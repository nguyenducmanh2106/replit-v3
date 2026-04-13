import { Router, type IRouter } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, assignmentsTable, assignmentQuestionsTable, questionsTable, coursesTable, submissionsTable, courseMembersTable, quizTemplatesTable, quizTemplateQuestionsTable } from "@workspace/db";
import {
  ListAssignmentsQueryParams,
  ListAssignmentsResponse,
  CreateAssignmentBody,
  GetAssignmentParams,
  GetAssignmentResponse,
  UpdateAssignmentParams,
  UpdateAssignmentBody,
  UpdateAssignmentResponse,
  DeleteAssignmentParams,
  AddQuestionToAssignmentBody,
  AddQuestionToAssignmentParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireTeacherRole, isTeacherOrAdmin } from "../middlewares/requireRole";

const router: IRouter = Router();

async function recalcTotalPoints(assignmentId: number) {
  const rows = await db.select({ pts: assignmentQuestionsTable.points }).from(assignmentQuestionsTable).where(eq(assignmentQuestionsTable.assignmentId, assignmentId));
  const total = rows.reduce((s, r) => s + r.pts, 0);
  await db.update(assignmentsTable).set({ totalPoints: total }).where(eq(assignmentsTable.id, assignmentId));
}

async function getAssignmentSummary(id: number) {
  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, id));
  if (!assignment) return null;
  const questionCount = await db.select({ count: sql<number>`count(*)` }).from(assignmentQuestionsTable).where(eq(assignmentQuestionsTable.assignmentId, id));
  const submissionCount = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(eq(submissionsTable.assignmentId, id));
  let courseName: string | null = null;
  if (assignment.courseId) {
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, assignment.courseId));
    courseName = course?.name ?? null;
  }
  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description ?? null,
    courseId: assignment.courseId ?? null,
    courseName,
    teacherId: assignment.teacherId,
    dueDate: assignment.dueDate?.toISOString() ?? null,
    startTime: assignment.startTime?.toISOString() ?? null,
    endTime: assignment.endTime?.toISOString() ?? null,
    timeLimitMinutes: assignment.timeLimitMinutes ?? null,
    totalPoints: assignment.totalPoints,
    questionCount: Number(questionCount[0]?.count ?? 0),
    maxAttempts: assignment.maxAttempts,
    allowReview: assignment.allowReview,
    autoGrade: assignment.autoGrade,
    status: assignment.status,
    submissionCount: Number(submissionCount[0]?.count ?? 0),
    createdAt: assignment.createdAt.toISOString(),
  };
}

router.get("/assignments", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = ListAssignmentsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  type AssignmentRow = typeof assignmentsTable.$inferSelect;
  let assignments: AssignmentRow[];

  if (!isTeacherOrAdmin(dbUser.role)) {
    const enrolledCourses = await db.select({ courseId: courseMembersTable.courseId }).from(courseMembersTable).where(eq(courseMembersTable.userId, dbUser.id));
    const enrolledCourseIds = enrolledCourses.map(e => e.courseId);
    const conditions = [eq(assignmentsTable.status, "published")];
    if (params.data.courseId) conditions.push(eq(assignmentsTable.courseId, params.data.courseId));
    if (params.data.status) conditions.push(eq(assignmentsTable.status, params.data.status));
    assignments = enrolledCourseIds.length > 0
      ? await db.select().from(assignmentsTable).where(and(...conditions, inArray(assignmentsTable.courseId, enrolledCourseIds)))
      : [];
  } else {
    const conditions = [];
    if (params.data.courseId) conditions.push(eq(assignmentsTable.courseId, params.data.courseId));
    if (params.data.status) conditions.push(eq(assignmentsTable.status, params.data.status));
    if (dbUser.role !== "system_admin") conditions.push(eq(assignmentsTable.teacherId, dbUser.id));
    assignments = conditions.length > 0
      ? await db.select().from(assignmentsTable).where(and(...conditions))
      : await db.select().from(assignmentsTable);
  }

  const result = await Promise.all(assignments.map(a => getAssignmentSummary(a.id)));
  res.json(ListAssignmentsResponse.parse(result.filter(Boolean)));
});

router.post("/assignments", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const parsed = CreateAssignmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "User not found" }); return; }

  if (parsed.data.courseId) {
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, parsed.data.courseId));
    if (!course) { res.status(404).json({ error: "Course not found" }); return; }
    if (course.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
      res.status(403).json({ error: "Forbidden: you do not own this course" }); return;
    }
  }

  const [assignment] = await db.insert(assignmentsTable).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    courseId: parsed.data.courseId ?? null,
    teacherId: dbUser.id,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : null,
    endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : null,
    timeLimitMinutes: parsed.data.timeLimitMinutes ?? null,
    maxAttempts: parsed.data.maxAttempts ?? 1,
    allowReview: parsed.data.allowReview ?? false,
    autoGrade: parsed.data.autoGrade ?? false,
    status: parsed.data.status ?? "draft",
    totalPoints: 0,
  }).returning();
  const summary = await getAssignmentSummary(assignment.id);
  res.status(201).json(summary);
});

router.get("/assignments/:id", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const includeAnswer = isTeacherOrAdmin(dbUser.role);

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetAssignmentParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, params.data.id));
  if (!assignment) { res.status(404).json({ error: "Assignment not found" }); return; }

  if (!includeAnswer) {
    if (assignment.status !== "published") { res.status(403).json({ error: "Forbidden: assignment is not published" }); return; }
    if (assignment.courseId) {
      const [membership] = await db.select().from(courseMembersTable).where(
        and(eq(courseMembersTable.courseId, assignment.courseId), eq(courseMembersTable.userId, dbUser.id))
      );
      if (!membership) { res.status(403).json({ error: "Forbidden: you are not enrolled in this course" }); return; }
    }
  }

  const aqRows = await db.select().from(assignmentQuestionsTable)
    .where(eq(assignmentQuestionsTable.assignmentId, params.data.id))
    .orderBy(assignmentQuestionsTable.orderIndex);

  const submissionCount = await db.select({ count: sql<number>`count(*)` }).from(submissionsTable).where(eq(submissionsTable.assignmentId, params.data.id));
  let courseName: string | null = null;
  if (assignment.courseId) {
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, assignment.courseId));
    courseName = course?.name ?? null;
  }

  const questions = aqRows.map(aq => ({
    id: aq.id,
    assignmentId: aq.assignmentId,
    questionId: aq.questionId,
    orderIndex: aq.orderIndex,
    question: {
      id: aq.questionId,
      type: aq.type,
      skill: aq.skill,
      level: aq.level,
      content: aq.content,
      options: aq.options ?? null,
      correctAnswer: includeAnswer ? (aq.correctAnswer ?? null) : null,
      audioUrl: aq.audioUrl ?? null,
      videoUrl: aq.videoUrl ?? null,
      imageUrl: aq.imageUrl ?? null,
      passage: aq.passage ?? null,
      explanation: aq.explanation ?? null,
      metadata: aq.metadata ?? null,
      points: aq.points,
      createdAt: new Date().toISOString(),
    },
  }));

  res.json(GetAssignmentResponse.parse({
    id: assignment.id,
    title: assignment.title,
    description: assignment.description ?? null,
    courseId: assignment.courseId ?? null,
    courseName,
    teacherId: assignment.teacherId,
    dueDate: assignment.dueDate?.toISOString() ?? null,
    startTime: assignment.startTime?.toISOString() ?? null,
    endTime: assignment.endTime?.toISOString() ?? null,
    timeLimitMinutes: assignment.timeLimitMinutes ?? null,
    totalPoints: assignment.totalPoints,
    maxAttempts: assignment.maxAttempts,
    allowReview: assignment.allowReview,
    autoGrade: assignment.autoGrade,
    status: assignment.status,
    submissionCount: Number(submissionCount[0]?.count ?? 0),
    createdAt: assignment.createdAt.toISOString(),
    questions,
  }));
});

router.patch("/assignments/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAssignmentParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existing.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden: you do not own this assignment" }); return;
  }

  const parsed = UpdateAssignmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.status === "published") {
    const targetCourseId = parsed.data.courseId ?? existing.courseId;
    if (!targetCourseId) {
      res.status(400).json({ error: "Không thể công bố bài tập chưa được gán vào khoá học" });
      return;
    }
  }

  if (parsed.data.courseId != null) {
    const [targetCourse] = await db.select().from(coursesTable).where(eq(coursesTable.id, parsed.data.courseId));
    if (!targetCourse) { res.status(400).json({ error: "Khóa học không tồn tại" }); return; }
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title != null) updates.title = parsed.data.title;
  if (parsed.data.description != null) updates.description = parsed.data.description;
  if ("courseId" in parsed.data) updates.courseId = parsed.data.courseId ?? null;
  if ("dueDate" in parsed.data) updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if ("startTime" in parsed.data) updates.startTime = parsed.data.startTime ? new Date(parsed.data.startTime) : null;
  if ("endTime" in parsed.data) updates.endTime = parsed.data.endTime ? new Date(parsed.data.endTime) : null;
  if (parsed.data.timeLimitMinutes != null) updates.timeLimitMinutes = parsed.data.timeLimitMinutes;
  if (parsed.data.maxAttempts != null) updates.maxAttempts = parsed.data.maxAttempts;
  if (parsed.data.allowReview != null) updates.allowReview = parsed.data.allowReview;
  if (parsed.data.autoGrade != null) updates.autoGrade = parsed.data.autoGrade;
  if (parsed.data.status != null) updates.status = parsed.data.status;

  await db.update(assignmentsTable).set(updates).where(eq(assignmentsTable.id, params.data.id));
  const summary = await getAssignmentSummary(params.data.id);
  if (!summary) { res.status(404).json({ error: "Assignment not found" }); return; }
  res.json(UpdateAssignmentResponse.parse(summary));
});

router.delete("/assignments/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAssignmentParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existing.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden: you do not own this assignment" }); return;
  }

  await db.delete(assignmentQuestionsTable).where(eq(assignmentQuestionsTable.assignmentId, params.data.id));
  await db.delete(assignmentsTable).where(eq(assignmentsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/assignments/:id/questions", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const assignmentId = parseInt(raw!, 10);

  const [existingAssignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId));
  if (!existingAssignment) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existingAssignment.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = AddQuestionToAssignmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [question] = await db.select().from(questionsTable).where(eq(questionsTable.id, parsed.data.questionId));
  if (!question) { res.status(404).json({ error: "Question not found" }); return; }

  const [aq] = await db.insert(assignmentQuestionsTable).values({
    assignmentId,
    questionId: question.id,
    type: question.type,
    skill: question.skill,
    level: question.level,
    content: question.content,
    options: question.options,
    correctAnswer: question.correctAnswer,
    audioUrl: question.audioUrl,
    videoUrl: question.videoUrl,
    imageUrl: question.imageUrl,
    passage: question.passage,
    explanation: question.explanation,
    metadata: question.metadata,
    points: question.points,
    orderIndex: parsed.data.orderIndex,
  }).returning();

  await recalcTotalPoints(assignmentId);

  res.status(201).json({
    id: aq.id,
    assignmentId: aq.assignmentId,
    questionId: aq.questionId,
    orderIndex: aq.orderIndex,
    question: {
      id: aq.questionId,
      type: aq.type,
      skill: aq.skill,
      level: aq.level,
      content: aq.content,
      options: aq.options ?? null,
      correctAnswer: aq.correctAnswer ?? null,
      audioUrl: aq.audioUrl ?? null,
      videoUrl: aq.videoUrl ?? null,
      imageUrl: aq.imageUrl ?? null,
      passage: aq.passage ?? null,
      explanation: aq.explanation ?? null,
      points: aq.points,
      createdAt: new Date().toISOString(),
    },
  });
});

router.patch("/assignments/:id/questions/:questionId", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const assignmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!, 10);
  const aqId = parseInt(Array.isArray(req.params.questionId) ? req.params.questionId[0]! : req.params.questionId!, 10);
  if (isNaN(assignmentId) || isNaN(aqId)) { res.status(400).json({ error: "Invalid parameters" }); return; }

  const [existingAssignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId));
  if (!existingAssignment) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existingAssignment.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [existingQ] = await db.select().from(assignmentQuestionsTable).where(
    and(eq(assignmentQuestionsTable.assignmentId, assignmentId), eq(assignmentQuestionsTable.id, aqId))
  );
  if (!existingQ) { res.status(404).json({ error: "Assignment question not found" }); return; }

  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (body.content != null) updates.content = body.content;
  if (body.options != null) updates.options = body.options;
  if (body.correctAnswer !== undefined) updates.correctAnswer = body.correctAnswer;
  if (body.audioUrl !== undefined) updates.audioUrl = body.audioUrl;
  if (body.videoUrl !== undefined) updates.videoUrl = body.videoUrl;
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
  if (body.passage !== undefined) updates.passage = body.passage;
  if (body.explanation !== undefined) updates.explanation = body.explanation;
  if (body.metadata !== undefined) updates.metadata = body.metadata;
  if (body.points != null) updates.points = Number(body.points);

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  const [updated] = await db.update(assignmentQuestionsTable).set(updates).where(
    and(eq(assignmentQuestionsTable.assignmentId, assignmentId), eq(assignmentQuestionsTable.id, aqId))
  ).returning();

  if (updates.points != null) await recalcTotalPoints(assignmentId);

  res.json({
    id: updated.id,
    assignmentId: updated.assignmentId,
    questionId: updated.questionId,
    orderIndex: updated.orderIndex,
    question: {
      id: updated.questionId,
      type: updated.type,
      skill: updated.skill,
      level: updated.level,
      content: updated.content,
      options: updated.options ?? null,
      correctAnswer: updated.correctAnswer ?? null,
      audioUrl: updated.audioUrl ?? null,
      videoUrl: updated.videoUrl ?? null,
      imageUrl: updated.imageUrl ?? null,
      passage: updated.passage ?? null,
      explanation: updated.explanation ?? null,
      points: updated.points,
      createdAt: new Date().toISOString(),
    },
  });
});

router.delete("/assignments/:id/questions/:questionId", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const assignmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!, 10);
  const aqId = parseInt(Array.isArray(req.params.questionId) ? req.params.questionId[0]! : req.params.questionId!, 10);
  if (isNaN(assignmentId) || isNaN(aqId)) { res.status(400).json({ error: "Invalid parameters" }); return; }

  const [existingAssignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId));
  if (!existingAssignment) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existingAssignment.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(assignmentQuestionsTable).where(
    and(eq(assignmentQuestionsTable.assignmentId, assignmentId), eq(assignmentQuestionsTable.id, aqId))
  );

  await recalcTotalPoints(assignmentId);
  res.sendStatus(204);
});

router.post("/assignments/:id/questions/create", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const assignmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!, 10);

  const [existingAssignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId));
  if (!existingAssignment) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existingAssignment.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { type, skill, level, content, options, correctAnswer, audioUrl, videoUrl, imageUrl, passage, explanation, metadata, points } = req.body;
  if (!type || !skill || !level || !content || points == null) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }

  const existingCount = await db.select({ count: sql<number>`count(*)` }).from(assignmentQuestionsTable).where(eq(assignmentQuestionsTable.assignmentId, assignmentId));
  const nextOrder = Number(existingCount[0]?.count ?? 0);

  const [aq] = await db.insert(assignmentQuestionsTable).values({
    assignmentId,
    questionId: 0,
    type, skill, level, content,
    options: options ?? null,
    correctAnswer: correctAnswer ?? null,
    audioUrl: audioUrl ?? null,
    videoUrl: videoUrl ?? null,
    imageUrl: imageUrl ?? null,
    passage: passage ?? null,
    explanation: explanation ?? null,
    metadata: metadata ?? null,
    points: Number(points),
    orderIndex: nextOrder,
  }).returning();

  await recalcTotalPoints(assignmentId);

  res.status(201).json({
    id: aq.id,
    assignmentId: aq.assignmentId,
    questionId: aq.questionId,
    orderIndex: aq.orderIndex,
    question: {
      id: aq.questionId,
      type: aq.type, skill: aq.skill, level: aq.level, content: aq.content,
      options: aq.options ?? null, correctAnswer: aq.correctAnswer ?? null,
      audioUrl: aq.audioUrl ?? null, videoUrl: aq.videoUrl ?? null,
      imageUrl: aq.imageUrl ?? null, passage: aq.passage ?? null,
      explanation: aq.explanation ?? null, metadata: aq.metadata ?? null,
      points: aq.points, createdAt: new Date().toISOString(),
    },
  });
});

router.post("/assignments/:id/import-from-template", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const assignmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!, 10);

  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId));
  if (!assignment) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (assignment.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { templateId, questionIds } = req.body;
  if (!templateId) { res.status(400).json({ error: "templateId is required" }); return; }

  const templateQuestions = await db.select().from(quizTemplateQuestionsTable)
    .where(eq(quizTemplateQuestionsTable.templateId, Number(templateId)))
    .orderBy(quizTemplateQuestionsTable.orderIndex);

  if (templateQuestions.length === 0) {
    res.status(400).json({ error: "Quiz nguồn không có câu hỏi" }); return;
  }

  const selectedIds: number[] | null = Array.isArray(questionIds) ? questionIds.map(Number) : null;
  const toImport = selectedIds
    ? templateQuestions.filter(tq => selectedIds.includes(tq.id))
    : templateQuestions;

  if (toImport.length === 0) {
    res.status(400).json({ error: "Không có câu hỏi nào được chọn" }); return;
  }

  const existingCount = await db.select({ count: sql<number>`count(*)` }).from(assignmentQuestionsTable).where(eq(assignmentQuestionsTable.assignmentId, assignmentId));
  let nextOrder = Number(existingCount[0]?.count ?? 0);

  for (const tq of toImport) {
    await db.insert(assignmentQuestionsTable).values({
      assignmentId,
      questionId: tq.id,
      type: tq.type,
      skill: tq.skill,
      level: tq.level,
      content: tq.content,
      options: tq.options,
      correctAnswer: tq.correctAnswer,
      audioUrl: tq.audioUrl,
      videoUrl: tq.videoUrl,
      imageUrl: tq.imageUrl,
      passage: tq.passage,
      explanation: tq.explanation,
      metadata: tq.metadata,
      points: tq.points,
      orderIndex: nextOrder++,
    });
  }

  await recalcTotalPoints(assignmentId);
  res.json({ imported: toImport.length });
});

router.get("/quiz-templates/:id/questions", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const templateId = parseInt(Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!, 10);

  const questions = await db.select().from(quizTemplateQuestionsTable)
    .where(eq(quizTemplateQuestionsTable.templateId, templateId))
    .orderBy(quizTemplateQuestionsTable.orderIndex);

  res.json(questions.map(q => ({
    id: q.id,
    templateId: q.templateId,
    type: q.type,
    skill: q.skill,
    level: q.level,
    content: q.content,
    options: q.options ?? null,
    correctAnswer: q.correctAnswer ?? null,
    audioUrl: q.audioUrl ?? null,
    videoUrl: q.videoUrl ?? null,
    imageUrl: q.imageUrl ?? null,
    passage: q.passage ?? null,
    explanation: q.explanation ?? null,
    metadata: q.metadata ?? null,
    points: q.points,
    orderIndex: q.orderIndex,
  })));
});

export default router;
