import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, submissionsTable, submissionAnswersTable, assignmentsTable, usersTable, questionsTable } from "@workspace/db";
import {
  GradeEssayBody,
  GradeEssayResponse,
  SuggestQuestionsBody,
  SuggestQuestionsResponse,
  GetPersonalizedFeedbackParams,
  GetPersonalizedFeedbackResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const TEACHER_ROLES = ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"];

router.post("/ai/grade-essay", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = GradeEssayBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { essayContent, questionContent, maxPoints, level } = parsed.data;

  try {
    const prompt = `You are an expert English language teacher and examiner. Grade the following essay answer.

Question: ${questionContent}
Student Level: ${level ?? "B1-B2"}
Maximum Points: ${maxPoints}

Student's Essay:
${essayContent}

Evaluate and return a JSON object with EXACTLY these fields (no extra text, just valid JSON):
{
  "score": <number from 0 to ${maxPoints}>,
  "grammarScore": <percentage 0-100>,
  "vocabularyScore": <percentage 0-100>,
  "structureScore": <percentage 0-100>,
  "contentScore": <percentage 0-100>,
  "overallFeedback": "<2-3 sentence overall feedback in Vietnamese>",
  "grammarFeedback": "<specific grammar feedback in Vietnamese>",
  "vocabularyFeedback": "<vocabulary usage feedback in Vietnamese>",
  "structureFeedback": "<essay structure feedback in Vietnamese>",
  "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]
}

Be fair but encouraging. Respond only with the JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const rawContent = response.choices[0]?.message?.content ?? "{}";
    let parsed2: Record<string, unknown>;

    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed2 = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON" });
      return;
    }

    const score = Math.min(maxPoints, Math.max(0, Number(parsed2.score ?? 0)));
    const percentage = maxPoints > 0 ? Math.round((score / maxPoints) * 100 * 10) / 10 : 0;

    const result = {
      score,
      maxPoints,
      percentage,
      grammarScore: Number(parsed2.grammarScore ?? 70),
      vocabularyScore: Number(parsed2.vocabularyScore ?? 70),
      structureScore: Number(parsed2.structureScore ?? 70),
      contentScore: Number(parsed2.contentScore ?? 70),
      overallFeedback: String(parsed2.overallFeedback ?? "Bài viết đã được hoàn thành."),
      grammarFeedback: String(parsed2.grammarFeedback ?? ""),
      vocabularyFeedback: String(parsed2.vocabularyFeedback ?? ""),
      structureFeedback: String(parsed2.structureFeedback ?? ""),
      suggestions: Array.isArray(parsed2.suggestions) ? parsed2.suggestions.map(String) : [],
    };

    res.json(GradeEssayResponse.parse(result));
  } catch (err) {
    console.error("AI essay grading error:", err);
    res.status(500).json({ error: "AI grading service unavailable" });
  }
});

router.post("/ai/suggest-questions", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = SuggestQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { skill, currentLevel, count, studentId } = parsed.data;
  const targetCount = count ?? 5;

  const allQuestions = await db.select().from(questionsTable).where(eq(questionsTable.skill, skill));

  if (allQuestions.length === 0) {
    res.json(SuggestQuestionsResponse.parse({
      questions: [],
      reasoning: "Không có câu hỏi nào cho kỹ năng này trong hệ thống.",
      recommendedLevel: currentLevel ?? "B1",
    }));
    return;
  }

  try {
    const questionList = allQuestions.map(q =>
      `ID:${q.id} Level:${q.level} Type:${q.type} Content:"${q.content.slice(0, 80)}"`
    ).join("\n");

    const prompt = `You are an adaptive learning system. Select the most suitable questions for a student.

Student skill area: ${skill}
Current level: ${currentLevel ?? "Unknown - assess from history"}
Number of questions needed: ${targetCount}

Available questions:
${questionList}

Return ONLY a JSON object like this:
{
  "questionIds": [<id1>, <id2>, ...],
  "recommendedLevel": "<A1|A2|B1|B2|C1|C2>",
  "reasoning": "<brief reasoning in Vietnamese>"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const rawContent = response.choices[0]?.message?.content ?? "{}";
    let aiResult: { questionIds?: number[]; recommendedLevel?: string; reasoning?: string };

    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      aiResult = { questionIds: [], recommendedLevel: currentLevel ?? "B1", reasoning: "Gợi ý tự động" };
    }

    const selectedIds = (aiResult.questionIds ?? []).slice(0, targetCount);
    const selectedQuestions = allQuestions.filter(q => selectedIds.includes(q.id));

    if (selectedQuestions.length < targetCount) {
      const remaining = allQuestions
        .filter(q => !selectedIds.includes(q.id))
        .slice(0, targetCount - selectedQuestions.length);
      selectedQuestions.push(...remaining);
    }

    res.json(SuggestQuestionsResponse.parse({
      questions: selectedQuestions.map(q => ({
        id: q.id,
        type: q.type,
        skill: q.skill,
        level: q.level,
        content: q.content,
        options: q.options ?? null,
        correctAnswer: q.correctAnswer ?? null,
        audioUrl: q.audioUrl ?? null,
        points: q.points,
        createdAt: q.createdAt.toISOString(),
      })),
      reasoning: aiResult.reasoning ?? "Câu hỏi được chọn phù hợp với trình độ học viên.",
      recommendedLevel: aiResult.recommendedLevel ?? currentLevel ?? "B1",
    }));
  } catch (err) {
    console.error("AI suggest questions error:", err);
    const fallback = allQuestions.slice(0, targetCount);
    res.json(SuggestQuestionsResponse.parse({
      questions: fallback.map(q => ({
        id: q.id,
        type: q.type,
        skill: q.skill,
        level: q.level,
        content: q.content,
        options: q.options ?? null,
        correctAnswer: q.correctAnswer ?? null,
        audioUrl: q.audioUrl ?? null,
        points: q.points,
        createdAt: q.createdAt.toISOString(),
      })),
      reasoning: "Gợi ý tự động (AI không khả dụng).",
      recommendedLevel: currentLevel ?? "B1",
    }));
  }
});

router.post("/ai/personalized-feedback/:submissionId", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const raw = Array.isArray(req.params.submissionId) ? req.params.submissionId[0] : req.params.submissionId;
  const params = GetPersonalizedFeedbackParams.safeParse({ submissionId: parseInt(raw!, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid submission ID" });
    return;
  }

  const { submissionId } = params.data;

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, submissionId));
  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  if (!TEACHER_ROLES.includes(dbUser.role) && submission.studentId !== dbUser.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, submission.studentId));
  const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, submission.assignmentId));
  const answers = await db.select().from(submissionAnswersTable).where(eq(submissionAnswersTable.submissionId, submissionId));

  const correctCount = answers.filter(a => a.isCorrect === "true").length;
  const totalAnswers = answers.length;
  const percentage = submission.totalPoints > 0 && submission.score != null
    ? Math.round((submission.score / submission.totalPoints) * 100)
    : null;

  try {
    const prompt = `You are a supportive and encouraging English teacher in Vietnam. Generate personalized feedback for a student.

Student: ${student?.name ?? "Học viên"}
Assignment: ${assignment?.title ?? "Bài tập"}
Score: ${submission.score ?? "Chưa chấm"}/${submission.totalPoints} points (${percentage ?? "?"}%)
Correct answers: ${correctCount}/${totalAnswers}

Generate encouraging, personalized feedback in Vietnamese. Return ONLY this JSON:
{
  "overallMessage": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "areasForImprovement": ["<area 1>", "<area 2>"],
  "nextSteps": ["<step 1>", "<step 2>", "<step 3>"],
  "encouragement": "<motivational closing message>"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const rawContent = response.choices[0]?.message?.content ?? "{}";
    let aiResult: Record<string, unknown>;

    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      aiResult = {};
    }

    res.json(GetPersonalizedFeedbackResponse.parse({
      submissionId,
      studentName: student?.name ?? "Học viên",
      overallMessage: String(aiResult.overallMessage ?? "Bạn đã hoàn thành bài tập tốt!"),
      strengths: Array.isArray(aiResult.strengths) ? aiResult.strengths.map(String) : ["Hoàn thành bài đúng hạn"],
      areasForImprovement: Array.isArray(aiResult.areasForImprovement) ? aiResult.areasForImprovement.map(String) : ["Cần ôn luyện thêm"],
      nextSteps: Array.isArray(aiResult.nextSteps) ? aiResult.nextSteps.map(String) : ["Tiếp tục học tập chăm chỉ"],
      encouragement: String(aiResult.encouragement ?? "Cố lên! Bạn đang tiến bộ rất tốt!"),
    }));
  } catch (err) {
    console.error("AI personalized feedback error:", err);
    res.json(GetPersonalizedFeedbackResponse.parse({
      submissionId,
      studentName: student?.name ?? "Học viên",
      overallMessage: "Bạn đã hoàn thành bài tập. Hãy tiếp tục cố gắng!",
      strengths: ["Hoàn thành bài đúng hạn", "Nỗ lực làm bài"],
      areasForImprovement: ["Cần ôn luyện thêm các dạng bài khó"],
      nextSteps: ["Ôn tập lại các câu sai", "Luyện thêm bài tập tương tự"],
      encouragement: "Hãy tiếp tục cố gắng! Mỗi ngày bạn đang tiến bộ hơn.",
    }));
  }
});

export default router;
