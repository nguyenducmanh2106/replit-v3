import { useState, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetQuizTemplate,
  useUpdateQuizTemplate,
  useDeleteQuizTemplate,
  useImportQuestionsToTemplate,
  useUpdateQuizTemplateQuestion,
  useDeleteQuizTemplateQuestion,
  getQuizTemplateQueryKey,
  getListQuizTemplatesQueryKey,
} from "@workspace/api-client-react";
import { useListQuestions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, Pencil, Save, X, Download, CheckCircle2,
  Circle, Image as ImageIcon, Headphones, Video, BookOpen, Clock,
} from "lucide-react";
import {
  McqForm, TrueFalseForm, FillBlankForm, WordSelectionForm,
  MatchingForm, DragDropForm, SentenceReorderForm, ReadingForm,
  ListeningForm, VideoInteractiveForm, EssayForm, OpenEndForm,
  safeJson as sharedSafeJson, newSubQuestion,
  type McqOption, type MatchingPair, type DragZone, type SubQuestion, type VideoQuestion,
} from "@/components/question-type-forms";
import { CreateQuestionDialog, type QuestionData } from "@/components/create-question-dialog";
import { useToast } from "@/hooks/use-toast";

const TYPE_LABELS: Record<string, string> = {
  mcq: "Trắc nghiệm", true_false: "Đúng/Sai", fill_blank: "Điền chỗ trống",
  word_selection: "Chọn từ", matching: "Nối cặp", drag_drop: "Kéo thả",
  sentence_reorder: "Sắp xếp câu", reading: "Đọc hiểu", listening: "Nghe",
  video_interactive: "Video tương tác", essay: "Tự luận", open_end: "Câu hỏi mở",
};

const TYPE_ICONS: Record<string, string> = {
  mcq: "🔤", true_false: "✓✗", fill_blank: "___", word_selection: "Aa",
  matching: "↔", drag_drop: "⇅", sentence_reorder: "↕", reading: "📖",
  listening: "🎧", video_interactive: "🎬", essay: "✍️", open_end: "💬",
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

function OptionsView({ type, options, correctAnswer, metadata }: { type: string; options: string | null; correctAnswer: string | null; metadata?: string | null }) {
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
            <span key={i} className="px-2.5 py-1 rounded-full text-sm border bg-green-100 border-green-300 text-green-800 font-medium">
              {t}
            </span>
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
                  const isCorrect = c === sq.correctAnswer;
                  return (
                    <div key={ci} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${isCorrect ? "bg-green-50 text-green-700" : "text-gray-600"}`}>
                      {isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3 text-gray-300" />}
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
                const isCorrect = c === sq.correctAnswer;
                return (
                  <div key={ci} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${isCorrect ? "bg-green-50 text-green-700" : "text-gray-600"}`}>
                    {isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3 text-gray-300" />}
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
                  const isCorrect = c === vq.correctAnswer;
                  return (
                    <div key={ci} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${isCorrect ? "bg-green-50 text-green-700" : "text-gray-600"}`}>
                      {isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3 text-gray-300" />}
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

  if (type === "open_end") {
    const meta = safeJson<Record<string, unknown>>(metadata ?? null, {});
    const allowedTypes = (meta.allowedTypes as string[]) ?? ["text", "audio", "image"];
    const labels: Record<string, string> = { text: "Văn bản", audio: "Ghi âm", image: "Hình ảnh" };
    return (
      <div className="mt-3 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-sm text-violet-600 italic">
        Câu hỏi mở — trả lời bằng: {allowedTypes.map(t => labels[t] || t).join(", ")}
      </div>
    );
  }

  return null;
}

function QuestionCard({ q, idx, onEdit, onDelete }: {
  q: any; idx: number;
  onEdit: () => void;
  onDelete: () => void;
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
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-gray-300 leading-8">|</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
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

          <OptionsView type={q.type} options={q.options} correctAnswer={q.correctAnswer} metadata={q.metadata} />

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
  const [openEndAllowedTypes, setOpenEndAllowedTypes] = useState<string[]>(["text", "audio", "image"]);

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
    if (q.type === "open_end") {
      setOpenEndAllowedTypes((meta.allowedTypes as string[]) ?? ["text", "audio", "image"]);
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
    if (qType === "open_end") {
      return { ...base, content, explanation: explanation || null, metadata: JSON.stringify({ allowedTypes: openEndAllowedTypes }) } as any;
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
      case "open_end":
        return <OpenEndForm content={content} setContent={setContent} explanation={explanation} setExplanation={setExplanation} allowedTypes={openEndAllowedTypes} setAllowedTypes={setOpenEndAllowedTypes} />;
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

export default function QuizTemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: template, isLoading } = useGetQuizTemplate(id);
  const { mutate: updateTemplate } = useUpdateQuizTemplate();
  const { mutate: deleteTemplate } = useDeleteQuizTemplate();
  const { mutate: importQuestions, isPending: importing } = useImportQuestionsToTemplate();
  const { mutate: updateQuestion, isPending: savingQ } = useUpdateQuizTemplateQuestion();
  const { mutate: deleteQuestion } = useDeleteQuizTemplateQuestion();

  const { toast } = useToast();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedQIds, setSelectedQIds] = useState<number[]>([]);
  const [editingQ, setEditingQ] = useState<any>(null);
  const [createQOpen, setCreateQOpen] = useState(false);
  const [creatingQ, setCreatingQ] = useState(false);

  const { data: bankQuestions } = useListQuestions(undefined, { query: { enabled: importOpen } });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getQuizTemplateQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListQuizTemplatesQueryKey() });
  }

  function handleSaveTitle() {
    updateTemplate({ id, data: { title: titleDraft, description: descDraft } }, { onSuccess: () => { setEditingTitle(false); invalidate(); } });
  }

  function handleDelete() {
    if (!confirm("Xoá bộ quiz này?")) return;
    deleteTemplate({ id }, { onSuccess: () => navigate("/quiz-templates") });
  }

  function handleImport() {
    if (selectedQIds.length === 0) return;
    importQuestions({ id, data: { questionIds: selectedQIds } }, {
      onSuccess: () => { setImportOpen(false); setSelectedQIds([]); invalidate(); },
    });
  }

  function toggleSelect(qId: number) {
    setSelectedQIds(prev => prev.includes(qId) ? prev.filter(x => x !== qId) : [...prev, qId]);
  }

  async function handleCreateQuestion(data: QuestionData) {
    setCreatingQ(true);
    try {
      const res = await fetch(`/api/quiz-templates/${id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
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
    if (Object.keys(data).length === 0) { setEditingQ(null); return; }
    updateQuestion({ templateId: id, questionId: editingQ.id, data: data as any }, {
      onSuccess: () => { setEditingQ(null); invalidate(); },
    });
  }

  function handleDeleteQuestion(qid: number) {
    if (!confirm("Xoá câu hỏi này khỏi bộ quiz?")) return;
    deleteQuestion({ templateId: id, questionId: qid }, { onSuccess: invalidate });
  }

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64" />
    </div>
  );

  if (!template) return (
    <div className="text-center py-12 text-muted-foreground">Không tìm thấy bộ quiz</div>
  );

  const totalPoints = template.questions.reduce((s, q) => s + q.points, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/quiz-templates")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {editingTitle ? (
          <div className="flex-1 space-y-2">
            <Input value={titleDraft} onChange={e => setTitleDraft(e.target.value)} placeholder="Tên bộ quiz" />
            <Input value={descDraft} onChange={e => setDescDraft(e.target.value)} placeholder="Mô tả" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveTitle}><Save className="h-3.5 w-3.5 mr-1" />Lưu</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-800">{template.title}</h1>
              <Button variant="ghost" size="icon" onClick={() => { setTitleDraft(template.title); setDescDraft(template.description ?? ""); setEditingTitle(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
          </div>
        )}
        <Button variant="destructive" size="sm" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-1" />Xoá</Button>
      </div>

      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-5 py-3 border">
        <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
          <span>{template.questions.length} Questions</span>
          <span className="text-gray-300">·</span>
          <span>{totalPoints} Points</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreateQOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Tạo câu hỏi
          </Button>
          <Button onClick={() => setImportOpen(true)} className="gap-2">
            <Download className="h-4 w-4" /> Nhập từ ngân hàng
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {template.questions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            q={q}
            idx={idx}
            onEdit={() => setEditingQ(q)}
            onDelete={() => handleDeleteQuestion(q.id)}
          />
        ))}
        {template.questions.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Download className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <h3 className="font-semibold text-gray-700 mb-1">Chưa có câu hỏi</h3>
            <p className="text-sm">Tạo câu hỏi mới hoặc nhập từ ngân hàng câu hỏi</p>
            <div className="flex gap-2 justify-center mt-3">
              <Button size="sm" variant="outline" onClick={() => setCreateQOpen(true)}><Plus className="w-4 h-4 mr-1" />Tạo câu hỏi</Button>
              <Button size="sm" onClick={() => setImportOpen(true)}><Download className="w-4 h-4 mr-1" />Nhập từ ngân hàng</Button>
            </div>
          </CardContent></Card>
        )}
      </div>

      <QuestionEditDialog
        q={editingQ}
        open={!!editingQ}
        onClose={() => setEditingQ(null)}
        onSave={handleSaveQuestion}
        saving={savingQ}
      />

      <CreateQuestionDialog
        open={createQOpen}
        onClose={() => setCreateQOpen(false)}
        onSave={handleCreateQuestion}
        saving={creatingQ}
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Chọn câu hỏi từ ngân hàng</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {bankQuestions && bankQuestions.length > 0 ? bankQuestions.map(q => (
              <label key={q.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedQIds.includes(q.id) ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="checkbox" checked={selectedQIds.includes(q.id)} onChange={() => toggleSelect(q.id)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[q.type] ?? q.type}</Badge>
                    <Badge className={`text-xs border-0 ${LEVEL_COLORS[q.level] ?? "bg-gray-100"}`}>{q.level}</Badge>
                    <span className="text-xs text-muted-foreground">{q.points} đ</span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{q.content}</p>
                </div>
              </label>
            )) : (
              <p className="text-center text-muted-foreground py-8">Không có câu hỏi trong ngân hàng</p>
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <span className="text-sm text-muted-foreground mr-auto">Đã chọn: {selectedQIds.length}</span>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Huỷ</Button>
            <Button onClick={handleImport} disabled={importing || selectedQIds.length === 0}>
              {importing ? "Đang nhập..." : `Nhập ${selectedQIds.length} câu`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
