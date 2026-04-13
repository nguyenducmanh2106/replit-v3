import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, scheduleEventsTable, coursesTable, courseMembersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireTeacherRole } from "../middlewares/requireRole";
import {
  CreateScheduleEventBody,
  CreateScheduleEventParams,
  DeleteScheduleEventParams,
} from "@workspace/api-zod";

const ADMIN_ROLES = ["system_admin", "center_admin", "school_admin", "enterprise_admin"];

async function isCourseMemberOrTeacher(userId: number, courseId: number, userRole: string): Promise<boolean> {
  if (ADMIN_ROLES.includes(userRole)) return true;
  const [course] = await db.select({ teacherId: coursesTable.teacherId }).from(coursesTable).where(eq(coursesTable.id, courseId));
  if (!course) return false;
  if (course.teacherId === userId) return true;
  const [member] = await db.select({ id: courseMembersTable.id }).from(courseMembersTable)
    .where(and(eq(courseMembersTable.courseId, courseId), eq(courseMembersTable.userId, userId)));
  return !!member;
}

const router: IRouter = Router();

router.get("/courses/:id/schedule", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const courseId = parseInt(String(req.params.id), 10);
  if (isNaN(courseId)) { res.status(400).json({ error: "Invalid course ID" }); return; }

  const hasAccess = await isCourseMemberOrTeacher(dbUser.id, courseId, dbUser.role);
  if (!hasAccess) { res.status(403).json({ error: "Forbidden" }); return; }

  const events = await db
    .select()
    .from(scheduleEventsTable)
    .where(eq(scheduleEventsTable.courseId, courseId))
    .orderBy(scheduleEventsTable.startAt);

  res.json(events.map(e => ({
    id: e.id,
    courseId: e.courseId,
    title: e.title,
    type: e.type,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    location: e.location ?? null,
    notes: e.notes ?? null,
    createdAt: e.createdAt.toISOString(),
  })));
});

router.post("/courses/:id/schedule", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const params = CreateScheduleEventParams.safeParse({ id: parseInt(String(req.params.id), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid course ID" }); return; }
  const courseId = params.data.id;

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  if (course.teacherId !== dbUser.id && !ADMIN_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = CreateScheduleEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [event] = await db.insert(scheduleEventsTable).values({
    courseId,
    title: parsed.data.title,
    type: parsed.data.type ?? "lesson",
    startAt: new Date(parsed.data.startAt),
    endAt: new Date(parsed.data.endAt),
    location: parsed.data.location ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();

  res.status(201).json({
    id: event!.id,
    courseId: event!.courseId,
    title: event!.title,
    type: event!.type,
    startAt: event!.startAt.toISOString(),
    endAt: event!.endAt.toISOString(),
    location: event!.location ?? null,
    notes: event!.notes ?? null,
    createdAt: event!.createdAt.toISOString(),
  });
});

router.delete("/courses/:id/schedule/:eventId", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const params = DeleteScheduleEventParams.safeParse({
    id: parseInt(String(req.params.id), 10),
    eventId: parseInt(String(req.params.eventId), 10),
  });
  if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }
  const { id: courseId, eventId } = params.data;

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  if (course.teacherId !== dbUser.id && !ADMIN_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(scheduleEventsTable).where(
    and(eq(scheduleEventsTable.id, eventId), eq(scheduleEventsTable.courseId, courseId))
  );
  res.sendStatus(204);
});

export default router;
