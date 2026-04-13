import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./users";

export const assignmentsTable = pgTable("assignments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  courseId: integer("course_id").references(() => coursesTable.id),
  teacherId: integer("teacher_id").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  timeLimitMinutes: integer("time_limit_minutes"),
  totalPoints: integer("total_points").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(1),
  allowReview: boolean("allow_review").notNull().default(false),
  autoGrade: boolean("auto_grade").notNull().default(false),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignmentsTable.$inferSelect;

export const assignmentQuestionsTable = pgTable("assignment_questions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id),
  questionId: integer("question_id").notNull(),
  type: text("type").notNull().default("mcq"),
  skill: text("skill").notNull().default("reading"),
  level: text("level").notNull().default("A1"),
  content: text("content").notNull().default(""),
  options: text("options"),
  correctAnswer: text("correct_answer"),
  audioUrl: text("audio_url"),
  videoUrl: text("video_url"),
  imageUrl: text("image_url"),
  passage: text("passage"),
  explanation: text("explanation"),
  metadata: text("metadata"),
  points: integer("points").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(0),
});

export const insertAssignmentQuestionSchema = createInsertSchema(assignmentQuestionsTable).omit({ id: true });
export type InsertAssignmentQuestion = z.infer<typeof insertAssignmentQuestionSchema>;
export type AssignmentQuestion = typeof assignmentQuestionsTable.$inferSelect;
