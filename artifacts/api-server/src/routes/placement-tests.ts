import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  placementTestsTable,
  placementTestQuestionsTable,
  placementSubmissionsTable,
  placementAnswersTable,
  usersTable,
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

type QType = "mcq" | "true_false" | "short_answer" | "long_answer" | "fill_blank";

function gradePlacementAnswer(q: { type: string; options: unknown; correctAnswer: string | null; points: number }, studentAnswer: string | null): { isCorrect: boolean | null; autoScore: number } {
  if (studentAnswer == null || studentAnswer.trim() === "") return { isCorrect: null, autoScore: 0 };
  const type = q.type as QType;
  const norm = (s: string) => s.trim().toLowerCase();

  if (type === "long_answer") return { isCorrect: null, autoScore: 0 };

  if (type === "mcq") {
    // correct_answer can be single string or JSON array (multi-select)
    let correct: string[] = [];
    try {
      const parsed = JSON.parse(q.correctAnswer ?? "");
      correct = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
    } catch {
      correct = q.correctAnswer ? [q.correctAnswer] : [];
    }
    let student: string[] = [];
    try {
      const parsed = JSON.parse(studentAnswer);
      student = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
    } catch {
      student = [studentAnswer];
    }
    const cs = new Set(correct.map(norm));
    const ss = new Set(student.map(norm));
    const same = cs.size === ss.size && [...cs].every(v => ss.has(v));
    return { isCorrect: same, autoScore: same ? q.points : 0 };
  }

  if (type === "true_false" || type === "short_answer" || type === "fill_blank") {
    const ok = norm(studentAnswer) === norm(q.correctAnswer ?? "");
    return { isCorrect: ok, autoScore: ok ? q.points : 0 };
  }

  return { isCorrect: null, autoScore: 0 };
}

// ========================
// TEACHER ENDPOINTS
// ========================

// GET /placement-tests
router.get("/placement-tests", requireAuth, async (req, res): Promise<void> => {
  const user = res.locals.user;
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
  const user = res.locals.user;
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

// GET /placement-tests/:id (teacher view with full details)
router.get("/placement-tests/:id", requireAuth, async (req, res): Promise<void> => {
  const user = res.locals.user;
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
  const user = res.locals.user;
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
  const user = res.locals.user;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = Number(req.params["id"]);
  await db.delete(placementTestsTable).where(eq(placementTestsTable.id, id));
  res.status(204).end();
});

// POST /placement-tests/:id/publish
router.post("/placement-tests/:id/publish", requireAuth, async (req, res): Promise<void> => {
  const user = res.locals.user;
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
  const user = res.locals.user;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const testId = Number(req.params["id"]);
  const body = req.body as {
    sourceType?: string;
    sourceId?: number | null;
    type: string;
    content: string;
    options?: unknown;
    correctAnswer?: string | null;
    points?: number;
  };
  // next order index
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
      content: body.content,
      options: (body.options as any) ?? null,
      correctAnswer: body.correctAnswer ?? null,
      points: body.points ?? 1,
    })
    .returning();
  res.status(201).json(row);
});

// POST /placement-tests/:id/questions/bulk-import  (import from question bank IDs)
router.post("/placement-tests/:id/questions/bulk-import", requireAuth, async (req, res): Promise<void> => {
  const user = res.locals.user;
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
    content: q.content,
    options: q.options as any,
    correctAnswer: q.correctAnswer as any,
    points: q.points ?? 1,
  }));
  if (rows.length === 0) { res.json({ imported: 0 }); return; }
  const inserted = await db.insert(placementTestQuestionsTable).values(rows).returning();
  res.json({ imported: inserted.length, questions: inserted });
});

// PATCH /placement-test-questions/:qid
router.patch("/placement-test-questions/:qid", requireAuth, async (req, res): Promise<void> => {
  const user = res.locals.user;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const qid = Number(req.params["qid"]);
  const body = req.body as Partial<{
    content: string; type: string; options: unknown; correctAnswer: string | null; points: number;
  }>;
  const [row] = await db
    .update(placementTestQuestionsTable)
    .set(body as any)
    .where(eq(placementTestQuestionsTable.id, qid))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// DELETE /placement-test-questions/:qid
router.delete("/placement-test-questions/:qid", requireAuth, async (req, res): Promise<void> => {
  const user = res.locals.user;
  if (!isTeacherOrAdmin(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const qid = Number(req.params["qid"]);
  await db.delete(placementTestQuestionsTable).where(eq(placementTestQuestionsTable.id, qid));
  res.status(204).end();
});

// POST /placement-tests/:id/questions/reorder
router.post("/placement-tests/:id/questions/reorder", requireAuth, async (req, res): Promise<void> => {
  const user = res.locals.user;
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
  const user = res.locals.user;
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
  const user = res.locals.user;
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
  const user = res.locals.user;
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
  const user = res.locals.user;
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
