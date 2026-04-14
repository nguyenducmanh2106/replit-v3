import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, quizSessionsTable, assignmentsTable, submissionsTable, submissionAnswersTable, assignmentQuestionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

const TEACHER_ROLES = ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"];

type QuestionLike = { type: string; correctAnswer: string | null; options: string | null; points: number; metadata?: string | null; content?: string; level?: string; };

function gradeAnswer(question: QuestionLike, studentAnswer: string): { isCorrect: boolean | null; pointsEarned: number } {
  if (question.type === "essay" || question.type === "open_end") {
    return { isCorrect: null, pointsEarned: 0 };
  }
  const ca = question.correctAnswer;
  const opts = question.options;

  if (question.type === "mcq") {
    if (!ca) return { isCorrect: null, pointsEarned: 0 };
    const isCorrect = studentAnswer.trim().toLowerCase() === ca.trim().toLowerCase();
    return { isCorrect, pointsEarned: isCorrect ? question.points : 0 };
  }
  if (question.type === "true_false") {
    if (!ca) return { isCorrect: null, pointsEarned: 0 };
    const tfMap: Record<string, string> = { "true": "đúng", "false": "sai", "đúng": "đúng", "sai": "sai" };
    const normStudent = tfMap[studentAnswer.trim().toLowerCase()] ?? studentAnswer.trim().toLowerCase();
    const normCorrect = tfMap[ca.trim().toLowerCase()] ?? ca.trim().toLowerCase();
    const isCorrect = normStudent === normCorrect;
    return { isCorrect, pointsEarned: isCorrect ? question.points : 0 };
  }
  if (question.type === "fill_blank") {
    if (!ca) return { isCorrect: null, pointsEarned: 0 };
    const correctArr = safeJson<string[]>(ca, [ca]);
    const studentArr = safeJson<string[]>(studentAnswer, [studentAnswer]);
    if (correctArr.length === 0) return { isCorrect: null, pointsEarned: 0 };
    let correct = 0;
    for (let i = 0; i < correctArr.length; i++) {
      if ((studentArr[i] ?? "").trim().toLowerCase() === (correctArr[i] ?? "").trim().toLowerCase()) correct++;
    }
    const ratio = correct / correctArr.length;
    return { isCorrect: ratio === 1, pointsEarned: Math.round(question.points * ratio) };
  }
  if (question.type === "word_selection") {
    if (!ca) return { isCorrect: null, pointsEarned: 0 };
    const correctWords = safeJson<string[]>(ca, []).map(w => w.trim().toLowerCase()).sort();
    const studentWords = studentAnswer.split(",").map(w => w.trim().toLowerCase()).filter(Boolean).sort();
    const isCorrect = correctWords.length === studentWords.length && correctWords.every((w, i) => w === studentWords[i]);
    return { isCorrect, pointsEarned: isCorrect ? question.points : 0 };
  }
  if (question.type === "matching") {
    const pairs = safeJson<Array<{ left: string; right: string }>>(opts, []);
    if (pairs.length === 0) return { isCorrect: null, pointsEarned: 0 };
    const studentMatches = safeJson<Record<string, string>>(studentAnswer, {});
    let correct = 0;
    for (const pair of pairs) { if (studentMatches[pair.left] === pair.right) correct++; }
    const ratio = correct / pairs.length;
    return { isCorrect: ratio === 1, pointsEarned: Math.round(question.points * ratio) };
  }
  if (question.type === "drag_drop") {
    const ddOpts = safeJson<{ items: string[]; zones: Array<{ label: string; accepts: string[] }> }>(opts, { items: [], zones: [] });
    if (ddOpts.zones.length === 0) return { isCorrect: null, pointsEarned: 0 };
    const studentZones = safeJson<Record<string, string[]>>(studentAnswer, {});
    let correct = 0; let total = 0;
    for (const zone of ddOpts.zones) { const placed = studentZones[zone.label] ?? []; for (const item of zone.accepts) { total++; if (placed.includes(item)) correct++; } }
    if (total === 0) return { isCorrect: null, pointsEarned: 0 };
    const ratio = correct / total;
    return { isCorrect: ratio === 1, pointsEarned: Math.round(question.points * ratio) };
  }
  if (question.type === "sentence_reorder") {
    const correctOrder = safeJson<string[]>(opts, []);
    if (correctOrder.length === 0) return { isCorrect: null, pointsEarned: 0 };
    const studentOrder = safeJson<string[]>(studentAnswer, []);
    const isCorrect = correctOrder.length === studentOrder.length && correctOrder.every((w, i) => w === studentOrder[i]);
    return { isCorrect, pointsEarned: isCorrect ? question.points : 0 };
  }
  if (question.type === "reading" || question.type === "listening") {
    type SubQ = { question: string; choices: string[]; correctAnswer: string; points?: number };
    const subQs = safeJson<SubQ[]>(opts, []);
    if (subQs.length === 0) return { isCorrect: null, pointsEarned: 0 };
    const studentSubs = safeJson<Record<string, string>>(studentAnswer, {});
    let earned = 0; let total = 0; let allCorrect = true;
    for (let i = 0; i < subQs.length; i++) {
      const subPts = subQs[i].points ?? 1; total += subPts;
      const isSubCorrect = (studentSubs[String(i)] ?? "").trim().toLowerCase() === (subQs[i].correctAnswer ?? "").trim().toLowerCase();
      if (isSubCorrect) earned += subPts; else allCorrect = false;
    }
    return { isCorrect: total > 0 && allCorrect, pointsEarned: earned };
  }
  if (question.type === "video_interactive") {
    type VQ = { timestamp: number; type?: string; question: string; choices: string[]; correctAnswer: string; points?: number };
    const allVqs = safeJson<VQ[]>(opts, []);
    const studentVA = safeJson<Record<string, string>>(studentAnswer, {});
    let correct = 0; let totalQ = 0;
    for (let i = 0; i < allVqs.length; i++) {
      if ((allVqs[i].type ?? "question") !== "question") continue;
      totalQ++;
      if ((studentVA[String(i)] ?? "").trim().toLowerCase() === (allVqs[i].correctAnswer ?? "").trim().toLowerCase()) correct++;
    }
    if (totalQ === 0) return { isCorrect: null, pointsEarned: 0 };
    const ratio = correct / totalQ;
    return { isCorrect: ratio === 1, pointsEarned: Math.round(question.points * ratio) };
  }
  if (ca) {
    const isCorrect = studentAnswer.trim().toLowerCase() === ca.trim().toLowerCase();
    return { isCorrect, pointsEarned: isCorrect ? question.points : 0 };
  }
  return { isCorrect: null, pointsEarned: 0 };
}

router.get("/assignments/:assignmentId/session", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const assignmentId = Number(req.params.assignmentId);
  if (!assignmentId) { res.status(400).json({ error: "Invalid assignment ID" }); return; }

  const [session] = await db.select().from(quizSessionsTable).where(
    and(
      eq(quizSessionsTable.userId, dbUser.id),
      eq(quizSessionsTable.assignmentId, assignmentId),
      eq(quizSessionsTable.status, "in_progress")
    )
  );

  if (!session) { res.json({ session: null }); return; }

  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId));
  if (assignment?.timeLimitMinutes) {
    const startedMs = new Date(session.startedAt).getTime();
    const durationMs = assignment.timeLimitMinutes * 60 * 1000;
    if (Date.now() > startedMs + durationMs) {
      await db.update(quizSessionsTable)
        .set({ status: "expired" })
        .where(eq(quizSessionsTable.id, session.id));
      res.json({ session: null, expired: true });
      return;
    }
  }

  const elapsedSinceLastSave = Math.floor((Date.now() - new Date(session.lastSavedAt).getTime()) / 1000);
  const adjustedTimeLeft = session.timeLeftSeconds !== null
    ? Math.max(0, session.timeLeftSeconds - elapsedSinceLastSave)
    : null;

  res.json({
    session: {
      sessionId: session.sessionId,
      answers: session.answers,
      flagged: session.flagged,
      currentQuestion: session.currentQuestion,
      timeLeftSeconds: adjustedTimeLeft,
      startedAt: session.startedAt.toISOString(),
      lastSavedAt: session.lastSavedAt.toISOString(),
    },
  });
});

router.post("/assignments/:assignmentId/session", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const assignmentId = Number(req.params.assignmentId);
  if (!assignmentId) { res.status(400).json({ error: "Invalid assignment ID" }); return; }

  const { sessionId } = req.body;
  if (!sessionId || typeof sessionId !== "string") { res.status(400).json({ error: "sessionId is required" }); return; }

  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId));
  if (!assignment) { res.status(404).json({ error: "Assignment not found" }); return; }

  const timeLeftSeconds = assignment.timeLimitMinutes ? assignment.timeLimitMinutes * 60 : null;

  const [existing] = await db.select().from(quizSessionsTable).where(
    and(
      eq(quizSessionsTable.userId, dbUser.id),
      eq(quizSessionsTable.assignmentId, assignmentId),
      eq(quizSessionsTable.status, "in_progress")
    )
  );
  if (existing) {
    res.json({ sessionId: existing.sessionId, startedAt: existing.startedAt.toISOString(), resumed: true }); return;
  }

  try {
    await db.insert(quizSessionsTable).values({
      sessionId,
      userId: dbUser.id,
      assignmentId,
      answers: {},
      flagged: [],
      currentQuestion: 0,
      timeLeftSeconds,
      status: "in_progress",
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      const [conflict] = await db.select().from(quizSessionsTable).where(
        and(eq(quizSessionsTable.userId, dbUser.id), eq(quizSessionsTable.assignmentId, assignmentId), eq(quizSessionsTable.status, "in_progress"))
      );
      if (conflict) { res.json({ sessionId: conflict.sessionId, startedAt: conflict.startedAt.toISOString(), resumed: true }); return; }
    }
    throw err;
  }

  res.json({ sessionId, startedAt: new Date().toISOString() });
});

router.patch("/assignments/:assignmentId/session", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const assignmentId = Number(req.params.assignmentId);
  if (!assignmentId) { res.status(400).json({ error: "Invalid assignment ID" }); return; }

  const { sessionId, answers, flagged, currentQuestion, timeLeftSeconds } = req.body;
  if (!sessionId) { res.status(400).json({ error: "sessionId is required" }); return; }

  const [session] = await db.select().from(quizSessionsTable).where(
    and(
      eq(quizSessionsTable.sessionId, sessionId),
      eq(quizSessionsTable.userId, dbUser.id),
      eq(quizSessionsTable.assignmentId, assignmentId),
      eq(quizSessionsTable.status, "in_progress")
    )
  );

  if (!session) {
    res.status(404).json({ error: "Session not found or already submitted" }); return;
  }

  const updateData: Record<string, unknown> = { lastSavedAt: new Date() };
  if (answers !== undefined && typeof answers === "object") updateData.answers = answers;
  if (flagged !== undefined && Array.isArray(flagged)) updateData.flagged = flagged;
  if (currentQuestion !== undefined && typeof currentQuestion === "number" && currentQuestion >= 0) updateData.currentQuestion = currentQuestion;
  if (timeLeftSeconds !== undefined && typeof timeLeftSeconds === "number" && timeLeftSeconds >= 0) updateData.timeLeftSeconds = timeLeftSeconds;

  await db.update(quizSessionsTable)
    .set(updateData as any)
    .where(eq(quizSessionsTable.id, session.id));

  res.json({ saved: true, lastSavedAt: new Date().toISOString() });
});

router.post("/assignments/:assignmentId/session/beacon", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const assignmentId = Number(req.params.assignmentId);
  if (!assignmentId) { res.status(400).json({ error: "Invalid assignment ID" }); return; }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { res.status(400).json({ error: "Invalid JSON" }); return; }
  }

  const { sessionId, answers, flagged: fl, currentQuestion, timeLeftSeconds } = body;
  if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }

  const [session] = await db.select().from(quizSessionsTable).where(
    and(
      eq(quizSessionsTable.sessionId, sessionId),
      eq(quizSessionsTable.userId, dbUser.id),
      eq(quizSessionsTable.assignmentId, assignmentId),
      eq(quizSessionsTable.status, "in_progress")
    )
  );

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const updateData: Record<string, unknown> = { lastSavedAt: new Date() };
  if (answers !== undefined && typeof answers === "object") updateData.answers = answers;
  if (fl !== undefined && Array.isArray(fl)) updateData.flagged = fl;
  if (currentQuestion !== undefined && typeof currentQuestion === "number" && currentQuestion >= 0) updateData.currentQuestion = currentQuestion;
  if (timeLeftSeconds !== undefined && typeof timeLeftSeconds === "number" && timeLeftSeconds >= 0) updateData.timeLeftSeconds = timeLeftSeconds;

  await db.update(quizSessionsTable)
    .set(updateData as any)
    .where(eq(quizSessionsTable.id, session.id));

  res.json({ saved: true });
});

router.post("/assignments/:assignmentId/session/submit", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const assignmentId = Number(req.params.assignmentId);
  if (!assignmentId) { res.status(400).json({ error: "Invalid assignment ID" }); return; }

  const { sessionId } = req.body;

  if (sessionId) {
    const [session] = await db.select().from(quizSessionsTable).where(
      and(
        eq(quizSessionsTable.sessionId, sessionId),
        eq(quizSessionsTable.userId, dbUser.id)
      )
    );
    if (session) {
      await db.update(quizSessionsTable)
        .set({ status: "submitted" })
        .where(eq(quizSessionsTable.id, session.id));
    }
  }

  res.json({ ok: true });
});

router.delete("/assignments/:assignmentId/session", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const assignmentId = Number(req.params.assignmentId);
  if (!assignmentId) { res.status(400).json({ error: "Invalid assignment ID" }); return; }

  await db.delete(quizSessionsTable).where(
    and(
      eq(quizSessionsTable.userId, dbUser.id),
      eq(quizSessionsTable.assignmentId, assignmentId),
      eq(quizSessionsTable.status, "in_progress")
    )
  );

  res.json({ deleted: true });
});

router.post("/assignments/:assignmentId/session/heartbeat", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const assignmentId = Number(req.params.assignmentId);
  const { sessionId } = req.body;
  if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }

  const [session] = await db.select().from(quizSessionsTable).where(
    and(
      eq(quizSessionsTable.sessionId, sessionId),
      eq(quizSessionsTable.userId, dbUser.id),
      eq(quizSessionsTable.status, "in_progress")
    )
  );

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId));
  if (assignment?.timeLimitMinutes) {
    const startedMs = new Date(session.startedAt).getTime();
    const durationMs = assignment.timeLimitMinutes * 60 * 1000;
    if (Date.now() > startedMs + durationMs) {
      await db.update(quizSessionsTable)
        .set({ status: "expired" })
        .where(eq(quizSessionsTable.id, session.id));
      res.json({ expired: true });
      return;
    }
  }

  await db.update(quizSessionsTable)
    .set({ lastSavedAt: new Date() } as any)
    .where(eq(quizSessionsTable.id, session.id));

  res.json({ ok: true });
});

export default router;
