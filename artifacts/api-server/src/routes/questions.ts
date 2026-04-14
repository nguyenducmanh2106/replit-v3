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
import { logger } from "../lib/logger";
import multer from "multer";
import * as XLSX from "xlsx";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith(".xlsx") || file.originalname.endsWith(".xls")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file Excel (.xlsx, .xls)"));
    }
  },
});

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

const VALID_SKILLS = ["reading", "writing", "listening", "speaking", "grammar", "vocabulary"];
const VALID_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const SHEET_TYPE_MAP: Record<string, string> = {
  "MCQ": "mcq",
  "TRUE_FALSE": "true_false",
  "FILL_BLANK": "fill_blank",
  "MATCHING": "matching",
  "SENTENCE_REORDER": "sentence_reorder",
  "ESSAY": "essay",
  "WORD_SELECTION": "word_selection",
  "DRAG_DROP": "drag_drop",
  "READING": "reading",
  "LISTENING": "listening",
  "OPEN_END": "open_end",
};

function cellStr(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

function collectColumns(row: Record<string, unknown>, prefix: string): string[] {
  const results: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const val = cellStr(row, `${prefix}${i}`);
    if (val) results.push(val);
  }
  return results;
}

function parseRowByType(type: string, row: Record<string, unknown>): {
  content: string;
  options?: string;
  correctAnswer?: string;
  passage?: string;
  explanation?: string;
  metadata?: string;
  audioUrl?: string;
  videoUrl?: string;
  points: number;
  skill: string;
  level: string;
} | null {
  const content = cellStr(row, "content");
  if (!content) return null;

  const skill = cellStr(row, "skill").toLowerCase();
  const level = cellStr(row, "level").toUpperCase();
  const points = parseInt(cellStr(row, "points") || "1", 10) || 1;
  const explanation = cellStr(row, "explanation") || undefined;
  const audioUrl = cellStr(row, "audioUrl") || undefined;
  const videoUrl = cellStr(row, "videoUrl") || undefined;

  if (!VALID_SKILLS.includes(skill)) return null;
  if (!VALID_LEVELS.includes(level)) return null;

  const base = { content, skill, level, points, explanation, audioUrl, videoUrl };

  switch (type) {
    case "mcq": {
      const opts = collectColumns(row, "option");
      const correct = cellStr(row, "correctAnswer");
      const allowMultiple = cellStr(row, "allowMultiple").toLowerCase() === "true";
      if (opts.length < 2 || !correct) return null;
      if (allowMultiple) {
        const answers = correct.split(",").map(s => s.trim());
        if (!answers.every(a => opts.includes(a))) return null;
      } else {
        if (!opts.includes(correct)) return null;
      }
      return {
        ...base,
        options: JSON.stringify(opts),
        correctAnswer: correct,
        metadata: JSON.stringify({ allowMultiple }),
      };
    }
    case "true_false": {
      const correct = cellStr(row, "correctAnswer");
      if (!["Đúng", "Sai"].includes(correct)) return null;
      return {
        ...base,
        options: JSON.stringify(["Đúng", "Sai"]),
        correctAnswer: correct,
      };
    }
    case "fill_blank": {
      const answers = collectColumns(row, "answer");
      if (answers.length === 0) return null;
      return {
        ...base,
        correctAnswer: JSON.stringify(answers),
      };
    }
    case "word_selection": {
      const passage = cellStr(row, "passage");
      const words = collectColumns(row, "word");
      if (!passage || words.length === 0) return null;
      return {
        ...base,
        passage,
        correctAnswer: JSON.stringify(words),
      };
    }
    case "matching": {
      const pairs: Array<{ left: string; right: string }> = [];
      for (let i = 1; i <= 10; i++) {
        const left = cellStr(row, `left${i}`);
        const right = cellStr(row, `right${i}`);
        if (left && right) pairs.push({ left, right });
      }
      if (pairs.length < 2) return null;
      return {
        ...base,
        options: JSON.stringify(pairs),
      };
    }
    case "sentence_reorder": {
      const words = collectColumns(row, "word");
      if (words.length < 2) return null;
      return {
        ...base,
        options: JSON.stringify(words),
      };
    }
    case "essay": {
      const autoGrade = cellStr(row, "autoGrade").toLowerCase() === "true";
      return {
        ...base,
        metadata: JSON.stringify({ autoGrade }),
      };
    }
    case "open_end": {
      const allowedRaw = cellStr(row, "allowedTypes") || "text,audio,image";
      const validTypes = ["text", "audio", "image"];
      const allowedTypes = allowedRaw.split(",").map(s => s.trim().toLowerCase()).filter(t => validTypes.includes(t));
      if (allowedTypes.length === 0) allowedTypes.push("text");
      return {
        ...base,
        metadata: JSON.stringify({ allowedTypes }),
      };
    }
    case "drag_drop": {
      const items = collectColumns(row, "item");
      const zones: Array<{ label: string; accepts: string[] }> = [];
      for (let i = 1; i <= 10; i++) {
        const label = cellStr(row, `zone${i}`);
        const accepts = cellStr(row, `zone${i}_accepts`);
        if (label && accepts) {
          const acceptList = accepts.split(",").map(s => s.trim()).filter(Boolean);
          if (!acceptList.every(a => items.includes(a))) return null;
          zones.push({ label, accepts: acceptList });
        }
      }
      if (items.length < 2 || zones.length < 1) return null;
      return {
        ...base,
        options: JSON.stringify({ items, zones }),
      };
    }
    case "reading": {
      const passage = cellStr(row, "passage");
      const subQuestions: Array<{ question: string; choices: string[]; correctAnswer: string; points: number }> = [];
      for (let i = 1; i <= 10; i++) {
        const q = cellStr(row, `question${i}`);
        const choicesStr = cellStr(row, `choices${i}`);
        const ans = cellStr(row, `correct${i}`);
        const pts = parseInt(cellStr(row, `points${i}`) || "1", 10) || 1;
        if (q && choicesStr && ans) {
          const choices = choicesStr.split("|").map(s => s.trim());
          if (choices.length < 2 || !choices.includes(ans)) continue;
          subQuestions.push({ question: q, choices, correctAnswer: ans, points: pts });
        }
      }
      if (!passage || subQuestions.length === 0) return null;
      return {
        ...base,
        passage,
        options: JSON.stringify(subQuestions),
        points: subQuestions.reduce((sum, sq) => sum + sq.points, 0),
      };
    }
    case "listening": {
      const passage = cellStr(row, "passage") || undefined;
      const audio = audioUrl;
      const subQuestions: Array<{ question: string; choices: string[]; correctAnswer: string; points: number }> = [];
      for (let i = 1; i <= 10; i++) {
        const q = cellStr(row, `question${i}`);
        const choicesStr = cellStr(row, `choices${i}`);
        const ans = cellStr(row, `correct${i}`);
        const pts = parseInt(cellStr(row, `points${i}`) || "1", 10) || 1;
        if (q && choicesStr && ans) {
          const choices = choicesStr.split("|").map(s => s.trim());
          if (choices.length < 2 || !choices.includes(ans)) continue;
          subQuestions.push({ question: q, choices, correctAnswer: ans, points: pts });
        }
      }
      if (!audio || subQuestions.length === 0) return null;
      return {
        ...base,
        passage,
        audioUrl: audio,
        options: JSON.stringify(subQuestions),
        points: subQuestions.reduce((sum, sq) => sum + sq.points, 0),
      };
    }
    default:
      return null;
  }
}

router.get("/questions/import-template", requireAuth, requireTeacherRole(), async (_req, res): Promise<void> => {
  const wb = XLSX.utils.book_new();

  const mcqData = [
    { content: "Thủ đô của Việt Nam là gì?", skill: "reading", level: "A1", points: 1, explanation: "Hà Nội là thủ đô", option1: "Hà Nội", option2: "Đà Nẵng", option3: "TP.HCM", option4: "Huế", correctAnswer: "Hà Nội", allowMultiple: "false" },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mcqData), "MCQ");

  const tfData = [
    { content: "Trái đất quay quanh mặt trời", skill: "reading", level: "A1", points: 1, explanation: "", correctAnswer: "Đúng" },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tfData), "TRUE_FALSE");

  const fbData = [
    { content: "Tôi __BLANK__ học sinh", skill: "grammar", level: "A1", points: 1, explanation: "", answer1: "là", answer2: "" },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fbData), "FILL_BLANK");

  const wsData = [
    { content: "Chọn từ sai chính tả", passage: "Tôi đi hok mỗi ngày", skill: "writing", level: "A1", points: 1, explanation: "", word1: "hok", word2: "" },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), "WORD_SELECTION");

  const matchData = [
    { content: "Nối từ tiếng Anh với tiếng Việt", skill: "vocabulary", level: "A1", points: 1, explanation: "", left1: "Hello", right1: "Xin chào", left2: "Goodbye", right2: "Tạm biệt", left3: "", right3: "" },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchData), "MATCHING");

  const srData = [
    { content: "Sắp xếp thành câu đúng", skill: "grammar", level: "A1", points: 1, explanation: "", word1: "Tôi", word2: "là", word3: "học sinh", word4: "" },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(srData), "SENTENCE_REORDER");

  const essayData = [
    { content: "Viết đoạn văn về gia đình bạn", skill: "writing", level: "A2", points: 10, explanation: "", autoGrade: "false" },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(essayData), "ESSAY");

  const ddData = [
    { content: "Phân loại động vật", skill: "reading", level: "A2", points: 2, explanation: "", item1: "Chó", item2: "Cá", item3: "Mèo", zone1: "Trên cạn", zone1_accepts: "Chó,Mèo", zone2: "Dưới nước", zone2_accepts: "Cá" },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ddData), "DRAG_DROP");

  const readData = [
    { content: "Đọc đoạn văn và trả lời", skill: "reading", level: "B1", points: 2, passage: "Hà Nội là thủ đô của Việt Nam...", question1: "Thủ đô của Việt Nam là?", choices1: "Hà Nội|Đà Nẵng|Huế", correct1: "Hà Nội", points1: 1, question2: "Hà Nội ở miền nào?", choices2: "Bắc|Trung|Nam", correct2: "Bắc", points2: 1 },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readData), "READING");

  const listenData = [
    { content: "Nghe và trả lời câu hỏi", skill: "listening", level: "B1", points: 1, audioUrl: "https://example.com/audio.mp3", passage: "", question1: "Người nói đề cập đến gì?", choices1: "Du lịch|Ẩm thực|Thể thao", correct1: "Du lịch", points1: 1 },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(listenData), "LISTENING");

  const openEndData = [
    { content: "Mô tả bức tranh bạn thấy", skill: "writing", level: "A2", points: 10, explanation: "", allowedTypes: "text,audio,image" },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(openEndData), "OPEN_END");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=question_import_template.xlsx");
  res.send(Buffer.from(buf));
});

router.post("/questions/import", requireAuth, requireTeacherRole(), upload.single("file"), async (req, res): Promise<void> => {
  const dbUser = req.dbUser!;
  const file = (req as any).file;
  if (!file) {
    res.status(400).json({ error: "Không tìm thấy file" });
    return;
  }

  try {
    const wb = XLSX.read(file.buffer, { type: "buffer" });
    const results: { sheet: string; type: string; imported: number; skipped: number; errors: string[] }[] = [];

    for (const sheetName of wb.SheetNames) {
      const qType = SHEET_TYPE_MAP[sheetName.toUpperCase()];
      if (!qType) {
        results.push({ sheet: sheetName, type: "unknown", imported: 0, skipped: 0, errors: [`Sheet "${sheetName}" không khớp dạng câu hỏi nào`] });
        continue;
      }

      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]!);
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const parsed = parseRowByType(qType, row);
        if (!parsed) {
          skipped++;
          errors.push(`Dòng ${i + 2}: thiếu dữ liệu bắt buộc hoặc sai định dạng`);
          continue;
        }

        try {
          await db.insert(questionsTable).values({
            type: qType,
            skill: parsed.skill,
            level: parsed.level,
            content: parsed.content,
            options: parsed.options,
            correctAnswer: parsed.correctAnswer,
            passage: parsed.passage,
            explanation: parsed.explanation,
            audioUrl: parsed.audioUrl,
            videoUrl: parsed.videoUrl,
            metadata: parsed.metadata,
            points: parsed.points,
            createdBy: dbUser.id,
          });
          imported++;
        } catch (e: any) {
          skipped++;
          logger.warn({ err: e, row: i + 2, sheet: sheetName }, "Import row failed");
          errors.push(`Dòng ${i + 2}: Lỗi lưu vào cơ sở dữ liệu`);
        }
      }

      results.push({ sheet: sheetName, type: qType, imported, skipped, errors: errors.slice(0, 10) });
    }

    const totalImported = results.reduce((s, r) => s + r.imported, 0);
    const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

    res.json({ totalImported, totalSkipped, details: results });
  } catch (e: any) {
    res.status(400).json({ error: `Lỗi đọc file Excel: ${e.message}` });
  }
});

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
