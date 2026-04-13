import { useParams, useLocation } from "wouter";
import {
  useGetAssignment, useUpdateAssignment, useListQuestions,
  useAddQuestionToAssignment, useRemoveQuestionFromAssignment,
  getGetAssignmentQueryKey, getListAssignmentsQueryKey,
  useListQuizTemplates, useImportFromTemplate,
  useListCourses, useUpdateAssignmentQuestion,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import {
  Play, Plus, CheckSquare, Clock, Calendar, Trash2, Eye, Pencil,
  CheckCircle2, XCircle, Circle, Type, MousePointerClick, ArrowRight,
  Layers, ArrowUpDown, BookOpen, Headphones, Video, Download,
  RefreshCw, Lock, AlertCircle, Image as ImageIcon
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  McqForm, TrueFalseForm, FillBlankForm, WordSelectionForm,
  MatchingForm, DragDropForm, SentenceReorderForm, ReadingForm,
  ListeningForm, VideoInteractiveForm, EssayForm,
  newSubQuestion,
  type McqOption, type MatchingPair, type DragZone, type SubQuestion, type VideoQuestion,
} from "@/components/question-type-forms";
import { CreateQuestionDialog, type QuestionData } from "@/components/create-question-dialog";

const TYPE_LABELS: Record<string, string> = {
  mcq: "Trắc nghiệm", true_false: "Đúng/Sai", fill_blank: "Điền vào chỗ trống",
  word_selection: "Chọn từ", matching: "Nối cặp", drag_drop: "Kéo thả",
  sentence_reorder: "Sắp xếp câu", reading: "Đọc hiểu", listening: "Nghe hiểu",
  video_interactive: "Video tương tác", essay: "Bài luận",
};

const TYPE_ICONS: Record<string, string> = {
  mcq: "🔤", true_false: "✓✗", fill_blank: "___", word_selection: "Aa",
  matching: "↔", drag_drop: "⇅", sentence_reorder: "↕", reading: "📖",
  listening: "🎧", video_interactive: "🎬", essay: "✍️",
};

const TYPE_COLORS: Record<string, string> = {
  mcq: "bg-blue-100 text-blue-700", true_false: "bg-teal-100 text-teal-700",
  fill_blank: "bg-purple-100 text-purple-700", word_selection: "bg-indigo-100 text-indigo-700",
  matching: "bg-pink-100 text-pink-700", drag_drop: "bg-orange-100 text-orange-700",
  sentence_reorder: "bg-cyan-100 text-cyan-700", reading: "bg-slate-100 text-slate-700",
  listening: "bg-green-100 text-green-700", video_interactive: "bg-red-100 text-red-700",
  essay: "bg-amber-100 text-amber-700",
};

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-green-100 text-green-700", A2: "bg-green-200 text-green-800",
  B1: "bg-blue-100 text-blue-700", B2: "bg-blue-200 text-blue-800",
  C1: "bg-purple-100 text-purple-700", C2: "bg-purple-200 text-purple-800",
};

const SKILL_LABELS: Record<string, string> = { reading: "Đọc", writing: "Viết", listening: "Nghe", speaking: "Nói" };

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy HH:mm"); } catch { return iso ?? "—"; }
}

function OptionsView({ type, options, correctAnswer }: { type: string; options: string | null; correctAnswer: string | null }) {
  if (type === "mcq") {
    const parsed = safeJson<string[]>(options, []);
    const opts = Array.isArray(parsed) ? parsed : [];
    const corrects = (correctAnswer ?? "").split(",").map(s => s.trim());
    return (
      <div className="grid grid-cols-2 gap-2 mt-3">
        {opts.map((opt, i) => {
          const isCorrect = corrects.includes(opt);
          return (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${isCorrect ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
              {isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <Circle className="w-4 h-4 text-gray-300 shrink-0" />}
              <span className={isCorrect ? "text-green-800 font-medium" : "text-gray-700"}>{opt}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (type === "true_false") {
    const ca = (correctAnswer ?? "").toLowerCase();
    const isTrue = ca === "true" || ca === "đúng";
    return (
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium ${isTrue ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}>
          {isTrue ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />} Đúng
        </div>
        <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium ${!isTrue ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}>
          {!isTrue ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />} Sai
        </div>
      </div>
    );
  }

  if (type === "fill_blank") {
    const answers = safeJson<string[]>(correctAnswer, correctAnswer ? [correctAnswer] : []);
    return (
      <div className="mt-3 space-y-1">
        {answers.map((ans, i) => (
          <div key={i} className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm">
            <span className="text-blue-600 font-medium">Chỗ trống {answers.length > 1 ? i + 1 : ""}:</span>{" "}
            <span className="text-blue-800">{ans || "—"}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "word_selection") {
    const selected = safeJson<string[]>(correctAnswer, correctAnswer ? correctAnswer.split(",").map(s => s.trim()) : []);
    if (selected.length === 0) return null;
    return (
      <div className="mt-3">
        <span className="text-xs font-medium text-gray-500">Từ đúng:</span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {selected.map((t, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full text-sm border bg-green-100 border-green-300 text-green-800 font-medium">{t}</span>
          ))}
        </div>
      </div>
    );
  }

  if (type === "matching") {
    const rawParsed = safeJson<any[]>(options, []);
    const raw = Array.isArray(rawParsed) ? rawParsed : [];
    const pairs = raw.map(p => {
      if (typeof p === "string") {
        const [left, right] = p.split(" | ");
        return { left: left ?? "", right: right ?? "" };
      }
      return { left: p?.left ?? "", right: p?.right ?? "" };
    });
    return (
      <div className="mt-3 space-y-1.5">
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg flex-1 text-center">{p.left}</span>
            <span className="text-gray-400">↔</span>
            <span className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg flex-1 text-center">{p.right}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "drag_drop") {
    const parsed = safeJson<any>(options, {});
    const items: string[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : []);
    const zones: Array<{ label: string; accepts: string[] }> = Array.isArray(parsed.zones) ? parsed.zones : [];
    return (
      <div className="mt-3 space-y-3">
        {items.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1 block">Các mục:</span>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item, i) => (
                <span key={i} className="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">{item}</span>
              ))}
            </div>
          </div>
        )}
        {zones.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1 block">Vùng thả:</span>
            <div className="space-y-1.5">
              {zones.map((z, i) => (
                <div key={i} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                  <span className="font-medium text-gray-700">{z.label}</span>
                  {z.accepts && z.accepts.length > 0 && (
                    <span className="text-gray-400 ml-2">← {z.accepts.join(", ")}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (type === "sentence_reorder") {
    const srParsed = safeJson<string[]>(options, []);
    const items = Array.isArray(srParsed) ? srParsed : [];
    return (
      <div className="mt-3 space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <span className="text-xs font-medium text-gray-400 w-5">{i + 1}.</span>
            <span className="text-gray-700">{item}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "reading") {
    const rdParsed = safeJson<Array<{ question: string; choices: string[]; correctAnswer: string }>>(options, []);
    const subQs = Array.isArray(rdParsed) ? rdParsed : [];
    if (subQs.length > 0) {
      return (
        <div className="mt-3 space-y-3">
          {subQs.map((sq, i) => (
            <div key={i} className="pl-4 border-l-2 border-slate-200">
              <p className="text-sm font-medium text-gray-700 mb-1">{i + 1}. {sq.question}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(sq.choices ?? []).map((c, ci) => {
                  const isC = c === sq.correctAnswer;
                  return (
                    <div key={ci} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${isC ? "bg-green-50 text-green-700" : "text-gray-600"}`}>
                      {isC ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3 text-gray-300" />}
                      {c}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (correctAnswer) {
      return (
        <div className="mt-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm">
          <span className="text-blue-600 font-medium">Đáp án:</span> <span className="text-blue-800">{correctAnswer}</span>
        </div>
      );
    }
    return null;
  }

  if (type === "listening") {
    const lisParsed = safeJson<Array<{ question: string; choices: string[]; correctAnswer: string }>>(options, []);
    const subQs = Array.isArray(lisParsed) ? lisParsed : [];
    if (subQs.length === 0) return null;
    return (
      <div className="mt-3 space-y-3">
        {subQs.map((sq, i) => (
          <div key={i} className="pl-4 border-l-2 border-blue-200">
            <p className="text-sm font-medium text-gray-700 mb-1">{i + 1}. {sq.question}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(sq.choices ?? []).map((c, ci) => {
                const isC = c === sq.correctAnswer;
                return (
                  <div key={ci} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${isC ? "bg-green-50 text-green-700" : "text-gray-600"}`}>
                    {isC ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3 text-gray-300" />}
                    {c}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "video_interactive") {
    const vidParsed = safeJson<Array<{ timestamp: number; type?: string; content?: string; question: string; choices: string[]; correctAnswer: string }>>(options, []);
    const vqs = Array.isArray(vidParsed) ? vidParsed : [];
    if (vqs.length === 0) return null;
    return (
      <div className="mt-3 space-y-3">
        {vqs.map((vq, i) => (
          <div key={i} className="pl-4 border-l-2 border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3 h-3 text-purple-500" />
              <span className="text-xs text-purple-600 font-medium">{Math.floor(vq.timestamp / 60)}:{String(vq.timestamp % 60).padStart(2, '0')}</span>
              {vq.type === "note" && <Badge className="text-[10px] bg-yellow-100 text-yellow-700 border-0">Ghi chú</Badge>}
            </div>
            <p className="text-sm text-gray-700 mb-1">{vq.type === "note" ? (vq.content || vq.question) : vq.question}</p>
            {vq.type !== "note" && (vq.choices ?? []).length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {(vq.choices ?? []).map((c, ci) => {
                  const isC = c === vq.correctAnswer;
                  return (
                    <div key={ci} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${isC ? "bg-green-50 text-green-700" : "text-gray-600"}`}>
                      {isC ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3 text-gray-300" />}
                      {c}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (type === "essay") {
    return (
      <div className="mt-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-500 italic">
        Tự luận — chấm bằng tay hoặc AI
      </div>
    );
  }

  return null;
}

interface EditDraft {
  content: string;
  points: number;
  options: string;
  correctAnswer: string;
  imageUrl: string;
  audioUrl: string;
  videoUrl: string;
  passage: string;
  explanation: string;
  metadata: string;
}

function QuestionEditDialog({ q, open, onClose, onSave, saving }: {
  q: any; open: boolean; onClose: () => void;
  onSave: (data: Partial<EditDraft>) => void; saving: boolean;
}) {
  const [points, setPoints] = useState(1);
  const [imageUrl, setImageUrl] = useState("");
  const [content, setContent] = useState("");
  const [explanation, setExplanation] = useState("");

  const [mcqOptions, setMcqOptions] = useState<McqOption[]>([
    { text: "", isCorrect: false }, { text: "", isCorrect: false },
    { text: "", isCorrect: false }, { text: "", isCorrect: false },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [tfAnswer, setTfAnswer] = useState("");
  const [blanksAnswers, setBlanksAnswers] = useState<string[]>([]);
  const [wsInstruction, setWsInstruction] = useState("");
  const [wsPassage, setWsPassage] = useState("");
  const [wsSelectedWords, setWsSelectedWords] = useState<string[]>([]);
  const [matchPairs, setMatchPairs] = useState<MatchingPair[]>([
    { left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" },
  ]);
  const [ddItems, setDdItems] = useState<string[]>(["", "", ""]);
  const [ddZones, setDdZones] = useState<DragZone[]>([
    { label: "Vùng 1", accepts: [] }, { label: "Vùng 2", accepts: [] },
  ]);
  const [srSentences, setSrSentences] = useState<string[]>(["", "", ""]);
  const [readPassage, setReadPassage] = useState("");
  const [readSubQs, setReadSubQs] = useState<SubQuestion[]>([newSubQuestion()]);
  const [lisAudioUrl, setLisAudioUrl] = useState("");
  const [lisTranscript, setLisTranscript] = useState("");
  const [lisSubQs, setLisSubQs] = useState<SubQuestion[]>([newSubQuestion()]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTimedQs, setVideoTimedQs] = useState<VideoQuestion[]>([]);
  const [essayAutoGrade, setEssayAutoGrade] = useState(false);

  useEffect(() => {
    if (!q) return;
    setPoints(q.points ?? 1);
    setImageUrl(q.imageUrl ?? "");
    setContent(q.content ?? "");
    setExplanation(q.explanation ?? "");

    const meta = safeJson<Record<string, unknown>>(q.metadata, {});
    const opts = safeJson<unknown[]>(q.options, []);

    if (q.type === "mcq") {
      const strOpts = opts as string[];
      const corrects = (q.correctAnswer ?? "").split(",").map((s: string) => s.trim());
      const am = (meta.allowMultiple as boolean) ?? false;
      setAllowMultiple(am);
      setMcqOptions(strOpts.length > 0
        ? strOpts.map(t => ({ text: t, isCorrect: corrects.includes(t) }))
        : [{ text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }]);
    }
    if (q.type === "true_false") {
      const raw = (q.correctAnswer ?? "").toLowerCase();
      if (raw === "true" || raw === "đúng") setTfAnswer("Đúng");
      else if (raw === "false" || raw === "sai") setTfAnswer("Sai");
      else setTfAnswer(q.correctAnswer ?? "");
    }
    if (q.type === "fill_blank") {
      const parsed = safeJson<string[]>(q.correctAnswer, null as any);
      setBlanksAnswers(Array.isArray(parsed) ? parsed : (q.correctAnswer ? [q.correctAnswer] : []));
    }
    if (q.type === "word_selection") {
      setWsInstruction(q.content ?? "");
      setWsPassage(q.passage ?? "");
      const wsParsed = safeJson<string[]>(q.correctAnswer, null as any);
      setWsSelectedWords(Array.isArray(wsParsed) ? wsParsed : (q.correctAnswer ? q.correctAnswer.split(",").map((s: string) => s.trim()) : []));
    }
    if (q.type === "matching") {
      const rawPairs = Array.isArray(opts) ? opts : [];
      const normalized = rawPairs.map((p: any) => {
        if (typeof p === "string") {
          const [left, right] = p.split(" | ");
          return { left: left ?? "", right: right ?? "" };
        }
        return { left: p?.left ?? "", right: p?.right ?? "" };
      });
      setMatchPairs(normalized.length > 0 ? normalized : [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }]);
    }
    if (q.type === "drag_drop") {
      const ddParsed = safeJson<any>(q.options, {});
      const ddItemsParsed: string[] = Array.isArray(ddParsed) ? ddParsed : (Array.isArray(ddParsed.items) ? ddParsed.items : []);
      const ddZonesParsed: DragZone[] = Array.isArray(ddParsed.zones) ? ddParsed.zones : [];
      setDdItems(ddItemsParsed.length ? ddItemsParsed : ["", "", ""]);
      setDdZones(ddZonesParsed.length ? ddZonesParsed : [{ label: "Vùng 1", accepts: [] }, { label: "Vùng 2", accepts: [] }]);
    }
    if (q.type === "sentence_reorder") setSrSentences((opts as string[]).length > 0 ? opts as string[] : ["", "", ""]);
    if (q.type === "reading") {
      setReadPassage(q.passage ?? "");
      const rawSubs = opts as SubQuestion[];
      setReadSubQs(rawSubs.length > 0
        ? rawSubs.map(sq => ({ question: sq.question ?? "", choices: Array.isArray(sq.choices) ? sq.choices : ["", "", "", ""], correctAnswer: sq.correctAnswer ?? "", points: sq.points ?? 1 }))
        : [newSubQuestion()]);
    }
    if (q.type === "listening") {
      setLisAudioUrl(q.audioUrl ?? "");
      setLisTranscript(q.passage ?? "");
      const rawSubs2 = opts as SubQuestion[];
      setLisSubQs(rawSubs2.length > 0
        ? rawSubs2.map(sq => ({ question: sq.question ?? "", choices: Array.isArray(sq.choices) ? sq.choices : ["", "", "", ""], correctAnswer: sq.correctAnswer ?? "", points: sq.points ?? 1 }))
        : [newSubQuestion()]);
    }
    if (q.type === "video_interactive") {
      setVideoUrl(q.videoUrl ?? "");
      const rawVids = opts as VideoQuestion[];
      setVideoTimedQs(rawVids.map(vq => ({ timestamp: vq.timestamp ?? 0, type: vq.type ?? "question", content: vq.content ?? "", question: vq.question ?? "", choices: Array.isArray(vq.choices) ? vq.choices : ["", "", "", ""], correctAnswer: vq.correctAnswer ?? "", points: vq.points ?? 10 })));
    }
    if (q.type === "essay") {
      setEssayAutoGrade((meta.autoGrade as boolean) ?? false);
    }
  }, [q]);

  if (!q) return null;

  function buildPayload(): Partial<EditDraft> {
    const base: Record<string, unknown> = { points, imageUrl: imageUrl || null };
    const qType = q.type;

    if (qType === "mcq") {
      const validOpts = mcqOptions.filter(o => o.text.trim());
      const corrects = validOpts.filter(o => o.isCorrect).map(o => o.text);
      return {
        ...base, content,
        options: JSON.stringify(validOpts.map(o => o.text)),
        correctAnswer: allowMultiple ? corrects.join(",") : (corrects[0] ?? ""),
        metadata: JSON.stringify({ allowMultiple }),
        explanation: explanation || null,
      } as any;
    }
    if (qType === "true_false") {
      return { ...base, content, correctAnswer: tfAnswer, options: JSON.stringify(["Đúng", "Sai"]), explanation: explanation || null } as any;
    }
    if (qType === "fill_blank") {
      return { ...base, content, correctAnswer: JSON.stringify(blanksAnswers), explanation: explanation || null } as any;
    }
    if (qType === "word_selection") {
      return { ...base, content: wsInstruction || content, passage: wsPassage || null, correctAnswer: JSON.stringify(wsSelectedWords), explanation: explanation || null } as any;
    }
    if (qType === "matching") {
      return { ...base, content, options: JSON.stringify(matchPairs), explanation: explanation || null } as any;
    }
    if (qType === "drag_drop") {
      return { ...base, content, options: JSON.stringify({ items: ddItems.filter(Boolean), zones: ddZones }), explanation: explanation || null } as any;
    }
    if (qType === "sentence_reorder") {
      return { ...base, content, options: JSON.stringify(srSentences.filter(Boolean)), explanation: explanation || null } as any;
    }
    if (qType === "reading") {
      const totalReadPts = readSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0);
      return { ...base, points: totalReadPts, content, passage: readPassage || null, options: JSON.stringify(readSubQs), explanation: explanation || null } as any;
    }
    if (qType === "listening") {
      const totalLisPts = lisSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0);
      return { ...base, points: totalLisPts, content, audioUrl: lisAudioUrl || null, passage: lisTranscript || null, options: JSON.stringify(lisSubQs), explanation: explanation || null } as any;
    }
    if (qType === "video_interactive") {
      return { ...base, content, videoUrl: videoUrl || null, options: JSON.stringify(videoTimedQs), explanation: explanation || null } as any;
    }
    // essay
    return { ...base, content, explanation: explanation || null, metadata: JSON.stringify({ autoGrade: essayAutoGrade }) } as any;
  }

  function handleSave() {
    onSave(buildPayload());
  }

  function renderTypeForm() {
    switch (q.type) {
      case "mcq":
        return <McqForm content={content} setContent={setContent} options={mcqOptions} setOptions={setMcqOptions}
          allowMultiple={allowMultiple} setAllowMultiple={setAllowMultiple} explanation={explanation} setExplanation={setExplanation} />;
      case "true_false":
        return <TrueFalseForm content={content} setContent={setContent} correctAnswer={tfAnswer} setCorrectAnswer={setTfAnswer}
          explanation={explanation} setExplanation={setExplanation} />;
      case "fill_blank":
        return <FillBlankForm content={content} setContent={setContent} blanksAnswers={blanksAnswers} setBlanksAnswers={setBlanksAnswers}
          explanation={explanation} setExplanation={setExplanation} />;
      case "word_selection":
        return <WordSelectionForm instruction={wsInstruction} setInstruction={setWsInstruction} passage={wsPassage} setPassage={setWsPassage}
          selectedWords={wsSelectedWords} setSelectedWords={setWsSelectedWords} explanation={explanation} setExplanation={setExplanation} />;
      case "matching":
        return <MatchingForm content={content} setContent={setContent} pairs={matchPairs} setPairs={setMatchPairs}
          explanation={explanation} setExplanation={setExplanation} />;
      case "drag_drop":
        return <DragDropForm content={content} setContent={setContent} items={ddItems} setItems={setDdItems}
          zones={ddZones} setZones={setDdZones} explanation={explanation} setExplanation={setExplanation} />;
      case "sentence_reorder":
        return <SentenceReorderForm content={content} setContent={setContent} sentences={srSentences} setSentences={setSrSentences}
          explanation={explanation} setExplanation={setExplanation} />;
      case "reading":
        return <ReadingForm passage={readPassage} setPassage={setReadPassage} subQuestions={readSubQs} setSubQuestions={setReadSubQs}
          explanation={explanation} setExplanation={setExplanation} />;
      case "listening":
        return <ListeningForm audioUrl={lisAudioUrl} setAudioUrl={setLisAudioUrl} passage={lisTranscript} setPassage={setLisTranscript}
          subQuestions={lisSubQs} setSubQuestions={setLisSubQs} explanation={explanation} setExplanation={setExplanation} />;
      case "video_interactive":
        return <VideoInteractiveForm videoUrl={videoUrl} setVideoUrl={setVideoUrl} timedQuestions={videoTimedQs} setTimedQuestions={setVideoTimedQs}
          explanation={explanation} setExplanation={setExplanation} />;
      case "essay":
        return <EssayForm content={content} setContent={setContent} explanation={explanation} setExplanation={setExplanation} autoGrade={essayAutoGrade} setAutoGrade={setEssayAutoGrade} />;
      default:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Nội dung *</Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} rows={3} className="text-sm" />
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích</Label>
              <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className="text-sm" />
            </div>
          </div>
        );
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{TYPE_ICONS[q.type] ?? "❓"}</span>
            Chỉnh sửa câu hỏi — {TYPE_LABELS[q.type] ?? q.type}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 pb-2">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Điểm</Label>
              {(q.type === "reading" || q.type === "listening") ? (
                <div>
                  <div className="h-9 flex items-center px-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 font-medium w-24">
                    {q.type === "reading"
                      ? readSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0)
                      : lisSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0)
                    }
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Tổng điểm câu thành phần</p>
                </div>
              ) : (
                <Input type="number" min={0} value={points} onChange={e => setPoints(Number(e.target.value))} className="w-24 text-sm" />
              )}
            </div>
            <div className="flex-1">
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
                <ImageIcon className="w-4 h-4" /> URL ảnh minh hoạ
              </Label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="text-sm" />
            </div>
          </div>

          {imageUrl && (
            <div className="rounded-lg overflow-hidden border border-gray-200 max-w-xs">
              <img src={imageUrl} alt="" className="w-full h-auto object-contain max-h-32" />
            </div>
          )}

          {renderTypeForm()}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuestionCard({ q, idx, onEdit, onDelete, isDraft, isTeacher }: {
  q: any; idx: number;
  onEdit: () => void;
  onDelete: () => void;
  isDraft: boolean;
  isTeacher: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Q{idx + 1}</span>
            <Badge variant="outline" className="text-xs font-medium">
              {TYPE_LABELS[q.type] ?? q.type}
            </Badge>
            {q.skill && (
              <Badge variant="outline" className="text-xs">{SKILL_LABELS[q.skill] ?? q.skill}</Badge>
            )}
            <Badge className={`text-xs border-0 ${LEVEL_COLORS[q.level] ?? "bg-gray-100 text-gray-600"}`}>{q.level}</Badge>
            <span className="text-xs text-muted-foreground font-medium">{q.points} Pt</span>
          </div>
          {isDraft && isTeacher && (
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-gray-300 leading-8">|</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="px-5 pb-4">
          {q.imageUrl && (
            <div className="mb-3 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 max-w-xs">
              <img src={q.imageUrl} alt="" className="w-full h-auto object-contain max-h-48" />
            </div>
          )}

          {q.audioUrl && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <Headphones className="w-4 h-4" />
              <a href={q.audioUrl} target="_blank" rel="noreferrer" className="underline truncate">{q.audioUrl}</a>
            </div>
          )}

          {q.videoUrl && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
              <Video className="w-4 h-4" />
              <a href={q.videoUrl} target="_blank" rel="noreferrer" className="underline truncate">{q.videoUrl}</a>
            </div>
          )}

          {q.passage && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1 text-xs font-medium text-amber-700">
                <BookOpen className="w-3.5 h-3.5" /> Bài đọc
              </div>
              <p className="text-sm text-amber-900 whitespace-pre-wrap line-clamp-4">{q.passage}</p>
            </div>
          )}

          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{q.content}</p>

          <OptionsView type={q.type} options={q.options} correctAnswer={q.correctAnswer} />

          {q.explanation && (
            <div className="mt-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <span className="font-medium text-yellow-700">Giải thích:</span>{" "}
              <span className="text-yellow-800">{q.explanation}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const assignmentId = Number(id);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const isTeacher = me?.role && ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"].includes(me.role);

  const [addQOpen, setAddQOpen] = useState(false);
  const [importTemplateOpen, setImportTemplateOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({ startTime: "", endTime: "", maxAttempts: 1, allowReview: false, autoGrade: false, courseId: null as number | null });
  const [editingQ, setEditingQ] = useState<any>(null);
  const [createQOpen, setCreateQOpen] = useState(false);
  const [creatingQ, setCreatingQ] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<number | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedImportIds, setSelectedImportIds] = useState<number[]>([]);
  const [importingSelected, setImportingSelected] = useState(false);

  const { data: assignment, isLoading } = useGetAssignment(assignmentId, {
    query: { enabled: !!assignmentId, queryKey: getGetAssignmentQueryKey(assignmentId) },
  });

  // Redirect students to the take page — the detail page is teacher-only
  useEffect(() => {
    if (!isLoading && me && !isTeacher && assignment) {
      navigate(`/assignments/${assignmentId}/take`);
    }
  }, [isLoading, me, isTeacher, assignment, assignmentId, navigate]);

  const { mutate: updateAssignment, isPending: updatingAssignment } = useUpdateAssignment();
  const { mutate: addQuestion, isPending: addingQuestion } = useAddQuestionToAssignment();
  const { mutate: removeQuestion, isPending: removingQuestion } = useRemoveQuestionFromAssignment();
  const { data: allQuestions } = useListQuestions();
  const { data: templates } = useListQuizTemplates({ query: { enabled: importTemplateOpen } });
  const { mutate: importFromTemplate, isPending: importingTemplate } = useImportFromTemplate();
  const { data: courses } = useListCourses();
  const { mutate: updateAQ, isPending: updatingAQ } = useUpdateAssignmentQuestion();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getGetAssignmentQueryKey(assignmentId) });
    queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
  }

  function handleStatusChange(status: string) {
    if (status === "published" && !assignment?.courseId) {
      toast({ title: "Không thể công bố", description: "Vui lòng gán bài tập vào khoá học trước khi công bố", variant: "destructive" });
      return;
    }
    updateAssignment({ id: assignmentId, data: { status } }, { onSuccess: invalidate });
  }

  function handleAddQuestion(questionId: number) {
    const nextIndex = (assignment?.questions?.length ?? 0);
    addQuestion({ id: assignmentId, data: { questionId, orderIndex: nextIndex } }, { onSuccess: () => { invalidate(); setAddQOpen(false); } });
  }

  function handleRemoveQuestion(aqId: number) {
    removeQuestion({ id: assignmentId, questionId: aqId }, { onSuccess: invalidate });
  }

  async function handlePreviewTemplate(templateId: number) {
    setPreviewTemplateId(templateId);
    setLoadingPreview(true);
    setSelectedImportIds([]);
    try {
      const res = await fetch(`/api/quiz-templates/${templateId}/questions`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setPreviewQuestions(data);
      setSelectedImportIds(data.map((q: any) => q.id));
    } catch {
      toast({ title: "Lỗi", description: "Không thể tải câu hỏi", variant: "destructive" });
    } finally {
      setLoadingPreview(false);
    }
  }

  function handleImportTemplate(templateId: number) {
    importFromTemplate({ assignmentId, data: { templateId } }, {
      onSuccess: (res) => {
        toast({ title: "Nhập thành công", description: `Đã nhập ${res.imported} câu hỏi từ bộ quiz` });
        invalidate();
        setImportTemplateOpen(false);
        setPreviewTemplateId(null);
        setPreviewQuestions([]);
      },
    });
  }

  async function handleImportSelected() {
    if (!previewTemplateId || selectedImportIds.length === 0) return;
    setImportingSelected(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/import-from-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: previewTemplateId, questionIds: selectedImportIds }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      toast({ title: "Nhập thành công", description: `Đã nhập ${data.imported} câu hỏi` });
      invalidate();
      setImportTemplateOpen(false);
      setPreviewTemplateId(null);
      setPreviewQuestions([]);
    } catch {
      toast({ title: "Lỗi", description: "Không thể nhập câu hỏi", variant: "destructive" });
    } finally {
      setImportingSelected(false);
    }
  }

  async function handleCreateQuestion(data: QuestionData) {
    setCreatingQ(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/questions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Đã tạo câu hỏi" });
      setCreateQOpen(false);
      invalidate();
    } catch {
      toast({ title: "Lỗi", description: "Không thể tạo câu hỏi", variant: "destructive" });
    } finally {
      setCreatingQ(false);
    }
  }

  function handleSaveQuestion(data: Partial<EditDraft>) {
    if (!editingQ) return;
    const aqId = editingQ._aqId ?? editingQ.id;
    updateAQ({ assignmentId, questionId: aqId, data: data as Record<string, unknown> }, {
      onSuccess: () => {
        toast({ title: "Đã lưu câu hỏi" });
        invalidate();
        setEditingQ(null);
      },
    });
  }

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-10 w-80" /><Skeleton className="h-48 rounded-xl" /></div>;
  if (!assignment) return <div className="text-center py-20 text-muted-foreground">Không tìm thấy bài tập</div>;

  const assignedQuestionIds = new Set(assignment.questions?.map((aq) => aq.questionId) ?? []);
  const availableQuestions = (allQuestions ?? []).filter((q) => !assignedQuestionIds.has(q.id));
  const canPublish = !!assignment.courseId;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            <Badge className={
              assignment.status === "published" ? "bg-green-100 text-green-700 border-0" :
              assignment.status === "closed" ? "bg-gray-100 text-gray-500 border-0" :
              "bg-amber-100 text-amber-700 border-0"
            }>
              {assignment.status === "published" ? "Đã công bố" : assignment.status === "closed" ? "Đã đóng" : "Nháp"}
            </Badge>
          </div>
          {assignment.description && <p className="text-muted-foreground">{assignment.description}</p>}
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
            {assignment.courseName && <span>Khóa học: <span className="font-medium text-gray-700">{assignment.courseName}</span></span>}
            {!assignment.courseId && isTeacher && (
              <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="w-4 h-4" />Chưa gán khoá học</span>
            )}
            {assignment.timeLimitMinutes && (
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{assignment.timeLimitMinutes} phút</span>
            )}
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />Hạn: {formatDate(assignment.dueDate)}</span>
            <span>{assignment.questions?.length ?? 0} câu hỏi — {assignment.totalPoints} điểm</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isTeacher && (
            <Link href={`/assignments/${assignmentId}/take?preview=1`}>
              <Button size="sm" variant="outline">
                <Eye className="w-4 h-4 mr-2" />Làm thử
              </Button>
            </Link>
          )}
          {assignment.status === "published" && !isTeacher && (() => {
            const myAttempts = assignment.myAttemptCount ?? 0;
            const maxAtt = assignment.maxAttempts ?? 0;
            const exceeded = maxAtt > 0 && myAttempts >= maxAtt;
            if (exceeded) return null;
            if (myAttempts > 0) {
              return (
                <Link href={`/assignments/${assignmentId}/take`}>
                  <Button size="sm" variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50">
                    <RefreshCw className="w-4 h-4 mr-2" />Làm lại
                  </Button>
                </Link>
              );
            }
            return (
              <Link href={`/assignments/${assignmentId}/take`}>
                <Button size="sm"><Play className="w-4 h-4 mr-2" />Làm bài</Button>
              </Link>
            );
          })()}
          {assignment.status === "draft" && isTeacher && (
            <Button
              size="sm"
              onClick={() => handleStatusChange("published")}
              disabled={updatingAssignment || !canPublish}
              title={!canPublish ? "Cần gán khoá học trước" : ""}
            >
              {!canPublish && <Lock className="w-4 h-4 mr-1" />}
              <CheckSquare className="w-4 h-4 mr-1" />
              {updatingAssignment ? "..." : "Công bố"}
            </Button>
          )}
          {assignment.status === "published" && isTeacher && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange("closed")} disabled={updatingAssignment}>
              {updatingAssignment ? "..." : "Đóng bài"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className="text-2xl font-bold text-primary">{assignment.questions?.length ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Câu hỏi</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className="text-2xl font-bold text-green-700">{assignment.totalPoints}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tổng điểm</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{assignment.submissionCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Bài nộp</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{assignment.maxAttempts ?? 1}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Số lần nộp tối đa</p>
        </CardContent></Card>
      </div>

      {isTeacher && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Cài đặt bài tập</h3>
              {assignment.status === "draft" && !editingSettings && (
                <Button size="sm" variant="ghost" onClick={() => {
                  setEditingSettings(true);
                  setSettingsDraft({
                    startTime: assignment.startTime ? assignment.startTime.slice(0, 16) : "",
                    endTime: assignment.endTime ? assignment.endTime.slice(0, 16) : "",
                    maxAttempts: assignment.maxAttempts ?? 1,
                    allowReview: assignment.allowReview ?? false,
                    autoGrade: assignment.autoGrade ?? false,
                    courseId: assignment.courseId ?? null,
                  });
                }}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />Sửa
                </Button>
              )}
            </div>
            {editingSettings ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Khóa học</label>
                  <select
                    value={settingsDraft.courseId ?? ""}
                    onChange={e => setSettingsDraft(d => ({ ...d, courseId: e.target.value ? Number(e.target.value) : null }))}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— Chưa chọn —</option>
                    {(courses ?? []).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Ngày mở</label>
                    <input
                      type="datetime-local"
                      value={settingsDraft.startTime}
                      onChange={e => setSettingsDraft(d => ({ ...d, startTime: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Ngày đóng</label>
                    <input
                      type="datetime-local"
                      value={settingsDraft.endTime}
                      onChange={e => setSettingsDraft(d => ({ ...d, endTime: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Số lần nộp tối đa</label>
                    <input
                      type="number"
                      min={1}
                      value={settingsDraft.maxAttempts}
                      onChange={e => setSettingsDraft(d => ({ ...d, maxAttempts: Number(e.target.value) }))}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.allowReview}
                        onChange={e => setSettingsDraft(d => ({ ...d, allowReview: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">Cho phép xem lại bài làm</span>
                    </label>
                  </div>
                </div>
                {(() => {
                  const blockedEssays = (assignment.questions ?? []).filter(aq => {
                    if (aq.question.type !== "essay") return false;
                    try {
                      const meta = aq.question.metadata ? JSON.parse(aq.question.metadata) : {};
                      return meta.autoGrade === false;
                    } catch { return false; }
                  });
                  const isBlocked = blockedEssays.length > 0;
                  return (
                    <div className="space-y-1.5">
                      <label className={`flex items-center gap-2 ${isBlocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          checked={settingsDraft.autoGrade}
                          disabled={isBlocked}
                          onChange={e => {
                            if (isBlocked) return;
                            setSettingsDraft(d => ({ ...d, autoGrade: e.target.checked }));
                          }}
                          className="rounded disabled:cursor-not-allowed"
                        />
                        <span className="text-sm text-gray-700">Tự động chấm bài</span>
                      </label>
                      {isBlocked && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>
                            {blockedEssays.length === 1
                              ? "Có 1 câu bài luận đang tắt tự động chấm điểm."
                              : `Có ${blockedEssays.length} câu bài luận đang tắt tự động chấm điểm.`}
                            {" "}Hãy bật lại trong từng câu trước khi kích hoạt cài đặt này.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => {
                    updateAssignment({
                      id: assignmentId,
                      data: {
                        startTime: settingsDraft.startTime ? new Date(settingsDraft.startTime).toISOString() : null,
                        endTime: settingsDraft.endTime ? new Date(settingsDraft.endTime).toISOString() : null,
                        maxAttempts: settingsDraft.maxAttempts,
                        allowReview: settingsDraft.allowReview,
                        autoGrade: settingsDraft.autoGrade,
                        ...(settingsDraft.courseId != null ? { courseId: settingsDraft.courseId } : {}),
                      },
                    }, { onSuccess: () => { setEditingSettings(false); invalidate(); } });
                  }} disabled={updatingAssignment}>
                    {updatingAssignment ? "Đang lưu..." : "Lưu"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingSettings(false)}>Huỷ</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Khóa học</span>
                  <p className="font-medium text-gray-700">{assignment.courseName || <span className="text-amber-600">Chưa gán</span>}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Ngày mở</span>
                  <p className="font-medium text-gray-700">{formatDate(assignment.startTime)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Ngày đóng</span>
                  <p className="font-medium text-gray-700">{formatDate(assignment.endTime)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Số lần nộp</span>
                  <p className="font-medium text-gray-700">{assignment.maxAttempts ?? 1} lần</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Xem lại bài làm</span>
                  <p className="font-medium text-gray-700">{assignment.allowReview ? "Có" : "Không"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">Danh sách câu hỏi</CardTitle>
          {assignment.status === "draft" && isTeacher && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setCreateQOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />Tạo câu hỏi
              </Button>
              <Button size="sm" variant="outline" onClick={() => setImportTemplateOpen(true)}>
                <Download className="w-4 h-4 mr-1" />Nhập từ Quiz
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddQOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />Từ ngân hàng
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!assignment.questions || assignment.questions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm">Chưa có câu hỏi nào.</p>
              {assignment.status === "draft" && isTeacher && (
                <div className="flex gap-2 justify-center mt-3">
                  <Button size="sm" variant="outline" onClick={() => setCreateQOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" />Tạo câu hỏi
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setImportTemplateOpen(true)}>
                    <Download className="w-4 h-4 mr-1" />Nhập từ Quiz
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAddQOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" />Từ ngân hàng
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {assignment.questions.map((aq, index) => {
                const q = aq.question;
                return (
                  <QuestionCard
                    key={aq.id}
                    q={q}
                    idx={index}
                    isDraft={assignment.status === "draft"}
                    isTeacher={!!isTeacher}
                    onEdit={() => setEditingQ({ ...q, _aqId: aq.id })}
                    onDelete={() => handleRemoveQuestion(aq.id)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <Link href="/submissions">
          <Button variant="outline" size="sm">Xem bài nộp ({assignment.submissionCount})</Button>
        </Link>
      </div>

      <QuestionEditDialog
        q={editingQ}
        open={!!editingQ}
        onClose={() => setEditingQ(null)}
        onSave={handleSaveQuestion}
        saving={updatingAQ}
      />

      <Dialog open={addQOpen} onOpenChange={setAddQOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Thêm câu hỏi từ ngân hàng</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            {availableQuestions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Tất cả câu hỏi đã được thêm vào bài tập</p>
            ) : (
              availableQuestions.map((q) => (
                <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg border hover:border-primary/40 hover:bg-blue-50/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      <Badge className={`${TYPE_COLORS[q.type] ?? "bg-gray-100 text-gray-600"} border-0 text-xs`}>{TYPE_LABELS[q.type] ?? q.type}</Badge>
                      <Badge variant="outline" className="text-xs">{SKILL_LABELS[q.skill] ?? q.skill}</Badge>
                      <Badge variant="outline" className="text-xs">{q.level}</Badge>
                      <span className="text-xs text-muted-foreground">{q.points} điểm</span>
                    </div>
                    <p className="text-sm text-gray-900 truncate">{q.content}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAddQuestion(q.id)} disabled={addingQuestion}>Thêm</Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddQOpen(false)}>Đóng</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateQuestionDialog
        open={createQOpen}
        onClose={() => setCreateQOpen(false)}
        onSave={handleCreateQuestion}
        saving={creatingQ}
        defaultEssayAutoGrade={assignment?.autoGrade ?? false}
      />

      <Dialog open={importTemplateOpen} onOpenChange={(v) => { if (!v) { setImportTemplateOpen(false); setPreviewTemplateId(null); setPreviewQuestions([]); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {previewTemplateId ? (
                <button className="flex items-center gap-2 text-left" onClick={() => { setPreviewTemplateId(null); setPreviewQuestions([]); }}>
                  <ArrowRight className="w-4 h-4 rotate-180" /> Chọn câu hỏi để nhập
                </button>
              ) : "Nhập câu hỏi từ bộ Quiz"}
            </DialogTitle>
          </DialogHeader>

          {!previewTemplateId ? (
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {!templates || templates.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Chưa có bộ quiz nào. <Link href="/quiz-templates" className="text-primary underline">Tạo bộ quiz mới</Link>
                </p>
              ) : (
                templates.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.questionCount} câu · {t.totalPoints} điểm</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handlePreviewTemplate(t.id)}>
                        <Eye className="w-4 h-4 mr-1" />Xem trước
                      </Button>
                      <Button size="sm" onClick={() => handleImportTemplate(t.id)} disabled={importingTemplate}>
                        {importingTemplate ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Nhập tất cả"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                <span>Đã chọn {selectedImportIds.length}/{previewQuestions.length} câu</span>
                <div className="flex gap-2">
                  <button className="text-primary text-xs hover:underline" onClick={() => setSelectedImportIds(previewQuestions.map((q: any) => q.id))}>Chọn tất cả</button>
                  <button className="text-xs hover:underline" onClick={() => setSelectedImportIds([])}>Bỏ chọn</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {loadingPreview ? (
                  <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
                ) : previewQuestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Bộ quiz chưa có câu hỏi</div>
                ) : (
                  previewQuestions.map((q: any) => (
                    <label key={q.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedImportIds.includes(q.id) ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                      <input
                        type="checkbox"
                        checked={selectedImportIds.includes(q.id)}
                        onChange={() => setSelectedImportIds(prev => prev.includes(q.id) ? prev.filter((x: number) => x !== q.id) : [...prev, q.id])}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          <Badge className={`${TYPE_COLORS[q.type] ?? "bg-gray-100 text-gray-600"} border-0 text-xs`}>{TYPE_LABELS[q.type] ?? q.type}</Badge>
                          <Badge variant="outline" className="text-xs">{q.level}</Badge>
                          <span className="text-xs text-muted-foreground">{q.points} điểm</span>
                        </div>
                        <p className="text-sm text-gray-900">{q.content}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </>
          )}

          <DialogFooter>
            {previewTemplateId && (
              <Button onClick={handleImportSelected} disabled={importingSelected || selectedImportIds.length === 0}>
                {importingSelected ? "Đang nhập..." : `Nhập ${selectedImportIds.length} câu hỏi`}
              </Button>
            )}
            <Button variant="outline" onClick={() => { setImportTemplateOpen(false); setPreviewTemplateId(null); setPreviewQuestions([]); }}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
