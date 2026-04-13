import { Router, type IRouter } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, usersTable, submissionsTable, learningStreaksTable, userBadgesTable, submissionAnswersTable, questionsTable, assignmentQuestionsTable } from "@workspace/db";
import {
  GetDepartmentReportResponse,
  GetCompetencyMatrixResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const TEACHER_ROLES = ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"];

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

function scoreToLevel(pct: number): string {
  if (pct >= 90) return "C2";
  if (pct >= 80) return "C1";
  if (pct >= 70) return "B2";
  if (pct >= 60) return "B1";
  if (pct >= 50) return "A2";
  return "A1";
}

router.get("/enterprise/department-report", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!TEACHER_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Only admins can view enterprise reports" });
    return;
  }

  const org = dbUser.organization ?? "Tổ chức";

  const allStudents = await db.select().from(usersTable).where(eq(usersTable.role, "student"));

  const orgMap = new Map<string, typeof allStudents>();
  for (const student of allStudents) {
    const dept = student.organization ?? "Chưa phân phòng";
    if (!orgMap.has(dept)) orgMap.set(dept, []);
    orgMap.get(dept)!.push(student);
  }

  const departmentStats = await Promise.all([...orgMap.entries()].map(async ([dept, members]) => {
    const memberIds = members.map(m => m.id);
    const subs = memberIds.length > 0
      ? await db.select().from(submissionsTable).where(and(
          inArray(submissionsTable.studentId, memberIds),
          eq(submissionsTable.status, "graded")
        ))
      : [];

    const activeLearners = new Set(subs.map(s => s.studentId)).size;
    const totalPct = subs.reduce((sum, s) => {
      return sum + (s.totalPoints > 0 && s.score != null ? (s.score / s.totalPoints) * 100 : 0);
    }, 0);
    const avgScore = subs.length > 0 ? Math.round(totalPct / subs.length * 10) / 10 : 0;

    const certified = members.filter(m => {
      const memberSubs = subs.filter(s => s.studentId === m.id);
      const avg = memberSubs.length > 0
        ? memberSubs.reduce((sum, s) => sum + (s.score ?? 0), 0) / memberSubs.length
        : 0;
      return avg >= 80;
    }).length;

    return {
      department: dept,
      totalMembers: members.length,
      activeLearners,
      completionRate: members.length > 0 ? Math.round((activeLearners / members.length) * 100 * 10) / 10 : 0,
      averageScore: avgScore,
      totalSubmissions: subs.length,
      certifiedCount: certified,
    };
  }));

  const allSubs = await db.select().from(submissionsTable).where(eq(submissionsTable.status, "graded"));
  const totalPercent = allSubs.reduce((sum, s) =>
    sum + (s.totalPoints > 0 && s.score != null ? (s.score / s.totalPoints) * 100 : 0), 0);

  const topPerformers = await Promise.all(allStudents.slice(0, 5).map(async (student, idx) => {
    const subs = await db.select().from(submissionsTable).where(
      and(eq(submissionsTable.studentId, student.id), eq(submissionsTable.status, "graded"))
    );
    const totalScore = subs.reduce((sum, s) => sum + (s.score ?? 0), 0);
    const totalPct = subs.reduce((sum, s) =>
      sum + (s.totalPoints > 0 && s.score != null ? (s.score / s.totalPoints) * 100 : 0), 0);
    const avgScore = subs.length > 0 ? Math.round(totalPct / subs.length * 10) / 10 : 0;
    const [streakRow] = await db.select().from(learningStreaksTable).where(eq(learningStreaksTable.userId, student.id));
    const badges = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, student.id));

    return {
      rank: idx + 1,
      userId: student.id,
      userName: student.name,
      avatarUrl: student.avatarUrl ?? null,
      totalScore,
      submissionCount: subs.length,
      averageScore: avgScore,
      streak: streakRow?.currentStreak ?? 0,
      badgeCount: badges.length,
      isCurrentUser: false,
    };
  }));

  const activeLearnerCount = new Set(allSubs.map(s => s.studentId)).size;

  res.json(GetDepartmentReportResponse.parse({
    organization: org,
    reportDate: new Date().toISOString(),
    totalEmployees: allStudents.length,
    overallCompletionRate: allStudents.length > 0
      ? Math.round((activeLearnerCount / allStudents.length) * 100 * 10) / 10
      : 0,
    overallAverageScore: allSubs.length > 0
      ? Math.round(totalPercent / allSubs.length * 10) / 10
      : 0,
    departments: departmentStats,
    topPerformers,
  }));
});

router.get("/enterprise/competency-matrix", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!TEACHER_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Only admins can view competency matrix" });
    return;
  }

  const students = await db.select().from(usersTable).where(eq(usersTable.role, "student"));

  const matrix = await Promise.all(students.map(async (student) => {
    const subs = await db.select().from(submissionsTable).where(
      and(eq(submissionsTable.studentId, student.id), eq(submissionsTable.status, "graded"))
    );

    const skillScores: Record<string, { total: number; points: number }> = {
      reading: { total: 0, points: 0 },
      writing: { total: 0, points: 0 },
      listening: { total: 0, points: 0 },
      speaking: { total: 0, points: 0 },
    };

    for (const sub of subs) {
      const answers = await db.select({
        questionId: submissionAnswersTable.questionId,
        pointsEarned: submissionAnswersTable.pointsEarned,
      }).from(submissionAnswersTable).where(eq(submissionAnswersTable.submissionId, sub.id));

      for (const answer of answers) {
        const [aq] = await db.select({ questionId: assignmentQuestionsTable.questionId })
          .from(assignmentQuestionsTable)
          .where(and(
            eq(assignmentQuestionsTable.questionId, answer.questionId),
          ));

        const [question] = await db.select({ skill: questionsTable.skill, points: questionsTable.points })
          .from(questionsTable)
          .where(eq(questionsTable.id, answer.questionId));

        if (question && skillScores[question.skill] !== undefined) {
          skillScores[question.skill].total += answer.pointsEarned;
          skillScores[question.skill].points += question.points;
        }
      }
    }

    const skillPercentages: Record<string, number> = {};
    for (const [skill, { total, points }] of Object.entries(skillScores)) {
      skillPercentages[skill] = points > 0 ? Math.round((total / points) * 100 * 10) / 10 : 0;
    }

    const avgAll = Object.values(skillPercentages).reduce((a, b) => a + b, 0) / 4;

    return {
      userId: student.id,
      userName: student.name,
      department: student.organization ?? null,
      reading: skillPercentages.reading ?? 0,
      writing: skillPercentages.writing ?? 0,
      listening: skillPercentages.listening ?? 0,
      speaking: skillPercentages.speaking ?? 0,
      overallLevel: scoreToLevel(avgAll),
    };
  }));

  res.json(GetCompetencyMatrixResponse.parse(matrix));
});

export default router;
