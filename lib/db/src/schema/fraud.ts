import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { submissionsTable } from "./submissions";
import { assignmentsTable } from "./assignments";

export const fraudEventsTable = pgTable("fraud_events", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").references(() => submissionsTable.id),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id),
  studentId: integer("student_id").notNull().references(() => usersTable.id),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("low"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFraudEventSchema = createInsertSchema(fraudEventsTable).omit({ id: true, createdAt: true });
export type InsertFraudEvent = z.infer<typeof insertFraudEventSchema>;
export type FraudEvent = typeof fraudEventsTable.$inferSelect;
