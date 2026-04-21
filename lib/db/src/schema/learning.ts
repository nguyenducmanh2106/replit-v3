import { pgTable, text, serial, timestamp, integer, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable, usersTable } from "./users";

export const chaptersTable = pgTable("chapters", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertChapterSchema = createInsertSchema(chaptersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type Chapter = typeof chaptersTable.$inferSelect;

export const lessonsTable = pgTable("lessons", {
  id: serial("id").primaryKey(),
  chapterId: integer("chapter_id").notNull().references(() => chaptersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug"),
  orderIndex: integer("order_index").notNull().default(0),
  includeInPreview: boolean("include_in_preview").notNull().default(false),
  durationMinutes: integer("duration_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLessonSchema = createInsertSchema(lessonsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessonsTable.$inferSelect;

// lesson_blocks: type-discriminated content blocks (Notion/Frappe style)
// type: 'heading' | 'text' | 'youtube' | 'upload' | 'quiz' | 'assignment'
// data shape per type:
//   heading:    { text: string, level: 1|2|3 }
//   text:       { html: string }
//   youtube:    { url: string, videoId: string }
//   upload:     { url: string, name: string, mimeType: string, size: number, kind: 'pdf'|'video'|'image'|'audio'|'other' }
//   quiz:       { quizTemplateId: number }
//   assignment: { assignmentId: number }
export const lessonBlocksTable = pgTable("lesson_blocks", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").notNull().references(() => lessonsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  data: jsonb("data").notNull().default({}),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLessonBlockSchema = createInsertSchema(lessonBlocksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLessonBlock = z.infer<typeof insertLessonBlockSchema>;
export type LessonBlock = typeof lessonBlocksTable.$inferSelect;

export const lessonProgressTable = pgTable(
  "lesson_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id").notNull().references(() => lessonsTable.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqUserLesson: unique("uniq_user_lesson").on(t.userId, t.lessonId),
  })
);

export const insertLessonProgressSchema = createInsertSchema(lessonProgressTable).omit({ id: true, completedAt: true });
export type InsertLessonProgress = z.infer<typeof insertLessonProgressSchema>;
export type LessonProgress = typeof lessonProgressTable.$inferSelect;

export const certificatesTable = pgTable(
  "certificates",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    certificateNo: text("certificate_no").notNull().unique(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqUserCourse: unique("uniq_user_course_cert").on(t.userId, t.courseId),
  })
);

export const insertCertificateSchema = createInsertSchema(certificatesTable).omit({ id: true, issuedAt: true });
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificatesTable.$inferSelect;
