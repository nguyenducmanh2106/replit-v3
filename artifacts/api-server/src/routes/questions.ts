import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, questionsTable } from "@workspace/db";
import {
  ListQuestionsQueryParams,
  ListQuestionsResponse,
  CreateQuestionBody,
  GetQuestionParams,
  GetQuestionResponse,
  UpdateQuestionParams,
  UpdateQuestionBody,
  UpdateQuestionResponse,
  DeleteQuestionParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireTeacherRole, isTeacherOrAdmin } from "../middlewares/requireRole";

const router: IRouter = Router();

function mapQuestion(q: typeof questionsTable.$inferSelect, includeAnswer: boolean) {
  return {
    id: q.id,
    type: q.type,
    skill: q.skill,
    level: q.level,
    content: q.content,
    options: q.options ?? null,
    correctAnswer: includeAnswer ? (q.correctAnswer ?? null) : null,
    audioUrl: q.audioUrl ?? null,
    videoUrl: q.videoUrl ?? null,
    imageUrl: q.imageUrl ?? null,
    passage: q.passage ?? null,
    explanation: includeAnswer ? (q.explanation ?? null) : null,
    metadata: q.metadata ?? null,
    points: q.points,
    createdAt: q.createdAt.toISOString(),
  };
}

router.get("/questions", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const includeAnswer = isTeacherOrAdmin(dbUser.role);

  const params = ListQuestionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [];
  if (params.data.skill) conditions.push(eq(questionsTable.skill, params.data.skill));
  if (params.data.level) conditions.push(eq(questionsTable.level, params.data.level));
  if (params.data.type) conditions.push(eq(questionsTable.type, params.data.type));

  const questions = conditions.length > 0
    ? await db.select().from(questionsTable).where(and(...conditions))
    : await db.select().from(questionsTable);

  res.json(ListQuestionsResponse.parse(questions.map(q => mapQuestion(q, includeAnswer))));
});

router.post("/questions", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const parsed = CreateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const dbUser = req.dbUser!;
  const [question] = await db.insert(questionsTable).values({
    ...parsed.data,
    createdBy: dbUser.id,
  }).returning();
  res.status(201).json(GetQuestionResponse.parse(mapQuestion(question, true)));
});

router.get("/questions/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const includeAnswer = isTeacherOrAdmin(dbUser.role);

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetQuestionParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [question] = await db.select().from(questionsTable).where(eq(questionsTable.id, params.data.id));
  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }
  res.json(GetQuestionResponse.parse(mapQuestion(question, includeAnswer)));
});

router.patch("/questions/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateQuestionParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existingQ] = await db.select().from(questionsTable).where(eq(questionsTable.id, params.data.id));
  if (!existingQ) {
    res.status(404).json({ error: "Question not found" });
    return;
  }
  if (existingQ.createdBy !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden: you do not own this question" });
    return;
  }

  const parsed = UpdateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.type != null) updates.type = parsed.data.type;
  if (parsed.data.skill != null) updates.skill = parsed.data.skill;
  if (parsed.data.level != null) updates.level = parsed.data.level;
  if (parsed.data.content != null) updates.content = parsed.data.content;
  if (parsed.data.options != null) updates.options = parsed.data.options;
  if (parsed.data.correctAnswer != null) updates.correctAnswer = parsed.data.correctAnswer;
  if (parsed.data.audioUrl != null) updates.audioUrl = parsed.data.audioUrl;
  if (parsed.data.videoUrl != null) updates.videoUrl = parsed.data.videoUrl;
  if (parsed.data.imageUrl != null) updates.imageUrl = parsed.data.imageUrl;
  if (parsed.data.passage != null) updates.passage = parsed.data.passage;
  if (parsed.data.explanation != null) updates.explanation = parsed.data.explanation;
  if (parsed.data.metadata != null) updates.metadata = parsed.data.metadata;
  if (parsed.data.points != null) updates.points = parsed.data.points;

  const [question] = await db.update(questionsTable).set(updates).where(eq(questionsTable.id, params.data.id)).returning();
  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }
  res.json(UpdateQuestionResponse.parse(mapQuestion(question, true)));
});

router.delete("/questions/:id", requireAuth, requireTeacherRole(), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteQuestionParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existingQ] = await db.select().from(questionsTable).where(eq(questionsTable.id, params.data.id));
  if (!existingQ) {
    res.status(404).json({ error: "Question not found" });
    return;
  }
  if (existingQ.createdBy !== dbUser.id && dbUser.role !== "system_admin") {
    res.status(403).json({ error: "Forbidden: you do not own this question" });
    return;
  }

  await db.delete(questionsTable).where(eq(questionsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
