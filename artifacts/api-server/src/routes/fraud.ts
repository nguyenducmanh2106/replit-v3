import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, fraudEventsTable, usersTable, assignmentsTable, submissionsTable } from "@workspace/db";
import {
  ReportFraudEventBody,
  ListFraudEventsResponseItem,
  ListFraudEventsQueryParams,
  ListFraudEventsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const TEACHER_ROLES = ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"];

async function enrichFraudEvent(event: typeof fraudEventsTable.$inferSelect) {
  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, event.studentId));
  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, event.assignmentId));
  return {
    id: event.id,
    submissionId: event.submissionId ?? null,
    assignmentId: event.assignmentId,
    studentId: event.studentId,
    studentName: student?.name ?? "Unknown",
    assignmentTitle: assignment?.title ?? "Unknown",
    eventType: event.eventType,
    severity: event.severity,
    details: event.details ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}

router.post("/fraud/report", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = ReportFraudEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { assignmentId, submissionId, eventType, severity, details } = parsed.data;

  const [event] = await db.insert(fraudEventsTable).values({
    assignmentId,
    submissionId: submissionId ?? null,
    studentId: dbUser.id,
    eventType,
    severity: severity ?? "low",
    details: details ?? null,
  }).returning();

  const enriched = await enrichFraudEvent(event!);
  res.status(201).json(ListFraudEventsResponseItem.parse(enriched));
});

router.get("/fraud/events", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!TEACHER_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Only teachers and admins can view fraud events" });
    return;
  }

  const params = ListFraudEventsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [];
  if (params.data.assignmentId) conditions.push(eq(fraudEventsTable.assignmentId, params.data.assignmentId));
  if (params.data.studentId) conditions.push(eq(fraudEventsTable.studentId, params.data.studentId));

  const events = conditions.length > 0
    ? await db.select().from(fraudEventsTable).where(and(...conditions))
    : await db.select().from(fraudEventsTable);

  const enriched = await Promise.all(events.map(enrichFraudEvent));
  res.json(ListFraudEventsResponse.parse(enriched));
});

export default router;
