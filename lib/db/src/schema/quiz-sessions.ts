import { pgTable, text, serial, timestamp, integer, jsonb, varchar } from "drizzle-orm/pg-core";
import { assignmentsTable } from "./assignments";
import { usersTable } from "./users";

export const quizSessionsTable = pgTable("quiz_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id),
  answers: jsonb("answers").notNull().default({}),
  flagged: jsonb("flagged").notNull().default([]),
  currentQuestion: integer("current_question").notNull().default(0),
  timeLeftSeconds: integer("time_left_seconds"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lastSavedAt: timestamp("last_saved_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("in_progress"),
});

export type QuizSession = typeof quizSessionsTable.$inferSelect;
