import { Router, type IRouter } from "express";
import { eq, and, or, sql, inArray } from "drizzle-orm";
import { db, submissionsTable, submissionAnswersTable, assignmentsTable, usersTable, assignmentQuestionsTable, courseMembersTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { updateStreak, checkAndAwardBadges } from "./gamification";
import {
  ListSubmissionsQueryParams,
  ListSubmissionsResponse,
  CreateSubmissionBody,
  GetSubmissionParams,
  GetSubmissionResponse,
  GradeSubmissionParams,
  GradeSubmissionBody,
  GradeSubmissionResponse,
  GradeQuestionParams,
  GradeQuestionBody,
  GradeQuestionResponse,
  PublishGradesParams,
  PublishGradesResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const TEACHER_ROLES = ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"];

async function getSubmissionResult(id: number) {
  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, id));
  if (!submission) return null;
  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, submission.assignmentId));
  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, submission.studentId));
  const answers = await db.select().from(submissionAnswersTable).where(eq(submissionAnswersTable.submissionId, id));
  const percentage = submission.totalPoints > 0 && submission.score != null
    ? Math.round((submission.score / submission.totalPoints) * 100 * 10) / 10
    : null;

  return {
    id: submission.id,
    assignmentId: submission.assignmentId,
    assignmentTitle: assignment?.title ?? "",
    studentId: submission.studentId,
    studentName: student?.name ?? "",
    score: submission.score ?? null,
    totalPoints: submission.totalPoints,
    percentage,
    status: submission.status,
    submittedAt: submission.submittedAt.toISOString(),
    gradedAt: submission.gradedAt?.toISOString() ?? null,
    feedback: submission.feedback ?? null,
    answers: answers.map(a => ({
      questionId: a.questionId,
      answer: a.answer,
      correctAnswer: null as string | null,
      isCorrect: a.isCorrect === "true" ? true : a.isCorrect === "false" ? false : null,
      pointsEarned: a.pointsEarned,
      feedback: a.feedback ?? null,
      teacherComment: a.teacherComment ?? null,
    })),
  };
}

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

const MANUAL_TYPES = ["essay"];

type QuestionLike = { type: string; correctAnswer: string | null; options: string | null; points: number; metadata?: string | null; content?: string; level?: string; };

async function aiGradeEssay(essayContent: string, questionContent: string, maxPoints: number, level: string): Promise<{ score: number; feedback: string }> {
  const prompt = `You are an expert English language teacher. Grade the following essay answer.

Question: ${questionContent}
Student Level: ${level ?? "B1"}
Maximum Points: ${maxPoints}

Student's Essay:
${essayContent}

Return a JSON object with EXACTLY these fields:
{"score": <number 0-${maxPoints}>, "overallFeedback": "<2-3 sentence feedback in Vietnamese>"}

Respond only with the JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : raw);
    const score = Math.min(maxPoints, Math.max(0, Number(parsed.score ?? 0)));
    return { score, feedback: String(parsed.overallFeedback ?? "") };
  } catch {
    return { score: 0, feedback: "" };
  }
}

function gradeAnswer(question: QuestionLike, studentAnswer: string): { isCorrect: boolean | null; pointsEarned: number } {
  if (question.type === "essay") {
    const meta = safeJson<Record<string, unknown>>(question.metadata, {});
    if (!meta.autoGrade) return { isCorrect: null, pointsEarned: 0 };
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
    const pointsEarned = Math.round(question.points * ratio);
    return { isCorrect: ratio === 1, pointsEarned };
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
    for (const pair of pairs) {
      if (studentMatches[pair.left] === pair.right) correct++;
    }
    const ratio = correct / pairs.length;
    return { isCorrect: ratio === 1, pointsEarned: Math.round(question.points * ratio) };
  }

  if (question.type === "drag_drop") {
    const ddOpts = safeJson<{ items: string[]; zones: Array<{ label: string; accepts: string[] }> }>(opts, { items: [], zones: [] });
    if (ddOpts.zones.length === 0) return { isCorrect: null, pointsEarned: 0 };
    const studentZones = safeJson<Record<string, string[]>>(studentAnswer, {});
    let correct = 0;
    let total = 0;
    for (const zone of ddOpts.zones) {
      const placed = studentZones[zone.label] ?? [];
      for (const item of zone.accepts) {
        total++;
        if (placed.includes(item)) correct++;
      }
    }
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
    let earned = 0;
    let total = 0;
    let allCorrect = true;
    for (let i = 0; i < subQs.length; i++) {
      const subPts = subQs[i].points ?? 1;
      total += subPts;
      const isSubCorrect = (studentSubs[String(i)] ?? "").trim().toLowerCase() === (subQs[i].correctAnswer ?? "").trim().toLowerCase();
      if (isSubCorrect) earned += subPts;
      else allCorrect = false;
    }
    return { isCorrect: total > 0 && allCorrect, pointsEarned: earned };
  }

  if (question.type === "video_interactive") {
    type VQ = { timestamp: number; type?: string; question: string; choices: string[]; correctAnswer: string; points?: number };
    const allVqs = safeJson<VQ[]>(opts, []);
    const studentVA = safeJson<Record<string, string>>(studentAnswer, {});
    let correct = 0;
    let totalQ = 0;
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

router.get("/submissions", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "User not found" }); return; }

  const params = ListSubmissionsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const conditions = [];
  const isStudentView = !TEACHER_ROLES.includes(dbUser.role);

  conditions.push(eq(submissionsTable.isFinal, true));

  if (isStudentView) {
    conditions.push(eq(submissionsTable.studentId, dbUser.id));
  } else {
    if (dbUser.role !== "system_admin") {
      const ownedAssignments = await db.select({ id: assignmentsTable.id }).from(assignmentsTable).where(eq(assignmentsTable.teacherId, dbUser.id));
      const ownedIds = ownedAssignments.map(a => a.id);
      if (ownedIds.length === 0) { res.json(ListSubmissionsResponse.parse([])); return; }
      conditions.push(or(...ownedIds.map(id => eq(submissionsTable.assignmentId, id))));
    }
  }

  if (params.data.assignmentId) conditions.push(eq(submissionsTable.assignmentId, params.data.assignmentId));
  if (params.data.studentId) {
    if (!TEACHER_ROLES.includes(dbUser.role) && params.data.studentId !== dbUser.id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    conditions.push(eq(submissionsTable.studentId, params.data.studentId));
  }
  if (params.data.status) conditions.push(eq(submissionsTable.status, params.data.status));

  const submissions = conditions.length > 0
    ? await db.select().from(submissionsTable).where(and(...conditions))
    : await db.select().from(submissionsTable);

  const result = await Promise.all(submissions.map(async s => {
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, s.assignmentId));
    const [student] = await db.select().from(usersTable).where(eq(usersTable.id, s.studentId));
    const percentage = s.totalPoints > 0 && s.score != null
      ? Math.round((s.score / s.totalPoints) * 100 * 10) / 10
      : null;
    return {
      id: s.id,
      assignmentId: s.assignmentId,
      assignmentTitle: assignment?.title ?? "",
      studentId: s.studentId,
      studentName: student?.name ?? "",
      score: s.score ?? null,
      totalPoints: s.totalPoints,
      percentage,
      status: s.status,
      submittedAt: s.submittedAt.toISOString(),
      gradedAt: s.gradedAt?.toISOString() ?? null,
    };
  }));

  res.json(ListSubmissionsResponse.parse(result));
});

router.post("/submissions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSubmissionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "User not found. Please complete your profile." }); return; }

  const isTeacher = TEACHER_ROLES.includes(dbUser.role);
  const isPreview = parsed.data.isPreview === true && isTeacher;

  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, parsed.data.assignmentId));
  if (!assignment) { res.status(404).json({ error: "Assignment not found" }); return; }

  if (!isPreview && assignment.status !== "published") {
    res.status(400).json({ error: "Assignment is not open for submissions" }); return;
  }

  if (!isTeacher && assignment.courseId) {
    const [membership] = await db.select().from(courseMembersTable).where(
      and(eq(courseMembersTable.courseId, assignment.courseId), eq(courseMembersTable.userId, dbUser.id))
    );
    if (!membership) { res.status(403).json({ error: "You are not enrolled in this course" }); return; }
  }

  if (!isPreview && !isTeacher) {
    const now = new Date();
    if (assignment.startTime && now < assignment.startTime) {
      res.status(400).json({ error: "Bài tập chưa mở" }); return;
    }
    if (assignment.endTime && now > assignment.endTime) {
      res.status(400).json({ error: "Bài tập đã đóng" }); return;
    }

    const existingCount = await db.select({ count: sql<number>`count(*)` })
      .from(submissionsTable)
      .where(and(eq(submissionsTable.assignmentId, assignment.id), eq(submissionsTable.studentId, dbUser.id)));
    const count = Number(existingCount[0]?.count ?? 0);
    if (assignment.maxAttempts > 0 && count >= assignment.maxAttempts) {
      res.status(400).json({ error: `Đã đạt giới hạn ${assignment.maxAttempts} lần nộp bài` }); return;
    }
  }

  const aqRows = await db.select().from(assignmentQuestionsTable)
    .where(eq(assignmentQuestionsTable.assignmentId, parsed.data.assignmentId))
    .orderBy(assignmentQuestionsTable.orderIndex);

  const questionMap = new Map<number, QuestionLike & { correctAnswer: string | null }>();
  for (const aq of aqRows) {
    questionMap.set(aq.id, {
      type: aq.type,
      correctAnswer: aq.correctAnswer ?? null,
      options: aq.options ?? null,
      points: aq.points,
      metadata: aq.metadata ?? null,
      content: aq.content,
      level: aq.level,
    });
  }

  let totalScore = 0;
  const answerResults: Array<{
    questionId: number;
    answer: string;
    isCorrect: string | null;
    pointsEarned: number;
    feedback: string | null;
  }> = [];

  const seenQuestionIds = new Set<number>();
  for (const ans of parsed.data.answers) {
    if (seenQuestionIds.has(ans.questionId)) continue;
    seenQuestionIds.add(ans.questionId);
    const question = questionMap.get(ans.questionId);
    if (!question) continue;
    const { isCorrect, pointsEarned } = gradeAnswer(question, ans.answer);
    totalScore += pointsEarned;
    answerResults.push({
      questionId: ans.questionId,
      answer: ans.answer,
      isCorrect: isCorrect === null ? null : isCorrect ? "true" : "false",
      pointsEarned,
      feedback: null,
    });
  }

  // AI auto-grade essays where enabled (question metadata OR assignment level)
  const essayAnswers = answerResults.filter(ar => {
    const q = questionMap.get(ar.questionId);
    if (!q || q.type !== "essay") return false;
    const meta = safeJson<Record<string, unknown>>(q.metadata, {});
    return meta.autoGrade === true || assignment.autoGrade === true;
  });
  for (const ar of essayAnswers) {
    const q = questionMap.get(ar.questionId)!;
    try {
      const { score, feedback } = await aiGradeEssay(ar.answer, q.content ?? "", q.points, q.level ?? "B1");
      ar.pointsEarned = score;
      ar.isCorrect = score >= q.points ? "true" : score > 0 ? "false" : "false";
      ar.feedback = feedback || null;
      totalScore += score;
    } catch {
      // leave as 0 if AI fails
    }
  }

  // If the assignment-level autoGrade flag is on, always mark as auto-graded
  // (AI has already run for essays above; non-essay types are graded by correctAnswer)
  const autoGraded = questionMap.size > 0 && (
    assignment.autoGrade === true ||
    Array.from(questionMap.values()).every(q => {
      if (q.type === "essay") {
        const meta = safeJson<Record<string, unknown>>(q.metadata, {});
        return meta.autoGrade === true;
      }
      if ((q.type === "reading" || q.type === "listening") && !q.correctAnswer) return false;
      return true;
    })
  );

  if (isPreview) {
    const percentage = assignment.totalPoints > 0 ? Math.round((totalScore / assignment.totalPoints) * 100 * 10) / 10 : null;
    res.status(200).json({
      id: 0,
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      studentId: dbUser.id,
      studentName: dbUser.name ?? "",
      score: autoGraded ? totalScore : null,
      totalPoints: assignment.totalPoints,
      percentage,
      status: autoGraded ? "graded" : "pending_review",
      submittedAt: new Date().toISOString(),
      gradedAt: autoGraded ? new Date().toISOString() : null,
      feedback: null,
      answers: answerResults.map(ar => ({
        questionId: ar.questionId,
        answer: ar.answer,
        correctAnswer: questionMap.get(ar.questionId)?.correctAnswer ?? null,
        isCorrect: ar.isCorrect === "true" ? true : ar.isCorrect === "false" ? false : null,
        pointsEarned: ar.pointsEarned,
        feedback: null,
        teacherComment: null,
      })),
      isPreview: true,
    });
    return;
  }

  if (!isTeacher) {
    await db.update(submissionsTable).set({ isFinal: false })
      .where(and(eq(submissionsTable.assignmentId, assignment.id), eq(submissionsTable.studentId, dbUser.id)));
  }

  const [submission] = await db.insert(submissionsTable).values({
    assignmentId: parsed.data.assignmentId,
    studentId: dbUser.id,
    score: autoGraded ? totalScore : null,
    totalPoints: assignment.totalPoints,
    status: autoGraded ? "graded" : "pending_review",
    gradedAt: autoGraded ? new Date() : null,
    isFinal: !isTeacher,
  }).returning();

  for (const ar of answerResults) {
    await db.insert(submissionAnswersTable).values({
      submissionId: submission.id,
      questionId: ar.questionId,
      answer: ar.answer,
      isCorrect: ar.isCorrect,
      pointsEarned: ar.pointsEarned,
      feedback: ar.feedback,
    });
  }

  const result = await getSubmissionResult(submission.id);
  if (result) {
    const showCorrectAnswer = assignment.allowReview || isTeacher;
    result.answers = result.answers.map((a, i) => ({
      ...a,
      correctAnswer: showCorrectAnswer && answerResults[i] ? (questionMap.get(answerResults[i]!.questionId)?.correctAnswer ?? null) : null,
    }));
  }

  try {
    await updateStreak(dbUser.id);
    await checkAndAwardBadges(dbUser.id);
  } catch (err) {}

  res.status(201).json(result);
});

router.get("/submissions/:id", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "User not found" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSubmissionParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const result = await getSubmissionResult(params.data.id);
  if (!result) { res.status(404).json({ error: "Submission not found" }); return; }

  const isStudent = !TEACHER_ROLES.includes(dbUser.role);
  if (isStudent && result.studentId !== dbUser.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  if (isStudent) {
    if (result.status === "pending_review") {
      res.json(GetSubmissionResponse.parse({
        ...result,
        score: null,
        percentage: null,
        answers: result.answers.map(a => ({ ...a, correctAnswer: null, feedback: null, teacherComment: null, pointsEarned: null, isCorrect: null })),
      }));
      return;
    }
    if (result.status !== "published") {
      const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, result.assignmentId));
      if (assignment && !assignment.allowReview) {
        res.status(403).json({ error: "Giáo viên chưa cho phép xem lại bài làm" }); return;
      }
    }
  }

  if (TEACHER_ROLES.includes(dbUser.role) && dbUser.role !== "system_admin") {
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, result.assignmentId));
    if (!assignment || assignment.teacherId !== dbUser.id) {
      res.status(403).json({ error: "Forbidden: not your assignment" }); return;
    }
  }

  res.json(GetSubmissionResponse.parse(result));
});

router.patch("/submissions/:id/grade", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "User not found" }); return; }

  if (!TEACHER_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Only teachers can grade submissions" }); return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GradeSubmissionParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = GradeSubmissionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Submission not found" }); return; }

  if (dbUser.role !== "system_admin") {
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, existing.assignmentId));
    if (!assignment || assignment.teacherId !== dbUser.id) {
      res.status(403).json({ error: "Forbidden: not your assignment" }); return;
    }
  }

  await db.update(submissionsTable).set({
    score: parsed.data.score,
    feedback: parsed.data.feedback ?? null,
    status: "graded",
    gradedAt: new Date(),
  }).where(eq(submissionsTable.id, params.data.id));

  const result = await getSubmissionResult(params.data.id);
  if (!result) { res.status(404).json({ error: "Submission not found" }); return; }
  res.json(GradeSubmissionResponse.parse(result));
});

router.patch("/submissions/:id/answers/:questionId", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "User not found" }); return; }

  if (!TEACHER_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Only teachers can grade questions" }); return;
  }

  const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const qidRaw = Array.isArray(req.params.questionId) ? req.params.questionId[0] : req.params.questionId;
  const params = GradeQuestionParams.safeParse({ id: parseInt(idRaw!, 10), questionId: parseInt(qidRaw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = GradeQuestionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Submission not found" }); return; }

  if (dbUser.role !== "system_admin") {
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, existing.assignmentId));
    if (!assignment || assignment.teacherId !== dbUser.id) {
      res.status(403).json({ error: "Forbidden: not your assignment" }); return;
    }
  }

  const [answerRow] = await db.select().from(submissionAnswersTable)
    .where(and(eq(submissionAnswersTable.submissionId, params.data.id), eq(submissionAnswersTable.questionId, params.data.questionId)));
  if (!answerRow) { res.status(404).json({ error: "Answer not found" }); return; }

  const questions = await db.select().from(assignmentQuestionsTable)
    .where(eq(assignmentQuestionsTable.assignmentId, existing.assignmentId));
  const question = questions.find(q => q.questionId === params.data.questionId);
  const isEssay = question?.type === "essay";

  const updateData: Record<string, unknown> = {};
  if (parsed.data.teacherComment !== undefined) {
    updateData.teacherComment = parsed.data.teacherComment;
  }
  if (parsed.data.pointsEarned !== undefined && isEssay) {
    updateData.pointsEarned = parsed.data.pointsEarned;
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(submissionAnswersTable).set(updateData)
      .where(and(eq(submissionAnswersTable.submissionId, params.data.id), eq(submissionAnswersTable.questionId, params.data.questionId)));
  }

  const allAnswers = await db.select().from(submissionAnswersTable)
    .where(eq(submissionAnswersTable.submissionId, params.data.id));
  const newTotal = allAnswers.reduce((sum, a) => sum + a.pointsEarned, 0);

  await db.update(submissionsTable).set({ score: newTotal }).where(eq(submissionsTable.id, params.data.id));

  const [updatedAnswer] = await db.select().from(submissionAnswersTable)
    .where(and(eq(submissionAnswersTable.submissionId, params.data.id), eq(submissionAnswersTable.questionId, params.data.questionId)));

  res.json(GradeQuestionResponse.parse({
    success: true,
    questionId: params.data.questionId,
    pointsEarned: updatedAnswer?.pointsEarned ?? 0,
    teacherComment: updatedAnswer?.teacherComment ?? null,
    submissionScore: newTotal,
  }));
});

router.post("/assignments/:id/publish-grades", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "User not found" }); return; }

  if (!TEACHER_ROLES.includes(dbUser.role)) {
    res.status(403).json({ error: "Only teachers can publish grades" }); return;
  }

  const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = PublishGradesParams.safeParse({ id: parseInt(idRaw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, params.data.id));
  if (!assignment) { res.status(404).json({ error: "Assignment not found" }); return; }

  if (dbUser.role !== "system_admin" && assignment.teacherId !== dbUser.id) {
    res.status(403).json({ error: "Forbidden: not your assignment" }); return;
  }

  const pendingSubs = await db.select().from(submissionsTable)
    .where(and(eq(submissionsTable.assignmentId, params.data.id), eq(submissionsTable.status, "pending_review"), eq(submissionsTable.isFinal, true)));

  if (pendingSubs.length === 0) {
    res.json(PublishGradesResponse.parse({ success: true, publishedCount: 0, message: "Không có bài nộp nào cần publish" }));
    return;
  }

  const subIds = pendingSubs.map(s => s.id);
  const now = new Date();

  await db.update(submissionsTable).set({ status: "published", gradedAt: now })
    .where(inArray(submissionsTable.id, subIds));

  for (const sub of pendingSubs) {
    try {
      await updateStreak(sub.studentId);
      await checkAndAwardBadges(sub.studentId);
    } catch {}
  }

  res.json(PublishGradesResponse.parse({
    success: true,
    publishedCount: subIds.length,
    message: `Đã publish kết quả cho ${subIds.length} bài nộp`,
  }));
});

export default router;
