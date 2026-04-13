import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, quizTemplatesTable, quizTemplateQuestionsTable, questionsTable } from "@workspace/db";
import {
  CreateQuizTemplateBody,
  GetQuizTemplateParams,
  GetQuizTemplateResponse,
  ListQuizTemplatesResponse,
  UpdateQuizTemplateBody,
  ImportQuestionsToTemplateBody,
  UpdateQuizTemplateQuestionBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireTeacherRole } from "../middlewares/requireRole";

const router: IRouter = Router();

router.get("/quiz-templates", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;

  const templates = dbUser.role === "system_admin"
    ? await db.select().from(quizTemplatesTable)
    : await db.select().from(quizTemplatesTable).where(eq(quizTemplatesTable.teacherId, dbUser.id));

  const result = await Promise.all(templates.map(async t => {
    const qCount = await db.select({ count: sql<number>`count(*)`, total: sql<number>`COALESCE(sum(points), 0)` })
      .from(quizTemplateQuestionsTable).where(eq(quizTemplateQuestionsTable.templateId, t.id));
    return {
      id: t.id,
      title: t.title,
      description: t.description ?? null,
      teacherId: t.teacherId,
      questionCount: Number(qCount[0]?.count ?? 0),
      totalPoints: Number(qCount[0]?.total ?? 0),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }));

  res.json(ListQuizTemplatesResponse.parse(result));
});

router.post("/quiz-templates", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const parsed = CreateQuizTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const dbUser = req.dbUser!;

  const [template] = await db.insert(quizTemplatesTable).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    teacherId: dbUser.id,
  }).returning();

  res.status(201).json({
    id: template.id,
    title: template.title,
    description: template.description ?? null,
    teacherId: template.teacherId,
    questionCount: 0,
    totalPoints: 0,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  });
});

router.get("/quiz-templates/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetQuizTemplateParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [template] = await db.select().from(quizTemplatesTable).where(eq(quizTemplatesTable.id, params.data.id));
  if (!template) { res.status(404).json({ error: "Quiz template not found" }); return; }
  const dbUser = req.dbUser!;
  if (template.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const questions = await db.select().from(quizTemplateQuestionsTable)
    .where(eq(quizTemplateQuestionsTable.templateId, params.data.id))
    .orderBy(quizTemplateQuestionsTable.orderIndex);

  res.json(GetQuizTemplateResponse.parse({
    id: template.id,
    title: template.title,
    description: template.description ?? null,
    teacherId: template.teacherId,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    questions: questions.map(q => ({
      id: q.id,
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
    })),
  }));
});

router.patch("/quiz-templates/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw!, 10);

  const [existing] = await db.select().from(quizTemplatesTable).where(eq(quizTemplatesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = UpdateQuizTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title != null) updates.title = parsed.data.title;
  if (parsed.data.description != null) updates.description = parsed.data.description;

  if (Object.keys(updates).length > 0) {
    await db.update(quizTemplatesTable).set(updates).where(eq(quizTemplatesTable.id, id));
  }

  const [updated] = await db.select().from(quizTemplatesTable).where(eq(quizTemplatesTable.id, id));
  res.json({
    id: updated.id,
    title: updated.title,
    description: updated.description ?? null,
    teacherId: updated.teacherId,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.delete("/quiz-templates/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw!, 10);

  const [existing] = await db.select().from(quizTemplatesTable).where(eq(quizTemplatesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(quizTemplatesTable).where(eq(quizTemplatesTable.id, id));
  res.sendStatus(204);
});

router.post("/quiz-templates/:id/import-questions", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const templateId = parseInt(raw!, 10);

  const [template] = await db.select().from(quizTemplatesTable).where(eq(quizTemplatesTable.id, templateId));
  if (!template) { res.status(404).json({ error: "Not found" }); return; }
  if (template.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = ImportQuestionsToTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existingCount = await db.select({ count: sql<number>`count(*)` })
    .from(quizTemplateQuestionsTable).where(eq(quizTemplateQuestionsTable.templateId, templateId));
  let nextOrder = Number(existingCount[0]?.count ?? 0);

  let imported = 0;
  for (const qId of parsed.data.questionIds) {
    const [question] = await db.select().from(questionsTable).where(eq(questionsTable.id, qId));
    if (!question) continue;

    await db.insert(quizTemplateQuestionsTable).values({
      templateId,
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
      orderIndex: nextOrder++,
    });
    imported++;
  }

  res.json({ imported });
});

router.patch("/quiz-templates/:id/questions/:qid", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const templateId = parseInt(Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!, 10);
  const qid = parseInt(Array.isArray(req.params.qid) ? req.params.qid[0]! : req.params.qid!, 10);

  const [template] = await db.select().from(quizTemplatesTable).where(eq(quizTemplatesTable.id, templateId));
  if (!template) { res.status(404).json({ error: "Not found" }); return; }
  if (template.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = UpdateQuizTemplateQuestionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.content !== undefined) updates.content = parsed.data.content;
  if (parsed.data.options !== undefined) updates.options = parsed.data.options;
  if (parsed.data.correctAnswer !== undefined) updates.correctAnswer = parsed.data.correctAnswer;
  if (parsed.data.audioUrl !== undefined) updates.audioUrl = parsed.data.audioUrl;
  if (parsed.data.videoUrl !== undefined) updates.videoUrl = parsed.data.videoUrl;
  if (parsed.data.imageUrl !== undefined) updates.imageUrl = parsed.data.imageUrl;
  if (parsed.data.passage !== undefined) updates.passage = parsed.data.passage;
  if (parsed.data.explanation !== undefined) updates.explanation = parsed.data.explanation;
  if (parsed.data.metadata !== undefined) updates.metadata = parsed.data.metadata;
  if (parsed.data.points !== undefined) updates.points = parsed.data.points;

  const whereClause = and(eq(quizTemplateQuestionsTable.id, qid), eq(quizTemplateQuestionsTable.templateId, templateId));
  if (Object.keys(updates).length > 0) {
    await db.update(quizTemplateQuestionsTable).set(updates).where(whereClause);
  }

  const [updated] = await db.select().from(quizTemplateQuestionsTable).where(whereClause);
  if (!updated) { res.status(404).json({ error: "Question not found" }); return; }

  res.json({
    id: updated.id,
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
    metadata: updated.metadata ?? null,
    points: updated.points,
    orderIndex: updated.orderIndex,
  });
});

router.post("/quiz-templates/:id/questions", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const templateId = parseInt(Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!, 10);

  const [template] = await db.select().from(quizTemplatesTable).where(eq(quizTemplatesTable.id, templateId));
  if (!template) { res.status(404).json({ error: "Not found" }); return; }
  if (template.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { type, skill, level, content, options, correctAnswer, audioUrl, videoUrl, imageUrl, passage, explanation, metadata, points } = req.body;
  if (!type || !skill || !level || !content || points == null) {
    res.status(400).json({ error: "Missing required fields: type, skill, level, content, points" }); return;
  }

  const existingCount = await db.select({ count: sql<number>`count(*)` })
    .from(quizTemplateQuestionsTable).where(eq(quizTemplateQuestionsTable.templateId, templateId));
  const nextOrder = Number(existingCount[0]?.count ?? 0);

  const [created] = await db.insert(quizTemplateQuestionsTable).values({
    templateId,
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

  res.status(201).json({
    id: created.id,
    templateId: created.templateId,
    type: created.type,
    skill: created.skill,
    level: created.level,
    content: created.content,
    options: created.options ?? null,
    correctAnswer: created.correctAnswer ?? null,
    audioUrl: created.audioUrl ?? null,
    videoUrl: created.videoUrl ?? null,
    imageUrl: created.imageUrl ?? null,
    passage: created.passage ?? null,
    explanation: created.explanation ?? null,
    metadata: created.metadata ?? null,
    points: created.points,
    orderIndex: created.orderIndex,
  });
});

router.delete("/quiz-templates/:id/questions/:qid", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const templateId = parseInt(Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!, 10);
  const qid = parseInt(Array.isArray(req.params.qid) ? req.params.qid[0]! : req.params.qid!, 10);

  const [template] = await db.select().from(quizTemplatesTable).where(eq(quizTemplatesTable.id, templateId));
  if (!template) { res.status(404).json({ error: "Not found" }); return; }
  if (template.teacherId !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(quizTemplateQuestionsTable).where(and(eq(quizTemplateQuestionsTable.id, qid), eq(quizTemplateQuestionsTable.templateId, templateId)));
  res.sendStatus(204);
});

export default router;
