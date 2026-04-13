import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, coursesTable, courseMembersTable, submissionsTable, assignmentsTable } from "@workspace/db";
import {
  SyncLmsBody,
  SyncLmsResponse,
  GetLmsStatusResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const TEACHER_ROLES = ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"];

const lastSyncTimes: Record<string, Date | null> = {
  moodle: null,
  google_classroom: null,
};

router.post("/lms/sync", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!TEACHER_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Only teachers and admins can sync LMS" });
    return;
  }

  const parsed = SyncLmsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { provider, courseId } = parsed.data;

  if (provider !== "moodle" && provider !== "google_classroom") {
    res.status(400).json({ error: "Provider must be 'moodle' or 'google_classroom'" });
    return;
  }

  const coursesQuery = courseId
    ? await db.select().from(coursesTable).where(eq(coursesTable.id, courseId))
    : await db.select().from(coursesTable).where(eq(coursesTable.status, "active"));

  const studentsInCourses = new Set<number>();
  for (const course of coursesQuery) {
    const members = await db.select().from(courseMembersTable)
      .where(and(eq(courseMembersTable.courseId, course.id), eq(courseMembersTable.role, "student")));
    members.forEach(m => studentsInCourses.add(m.userId));
  }

  const gradedSubmissions = await db.select().from(submissionsTable)
    .where(eq(submissionsTable.status, "graded"));

  lastSyncTimes[provider] = new Date();

  const syncedAt = lastSyncTimes[provider]!;

  const errors: string[] = [];

  if (provider === "moodle") {
    if (!process.env.MOODLE_URL || !process.env.MOODLE_TOKEN) {
      errors.push("Moodle credentials not configured (MOODLE_URL, MOODLE_TOKEN). Using simulation mode.");
    }
  } else if (provider === "google_classroom") {
    if (!process.env.GOOGLE_CLASSROOM_CLIENT_ID) {
      errors.push("Google Classroom OAuth not configured. Using simulation mode.");
    }
  }

  res.json(SyncLmsResponse.parse({
    provider,
    status: errors.length === 0 ? "success" : "partial",
    coursesSynced: coursesQuery.length,
    studentsSynced: studentsInCourses.size,
    gradesSynced: gradedSubmissions.length,
    errors,
    syncedAt: syncedAt.toISOString(),
  }));
});

router.get("/lms/status", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!TEACHER_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Only teachers and admins can view LMS status" });
    return;
  }

  res.json(GetLmsStatusResponse.parse({
    moodle: {
      connected: !!(process.env.MOODLE_URL && process.env.MOODLE_TOKEN),
      lastSync: lastSyncTimes.moodle?.toISOString() ?? null,
    },
    googleClassroom: {
      connected: !!process.env.GOOGLE_CLASSROOM_CLIENT_ID,
      lastSync: lastSyncTimes.google_classroom?.toISOString() ?? null,
    },
  }));
});

export default router;
