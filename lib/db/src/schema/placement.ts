import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const placementTestsTable = pgTable("placement_tests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions"),
  status: text("status").notNull().default("draft"),
  timeLimitMinutes: integer("time_limit_minutes"),
  maxScore: integer("max_score").notNull().default(0),
  passScore: integer("pass_score"),
  showScoreImmediately: boolean("show_score_immediately").notNull().default(false),
  allowRetake: boolean("allow_retake").notNull().default(false),
  linkSlug: text("link_slug").notNull().unique(),
  linkActive: boolean("link_active").notNull().default(true),
  linkExpiresAt: timestamp("link_expires_at", { withTimezone: true }),
  notifyTeacherEmail: boolean("notify_teacher_email").notNull().default(true),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlacementTestSchema = createInsertSchema(placementTestsTable).omit({
  id: true, createdAt: true, updatedAt: true, linkSlug: true,
});
export type InsertPlacementTest = z.infer<typeof insertPlacementTestSchema>;
export type PlacementTest = typeof placementTestsTable.$inferSelect;

export const placementTestQuestionsTable = pgTable("placement_test_questions", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull().references(() => placementTestsTable.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  sourceType: text("source_type").notNull(),
  sourceId: integer("source_id"),
  type: text("type").notNull(),
  skill: text("skill"),
  level: text("level"),
  content: text("content").notNull(),
  options: jsonb("options"),
  correctAnswer: text("correct_answer"),
  audioUrl: text("audio_url"),
  videoUrl: text("video_url"),
  imageUrl: text("image_url"),
  passage: text("passage"),
  explanation: text("explanation"),
  metadata: jsonb("metadata"),
  points: integer("points").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlacementTestQuestion = typeof placementTestQuestionsTable.$inferSelect;

export const placementSubmissionsTable = pgTable("placement_submissions", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull().references(() => placementTestsTable.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull(),
  studentEmail: text("student_email").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  autoScore: integer("auto_score"),
  manualScore: integer("manual_score"),
  totalScore: integer("total_score"),
  gradingStatus: text("grading_status").notNull().default("pending"),
  teacherComment: text("teacher_comment"),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
  gradedBy: integer("graded_by").references(() => usersTable.id, { onDelete: "set null" }),
  resultSentAt: timestamp("result_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlacementSubmission = typeof placementSubmissionsTable.$inferSelect;

export const placementAnswersTable = pgTable("placement_answers", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => placementSubmissionsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => placementTestQuestionsTable.id, { onDelete: "cascade" }),
  studentAnswer: text("student_answer"),
  isCorrect: boolean("is_correct"),
  autoScore: integer("auto_score"),
  manualScore: integer("manual_score"),
  teacherComment: text("teacher_comment"),
  answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlacementAnswer = typeof placementAnswersTable.$inferSelect;
