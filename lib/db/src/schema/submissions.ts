import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assignmentsTable } from "./assignments";
import { usersTable } from "./users";

export const submissionsTable = pgTable("submissions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id),
  studentId: integer("student_id").notNull().references(() => usersTable.id),
  score: real("score"),
  totalPoints: integer("total_points").notNull().default(0),
  status: text("status").notNull().default("pending"),
  feedback: text("feedback"),
  isFinal: boolean("is_final").notNull().default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
});

export const insertSubmissionSchema = createInsertSchema(submissionsTable).omit({ id: true, submittedAt: true });
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissionsTable.$inferSelect;

export const submissionAnswersTable = pgTable("submission_answers", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissionsTable.id),
  questionId: integer("question_id").notNull(),
  answer: text("answer").notNull(),
  isCorrect: text("is_correct"),
  pointsEarned: real("points_earned").notNull().default(0),
  feedback: text("feedback"),
});

export const insertSubmissionAnswerSchema = createInsertSchema(submissionAnswersTable).omit({ id: true });
export type InsertSubmissionAnswer = z.infer<typeof insertSubmissionAnswerSchema>;
export type SubmissionAnswer = typeof submissionAnswersTable.$inferSelect;
