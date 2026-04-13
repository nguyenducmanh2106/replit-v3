import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  db, usersTable, badgesTable, userBadgesTable, learningStreaksTable,
  submissionsTable, courseMembersTable, fraudEventsTable
} from "@workspace/db";
import {
  ListBadgesResponse,
  GetLeaderboardQueryParams,
  GetLeaderboardResponse,
  GetMyStreakResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const BADGE_DEFINITIONS = [
  { key: "first_submission", name: "Bước Đầu Tiên", description: "Hoàn thành bài nộp đầu tiên", icon: "🎯", condition: "Nộp bài lần đầu tiên" },
  { key: "perfect_score", name: "Hoàn Hảo", description: "Đạt điểm tuyệt đối trong một bài thi", icon: "⭐", condition: "Đạt 100% điểm" },
  { key: "streak_7", name: "Học Không Nghỉ", description: "Học liên tục 7 ngày", icon: "🔥", condition: "Streak 7 ngày" },
  { key: "streak_30", name: "Kiên Trì", description: "Học liên tục 30 ngày", icon: "💪", condition: "Streak 30 ngày" },
  { key: "submissions_10", name: "Chăm Chỉ", description: "Hoàn thành 10 bài thi", icon: "📚", condition: "Nộp 10 bài" },
  { key: "submissions_50", name: "Siêu Năng Động", description: "Hoàn thành 50 bài thi", icon: "🚀", condition: "Nộp 50 bài" },
  { key: "avg_score_80", name: "Xuất Sắc", description: "Đạt điểm trung bình trên 80%", icon: "🏆", condition: "Điểm TB ≥ 80%" },
  { key: "avg_score_90", name: "Thiên Tài", description: "Đạt điểm trung bình trên 90%", icon: "🧠", condition: "Điểm TB ≥ 90%" },
];

async function seedBadges() {
  const existing = await db.select().from(badgesTable);
  if (existing.length < BADGE_DEFINITIONS.length) {
    for (const badge of BADGE_DEFINITIONS) {
      await db.insert(badgesTable).values(badge).onConflictDoNothing();
    }
  }
}

async function checkAndAwardBadges(userId: number) {
  await seedBadges();

  const [streakRow] = await db.select().from(learningStreaksTable).where(eq(learningStreaksTable.userId, userId));
  const currentStreak = streakRow?.currentStreak ?? 0;
  const longestStreak = streakRow?.longestStreak ?? 0;

  const submissions = await db.select().from(submissionsTable).where(
    and(eq(submissionsTable.studentId, userId), eq(submissionsTable.status, "graded"))
  );

  const submissionCount = submissions.length;
  const totalPercent = submissions.reduce((sum, s) => {
    const pct = s.totalPoints > 0 && s.score != null ? (s.score / s.totalPoints) * 100 : 0;
    return sum + pct;
  }, 0);
  const avgScore = submissionCount > 0 ? totalPercent / submissionCount : 0;
  const hasPerfect = submissions.some(s => s.totalPoints > 0 && s.score === s.totalPoints);

  const earnedBadges: string[] = [];
  if (submissionCount >= 1) earnedBadges.push("first_submission");
  if (hasPerfect) earnedBadges.push("perfect_score");
  if (longestStreak >= 7) earnedBadges.push("streak_7");
  if (longestStreak >= 30) earnedBadges.push("streak_30");
  if (submissionCount >= 10) earnedBadges.push("submissions_10");
  if (submissionCount >= 50) earnedBadges.push("submissions_50");
  if (avgScore >= 80) earnedBadges.push("avg_score_80");
  if (avgScore >= 90) earnedBadges.push("avg_score_90");

  const existingBadges = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, userId));
  const existingKeys = new Set(existingBadges.map(b => b.badgeKey));

  for (const key of earnedBadges) {
    if (!existingKeys.has(key)) {
      await db.insert(userBadgesTable).values({ userId, badgeKey: key });
    }
  }
}

async function updateStreak(userId: number) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);

  const [existing] = await db.select().from(learningStreaksTable).where(eq(learningStreaksTable.userId, userId));

  if (!existing) {
    await db.insert(learningStreaksTable).values({
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: now,
    });
    return;
  }

  const lastActivity = existing.lastActivityDate;
  if (!lastActivity) {
    await db.update(learningStreaksTable).set({
      currentStreak: 1,
      longestStreak: Math.max(1, existing.longestStreak),
      lastActivityDate: now,
    }).where(eq(learningStreaksTable.userId, userId));
    return;
  }

  const lastDate = new Date(lastActivity.getFullYear(), lastActivity.getMonth(), lastActivity.getDate());

  if (lastDate.getTime() === todayStart.getTime()) {
    return;
  }

  let newStreak: number;
  if (lastDate.getTime() === yesterdayStart.getTime()) {
    newStreak = existing.currentStreak + 1;
  } else {
    newStreak = 1;
  }

  await db.update(learningStreaksTable).set({
    currentStreak: newStreak,
    longestStreak: Math.max(newStreak, existing.longestStreak),
    lastActivityDate: now,
  }).where(eq(learningStreaksTable.userId, userId));
}

export { updateStreak, checkAndAwardBadges };

router.get("/gamification/badges", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await seedBadges();
  await checkAndAwardBadges(dbUser.id);

  const allBadges = await db.select().from(badgesTable);
  const earnedBadges = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, dbUser.id));
  const earnedMap = new Map(earnedBadges.map(b => [b.badgeKey, b.awardedAt]));

  const result = allBadges.map(badge => ({
    key: badge.key,
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    condition: badge.condition,
    earned: earnedMap.has(badge.key),
    awardedAt: earnedMap.get(badge.key)?.toISOString() ?? null,
  }));

  res.json(ListBadgesResponse.parse(result));
});

router.get("/gamification/leaderboard", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetLeaderboardQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = params.data.limit ?? 20;

  let studentIds: number[] = [];

  if (params.data.courseId) {
    const members = await db.select().from(courseMembersTable)
      .where(and(eq(courseMembersTable.courseId, params.data.courseId), eq(courseMembersTable.role, "student")));
    studentIds = members.map(m => m.userId);
  }

  const students = studentIds.length > 0
    ? await db.select().from(usersTable).where(and(eq(usersTable.role, "student"), inArray(usersTable.id, studentIds)))
    : await db.select().from(usersTable).where(eq(usersTable.role, "student"));

  const entries = await Promise.all(students.map(async (student) => {
    const subs = await db.select().from(submissionsTable).where(
      and(eq(submissionsTable.studentId, student.id), eq(submissionsTable.status, "graded"))
    );

    const totalScore = subs.reduce((sum, s) => sum + (s.score ?? 0), 0);
    const totalPct = subs.reduce((sum, s) => {
      const pct = s.totalPoints > 0 && s.score != null ? (s.score / s.totalPoints) * 100 : 0;
      return sum + pct;
    }, 0);
    const avgScore = subs.length > 0 ? Math.round(totalPct / subs.length * 10) / 10 : 0;

    const [streakRow] = await db.select().from(learningStreaksTable).where(eq(learningStreaksTable.userId, student.id));
    const badges = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, student.id));

    return {
      userId: student.id,
      userName: student.name,
      avatarUrl: student.avatarUrl ?? null,
      totalScore,
      submissionCount: subs.length,
      averageScore: avgScore,
      streak: streakRow?.currentStreak ?? 0,
      badgeCount: badges.length,
      isCurrentUser: student.id === dbUser.id,
    };
  }));

  entries.sort((a, b) => {
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    return b.submissionCount - a.submissionCount;
  });

  const limited = entries.slice(0, limit).map((e, idx) => ({ ...e, rank: idx + 1 }));

  res.json(GetLeaderboardResponse.parse(limited));
});

router.get("/gamification/streak", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [streakRow] = await db.select().from(learningStreaksTable).where(eq(learningStreaksTable.userId, dbUser.id));

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastActivity = streakRow?.lastActivityDate;
  const lastDate = lastActivity
    ? new Date(lastActivity.getFullYear(), lastActivity.getMonth(), lastActivity.getDate())
    : null;
  const todayCompleted = lastDate ? lastDate.getTime() === todayStart.getTime() : false;

  res.json(GetMyStreakResponse.parse({
    currentStreak: streakRow?.currentStreak ?? 0,
    longestStreak: streakRow?.longestStreak ?? 0,
    lastActivityDate: streakRow?.lastActivityDate?.toISOString() ?? null,
    todayCompleted,
  }));
});

export default router;
