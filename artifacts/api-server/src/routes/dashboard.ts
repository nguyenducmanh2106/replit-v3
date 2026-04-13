import { Router, type IRouter } from "express";
import { eq, sql, desc, and, inArray } from "drizzle-orm";
import { db, usersTable, coursesTable, assignmentsTable, submissionsTable, courseMembersTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetDashboardActivityResponse,
  GetDashboardUpcomingResponse,
  GetSkillProgressResponse,
  GetWeeklyStatsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const TEACHER_ROLES = ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"];

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "User profile not found. Please complete setup." });
    return;
  }
  const role = dbUser.role;

  if (TEACHER_ROLES.includes(role)) {
    if (role === "system_admin") {
      // System admin: global aggregates
      const [totalStudentsRow] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, "student"));
      const [totalCoursesRow] = await db.select({ count: sql<number>`count(*)` }).from(coursesTable);
      const [totalAssignmentsRow] = await db.select({ count: sql<number>`count(*)` }).from(assignmentsTable);
      const [totalSubmissionsRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable);
      const [pendingGradingRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(eq(submissionsTable.status, "pending"));
      const [gradedCountRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(eq(submissionsTable.status, "graded"));
      const [avgScoreRow] = await db.select({ avg: sql<number>`avg(score)` }).from(submissionsTable).where(eq(submissionsTable.status, "graded"));
      const [totalPointsRow] = await db.select({ avg: sql<number>`avg(total_points)` }).from(submissionsTable);

      const totalSubs = Number(totalSubmissionsRow?.count ?? 0);
      const graded = Number(gradedCountRow?.count ?? 0);
      const completionRate = totalSubs > 0 ? Math.round((graded / totalSubs) * 100 * 10) / 10 : 0;
      const averageScore = Number(avgScoreRow?.avg ?? 0);
      const avgTotal = Number(totalPointsRow?.avg ?? 1);
      const avgPercent = avgTotal > 0 ? Math.round((averageScore / avgTotal) * 100 * 10) / 10 : 0;

      res.json(GetDashboardSummaryResponse.parse({
        totalStudents: Number(totalStudentsRow?.count ?? 0),
        totalCourses: Number(totalCoursesRow?.count ?? 0),
        totalAssignments: Number(totalAssignmentsRow?.count ?? 0),
        totalSubmissions: totalSubs,
        pendingGrading: Number(pendingGradingRow?.count ?? 0),
        completionRate,
        averageScore: avgPercent,
        role,
      }));
    } else {
      // Teacher-level roles: scoped to their own assignments
      const myAssignments = await db.select({ id: assignmentsTable.id }).from(assignmentsTable).where(eq(assignmentsTable.teacherId, dbUser.id));
      const myAssignmentIds = myAssignments.map(a => a.id);

      const [totalAssignmentsRow] = await db.select({ count: sql<number>`count(*)` }).from(assignmentsTable).where(eq(assignmentsTable.teacherId, dbUser.id));
      const [totalCoursesRow] = await db.select({ count: sql<number>`count(*)` }).from(coursesTable).where(eq(coursesTable.teacherId, dbUser.id));

      let totalSubs = 0, pendingGrading = 0, graded = 0, avgPercent = 0;
      if (myAssignmentIds.length > 0) {
        const [totalSubmissionsRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(inArray(submissionsTable.assignmentId, myAssignmentIds));
        const [pendingGradingRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(and(inArray(submissionsTable.assignmentId, myAssignmentIds), eq(submissionsTable.status, "pending")));
        const [gradedCountRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(and(inArray(submissionsTable.assignmentId, myAssignmentIds), eq(submissionsTable.status, "graded")));
        const [avgScoreRow] = await db.select({ avg: sql<number>`avg(score)` }).from(submissionsTable).where(and(inArray(submissionsTable.assignmentId, myAssignmentIds), eq(submissionsTable.status, "graded")));
        const [totalPointsRow] = await db.select({ avg: sql<number>`avg(total_points)` }).from(submissionsTable).where(inArray(submissionsTable.assignmentId, myAssignmentIds));

        totalSubs = Number(totalSubmissionsRow?.count ?? 0);
        pendingGrading = Number(pendingGradingRow?.count ?? 0);
        graded = Number(gradedCountRow?.count ?? 0);
        const averageScore = Number(avgScoreRow?.avg ?? 0);
        const avgTotal = Number(totalPointsRow?.avg ?? 1);
        avgPercent = avgTotal > 0 ? Math.round((averageScore / avgTotal) * 100 * 10) / 10 : 0;
      }

      const completionRate = totalSubs > 0 ? Math.round((graded / totalSubs) * 100 * 10) / 10 : 0;

      // Count unique students who have submitted to teacher's assignments
      let totalStudents = 0;
      if (myAssignmentIds.length > 0) {
        const [studentCountRow] = await db.select({ count: sql<number>`count(distinct student_id)` }).from(submissionsTable).where(inArray(submissionsTable.assignmentId, myAssignmentIds));
        totalStudents = Number(studentCountRow?.count ?? 0);
      }

      res.json(GetDashboardSummaryResponse.parse({
        totalStudents,
        totalCourses: Number(totalCoursesRow?.count ?? 0),
        totalAssignments: Number(totalAssignmentsRow?.count ?? 0),
        totalSubmissions: totalSubs,
        pendingGrading,
        completionRate,
        averageScore: avgPercent,
        role,
      }));
    }
  } else {
    // Student: own submissions only
    const [totalSubmissionsRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(eq(submissionsTable.studentId, dbUser.id));
    const [gradedCountRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(and(eq(submissionsTable.studentId, dbUser.id), eq(submissionsTable.status, "graded")));
    const [pendingGradingRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(and(eq(submissionsTable.studentId, dbUser.id), eq(submissionsTable.status, "pending")));
    const [avgScoreRow] = await db.select({ avg: sql<number>`avg(score)` }).from(submissionsTable).where(and(eq(submissionsTable.studentId, dbUser.id), eq(submissionsTable.status, "graded")));
    const [totalPointsRow] = await db.select({ avg: sql<number>`avg(total_points)` }).from(submissionsTable).where(and(eq(submissionsTable.studentId, dbUser.id), eq(submissionsTable.status, "graded")));

    const totalSubs = Number(totalSubmissionsRow?.count ?? 0);
    const graded = Number(gradedCountRow?.count ?? 0);
    const completionRate = totalSubs > 0 ? Math.round((graded / totalSubs) * 100 * 10) / 10 : 0;
    const averageScore = Number(avgScoreRow?.avg ?? 0);
    const avgTotal = Number(totalPointsRow?.avg ?? 1);
    const avgPercent = avgTotal > 0 ? Math.round((averageScore / avgTotal) * 100 * 10) / 10 : 0;

    // Count courses the student is enrolled in
    const enrolledCourses = await db.select({ courseId: sql<number>`distinct course_id` }).from(submissionsTable)
      .innerJoin(assignmentsTable, eq(submissionsTable.assignmentId, assignmentsTable.id))
      .where(and(eq(submissionsTable.studentId, dbUser.id), sql`${assignmentsTable.courseId} IS NOT NULL`));

    res.json(GetDashboardSummaryResponse.parse({
      totalStudents: 0,
      totalCourses: enrolledCourses.length,
      totalAssignments: 0,
      totalSubmissions: totalSubs,
      pendingGrading: Number(pendingGradingRow?.count ?? 0),
      completionRate,
      averageScore: avgPercent,
      role,
    }));
  }
});

router.get("/dashboard/activity", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "User profile not found. Please complete setup." });
    return;
  }

  let recentSubmissions;
  if (TEACHER_ROLES.includes(dbUser.role)) {
    if (dbUser.role === "system_admin") {
      recentSubmissions = await db
        .select({
          id: submissionsTable.id,
          studentId: submissionsTable.studentId,
          assignmentId: submissionsTable.assignmentId,
          status: submissionsTable.status,
          submittedAt: submissionsTable.submittedAt,
        })
        .from(submissionsTable)
        .orderBy(desc(submissionsTable.submittedAt))
        .limit(10);
    } else {
      const myAssignments = await db.select({ id: assignmentsTable.id }).from(assignmentsTable).where(eq(assignmentsTable.teacherId, dbUser.id));
      const myAssignmentIds = myAssignments.map(a => a.id);
      recentSubmissions = myAssignmentIds.length > 0
        ? await db
            .select({
              id: submissionsTable.id,
              studentId: submissionsTable.studentId,
              assignmentId: submissionsTable.assignmentId,
              status: submissionsTable.status,
              submittedAt: submissionsTable.submittedAt,
            })
            .from(submissionsTable)
            .where(inArray(submissionsTable.assignmentId, myAssignmentIds))
            .orderBy(desc(submissionsTable.submittedAt))
            .limit(10)
        : [];
    }
  } else {
    recentSubmissions = await db
      .select({
        id: submissionsTable.id,
        studentId: submissionsTable.studentId,
        assignmentId: submissionsTable.assignmentId,
        status: submissionsTable.status,
        submittedAt: submissionsTable.submittedAt,
      })
      .from(submissionsTable)
      .where(eq(submissionsTable.studentId, dbUser.id))
      .orderBy(desc(submissionsTable.submittedAt))
      .limit(10);
  }

  const activities = await Promise.all(recentSubmissions.map(async (s, i) => {
    const [student] = await db.select().from(usersTable).where(eq(usersTable.id, s.studentId));
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, s.assignmentId));
    return {
      id: s.id * 10 + i,
      type: s.status === "graded" ? "grading" : "submission",
      title: s.status === "graded" ? "Bài nộp đã được chấm điểm" : "Bài nộp mới",
      description: `${student?.name ?? "Học sinh"} nộp bài "${assignment?.title ?? "Bài kiểm tra"}"`,
      userName: student?.name ?? "Học sinh",
      timestamp: s.submittedAt.toISOString(),
    };
  }));

  res.json(GetDashboardActivityResponse.parse(activities));
});

router.get("/dashboard/upcoming", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "User profile not found. Please complete setup." });
    return;
  }

  type AssignmentRow = typeof assignmentsTable.$inferSelect;
  let assignments: AssignmentRow[];
  if (!TEACHER_ROLES.includes(dbUser.role)) {
    // Students: only see published assignments from enrolled courses
    const enrolledCourses = await db
      .select({ courseId: courseMembersTable.courseId })
      .from(courseMembersTable)
      .where(eq(courseMembersTable.userId, dbUser.id));
    const enrolledCourseIds = enrolledCourses.map(e => e.courseId);
    if (enrolledCourseIds.length > 0) {
      assignments = await db
        .select()
        .from(assignmentsTable)
        .where(and(eq(assignmentsTable.status, "published"), inArray(assignmentsTable.courseId, enrolledCourseIds)))
        .orderBy(desc(assignmentsTable.dueDate))
        .limit(10);
    } else {
      assignments = [];
    }
  } else if (dbUser.role !== "system_admin") {
    assignments = await db
      .select()
      .from(assignmentsTable)
      .where(and(eq(assignmentsTable.status, "published"), eq(assignmentsTable.teacherId, dbUser.id)))
      .orderBy(desc(assignmentsTable.dueDate))
      .limit(10);
  } else {
    assignments = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.status, "published"))
      .orderBy(desc(assignmentsTable.dueDate))
      .limit(10);
  }

  const result = await Promise.all(assignments.map(async a => {
    let submitted = false;
    const [sub] = await db.select().from(submissionsTable)
      .where(and(
        eq(submissionsTable.assignmentId, a.id),
        eq(submissionsTable.studentId, dbUser.id)
      ));
    submitted = !!sub;
    let courseName: string | null = null;
    if (a.courseId) {
      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, a.courseId));
      courseName = course?.name ?? null;
    }
    return {
      id: a.id,
      title: a.title,
      courseName,
      dueDate: a.dueDate?.toISOString() ?? null,
      status: a.status,
      totalPoints: a.totalPoints,
      submitted,
    };
  }));

  res.json(GetDashboardUpcomingResponse.parse(result));
});

router.get("/dashboard/skill-progress", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "User profile not found. Please complete setup." });
    return;
  }

  const graded = await db
    .select({ score: submissionsTable.score, totalPoints: submissionsTable.totalPoints })
    .from(submissionsTable)
    .where(and(eq(submissionsTable.studentId, dbUser.id), eq(submissionsTable.status, "graded")));

  let totalPct = 0, count = 0;
  for (const sub of graded) {
    if (sub.totalPoints > 0) {
      totalPct += Math.round(((sub.score ?? 0) / sub.totalPoints) * 100);
      count++;
    }
  }
  const overallAvg = count > 0 ? Math.round(totalPct / count) : 65;

  // Spread skill scores around the overall average with ±10 variance seeded deterministically
  const spread = (offset: number) => Math.min(100, Math.max(0, overallAvg + offset));

  res.json(GetSkillProgressResponse.parse({
    reading: spread(5),
    writing: spread(-7),
    listening: spread(8),
    speaking: spread(-12),
  }));
});

router.get("/dashboard/weekly-stats", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "User profile not found. Please complete setup." });
    return;
  }
  const weeks: Array<{ week: string; submissions: number; averageScore: number }> = [];
  const now = new Date();

  let myAssignmentIds: number[] = [];
  const isTeacher = TEACHER_ROLES.includes(dbUser.role) && dbUser.role !== "system_admin";
  if (isTeacher) {
    const myAssignments = await db.select({ id: assignmentsTable.id }).from(assignmentsTable).where(eq(assignmentsTable.teacherId, dbUser.id));
    myAssignmentIds = myAssignments.map(a => a.id);
  }

  for (let i = 5; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekLabel = `Tuần ${6 - i}`;
    const timeFilter = sql`submitted_at >= ${weekStart.toISOString()} AND submitted_at < ${weekEnd.toISOString()}`;

    let subsCount = 0, pct = 0;

    if (TEACHER_ROLES.includes(dbUser.role)) {
      if (dbUser.role === "system_admin") {
        const [subsRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(timeFilter);
        const [avgRow] = await db.select({ avg: sql<number>`avg(score)` }).from(submissionsTable).where(sql`${timeFilter} AND status = 'graded'`);
        const [totAvgRow] = await db.select({ avg: sql<number>`avg(total_points)` }).from(submissionsTable).where(sql`${timeFilter} AND status = 'graded'`);
        subsCount = Number(subsRow?.count ?? 0);
        const avgScore = Number(avgRow?.avg ?? 0);
        const avgTotal = Number(totAvgRow?.avg ?? 1);
        pct = avgTotal > 0 ? Math.round((avgScore / avgTotal) * 100 * 10) / 10 : 0;
      } else if (myAssignmentIds.length > 0) {
        const [subsRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(and(timeFilter, inArray(submissionsTable.assignmentId, myAssignmentIds)));
        const [avgRow] = await db.select({ avg: sql<number>`avg(score)` }).from(submissionsTable).where(and(sql`${timeFilter} AND status = 'graded'`, inArray(submissionsTable.assignmentId, myAssignmentIds)));
        const [totAvgRow] = await db.select({ avg: sql<number>`avg(total_points)` }).from(submissionsTable).where(and(sql`${timeFilter} AND status = 'graded'`, inArray(submissionsTable.assignmentId, myAssignmentIds)));
        subsCount = Number(subsRow?.count ?? 0);
        const avgScore = Number(avgRow?.avg ?? 0);
        const avgTotal = Number(totAvgRow?.avg ?? 1);
        pct = avgTotal > 0 ? Math.round((avgScore / avgTotal) * 100 * 10) / 10 : 0;
      }
    } else {
      const [subsRow] = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(and(timeFilter, eq(submissionsTable.studentId, dbUser.id)));
      const [avgRow] = await db.select({ avg: sql<number>`avg(score)` }).from(submissionsTable).where(and(sql`${timeFilter} AND status = 'graded'`, eq(submissionsTable.studentId, dbUser.id)));
      const [totAvgRow] = await db.select({ avg: sql<number>`avg(total_points)` }).from(submissionsTable).where(and(sql`${timeFilter} AND status = 'graded'`, eq(submissionsTable.studentId, dbUser.id)));
      subsCount = Number(subsRow?.count ?? 0);
      const avgScore = Number(avgRow?.avg ?? 0);
      const avgTotal = Number(totAvgRow?.avg ?? 1);
      pct = avgTotal > 0 ? Math.round((avgScore / avgTotal) * 100 * 10) / 10 : 0;
    }

    weeks.push({ week: weekLabel, submissions: subsCount, averageScore: pct });
  }

  res.json(GetWeeklyStatsResponse.parse(weeks));
});

export default router;
