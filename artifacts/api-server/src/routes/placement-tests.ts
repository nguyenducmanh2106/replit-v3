import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  placementTestsTable,
  placementTestQuestionsTable,
  placementSubmissionsTable,
  placementAnswersTable,
  usersTable,
  quizTemplatesTable,
  quizTemplateQuestionsTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import crypto from "crypto";
import { requireAuth } from "../middlewares/requireAuth";
import { isTeacherOrAdmin } from "../middlewares/requireRole";
import {
  sendPlacementSubmitConfirmEmail,
  sendPlacementNewSubmissionEmail,
  sendPlacementResultEmail,
  appBaseUrl,
} from "../lib/mailer";

const router: IRouter = Router();

function genSlug(): string {
  return crypto.randomBytes(8).toString("base64url");
}

function safeJson<T>(str: unknown, fallback: T): T {
  if (str == null) return fallback;
  if (typeof str !== "string") {
    // jsonb columns may already arrive parsed
    try { return str as T; } catch { return fallback; }
  }
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

type QLike = { type: string; options: unknown; correctAnswer: string | null; metadata: unknown; points: number };

function gradePlacementAnswer(q: QLike, studentAnswer: string | null): { isCorrect: boolean | null; autoScore: number } {
  if (studentAnswer == null || studentAnswer.trim() === "") return { isCorrect: null, autoScore: 0 };

  const ca = q.correctAnswer;
  const opts = q.options;
  const norm = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();

  // Manual-only types (unless essay has autoGrade — we still treat as manual here)
  if (q.type === "essay" || q.type === "open_end" || q.type === "long_answer") {
    return { isCorrect: null, autoScore: 0 };
  }

  if (q.type === "mcq") {
    if (!ca) return { isCorrect: null, autoScore: 0 };
    // multi-select if metadata.allowMultiple — student/correct stored as comma-joined or JSON array
    const meta = safeJson<Record<string, unknown>>(q.metadata, {});
    const isMulti = !!meta.allowMultiple;
    const parseList = (s: string): string[] => {
      try { const p = JSON.parse(s); if (Array.isArray(p)) return p.map(String); } catch {/*noop*/}
      return s.split(",").map(t => t.trim()).filter(Boolean);
    };
    if (isMulti) {
      const cs = new Set(parseList(ca).map(norm));
      const ss = new Set(parseList(studentAnswer).map(norm));
      const same = cs.size === ss.size && [...cs].every(v => ss.has(v));
      return { isCorrect: same, autoScore: same ? q.points : 0 };
    }
    const ok = norm(studentAnswer) === norm(ca);
    return { isCorrect: ok, autoScore: ok ? q.points : 0 };
  }

  if (q.type === "true_false") {
    if (!ca) return { isCorrect: null, autoScore: 0 };
    const tfMap: Record<string, string> = { "true": "đúng", "false": "sai", "đúng": "đúng", "sai": "sai" };
    const ns = tfMap[norm(studentAnswer)] ?? norm(studentAnswer);
    const nc = tfMap[norm(ca)] ?? norm(ca);
    const ok = ns === nc;
    return { isCorrect: ok, autoScore: ok ? q.points : 0 };
  }

  if (q.type === "fill_blank") {
    if (!ca) return { isCorrect: null, autoScore: 0 };
    const correctArr = safeJson<string[]>(ca, [ca]);
    const studentArr = safeJson<string[]>(studentAnswer, [studentAnswer]);
    if (correctArr.length === 0) return { isCorrect: null, autoScore: 0 };
    const all = correctArr.every((c, i) => norm(studentArr[i]) === norm(c));
    return { isCorrect: all, autoScore: all ? q.points : 0 };
  }

  if (q.type === "short_answer") {
    const ok = norm(studentAnswer) === norm(ca ?? "");
    return { isCorrect: ok, autoScore: ok ? q.points : 0 };
  }

  if (q.type === "word_selection") {
    if (!ca) return { isCorrect: null, autoScore: 0 };
    const correctWords = safeJson<string[]>(ca, []).map(w => norm(w)).sort();
    const studentWords = safeJson<string[]>(studentAnswer, studentAnswer.split(",")).map(w => norm(w)).filter(Boolean).sort();
    const ok = correctWords.length === studentWords.length && correctWords.every((w, i) => w === studentWords[i]);
    return { isCorrect: ok, autoScore: ok ? q.points : 0 };
  }

  if (q.type === "matching") {
    let correctDict = safeJson<Record<string, string>>(ca, {} as Record<string, string>);
    if (!correctDict || typeof correctDict !== "object" || Array.isArray(correctDict) || Object.keys(correctDict).length === 0) {
      const arr = safeJson<unknown>(opts, null);
      correctDict = {};
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (typeof item === "string" && item.includes("|")) {
            const [l, ...rest] = item.split("|");
            correctDict[l!.trim()] = rest.join("|").trim();
          } else if (item && typeof item === "object" && "left" in (item as any) && "right" in (item as any)) {
            correctDict[(item as any).left] = (item as any).right;
          }
        }
      }
    }
    const entries = Object.entries(correctDict);
    if (entries.length === 0) return { isCorrect: null, autoScore: 0 };
    const studentMatches = safeJson<Record<string, string>>(studentAnswer, {} as Record<string, string>);
    const ok = entries.every(([l, r]) => norm(studentMatches[l]) === norm(r));
    return { isCorrect: ok, autoScore: ok ? q.points : 0 };
  }

  if (q.type === "drag_drop") {
    const ddOpts = safeJson<{ items: string[]; zones: Array<{ label: string; accepts: string[] }> }>(opts, { items: [], zones: [] });
    if (!ddOpts.zones || ddOpts.zones.length === 0) return { isCorrect: null, autoScore: 0 };
    const studentZones = safeJson<Record<string, string[]>>(studentAnswer, {} as Record<string, string[]>);
    let total = 0;
    let ok = true;
    for (const zone of ddOpts.zones) {
      const placed = studentZones[zone.label] ?? [];
      const accepts = zone.accepts ?? [];
      for (const item of accepts) { total++; if (!placed.includes(item)) ok = false; }
      for (const item of placed) { if (!accepts.includes(item)) ok = false; }
    }
    if (total === 0) return { isCorrect: null, autoScore: 0 };
    return { isCorrect: ok, autoScore: ok ? q.points : 0 };
  }

  if (q.type === "sentence_reorder") {
    const correctOrder = safeJson<string[]>(opts, []);
    if (correctOrder.length === 0) return { isCorrect: null, autoScore: 0 };
    const studentOrder = safeJson<string[]>(studentAnswer, []);
    const ok = correctOrder.length === studentOrder.length && correctOrder.every((w, i) => w === studentOrder[i]);
    return { isCorrect: ok, autoScore: ok ? q.points : 0 };
  }

  if (q.type === "reading" || q.type === "listening") {
    type SubQ = { question: string; choices: string[]; correctAnswer: string; points?: number };
    const subQs = safeJson<SubQ[]>(opts, []);
    if (subQs.length === 0) return { isCorrect: null, autoScore: 0 };
    const studentSubs = safeJson<Record<string, string>>(studentAnswer, {} as Record<string, string>);
    const fallbackShare = q.points / subQs.length;
    let earned = 0;
    let allOk = true;
    for (let i = 0; i < subQs.length; i++) {
      const sc = norm(studentSubs[String(i)]);
      const cc = norm(subQs[i]!.correctAnswer);
      if (sc && sc === cc) {
        earned += typeof subQs[i]!.points === "number" ? subQs[i]!.points! : fallbackShare;
      } else {
        allOk = false;
      }
    }
    return { isCorrect: allOk, autoScore: Math.round(earned) };
  }

  if (q.type === "video_interactive") {
    type VQ = { timestamp: number; type?: string; question: string; choices: string[]; correctAnswer: string; points?: number };
    const all = safeJson<VQ[]>(opts, []);
    const studentVA = safeJson<Record<string, string>>(studentAnswer, {} as Record<string, string>);
    let correct = 0; let totalQ = 0;
    for (let i = 0; i < all.length; i++) {
      if ((all[i]!.type ?? "question") !== "question") continue;
      totalQ++;
      if (norm(studentVA[String(i)]) === norm(all[i]!.correctAnswer)) correct++;
    }
    if (totalQ === 0) return { isCorrect: null, autoScore: 0 };
    const ratio = correct / totalQ;
    return { isCorrect: ratio === 1, autoScore: Math.round(q.points * ratio) };
  }

  // Unknown / fallback
  if (ca) {
    const ok = norm(studentAnswer) === norm(ca);
    return { isCorrect: ok, autoScore: ok ? q.points : 0 };
  }
  return { isCorrect: null, autoScore: 0 };
}

// ========================
// TEACHER ENDPOINTS
// ========================

// GET /placement-tests
router.get("/placement-tests", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const rows = await db
    .select({
      id: placementTestsTable.id,
      title: placementTestsTable.title,
      description: placementTestsTable.description,
      status: placementTestsTable.status,
      linkSlug: placementTestsTable.linkSlug,
      linkActive: placementTestsTable.linkActive,
      maxScore: placementTestsTable.maxScore,
      passScore: placementTestsTable.passScore,
      timeLimitMinutes: placementTestsTable.timeLimitMinutes,
      createdAt: placementTestsTable.createdAt,
      updatedAt: placementTestsTable.updatedAt,
      submissionCount: sql<number>`(SELECT COUNT(*)::int FROM ${placementSubmissionsTable} WHERE ${placementSubmissionsTable.testId} = ${placementTestsTable.id} AND ${placementSubmissionsTable.submittedAt} IS NOT NULL)`,
      pendingCount: sql<number>`(SELECT COUNT(*)::int FROM ${placementSubmissionsTable} WHERE ${placementSubmissionsTable.testId} = ${placementTestsTable.id} AND ${placementSubmissionsTable.gradingStatus} = 'pending' AND ${placementSubmissionsTable.submittedAt} IS NOT NULL)`,
    })
    .from(placementTestsTable)
    .orderBy(desc(placementTestsTable.updatedAt));
  res.json(rows);
});

// POST /placement-tests
router.post("/placement-tests", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const body = req.body as {
    title: string;
    description?: string;
    instructions?: string;
    timeLimitMinutes?: number | null;
    passScore?: number | null;
    showScoreImmediately?: boolean;
    allowRetake?: boolean;
    notifyTeacherEmail?: boolean;
  };
  if (!body.title || body.title.trim() === "") { res.status(400).json({ error: "Title is required" }); return; }

  // ensure unique slug
  let slug = genSlug();
  for (let i = 0; i < 5; i++) {
    const exists = await db.select({ id: placementTestsTable.id }).from(placementTestsTable).where(eq(placementTestsTable.linkSlug, slug)).limit(1);
    if (exists.length === 0) break;
    slug = genSlug();
  }

  const [row] = await db
    .insert(placementTestsTable)
    .values({
      title: body.title.trim(),
      description: body.description ?? null,
      instructions: body.instructions ?? null,
      status: "draft",
      timeLimitMinutes: body.timeLimitMinutes ?? null,
      passScore: body.passScore ?? null,
      showScoreImmediately: body.showScoreImmediately ?? false,
      allowRetake: body.allowRetake ?? false,
      notifyTeacherEmail: body.notifyTeacherEmail ?? true,
      linkSlug: slug,
      createdBy: user.id,
    })
    .returning();
  res.status(201).json(row);
});

// GET /placement-tests/quiz-templates  (list quiz templates available to import) — declared before /:id to avoid route shadowing
router.get("/placement-tests/quiz-templates", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const rows = await db
    .select({
      id: quizTemplatesTable.id,
      title: quizTemplatesTable.title,
      description: quizTemplatesTable.description,
      questionCount: sql<number>`(SELECT COUNT(*)::int FROM ${quizTemplateQuestionsTable} WHERE ${quizTemplateQuestionsTable.templateId} = ${quizTemplatesTable.id})`,
    })
    .from(quizTemplatesTable)
    .orderBy(desc(quizTemplatesTable.createdAt));
  res.json(rows);
});

// GET /placement-tests/quiz-templates/:tid/questions
router.get("/placement-tests/quiz-templates/:tid/questions", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const tid = Number(req.params["tid"]);
  const rows = await db
    .select()
    .from(quizTemplateQuestionsTable)
    .where(eq(quizTemplateQuestionsTable.templateId, tid))
    .orderBy(quizTemplateQuestionsTable.orderIndex);
  res.json(rows);
});

router.get("/placement-tests/:id", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = Number(req.params["id"]);
  const [test] = await db.select().from(placementTestsTable).where(eq(placementTestsTable.id, id)).limit(1);
  if (!test) { res.status(404).json({ error: "Not found" }); return; }
  const questions = await db
    .select()
    .from(placementTestQuestionsTable)
    .where(eq(placementTestQuestionsTable.testId, id))
    .orderBy(placementTestQuestionsTable.orderIndex);
  res.json({ ...test, questions });
});

// PATCH /placement-tests/:id
router.patch("/placement-tests/:id", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = Number(req.params["id"]);
  const body = req.body as Partial<{
    title: string;
    description: string | null;
    instructions: string | null;
    status: string;
    timeLimitMinutes: number | null;
    passScore: number | null;
    showScoreImmediately: boolean;
    allowRetake: boolean;
    linkActive: boolean;
    notifyTeacherEmail: boolean;
  }>;
  const [updated] = await db
    .update(placementTestsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(placementTestsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// DELETE /placement-tests/:id
router.delete("/placement-tests/:id", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = Number(req.params["id"]);
  await db.delete(placementTestsTable).where(eq(placementTestsTable.id, id));
  res.status(204).end();
});

// POST /placement-tests/:id/publish
router.post("/placement-tests/:id/publish", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = Number(req.params["id"]);
  // recompute max_score from questions
  const qs = await db.select({ points: placementTestQuestionsTable.points }).from(placementTestQuestionsTable).where(eq(placementTestQuestionsTable.testId, id));
  const maxScore = qs.reduce((s, q) => s + (q.points ?? 0), 0);
  const [updated] = await db
    .update(placementTestsTable)
    .set({ status: "active", linkActive: true, maxScore, updatedAt: new Date() })
    .where(eq(placementTestsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    ...updated,
    publicUrl: `${appBaseUrl()}/test/${updated.linkSlug}`,
  });
});

// ========================
// QUESTIONS
// ========================

// POST /placement-tests/:id/questions  (add single question)
router.post("/placement-tests/:id/questions", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const testId = Number(req.params["id"]);
  const body = req.body as {
    sourceType?: string;
    sourceId?: number | null;
    type: string;
    skill?: string | null;
    level?: string | null;
    content: string;
    options?: unknown;
    correctAnswer?: string | null;
    audioUrl?: string | null;
    videoUrl?: string | null;
    imageUrl?: string | null;
    passage?: string | null;
    explanation?: string | null;
    metadata?: unknown;
    points?: number;
  };
  const [{ maxIdx }] = await db
    .select({ maxIdx: sql<number>`COALESCE(MAX(${placementTestQuestionsTable.orderIndex}), -1)::int` })
    .from(placementTestQuestionsTable)
    .where(eq(placementTestQuestionsTable.testId, testId));
  const [row] = await db
    .insert(placementTestQuestionsTable)
    .values({
      testId,
      orderIndex: (maxIdx ?? -1) + 1,
      sourceType: body.sourceType ?? "custom",
      sourceId: body.sourceId ?? null,
      type: body.type,
      skill: body.skill ?? null,
      level: body.level ?? null,
      content: body.content,
      options: (body.options as any) ?? null,
      correctAnswer: body.correctAnswer ?? null,
      audioUrl: body.audioUrl ?? null,
      videoUrl: body.videoUrl ?? null,
      imageUrl: body.imageUrl ?? null,
      passage: body.passage ?? null,
      explanation: body.explanation ?? null,
      metadata: (body.metadata as any) ?? null,
      points: body.points ?? 1,
    })
    .returning();
  res.status(201).json(row);
});

// POST /placement-tests/:id/questions/bulk-import  (import from question bank IDs)
router.post("/placement-tests/:id/questions/bulk-import", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const testId = Number(req.params["id"]);
  const body = req.body as { questionIds: number[] };
  if (!Array.isArray(body.questionIds) || body.questionIds.length === 0) {
    res.status(400).json({ error: "questionIds required" }); return;
  }
  // Fetch source questions from questions table (bank)
  const { questionsTable } = await import("@workspace/db/schema");
  const src = await db.select().from(questionsTable).where(inArray(questionsTable.id, body.questionIds));
  const [{ maxIdx }] = await db
    .select({ maxIdx: sql<number>`COALESCE(MAX(${placementTestQuestionsTable.orderIndex}), -1)::int` })
    .from(placementTestQuestionsTable)
    .where(eq(placementTestQuestionsTable.testId, testId));
  let idx = (maxIdx ?? -1) + 1;
  const rows = src.map(q => ({
    testId,
    orderIndex: idx++,
    sourceType: "bank",
    sourceId: q.id,
    type: q.type,
    skill: (q as any).skill ?? null,
    level: (q as any).level ?? null,
    content: q.content,
    options: q.options as any,
    correctAnswer: q.correctAnswer as any,
    audioUrl: (q as any).audioUrl ?? null,
    videoUrl: (q as any).videoUrl ?? null,
    imageUrl: (q as any).imageUrl ?? null,
    passage: (q as any).passage ?? null,
    explanation: (q as any).explanation ?? null,
    metadata: (q as any).metadata ?? null,
    points: q.points ?? 1,
  }));
  if (rows.length === 0) { res.json({ imported: 0 }); return; }
  const inserted = await db.insert(placementTestQuestionsTable).values(rows).returning();
  res.json({ imported: inserted.length, questions: inserted });
});

// POST /placement-tests/:id/import-from-quiz  (import from quiz template)
router.post("/placement-tests/:id/import-from-quiz", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const testId = Number(req.params["id"]);
  const body = req.body as { templateId: number; questionIds?: number[] };
  if (!body.templateId) { res.status(400).json({ error: "templateId is required" }); return; }

  const [test] = await db.select().from(placementTestsTable).where(eq(placementTestsTable.id, testId)).limit(1);
  if (!test) { res.status(404).json({ error: "Bài test không tồn tại" }); return; }

  const tplQs = await db.select().from(quizTemplateQuestionsTable)
    .where(eq(quizTemplateQuestionsTable.templateId, Number(body.templateId)))
    .orderBy(quizTemplateQuestionsTable.orderIndex);
  if (tplQs.length === 0) { res.status(400).json({ error: "Quiz nguồn không có câu hỏi" }); return; }

  const selectedIds = Array.isArray(body.questionIds) ? body.questionIds.map(Number) : null;
  const toImport = selectedIds && selectedIds.length > 0
    ? tplQs.filter(q => selectedIds.includes(q.id))
    : tplQs;
  if (toImport.length === 0) { res.status(400).json({ error: "Không có câu hỏi nào được chọn" }); return; }

  const [{ maxIdx }] = await db
    .select({ maxIdx: sql<number>`COALESCE(MAX(${placementTestQuestionsTable.orderIndex}), -1)::int` })
    .from(placementTestQuestionsTable)
    .where(eq(placementTestQuestionsTable.testId, testId));
  let idx = (maxIdx ?? -1) + 1;

  const rows = toImport.map(q => ({
    testId,
    orderIndex: idx++,
    sourceType: "quiz",
    sourceId: q.id,
    type: q.type,
    skill: (q as any).skill ?? null,
    level: (q as any).level ?? null,
    content: q.content,
    options: q.options as any,
    correctAnswer: q.correctAnswer as any,
    audioUrl: (q as any).audioUrl ?? null,
    videoUrl: (q as any).videoUrl ?? null,
    imageUrl: (q as any).imageUrl ?? null,
    passage: (q as any).passage ?? null,
    explanation: (q as any).explanation ?? null,
    metadata: (q as any).metadata ?? null,
    points: q.points ?? 1,
  }));
  const inserted = await db.insert(placementTestQuestionsTable).values(rows).returning();
  res.json({ imported: inserted.length, questions: inserted });
});

// PATCH /placement-test-questions/:qid
router.patch("/placement-test-questions/:qid", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const qid = Number(req.params["qid"]);
  const body = req.body as Partial<{
    content: string; type: string; skill: string | null; level: string | null;
    options: unknown; correctAnswer: string | null;
    audioUrl: string | null; videoUrl: string | null; imageUrl: string | null;
    passage: string | null; explanation: string | null; metadata: unknown;
    points: number;
  }>;
  const updates: Record<string, unknown> = {};
  for (const k of ["content", "type", "skill", "level", "correctAnswer", "audioUrl", "videoUrl", "imageUrl", "passage", "explanation", "points"] as const) {
    if (k in body) updates[k] = (body as any)[k];
  }
  if ("options" in body) updates.options = body.options as any;
  if ("metadata" in body) updates.metadata = body.metadata as any;

  const [row] = await db
    .update(placementTestQuestionsTable)
    .set(updates as any)
    .where(eq(placementTestQuestionsTable.id, qid))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// DELETE /placement-test-questions/:qid
router.delete("/placement-test-questions/:qid", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const qid = Number(req.params["qid"]);
  await db.delete(placementTestQuestionsTable).where(eq(placementTestQuestionsTable.id, qid));
  res.status(204).end();
});

// POST /placement-tests/:id/questions/reorder
router.post("/placement-tests/:id/questions/reorder", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const body = req.body as { questionIds: number[] };
  if (!Array.isArray(body.questionIds)) { res.status(400).json({ error: "questionIds array required" }); return; }
  await db.transaction(async (tx) => {
    for (let i = 0; i < body.questionIds.length; i++) {
      await tx.update(placementTestQuestionsTable).set({ orderIndex: i }).where(eq(placementTestQuestionsTable.id, body.questionIds[i]!));
    }
  });
  res.json({ ok: true });
});

// ========================
// SUBMISSIONS (TEACHER)
// ========================

// GET /placement-tests/:id/submissions
router.get("/placement-tests/:id/submissions", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = Number(req.params["id"]);
  const rows = await db
    .select()
    .from(placementSubmissionsTable)
    .where(and(eq(placementSubmissionsTable.testId, id), sql`${placementSubmissionsTable.submittedAt} IS NOT NULL`))
    .orderBy(desc(placementSubmissionsTable.submittedAt));
  res.json(rows);
});

// GET /placement-submissions/:sid (full detail for grading)
router.get("/placement-submissions/:sid", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const sid = Number(req.params["sid"]);
  const [sub] = await db.select().from(placementSubmissionsTable).where(eq(placementSubmissionsTable.id, sid)).limit(1);
  if (!sub) { res.status(404).json({ error: "Not found" }); return; }
  const [test] = await db.select().from(placementTestsTable).where(eq(placementTestsTable.id, sub.testId)).limit(1);
  const questions = await db
    .select()
    .from(placementTestQuestionsTable)
    .where(eq(placementTestQuestionsTable.testId, sub.testId))
    .orderBy(placementTestQuestionsTable.orderIndex);
  const answers = await db
    .select()
    .from(placementAnswersTable)
    .where(eq(placementAnswersTable.submissionId, sid));
  res.json({ submission: sub, test, questions, answers });
});

// PATCH /placement-submissions/:sid/grade (teacher grading)
router.patch("/placement-submissions/:sid/grade", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const sid = Number(req.params["sid"]);
  const body = req.body as {
    teacherComment?: string | null;
    answerGrades?: Array<{ answerId: number; manualScore?: number | null; teacherComment?: string | null }>;
  };

  const [sub] = await db.select().from(placementSubmissionsTable).where(eq(placementSubmissionsTable.id, sid)).limit(1);
  if (!sub) { res.status(404).json({ error: "Not found" }); return; }

  if (body.answerGrades && body.answerGrades.length > 0) {
    await db.transaction(async (tx) => {
      for (const g of body.answerGrades!) {
        await tx
          .update(placementAnswersTable)
          .set({
            ...(g.manualScore !== undefined ? { manualScore: g.manualScore } : {}),
            ...(g.teacherComment !== undefined ? { teacherComment: g.teacherComment } : {}),
          })
          .where(eq(placementAnswersTable.id, g.answerId));
      }
    });
  }

  // recompute totalScore = sum(coalesce(manualScore, autoScore)) across all answers of this submission
  const answers = await db.select().from(placementAnswersTable).where(eq(placementAnswersTable.submissionId, sid));
  const manualScore = answers.reduce((s, a) => s + (a.manualScore ?? 0), 0);
  const autoScore = answers.reduce((s, a) => s + (a.autoScore ?? 0), 0);
  const totalScore = answers.reduce((s, a) => s + (a.manualScore ?? a.autoScore ?? 0), 0);

  const [updated] = await db
    .update(placementSubmissionsTable)
    .set({
      teacherComment: body.teacherComment ?? sub.teacherComment,
      autoScore,
      manualScore,
      totalScore,
      gradingStatus: "graded",
      gradedAt: new Date(),
      gradedBy: user.id,
    })
    .where(eq(placementSubmissionsTable.id, sid))
    .returning();
  res.json(updated);
});

// POST /placement-submissions/:sid/send-result
router.post("/placement-submissions/:sid/send-result", requireAuth, async (req, res): Promise<void> => {
  const user = req.dbUser!;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const sid = Number(req.params["sid"]);
  const [sub] = await db.select().from(placementSubmissionsTable).where(eq(placementSubmissionsTable.id, sid)).limit(1);
  if (!sub) { res.status(404).json({ error: "Not found" }); return; }
  if (sub.gradingStatus !== "graded") { res.status(400).json({ error: "Submission chưa được chấm" }); return; }
  const [test] = await db.select().from(placementTestsTable).where(eq(placementTestsTable.id, sub.testId)).limit(1);
  if (!test) { res.status(404).json({ error: "Test not found" }); return; }

  try {
    await sendPlacementResultEmail({
      to: sub.studentEmail,
      studentName: sub.studentName,
      testTitle: test.title,
      totalScore: sub.totalScore ?? 0,
      maxScore: test.maxScore ?? 0,
      passScore: test.passScore,
      teacherComment: sub.teacherComment,
      reviewUrl: null,
    });
  } catch (e) {
    console.error("sendPlacementResultEmail failed:", e);
    res.status(500).json({ error: "Gửi email thất bại" }); return;
  }

  const [updated] = await db
    .update(placementSubmissionsTable)
    .set({ resultSentAt: new Date() })
    .where(eq(placementSubmissionsTable.id, sid))
    .returning();
  res.json(updated);
});

// ========================
// STUDENT (PUBLIC) ENDPOINTS
// ========================

// GET /public/placement-tests/:slug (no auth)
router.get("/public/placement-tests/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params["slug"]);
  const [test] = await db.select().from(placementTestsTable).where(eq(placementTestsTable.linkSlug, slug)).limit(1);
  if (!test) { res.status(404).json({ error: "Bài test không tồn tại" }); return; }
  if (!test.linkActive || test.status !== "active") { res.status(403).json({ error: "Bài test hiện không khả dụng" }); return; }
  if (test.linkExpiresAt && new Date(test.linkExpiresAt) < new Date()) { res.status(403).json({ error: "Link bài test đã hết hạn" }); return; }

  const questions = await db
    .select({
      id: placementTestQuestionsTable.id,
      orderIndex: placementTestQuestionsTable.orderIndex,
      type: placementTestQuestionsTable.type,
      content: placementTestQuestionsTable.content,
      options: placementTestQuestionsTable.options,
      points: placementTestQuestionsTable.points,
      audioUrl: placementTestQuestionsTable.audioUrl,
      videoUrl: placementTestQuestionsTable.videoUrl,
      imageUrl: placementTestQuestionsTable.imageUrl,
      passage: placementTestQuestionsTable.passage,
      metadata: placementTestQuestionsTable.metadata,
    })
    .from(placementTestQuestionsTable)
    .where(eq(placementTestQuestionsTable.testId, test.id))
    .orderBy(placementTestQuestionsTable.orderIndex);

  res.json({
    id: test.id,
    title: test.title,
    description: test.description,
    instructions: test.instructions,
    timeLimitMinutes: test.timeLimitMinutes,
    maxScore: test.maxScore,
    passScore: test.passScore,
    questionCount: questions.length,
    questions,
  });
});

// POST /public/placement-tests/:slug/start (no auth)
router.post("/public/placement-tests/:slug/start", async (req, res): Promise<void> => {
  const slug = String(req.params["slug"]);
  const body = req.body as { studentName: string; studentEmail: string };
  if (!body.studentName?.trim() || !body.studentEmail?.trim()) { res.status(400).json({ error: "Họ tên và email là bắt buộc" }); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.studentEmail)) { res.status(400).json({ error: "Email không hợp lệ" }); return; }

  const [test] = await db.select().from(placementTestsTable).where(eq(placementTestsTable.linkSlug, slug)).limit(1);
  if (!test) { res.status(404).json({ error: "Bài test không tồn tại" }); return; }
  if (!test.linkActive || test.status !== "active") { res.status(403).json({ error: "Bài test hiện không khả dụng" }); return; }
  if (test.linkExpiresAt && new Date(test.linkExpiresAt).getTime() < Date.now()) {
    res.status(403).json({ error: "Link đã hết hạn" }); return;
  }

  // If not allowRetake, block if email has any existing submission (submitted or still in-progress)
  if (!test.allowRetake) {
    const existing = await db
      .select({ id: placementSubmissionsTable.id })
      .from(placementSubmissionsTable)
      .where(and(
        eq(placementSubmissionsTable.testId, test.id),
        eq(placementSubmissionsTable.studentEmail, body.studentEmail.trim().toLowerCase()),
      ))
      .limit(1);
    if (existing.length > 0) { res.status(409).json({ error: "Email này đã bắt đầu/nộp bài rồi" }); return; }
  }

  const [sub] = await db
    .insert(placementSubmissionsTable)
    .values({
      testId: test.id,
      studentName: body.studentName.trim(),
      studentEmail: body.studentEmail.trim().toLowerCase(),
    })
    .returning();
  res.status(201).json({ submissionId: sub.id, token: crypto.createHash("sha256").update(`${sub.id}:${sub.studentEmail}:${sub.startedAt.getTime()}`).digest("hex").slice(0, 32) });
});

function validateSubmissionToken(sub: { id: number; studentEmail: string; startedAt: Date }, token: string): boolean {
  const expected = crypto.createHash("sha256").update(`${sub.id}:${sub.studentEmail}:${sub.startedAt.getTime()}`).digest("hex").slice(0, 32);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

// POST /public/placement-submissions/:sid/submit (no auth, requires token)
router.post("/public/placement-submissions/:sid/submit", async (req, res): Promise<void> => {
  const sid = Number(req.params["sid"]);
  const body = req.body as { token: string; answers: Array<{ questionId: number; answer: string | null }> };
  if (!body.token) { res.status(401).json({ error: "Thiếu token" }); return; }

  const [sub] = await db.select().from(placementSubmissionsTable).where(eq(placementSubmissionsTable.id, sid)).limit(1);
  if (!sub) { res.status(404).json({ error: "Submission không tồn tại" }); return; }
  if (sub.submittedAt) { res.status(409).json({ error: "Bài này đã nộp rồi" }); return; }
  try {
    if (!validateSubmissionToken(sub, body.token)) { res.status(401).json({ error: "Token không hợp lệ" }); return; }
  } catch { res.status(401).json({ error: "Token không hợp lệ" }); return; }

  const [test] = await db.select().from(placementTestsTable).where(eq(placementTestsTable.id, sub.testId)).limit(1);
  if (!test) { res.status(404).json({ error: "Test not found" }); return; }

  // Re-check availability at submit time
  if (!test.linkActive || test.status === "closed") {
    res.status(403).json({ error: "Bài test đã đóng" }); return;
  }
  if (test.linkExpiresAt && new Date(test.linkExpiresAt).getTime() < Date.now()) {
    res.status(403).json({ error: "Link đã hết hạn" }); return;
  }
  // Enforce server-side time limit (grace: 30s for network latency)
  if (test.timeLimitMinutes != null && test.timeLimitMinutes > 0) {
    const deadline = new Date(sub.startedAt).getTime() + test.timeLimitMinutes * 60_000 + 30_000;
    if (Date.now() > deadline) {
      res.status(403).json({ error: "Đã hết thời gian làm bài" }); return;
    }
  }

  const questions = await db.select().from(placementTestQuestionsTable).where(eq(placementTestQuestionsTable.testId, sub.testId));
  const qMap = new Map(questions.map(q => [q.id, q]));

  const answerRows: Array<typeof placementAnswersTable.$inferInsert> = [];
  let autoScore = 0;
  let answeredCount = 0;
  for (const a of body.answers ?? []) {
    const q = qMap.get(a.questionId);
    if (!q) continue;
    if (a.answer != null && a.answer.trim() !== "") answeredCount++;
    const { isCorrect, autoScore: as } = gradePlacementAnswer(q, a.answer);
    autoScore += as;
    answerRows.push({
      submissionId: sid,
      questionId: a.questionId,
      studentAnswer: a.answer ?? null,
      isCorrect,
      autoScore: as,
    });
  }

  if (answerRows.length > 0) {
    await db.insert(placementAnswersTable).values(answerRows);
  }

  const now = new Date();
  const hasManual = questions.some(q => q.type === "long_answer" || q.type === "short_answer");
  const gradingStatus = hasManual ? "pending" : "graded";
  const totalScore = hasManual ? autoScore : autoScore; // manual will be added later

  const [updated] = await db
    .update(placementSubmissionsTable)
    .set({
      submittedAt: now,
      autoScore,
      totalScore,
      gradingStatus,
      ...(gradingStatus === "graded" ? { gradedAt: now } : {}),
    })
    .where(eq(placementSubmissionsTable.id, sid))
    .returning();

  // Fire emails in background (don't block response)
  (async () => {
    try {
      await sendPlacementSubmitConfirmEmail({
        to: updated.studentEmail,
        studentName: updated.studentName,
        testTitle: test.title,
        submittedAt: now,
        answeredCount,
        totalCount: questions.length,
        autoScore,
        maxScore: test.maxScore,
        showScoreImmediately: test.showScoreImmediately,
      });
    } catch (e) { console.error("submit-confirm email failed", e); }

    if (test.notifyTeacherEmail && test.createdBy) {
      try {
        const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, test.createdBy)).limit(1);
        if (teacher?.email) {
          const [{ pending }] = await db
            .select({ pending: sql<number>`COUNT(*)::int` })
            .from(placementSubmissionsTable)
            .where(and(eq(placementSubmissionsTable.gradingStatus, "pending"), sql`${placementSubmissionsTable.submittedAt} IS NOT NULL`));
          await sendPlacementNewSubmissionEmail({
            to: teacher.email,
            teacherName: teacher.name ?? undefined,
            studentName: updated.studentName,
            studentEmail: updated.studentEmail,
            testTitle: test.title,
            submissionId: updated.id,
            pendingCount: pending ?? 0,
          });
        }
      } catch (e) { console.error("teacher notify email failed", e); }
    }
  })();

  res.json({
    submissionId: updated.id,
    submittedAt: updated.submittedAt,
    autoScore,
    maxScore: test.maxScore,
    showScore: test.showScoreImmediately,
    gradingStatus,
  });
});

export default router;
