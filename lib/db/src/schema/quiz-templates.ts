import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const quizTemplatesTable = pgTable("quiz_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQuizTemplateSchema = createInsertSchema(quizTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuizTemplate = z.infer<typeof insertQuizTemplateSchema>;
export type QuizTemplate = typeof quizTemplatesTable.$inferSelect;

export const quizTemplateQuestionsTable = pgTable("quiz_template_questions", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => quizTemplatesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  skill: text("skill").notNull(),
  level: text("level").notNull(),
  content: text("content").notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuizTemplateQuestionSchema = createInsertSchema(quizTemplateQuestionsTable).omit({ id: true, createdAt: true });
export type InsertQuizTemplateQuestion = z.infer<typeof insertQuizTemplateQuestionSchema>;
export type QuizTemplateQuestion = typeof quizTemplateQuestionsTable.$inferSelect;
