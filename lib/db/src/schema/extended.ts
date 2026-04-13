import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable, usersTable } from "./users";
import { submissionsTable } from "./submissions";
import { assignmentsTable } from "./assignments";
import { questionsTable } from "./questions";

export const scheduleEventsTable = pgTable("schedule_events", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id),
  title: text("title").notNull(),
  type: text("type").notNull().default("lesson"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScheduleEventSchema = createInsertSchema(scheduleEventsTable).omit({ id: true, createdAt: true });
export type InsertScheduleEvent = z.infer<typeof insertScheduleEventSchema>;
export type ScheduleEvent = typeof scheduleEventsTable.$inferSelect;

export const courseDocumentsTable = pgTable("course_documents", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id),
  uploadedBy: integer("uploaded_by").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  url: text("url").notNull(),
  objectPath: text("object_path").unique(),
  size: integer("size"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCourseDocumentSchema = createInsertSchema(courseDocumentsTable).omit({ id: true, createdAt: true });
export type InsertCourseDocument = z.infer<typeof insertCourseDocumentSchema>;
export type CourseDocument = typeof courseDocumentsTable.$inferSelect;

export const rubricsTable = pgTable("rubrics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  skill: text("skill").notNull(),
  description: text("description"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRubricSchema = createInsertSchema(rubricsTable).omit({ id: true, createdAt: true });
export type InsertRubric = z.infer<typeof insertRubricSchema>;
export type Rubric = typeof rubricsTable.$inferSelect;

export const rubricCriteriaTable = pgTable("rubric_criteria", {
  id: serial("id").primaryKey(),
  rubricId: integer("rubric_id").notNull().references(() => rubricsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  maxPoints: real("max_points").notNull().default(10),
  orderIndex: integer("order_index").notNull().default(0),
});

export const insertRubricCriterionSchema = createInsertSchema(rubricCriteriaTable).omit({ id: true });
export type InsertRubricCriterion = z.infer<typeof insertRubricCriterionSchema>;
export type RubricCriterion = typeof rubricCriteriaTable.$inferSelect;

export const answerAnnotationsTable = pgTable("answer_annotations", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissionsTable.id),
  questionId: integer("question_id").notNull().references(() => questionsTable.id),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  startOffset: integer("start_offset").notNull(),
  endOffset: integer("end_offset").notNull(),
  comment: text("comment"),
  color: text("color").notNull().default("yellow"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnswerAnnotationSchema = createInsertSchema(answerAnnotationsTable).omit({ id: true, createdAt: true });
export type InsertAnswerAnnotation = z.infer<typeof insertAnswerAnnotationSchema>;
export type AnswerAnnotation = typeof answerAnnotationsTable.$inferSelect;

export const rubricGradesTable = pgTable("rubric_grades", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissionsTable.id),
  criterionId: integer("criterion_id").notNull().references(() => rubricCriteriaTable.id),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  score: real("score").notNull().default(0),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRubricGradeSchema = createInsertSchema(rubricGradesTable).omit({ id: true, createdAt: true });
export type InsertRubricGrade = z.infer<typeof insertRubricGradeSchema>;
export type RubricGrade = typeof rubricGradesTable.$inferSelect;

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: integer("entity_id"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;

export const systemSettingsTable = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSystemSettingSchema = createInsertSchema(systemSettingsTable).omit({ id: true, updatedAt: true });
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettingsTable.$inferSelect;
