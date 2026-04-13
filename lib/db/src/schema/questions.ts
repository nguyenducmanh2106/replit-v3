import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
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
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
