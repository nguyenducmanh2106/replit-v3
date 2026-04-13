import { Router, type IRouter } from "express";
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  db, submissionsTable,
  assignmentsTable, usersTable, coursesTable,
  courseMembersTable, questionsTable, assignmentQuestionsTable
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  GetCourseReportParams,
  GetStudentReportParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const TEACHER_ROLES = ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"];

async function computeSkillAverages(submissionIds: number[]): Promise<{
  reading: number; writing: number; listening: number; speaking: number;
}> {
  if (submissionIds.length === 0) return { reading: 0, writing: 0, listening: 0, speaking: 0 };

  const skills: Record<string, number[]> = { reading: [], writing: [], listening: [], speaking: [] };

  const gradedSubs = await db
    .select({
      id: submissionsTable.id,
      assignmentId: submissionsTable.assignmentId,
      score: submissionsTable.score,
      totalPoints: submissionsTable.totalPoints,
    })
    .from(submissionsTable)
    .where(and(inArray(submissionsTable.id, submissionIds), eq(submissionsTable.status, "graded")));

  for (const s of gradedSubs) {
    if (s.score == null || s.totalPoints <= 0) continue;
    const aqRows = await db
      .select({ questionId: assignmentQuestionsTable.questionId })
      .from(assignmentQuestionsTable)
      .where(eq(assignmentQuestionsTable.assignmentId, s.assignmentId));

    for (const aq of aqRows) {
      const [q] = await db.select({ skill: questionsTable.skill }).from(questionsTable).where(eq(questionsTable.id, aq.questionId));
      if (q?.skill && skills[q.skill] !== undefined) {
        skills[q.skill]!.push((s.score / s.totalPoints) * 100);
      }
    }
  }

  const calcAvg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
  return {
    reading: calcAvg(skills.reading!),
    writing: calcAvg(skills.writing!),
    listening: calcAvg(skills.listening!),
    speaking: calcAvg(skills.speaking!),
  };
}

router.get("/reports/overview", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!TEACHER_ROLES.includes(dbUser.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  let courseQuery;
  if (dbUser.role === "system_admin") {
    courseQuery = await db.select({ id: coursesTable.id }).from(coursesTable);
  } else {
    courseQuery = await db.select({ id: coursesTable.id }).from(coursesTable).where(eq(coursesTable.teacherId, dbUser.id));
  }
  const courseIds = courseQuery.map(c => c.id);
  const totalCourses = courseIds.length;

  const studentSet = new Set<number>();
  for (const cid of courseIds) {
    const members = await db.select({ userId: courseMembersTable.userId }).from(courseMembersTable)
      .where(and(eq(courseMembersTable.courseId, cid), eq(courseMembersTable.role, "student")));
    members.forEach(m => studentSet.add(m.userId));
  }
  const totalStudents = studentSet.size;

  let allSubs: { id: number; score: number | null; totalPoints: number; status: string }[] = [];
  if (courseIds.length > 0) {
    const assignments = await db.select({ id: assignmentsTable.id }).from(assignmentsTable)
      .where(inArray(assignmentsTable.courseId, courseIds));
    if (assignments.length > 0) {
      const assignmentIds = assignments.map(a => a.id);
      allSubs = await db.select({
        id: submissionsTable.id,
        score: submissionsTable.score,
        totalPoints: submissionsTable.totalPoints,
        status: submissionsTable.status,
      }).from(submissionsTable).where(inArray(submissionsTable.assignmentId, assignmentIds));
    }
  }

  const totalSubmissions = allSubs.length;
  const graded = allSubs.filter(s => s.status === "graded" && s.score != null);
  const averageScore = graded.length > 0
    ? Math.round((graded.reduce((acc, s) => acc + (s.score! / s.totalPoints) * 100, 0) / graded.length) * 10) / 10
    : 0;
  const pendingGrading = allSubs.filter(s => s.status === "pending").length;

  const skillAverages = await computeSkillAverages(allSubs.map(s => s.id));

  const courseComparison = await Promise.all(courseIds.map(async (cid) => {
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, cid));
    const studentCount = (await db.select({ userId: courseMembersTable.userId }).from(courseMembersTable)
      .where(and(eq(courseMembersTable.courseId, cid), eq(courseMembersTable.role, "student")))).length;

    const courseAssignments = await db.select({ id: assignmentsTable.id }).from(assignmentsTable)
      .where(eq(assignmentsTable.courseId, cid));
    const courseAssignmentIds = courseAssignments.map(a => a.id);
    const courseSubs = courseAssignmentIds.length > 0
      ? await db.select({ score: submissionsTable.score, totalPoints: submissionsTable.totalPoints, status: submissionsTable.status })
        .from(submissionsTable).where(inArray(submissionsTable.assignmentId, courseAssignmentIds))
      : [];

    const gradedSubs = courseSubs.filter(s => s.status === "graded" && s.score != null);
    const avgScore = gradedSubs.length > 0
      ? Math.round((gradedSubs.reduce((a, s) => a + (s.score! / s.totalPoints) * 100, 0) / gradedSubs.length) * 10) / 10
      : 0;
    const completionRate = studentCount > 0 && courseAssignments.length > 0
      ? Math.round((courseSubs.length / (studentCount * courseAssignments.length)) * 100 * 10) / 10
      : 0;

    return {
      courseId: cid,
      courseName: course?.name ?? "",
      studentCount,
      submissionCount: courseSubs.length,
      averageScore: avgScore,
      completionRate,
    };
  }));

  res.json({
    totalCourses,
    totalStudents,
    totalSubmissions,
    averageScore,
    pendingGrading,
    skillAverages,
    courseComparison,
  });
});

router.get("/reports/course/:courseId", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!TEACHER_ROLES.includes(dbUser.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const params = GetCourseReportParams.safeParse({ courseId: parseInt(String(req.params.courseId), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid course ID" }); return; }
  const courseId = params.data.courseId;

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  if (dbUser.role !== "system_admin" && course.teacherId !== dbUser.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const members = await db
    .select({ userId: courseMembersTable.userId, name: usersTable.name })
    .from(courseMembersTable)
    .innerJoin(usersTable, eq(courseMembersTable.userId, usersTable.id))
    .where(and(eq(courseMembersTable.courseId, courseId), eq(courseMembersTable.role, "student")));

  const studentCount = members.length;

  const assignments = await db.select({ id: assignmentsTable.id }).from(assignmentsTable)
    .where(eq(assignmentsTable.courseId, courseId));
  const assignmentIds = assignments.map(a => a.id);

  const subs = assignmentIds.length > 0
    ? await db.select().from(submissionsTable).where(inArray(submissionsTable.assignmentId, assignmentIds))
    : [];

  const gradedSubs = subs.filter(s => s.status === "graded" && s.score != null);
  const percentages = gradedSubs.map(s => (s.score! / s.totalPoints) * 100);

  const averageScore = percentages.length > 0
    ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 10) / 10
    : 0;

  const sorted = [...percentages].sort((a, b) => a - b);
  const medianScore = sorted.length > 0
    ? sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
      : sorted[Math.floor(sorted.length / 2)]!
    : 0;

  const passRate = percentages.length > 0
    ? Math.round((percentages.filter(p => p >= 50).length / percentages.length) * 100 * 10) / 10
    : 0;

  const bins = [
    { range: "0-20", low: 0, high: 20 },
    { range: "20-40", low: 20, high: 40 },
    { range: "40-60", low: 40, high: 60 },
    { range: "60-80", low: 60, high: 80 },
    { range: "80-100", low: 80, high: 100 },
  ];
  const scoreDistribution = bins.map(({ range, low, high }) => ({
    range,
    count: percentages.filter(p => p >= low && (high === 100 ? p <= high : p < high)).length,
  }));

  const studentScores = await Promise.all(members.map(async (m) => {
    const studentSubs = subs.filter(s => s.studentId === m.userId && s.status === "graded" && s.score != null);
    const avgPct = studentSubs.length > 0
      ? Math.round((studentSubs.reduce((a, s) => a + (s.score! / s.totalPoints) * 100, 0) / studentSubs.length) * 10) / 10
      : 0;
    const avgScore = studentSubs.length > 0
      ? Math.round((studentSubs.reduce((a, s) => a + s.score!, 0) / studentSubs.length) * 10) / 10
      : 0;
    return {
      studentId: m.userId,
      studentName: m.name,
      totalSubmissions: studentSubs.length,
      averageScore: avgScore,
      averagePercentage: avgPct,
    };
  }));

  const skillAverages = await computeSkillAverages(subs.map(s => s.id));

  res.json({
    courseId,
    courseName: course.name,
    studentCount,
    submissionCount: subs.length,
    averageScore,
    medianScore: Math.round(medianScore * 10) / 10,
    passRate,
    skillAverages,
    scoreDistribution,
    studentScores,
  });
});

router.get("/reports/student/:studentId", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = GetStudentReportParams.safeParse({ studentId: parseInt(String(req.params.studentId), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid student ID" }); return; }
  const studentId = params.data.studentId;

  const isAdmin = ["system_admin", "center_admin", "school_admin", "enterprise_admin"].includes(dbUser.role);
  const isSelf = dbUser.id === studentId;

  if (!isSelf && !TEACHER_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  if (!isSelf && !isAdmin) {
    const teacherCourseIds = (await db.select({ id: coursesTable.id }).from(coursesTable).where(eq(coursesTable.teacherId, dbUser.id))).map(c => c.id);
    if (teacherCourseIds.length === 0) { res.status(403).json({ error: "Forbidden" }); return; }
    const [membership] = await db.select({ id: courseMembersTable.id }).from(courseMembersTable)
      .where(and(eq(courseMembersTable.userId, studentId), inArray(courseMembersTable.courseId, teacherCourseIds)));
    if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }
  }

  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, studentId));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const subs = await db.select({
    id: submissionsTable.id,
    assignmentId: submissionsTable.assignmentId,
    score: submissionsTable.score,
    totalPoints: submissionsTable.totalPoints,
    status: submissionsTable.status,
    submittedAt: submissionsTable.submittedAt,
  }).from(submissionsTable).where(eq(submissionsTable.studentId, studentId));

  const graded = subs.filter(s => s.status === "graded" && s.score != null);
  const averageScore = graded.length > 0
    ? Math.round((graded.reduce((a, s) => a + s.score!, 0) / graded.length) * 10) / 10
    : 0;
  const averagePercentage = graded.length > 0
    ? Math.round((graded.reduce((a, s) => a + (s.score! / s.totalPoints) * 100, 0) / graded.length) * 10) / 10
    : 0;

  const scoreHistory = await Promise.all(subs.map(async s => {
    const [assignment] = await db.select({ title: assignmentsTable.title }).from(assignmentsTable).where(eq(assignmentsTable.id, s.assignmentId));
    const percentage = s.score != null && s.totalPoints > 0
      ? Math.round((s.score / s.totalPoints) * 100 * 10) / 10
      : null;
    return {
      assignmentId: s.assignmentId,
      assignmentTitle: assignment?.title ?? "",
      score: s.score ?? null,
      totalPoints: s.totalPoints,
      percentage,
      submittedAt: s.submittedAt.toISOString(),
    };
  }));

  const courseMap: Record<number, { courseId: number | null; courseName: string | null; scores: number[]; count: number }> = {};
  for (const s of subs) {
    const [assignment] = await db.select({ courseId: assignmentsTable.courseId }).from(assignmentsTable).where(eq(assignmentsTable.id, s.assignmentId));
    const cid = assignment?.courseId ?? 0;
    if (!courseMap[cid]) {
      let courseName: string | null = null;
      if (assignment?.courseId) {
        const [course] = await db.select({ name: coursesTable.name }).from(coursesTable).where(eq(coursesTable.id, assignment.courseId));
        courseName = course?.name ?? null;
      }
      courseMap[cid] = { courseId: assignment?.courseId ?? null, courseName, scores: [], count: 0 };
    }
    courseMap[cid]!.count++;
    if (s.status === "graded" && s.score != null && s.totalPoints > 0) {
      courseMap[cid]!.scores.push((s.score / s.totalPoints) * 100);
    }
  }

  const courseBreakdown = Object.values(courseMap).map(cb => ({
    courseId: cb.courseId,
    courseName: cb.courseName,
    averageScore: cb.scores.length > 0 ? Math.round((cb.scores.reduce((a, b) => a + b, 0) / cb.scores.length) * 10) / 10 : 0,
    submissionCount: cb.count,
  }));

  const skillAverages = await computeSkillAverages(subs.map(s => s.id));

  res.json({
    studentId,
    studentName: student.name,
    totalSubmissions: subs.length,
    averageScore,
    averagePercentage,
    skillAverages,
    scoreHistory,
    courseBreakdown,
  });
});

export default router;
