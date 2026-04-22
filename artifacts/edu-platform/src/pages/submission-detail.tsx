import React, { useState, useRef, useEffect } from "react";
import { useParams } from "@/lib/routing";
import {
  useGetSubmission, useGradeSubmission,
  useGetSubmissionAnnotations, getGetSubmissionAnnotationsQueryKey, useCreateAnnotation, useDeleteAnnotation,
  useGetSubmissionRubricGrades, useSaveRubricGrades, useListRubrics,
  useGetPersonalizedFeedback,
  getGetSubmissionQueryKey,
  useGradeQuestion,
  usePublishGrades,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, Star, MessageSquare, Trash2, Target, Sparkles, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { MarkdownView } from "@/components/markdown-view";
import { SubmissionAnswerView } from "@/components/submission-answer-view";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy HH:mm"); } catch { return iso ?? "—"; }
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: "Trắc nghiệm", true_false: "Đúng/Sai", fill_blank: "Điền chỗ trống",
  word_selection: "Chọn từ", matching: "Nối cặp", drag_drop: "Kéo thả",
  sentence_reorder: "Sắp xếp câu", reading: "Đọc hiểu", listening: "Nghe hiểu",
  video_interactive: "Video tương tác", essay: "Bài luận", open_end: "Câu hỏi mở",
};

// ── Reading / Listening sub-question answer view ──────────────────────────
function ReadingSubAnswerView({
  studentAnswer, questionOptions, qType,
}: { studentAnswer: string | null; questionOptions: string | null; qType: string }) {
  const subQs = safeJson<Array<{ question: string; options?: string[]; correctAnswer?: string; points?: number }>>(questionOptions, []);
  const studentAnswers = safeJson<string[]>(studentAnswer, []);
  const labels = "ABCDEFGHIJ";

  if (subQs.length === 0) {
    return <span className="text-gray-500 italic text-sm">(Chưa có câu hỏi con)</span>;
  }

  return (
    <div className="space-y-2">
      {subQs.map((sq, i) => {
        const sa = studentAnswers[i] ?? null;
        const ca = sq.correctAnswer ?? null;
        const isCorrect = sa && ca && sa.trim().toLowerCase() === ca.trim().toLowerCase();
        const opts = sq.options ?? [];

        return (
          <div key={i} className={`rounded-lg border p-3 ${isCorrect ? "border-green-200 bg-green-50/50" : sa ? "border-red-200 bg-red-50/50" : "border-gray-200 bg-gray-50/40"}`}>
            <div className="flex items-start gap-2 mb-2">
              <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isCorrect ? "bg-green-500 text-white" : sa ? "bg-red-500 text-white" : "bg-gray-300 text-gray-600"}`}>
                {i + 1}
              </span>
              <p className="text-sm text-gray-800 leading-relaxed flex-1">{sq.question}</p>
            </div>

            {opts.length > 0 && (
              <div className="grid grid-cols-2 gap-1 ml-7">
                {opts.map((opt, oi) => {
                  const lbl = labels[oi] || String(oi);
                  const isStudentChoice = sa === opt || sa === lbl;
                  const isCorrectOpt = ca === opt || ca === lbl;
                  return (
                    <div key={oi} className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                      isStudentChoice && isCorrectOpt ? "bg-green-100 border border-green-300 font-medium text-green-800" :
                      isStudentChoice ? "bg-red-100 border border-red-300 font-medium text-red-800" :
                      isCorrectOpt ? "bg-green-50 border border-green-200 text-green-700" :
                      "text-gray-600"
                    }`}>
                      <span className="font-mono w-4 shrink-0">{lbl}.</span>
                      <span className="truncate">{opt}</span>
                      {isStudentChoice && !isCorrectOpt && <span className="ml-auto shrink-0">✗</span>}
                      {isCorrectOpt && <span className="ml-auto shrink-0">✓</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {opts.length === 0 && (
              <div className="ml-7 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Học sinh:</span>
                {sa ? (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${isCorrect ? "bg-green-100 text-green-800 border border-green-300" : "bg-red-100 text-red-800 border border-red-300"}`}>{sa}</span>
                ) : (
                  <span className="text-gray-400 italic text-xs">(Bỏ trống)</span>
                )}
                {ca && !isCorrect && (
                  <>
                    <span className="text-xs text-gray-400">→ Đúng:</span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300">{ca}</span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Open-end parsed answer view ─────────────────────────────────────────────
function OpenEndAnswerView({ rawAnswer }: { rawAnswer: string | null }) {
  if (!rawAnswer) return <span className="text-gray-400 italic text-sm">(Bỏ trống)</span>;
  let parsed: any = null;
  try { parsed = JSON.parse(rawAnswer); } catch {}
  if (!parsed) return <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{rawAnswer}</p>;

  const text = parsed.text_content || parsed.text;
  const audioUrl = parsed.audio_url || parsed.audioUrl;
  const imageUrl = parsed.imageUrl || parsed.image_url;
  const transcript = parsed.transcript;
  const durationSecs = parsed.duration_seconds;
  const sttConf = parsed.stt_confidence;

  return (
    <div className="space-y-2">
      {text && <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{text}</p>}
      {audioUrl && (
        <div className="p-3 bg-violet-50 rounded-xl border border-violet-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-violet-700">🎙️ Ghi âm</span>
            <div className="flex items-center gap-2">
              {durationSecs && (
                <span className="text-xs text-gray-400">{Math.floor(durationSecs / 60)}:{String(durationSecs % 60).padStart(2, "0")}</span>
              )}
              {sttConf != null && sttConf > 0 && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${sttConf >= 0.8 ? "bg-green-100 text-green-700" : sttConf >= 0.5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  STT: {Math.round(sttConf * 100)}%
                </span>
              )}
            </div>
          </div>
          <audio controls src={audioUrl} className="w-full h-10" />
          {transcript && (
            <div className="p-2 bg-white rounded-lg border border-violet-100">
              <p className="text-xs text-gray-400 mb-0.5">Bản chuyển đổi:</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{transcript}</p>
            </div>
          )}
        </div>
      )}
      {imageUrl && (
        <div className="p-2 bg-violet-50 rounded-xl border border-violet-200">
          <img src={imageUrl} alt="Ảnh trả lời" className="max-h-64 rounded-lg object-contain" />
        </div>
      )}
      {!text && !audioUrl && !imageUrl && (
        <span className="text-gray-400 italic text-sm">(Bỏ trống)</span>
      )}
    </div>
  );
}

function formatCorrectAnswer(correctAnswer: string | null, options: string | null, type: string | null): React.ReactNode {
  if (!correctAnswer) return null;
  const t = type ?? "";
  if (t === "mcq") {
    const opts = safeJson<string[]>(options, []);
    const correct = correctAnswer.split(",").map(a => a.trim()).filter(Boolean);
    const labels = "ABCDEFGHIJ";
    return (
      <div className="flex flex-wrap gap-1.5">
        {correct.map((c, i) => {
          const idx = opts.indexOf(c);
          return (
            <span key={i} className="px-2.5 py-1 bg-green-50 border border-green-300 rounded-lg text-sm font-bold text-green-800">
              {idx >= 0 ? `${labels[idx]}. ${c}` : c}
            </span>
          );
        })}
      </div>
    );
  }
  if (t === "true_false") {
    return (
      <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${
        correctAnswer === "Đúng" ? "bg-green-50 border-green-300 text-green-700" : "bg-red-50 border-red-300 text-red-700"
      }`}>{correctAnswer}</span>
    );
  }
  if (t === "fill_blank") {
    const blanks = safeJson<string[]>(correctAnswer, [correctAnswer]);
    return (
      <div className="flex flex-wrap gap-1.5">
        {blanks.map((b, i) => (
          <span key={i} className="px-2.5 py-1 bg-green-50 border border-green-300 rounded-lg text-sm font-medium text-green-800">
            Ô {i + 1}: {b}
          </span>
        ))}
      </div>
    );
  }
  return <span className="text-sm text-green-700 font-medium">{correctAnswer}</span>;
}

const HIGHLIGHT_COLORS = [
  { value: "yellow", label: "Vàng", cls: "bg-yellow-200" },
  { value: "green", label: "Xanh lá", cls: "bg-green-200" },
  { value: "red", label: "Đỏ", cls: "bg-red-200" },
  { value: "blue", label: "Xanh dương", cls: "bg-blue-200" },
];

function AnnotatedText({
  text,
  annotations,
  onAnnotate,
  canAnnotate,
}: {
  text: string;
  annotations: Array<{ id: number; startOffset: number; endOffset: number; comment: string | null; color: string }>;
  onAnnotate: (start: number, end: number, color: string, comment: string) => void;
  canAnnotate: boolean;
}) {
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState("");
  const [color, setColor] = useState("yellow");
  const containerRef = useRef<HTMLDivElement>(null);

  function handleMouseUp() {
    if (!canAnnotate) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    const preRange = document.createRange();
    preRange.setStart(container, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const selectedText = range.toString();
    if (!selectedText.trim()) return;

    setSelStart(start);
    setSelEnd(start + selectedText.length);
    setShowCommentBox(true);
    sel.removeAllRanges();
  }

  function handleSaveAnnotation() {
    if (selStart === null || selEnd === null) return;
    onAnnotate(selStart, selEnd, color, comment);
    setShowCommentBox(false);
    setComment("");
    setSelStart(null);
    setSelEnd(null);
  }

  const sortedAnnotations = [...annotations].sort((a, b) => a.startOffset - b.startOffset);

  const segments: Array<{ text: string; annotation?: typeof annotations[0] }> = [];
  let cursor = 0;
  for (const ann of sortedAnnotations) {
    if (ann.startOffset > cursor) {
      segments.push({ text: text.slice(cursor, ann.startOffset) });
    }
    segments.push({ text: text.slice(ann.startOffset, ann.endOffset), annotation: ann });
    cursor = ann.endOffset;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });

  const colorMap: Record<string, string> = {
    yellow: "bg-yellow-200 cursor-pointer",
    green: "bg-green-200 cursor-pointer",
    red: "bg-red-200 cursor-pointer",
    blue: "bg-blue-200 cursor-pointer",
  };

  return (
    <div>
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className={`text-sm leading-relaxed whitespace-pre-wrap ${canAnnotate ? "select-text" : ""}`}
      >
        {segments.map((seg, i) => (
          seg.annotation ? (
            <span
              key={i}
              className={`${colorMap[seg.annotation.color] ?? "bg-yellow-200"} rounded group relative`}
              title={seg.annotation.comment ?? undefined}
            >
              {seg.text}
              {seg.annotation.comment && (
                <span className="absolute -top-7 left-0 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {seg.annotation.comment}
                </span>
              )}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        ))}
      </div>

      {showCommentBox && (
        <div className="mt-3 p-3 border rounded-lg bg-gray-50 space-y-3">
          <p className="text-xs font-medium text-gray-700">Thêm nhận xét cho đoạn được chọn</p>
          <div className="flex items-center gap-2">
            {HIGHLIGHT_COLORS.map(c => (
              <button
                key={c.value}
                className={`w-6 h-6 rounded-full ${c.cls} border-2 ${color === c.value ? "border-gray-700" : "border-transparent"}`}
                onClick={() => setColor(c.value)}
                title={c.label}
              />
            ))}
          </div>
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Nhận xét (tuỳ chọn)..."
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveAnnotation}>Lưu</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowCommentBox(false); setSelStart(null); setSelEnd(null); }}>Huỷ</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RubricGradingPanel({ submissionId }: { submissionId: number }) {
  const { data: rubrics } = useListRubrics();
  const { data: existingGrades } = useGetSubmissionRubricGrades(submissionId);
  const { mutateAsync: saveGrades } = useSaveRubricGrades();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedRubricId, setSelectedRubricId] = useState<string>("");
  const [gradeInputs, setGradeInputs] = useState<Record<number, { score: number; comment: string }>>({});

  const selectedRubric = (rubrics ?? []).find((r: any) => r.id === parseInt(selectedRubricId));
  const existingMap = Object.fromEntries((existingGrades ?? []).map((g: any) => [g.criterionId, g]));

  function initGradeInputs(rubric: NonNullable<typeof selectedRubric>) {
    const initial: Record<number, { score: number; comment: string }> = {};
    for (const c of rubric.criteria) {
      initial[c.id] = {
        score: existingMap[c.id]?.score ?? 0,
        comment: existingMap[c.id]?.comment ?? "",
      };
    }
    setGradeInputs(initial);
  }

  async function handleSave() {
    if (!selectedRubric) return;
    try {
      await saveGrades({
        id: submissionId,
        data: {
          grades: selectedRubric.criteria.map((c: any) => ({
            criterionId: c.id,
            score: gradeInputs[c.id]?.score ?? 0,
            comment: gradeInputs[c.id]?.comment || undefined,
          })),
        },
      });
      await queryClient.invalidateQueries({ queryKey: [`/api/submissions/${submissionId}/rubric-grades`] });
      toast({ title: "Đã lưu điểm rubric" });
    } catch {
      toast({ title: "Lỗi", description: "Không thể lưu điểm", variant: "destructive" });
    }
  }

  const totalScore = selectedRubric
    ? selectedRubric.criteria.reduce((sum: number, c: any) => sum + (gradeInputs[c.id]?.score ?? 0), 0)
    : 0;
  const maxScore = selectedRubric
    ? selectedRubric.criteria.reduce((sum: number, c: any) => sum + c.maxPoints, 0)
    : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Chọn bộ tiêu chí</Label>
        <Select
          value={selectedRubricId}
          onValueChange={v => {
            setSelectedRubricId(v);
            const r = (rubrics ?? []).find((r: any) => r.id === parseInt(v));
            if (r) initGradeInputs(r);
          }}
        >
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Chọn rubric..." />
          </SelectTrigger>
          <SelectContent>
            {(rubrics ?? []).map((r: any) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.title} ({r.skill})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {existingGrades && existingGrades.length > 0 && !selectedRubricId && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Điểm rubric đã lưu:</p>
          {existingGrades.map((g: any) => (
            <div key={g.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border">
              <div>
                <p className="text-sm font-medium">{g.criterionName}</p>
                {g.comment && <p className="text-xs text-muted-foreground">{g.comment}</p>}
              </div>
              <span className="text-sm font-semibold text-primary">{g.score} đ</span>
            </div>
          ))}
        </div>
      )}

      {selectedRubric && (
        <div className="space-y-3">
          {selectedRubric.criteria.map((c: any) => (
            <div key={c.id} className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                </div>
                <span className="text-xs text-muted-foreground">/ {c.maxPoints}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={c.maxPoints}
                  step={0.5}
                  value={gradeInputs[c.id]?.score ?? 0}
                  onChange={e => setGradeInputs(g => ({ ...g, [c.id]: { ...g[c.id], score: parseFloat(e.target.value) || 0, comment: g[c.id]?.comment ?? "" } }))}
                  className="w-24 h-8 text-sm"
                />
                <Input
                  placeholder="Nhận xét..."
                  value={gradeInputs[c.id]?.comment ?? ""}
                  onChange={e => setGradeInputs(g => ({ ...g, [c.id]: { ...g[c.id], comment: e.target.value, score: g[c.id]?.score ?? 0 } }))}
                  className="flex-1 h-8 text-sm"
                />
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              Tổng: <span className="text-primary">{totalScore} / {maxScore}</span>
            </p>
            <Button onClick={handleSave}>
              <Target className="w-4 h-4 mr-2" />
              Lưu điểm Rubric
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AIFeedbackPanel({ submissionId }: { submissionId: number }) {
  const [show, setShow] = useState(false);
  const { data: feedback, isPending: isLoading, mutate } = useGetPersonalizedFeedback();

  const handleGetFeedback = () => {
    if (!show) {
      setShow(true);
      mutate({ submissionId });
    } else {
      setShow(false);
    }
  };

  return (
    <Card className="border-purple-100 bg-gradient-to-br from-purple-50/50 to-blue-50/50">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-purple-900">Nhận xét AI cá nhân hoá</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGetFeedback}
            className="border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            {show ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            {show ? "Ẩn" : "Xem nhận xét AI"}
          </Button>
        </div>

        {show && (
          <div className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : feedback ? (
              <div className="space-y-4">
                <div className="p-3 bg-white rounded-lg border border-purple-100">
                  <p className="text-sm text-gray-800 leading-relaxed">{feedback.overallMessage}</p>
                </div>

                {(feedback.strengths ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">✅ Điểm mạnh</p>
                    <ul className="space-y-1">
                      {(feedback.strengths ?? []).map((s: any, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">•</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(feedback.areasForImprovement ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-700 mb-2 uppercase tracking-wide">📈 Cần cải thiện</p>
                    <ul className="space-y-1">
                      {(feedback.areasForImprovement ?? []).map((a: any, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-orange-400 mt-0.5">•</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(feedback.nextSteps ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">🎯 Bước tiếp theo</p>
                    <ul className="space-y-1">
                      {(feedback.nextSteps ?? []).map((s: any, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">{i + 1}.</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <p className="text-sm text-purple-800 italic">💪 {feedback.encouragement}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Không thể tải nhận xét AI. Vui lòng thử lại.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const submissionId = Number(id);
  const { data: me } = useGetMe();
  const { data: submission, isLoading } = useGetSubmission(submissionId, {
    query: { enabled: !!id, queryKey: getGetSubmissionQueryKey(submissionId) }
  });
  const { data: annotations } = useGetSubmissionAnnotations(submissionId, {
    query: { enabled: !!submissionId, queryKey: getGetSubmissionAnnotationsQueryKey(submissionId) }
  });
  const { mutateAsync: createAnnotation } = useCreateAnnotation();
  const { mutateAsync: deleteAnnotation } = useDeleteAnnotation();
  const { mutateAsync: gradeSubmission } = useGradeSubmission();
  const { mutateAsync: gradeQuestionMutate } = useGradeQuestion();
  const { mutateAsync: publishGradesMutate } = usePublishGrades();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [gradeFeedback, setGradeFeedback] = useState<string>("");
  const [questionGrades, setQuestionGrades] = useState<Record<number, { points: string; comment: string }>>({});
  const [savingQuestion, setSavingQuestion] = useState<number | null>(null);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [publishing, setPublishing] = useState<"single" | "all" | null>(null);

  useEffect(() => {
    if (submission?.feedback != null) setGradeFeedback(submission.feedback);
  }, [submission?.feedback]);

  const isTeacher = me?.role && ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"].includes(me.role);
  const canShowCorrect = !!isTeacher || !!(submission as any)?.allowReview;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (!submission) {
    return <div className="text-center py-20 text-muted-foreground">Không tìm thấy bài nộp</div>;
  }

  const percentage = submission.percentage ?? 0;

  const annotationsForAnswer = (questionId: number) =>
    (annotations ?? []).filter((a: any) => a.questionId === questionId);

  async function handleAnnotate(questionId: number, start: number, end: number, color: string, comment: string) {
    try {
      await createAnnotation({ id: submissionId, data: { questionId, startOffset: start, endOffset: end, comment: comment || undefined, color } });
      await queryClient.invalidateQueries({ queryKey: [`/api/submissions/${submissionId}/annotations`] });
      toast({ title: "Đã thêm nhận xét" });
    } catch {
      toast({ title: "Lỗi", variant: "destructive" });
    }
  }

  async function handleDeleteAnnotation(annotationId: number) {
    try {
      await deleteAnnotation({ id: submissionId, annotationId });
      await queryClient.invalidateQueries({ queryKey: [`/api/submissions/${submissionId}/annotations`] });
      toast({ title: "Đã xoá nhận xét" });
    } catch {
      toast({ title: "Lỗi", variant: "destructive" });
    }
  }

  async function handleSaveFeedback() {
    if (!submission) return;
    setSavingFeedback(true);
    try {
      await gradeSubmission({
        id: submissionId,
        data: {
          score: submission.score ?? 0,
          feedback: gradeFeedback.trim() ? gradeFeedback : undefined,
          keepStatus: true,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetSubmissionQueryKey(submissionId) });
      toast({
        title: "Đã lưu nhận xét",
        description: submission.status === "pending_review"
          ? "Nhận xét lưu dạng nháp — học sinh chỉ thấy sau khi publish"
          : "Học sinh đã có thể thấy nhận xét cập nhật",
      });
    } catch {
      toast({ title: "Lỗi", description: "Không thể lưu nhận xét", variant: "destructive" });
    } finally {
      setSavingFeedback(false);
    }
  }

  async function handlePublishSingle() {
    if (!submission) return;
    setPublishing("single");
    try {
      await gradeSubmission({
        id: submissionId,
        data: {
          score: submission.score ?? 0,
          feedback: gradeFeedback.trim() ? gradeFeedback : undefined,
          keepStatus: false,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetSubmissionQueryKey(submissionId) });
      toast({ title: "Đã công bố kết quả cho học sinh này" });
    } catch {
      toast({ title: "Lỗi", description: "Không thể công bố", variant: "destructive" });
    } finally {
      setPublishing(null);
    }
  }

  async function handlePublishAll() {
    if (!submission) return;
    setPublishing("all");
    try {
      const result = await publishGradesMutate({ id: submission.assignmentId });
      await queryClient.invalidateQueries({ queryKey: getGetSubmissionQueryKey(submissionId) });
      toast({ title: result.message || "Đã publish kết quả" });
    } catch {
      toast({ title: "Lỗi", description: "Không thể publish kết quả", variant: "destructive" });
    } finally {
      setPublishing(null);
    }
  }

  const feedbackChanged = gradeFeedback.trim() !== (submission?.feedback ?? "").trim();
  const isPendingReview = submission?.status === "pending_review";
  const isPublishedOrGraded = submission?.status === "published" || submission?.status === "graded";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{submission.assignmentTitle}</h1>
        <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
          <span>Học sinh: <span className="font-medium text-gray-700">{submission.studentName}</span></span>
          <span>Nộp lúc: <span className="font-medium text-gray-700">{formatDate(submission.submittedAt)}</span></span>
          {submission.gradedAt && <span>Chấm lúc: <span className="font-medium text-gray-700">{formatDate(submission.gradedAt)}</span></span>}
        </div>
      </div>

      {/* Score card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className={`text-5xl font-extrabold ${
                percentage >= 80 ? "text-success" : percentage >= 50 ? "text-warning" : "text-destructive"
              }`}>
                {submission.score !== null && submission.score !== undefined ? submission.score : "—"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">/ {submission.totalPoints} điểm</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {(submission.status === "graded" || submission.status === "published") ? `${percentage.toFixed(1)}%` : "Chờ chấm điểm"}
                </span>
                {submission.status === "graded" ? (
                  <Badge className={percentage >= 80 ? "bg-green-100 text-success border-0" : percentage >= 50 ? "bg-amber-100 text-warning border-0" : "bg-red-100 text-red-600 border-0"}>
                    {percentage >= 80 ? "Đạt" : percentage >= 50 ? "Trung bình" : "Chưa đạt"}
                  </Badge>
                ) : submission.status === "published" ? (
                  <Badge className="bg-blue-100 text-blue-700 border-0">
                    Đã công bố
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-warning border-0">
                    <Clock className="w-3 h-3 mr-1" />
                    Chờ chấm
                  </Badge>
                )}
              </div>
              {(submission.status === "graded" || submission.status === "published") && (
                <Progress value={percentage} className="h-3" />
              )}
              {submission.feedback && (
                <p className="text-sm text-muted-foreground mt-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {submission.feedback}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student pending_review notice */}
      {!isTeacher && submission.status === "pending_review" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900">Đã ghi nhận bài nộp</p>
                <p className="text-sm text-amber-700">Bài làm đang chờ giáo viên chấm điểm. Kết quả sẽ được công bố sau khi giáo viên hoàn tất chấm điểm.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Personalized Feedback */}
      {(submission.status === "graded" || submission.status === "published") && (
        <AIFeedbackPanel submissionId={submission.id} />
      )}

      <Tabs defaultValue="answers">
        <TabsList>
          <TabsTrigger value="answers">Chi tiết bài làm</TabsTrigger>
          {isTeacher && <TabsTrigger value="grade">Chấm điểm</TabsTrigger>}
          {isTeacher && <TabsTrigger value="rubric">Rubric</TabsTrigger>}
        </TabsList>

        <TabsContent value="answers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Chi tiết từng câu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(submission.answers ?? []).map((answer: any, index: number) => {
                  const qType = answer.questionType as string | null;
                  const isEssay = answer.isCorrect === undefined || answer.isCorrect === null;
                  const isEssayType = qType === "essay";
                  const anns = annotationsForAnswer(answer.questionId);
                  const isGradedEssay = isEssay && (
                    submission.status === "published" ||
                    (submission.status === "graded" && (answer.pointsEarned != null || answer.teacherComment != null))
                  );

                  return (
                    <div key={answer.questionId} className={`rounded-xl border-2 overflow-hidden ${
                      isEssay
                        ? isGradedEssay ? "border-green-200" : "border-amber-200"
                        : answer.isCorrect ? "border-green-200" : "border-red-200"
                    }`}>
                      {/* Header */}
                      <div className={`flex items-center justify-between px-4 py-2.5 ${
                        isEssay
                          ? isGradedEssay ? "bg-green-50" : "bg-amber-50"
                          : answer.isCorrect ? "bg-green-50" : "bg-red-50"
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white border shadow-sm">
                            {isEssay ? (
                              isGradedEssay ? <CheckCircle className="w-3.5 h-3.5 text-success" /> : <Clock className="w-3.5 h-3.5 text-warning" />
                            ) : answer.isCorrect ? (
                              <CheckCircle className="w-3.5 h-3.5 text-success" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-800">Câu {index + 1}</span>
                          {qType && (
                            <Badge variant="outline" className="text-xs py-0 h-5">
                              {QUESTION_TYPE_LABELS[qType] ?? qType}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-warning" />
                          <span className="text-sm font-semibold text-gray-700">{answer.pointsEarned ?? "—"}</span>
                          {answer.points != null && <span className="text-xs text-gray-400">/ {answer.points}</span>}
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-4 bg-white space-y-3">

                        {/* Question content */}
                        {answer.questionContent && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Đề bài</p>
                            <div className="text-sm text-gray-900">
                              <MarkdownView source={answer.questionContent} />
                            </div>
                          </div>
                        )}

                        {/* Passage for reading/listening */}
                        {answer.questionPassage && (qType === "reading" || qType === "listening") && (
                          <details className="rounded-lg border border-blue-100 bg-blue-50/40">
                            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-semibold text-blue-700 select-none">
                              <BookOpen className="w-3.5 h-3.5" />
                              Xem đoạn văn / transcript
                            </summary>
                            <div className="px-4 pb-3 pt-1 text-sm text-gray-800">
                              <MarkdownView source={answer.questionPassage} />
                            </div>
                          </details>
                        )}

                        {/* Student answer — rendered like the question itself with overlay of correct/wrong */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                            {qType === "essay" || qType === "open_end" ? "Câu trả lời của học sinh" : "Bài làm"}
                          </p>
                          {isEssayType && isTeacher ? (
                            <div>
                              <AnnotatedText
                                text={answer.answer || "(Bỏ trống)"}
                                annotations={anns.map((a: any) => ({
                                  id: a.id, startOffset: a.startOffset, endOffset: a.endOffset,
                                  comment: a.comment ?? null, color: a.color,
                                }))}
                                onAnnotate={(start, end, color, comment) => handleAnnotate(answer.questionId, start, end, color, comment)}
                                canAnnotate={!!isTeacher}
                              />
                              <p className="text-xs text-muted-foreground mt-1.5 italic">💡 Chọn văn bản để thêm nhận xét inline</p>
                            </div>
                          ) : (
                            <SubmissionAnswerView answer={answer} canShowCorrect={canShowCorrect} />
                          )}
                        </div>

                        {/* Annotations list */}
                        {anns.length > 0 && (
                          <div className="space-y-1">
                            {anns.map((a: any) => (
                              <div key={a.id} className="flex items-center justify-between px-2 py-1 rounded bg-gray-50 border text-xs">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">[{a.startOffset}:{a.endOffset}]</span>
                                  {a.comment && <span>{a.comment}</span>}
                                </div>
                                {isTeacher && (
                                  <button onClick={() => handleDeleteAnnotation(a.id)} className="text-red-400 hover:text-red-600">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Correct answer (for wrong auto-graded answers) */}
                        {/* {!isEssay && !answer.isCorrect && answer.correctAnswer && (
                          <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                            <p className="text-xs font-semibold text-green-700 mb-1.5">✅ Đáp án đúng</p>
                            {formatCorrectAnswer(answer.correctAnswer, answer.questionOptions, qType)}
                          </div>
                        )} */}

                        {/* Explanation */}
                        {answer.questionExplanation && (
                          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                            <p className="text-xs font-semibold text-amber-700 mb-1">💡 Giải thích</p>
                            <div className="text-sm text-amber-900">
                              <MarkdownView source={answer.questionExplanation} />
                            </div>
                          </div>
                        )}

                        {/* Auto feedback */}
                        {answer.feedback && (
                          <p className="text-xs text-muted-foreground italic">{answer.feedback}</p>
                        )}

                        {/* Teacher comment */}
                        {answer.teacherComment && (
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-xs font-semibold text-blue-700 mb-1">Nhận xét giáo viên</p>
                            <p className="text-sm text-blue-900">{answer.teacherComment}</p>
                          </div>
                        )}

                        {/* Essay status for student */}
                        {!isTeacher && isEssay && (
                          isGradedEssay
                            ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">Đã chấm</Badge>
                            : <Badge className="bg-amber-100 text-warning border-0 text-xs">Chờ chấm tay</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isTeacher && (
          <TabsContent value="grade" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chấm điểm từng câu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(submission.answers ?? []).map((answer: any, index: number) => {
                  const isEssay = answer.isCorrect === undefined || answer.isCorrect === null;
                  const qg = questionGrades[answer.questionId] ?? { points: String(answer.pointsEarned), comment: answer.teacherComment ?? "" };
                  return (
                    <div key={answer.questionId} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">Câu {index + 1}</p>
                          {answer.questionType && (
                            <Badge variant="outline" className="text-xs py-0 h-5">
                              {QUESTION_TYPE_LABELS[answer.questionType] ?? answer.questionType}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isEssay ? (
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Bài luận/Mở</Badge>
                          ) : (
                            <Badge className={answer.isCorrect ? "bg-green-100 text-green-700 border-0 text-xs" : "bg-red-100 text-red-600 border-0 text-xs"}>
                              {answer.isCorrect ? "Đúng" : "Sai"}
                            </Badge>
                          )}
                          <span className="text-sm font-medium">{answer.pointsEarned} đ</span>
                        </div>
                      </div>
                      {answer.questionContent && (
                        <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                          <p className="text-xs text-gray-400 mb-1">Đề bài:</p>
                          <div className="text-sm text-gray-800">
                            <MarkdownView source={answer.questionContent} />
                          </div>
                        </div>
                      )}

                      {/* Passage collapsible for reading/listening */}
                      {answer.questionPassage && (answer.questionType === "reading" || answer.questionType === "listening") && (
                        <details className="rounded-lg border border-blue-100 bg-blue-50/40">
                          <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-semibold text-blue-700 select-none">
                            <BookOpen className="w-3.5 h-3.5" />
                            Xem đoạn văn / transcript
                          </summary>
                          <div className="px-4 pb-3 pt-1 text-sm text-gray-800">
                            <MarkdownView source={answer.questionPassage} />
                          </div>
                        </details>
                      )}

                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">
                          {answer.questionType === "essay" || answer.questionType === "open_end" ? "Câu trả lời của học sinh:" : "Bài làm:"}
                        </p>
                        <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                          <SubmissionAnswerView answer={answer} canShowCorrect={canShowCorrect} />
                        </div>
                      </div>
                      {isEssay && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">
                            Điểm
                            {answer.points != null && (
                              <span className="text-muted-foreground font-normal ml-1">(tối đa {answer.points})</span>
                            )}
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              max={answer.points ?? undefined}
                              step={0.5}
                              value={qg.points}
                              onChange={e => {
                                const val = e.target.value;
                                const num = parseFloat(val);
                                const max = answer.points ?? Infinity;
                                if (!isNaN(num) && num > max) {
                                  setQuestionGrades(g => ({ ...g, [answer.questionId]: { ...qg, points: String(max) } }));
                                } else {
                                  setQuestionGrades(g => ({ ...g, [answer.questionId]: { ...qg, points: val } }));
                                }
                              }}
                              className="w-28 h-8 text-sm"
                            />
                            {answer.points != null && (
                              <span className="text-xs text-muted-foreground">/ {answer.points} điểm</span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nhận xét</Label>
                        <Textarea
                          value={qg.comment}
                          onChange={e => setQuestionGrades(g => ({ ...g, [answer.questionId]: { ...qg, comment: e.target.value } }))}
                          placeholder="Nhận xét cho câu này..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingQuestion === answer.questionId}
                        onClick={async () => {
                          if (isEssay && qg.points) {
                            const pts = parseFloat(qg.points);
                            const maxPts = answer.points ?? Infinity;
                            if (isNaN(pts) || pts < 0 || pts > maxPts) {
                              toast({ title: `Điểm không hợp lệ — phải từ 0 đến ${maxPts}`, variant: "destructive" });
                              return;
                            }
                          }
                          setSavingQuestion(answer.questionId);
                          try {
                            const body: Record<string, unknown> = {};
                            if (qg.comment) body.teacherComment = qg.comment;
                            if (isEssay && qg.points) body.pointsEarned = parseFloat(qg.points);
                            await gradeQuestionMutate({ id: submissionId, questionId: answer.questionId, data: body as any });
                            await queryClient.invalidateQueries({ queryKey: getGetSubmissionQueryKey(submissionId) });
                            toast({ title: `Đã lưu câu ${index + 1}` });
                          } catch {
                            toast({ title: "Lỗi", variant: "destructive" });
                          } finally {
                            setSavingQuestion(null);
                          }
                        }}
                      >
                        {savingQuestion === answer.questionId ? "Đang lưu..." : "Lưu câu này"}
                      </Button>
                    </div>
                  );
                })}

                <div className="border-t pt-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold">Nhận xét chung (tuỳ chọn)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isPendingReview
                        ? "Nhận xét nội bộ — chỉ hiển thị cho học sinh sau khi công bố kết quả"
                        : "Học sinh đã có thể thấy kết quả — chỉnh sửa nhận xét sẽ áp dụng ngay"}
                    </p>
                  </div>
                  <Textarea
                    value={gradeFeedback}
                    onChange={e => setGradeFeedback(e.target.value)}
                    placeholder="Nhận xét chung cho học sinh..."
                    rows={3}
                  />

                  <div className="space-y-3">
                    {/* Save feedback (always available) */}
                    <div className="flex flex-wrap gap-3 items-center">
                      <Button
                        onClick={handleSaveFeedback}
                        variant="outline"
                        size="sm"
                        disabled={savingFeedback || !feedbackChanged}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {savingFeedback
                          ? "Đang lưu..."
                          : isPendingReview
                            ? "Lưu nháp nhận xét"
                            : "Cập nhật nhận xét"}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {!feedbackChanged
                          ? "Chưa có thay đổi"
                          : isPendingReview
                            ? "Lưu tạm — chưa công bố cho học sinh"
                            : "Áp dụng ngay cho học sinh"}
                      </span>
                    </div>

                    {/* Publish actions — only for pending_review */}
                    {isPendingReview && (
                      <div className="pt-3 border-t space-y-2">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Công bố kết quả</p>

                        <div className="flex flex-wrap gap-3 items-center">
                          <Button
                            onClick={handlePublishSingle}
                            size="sm"
                            disabled={publishing !== null}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {publishing === "single" ? "Đang công bố..." : "Công bố chỉ bài này"}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Học sinh <span className="font-medium text-gray-700">{submission.studentName}</span> sẽ thấy điểm và nhận xét ngay
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-3 items-center">
                          <Button
                            onClick={handlePublishAll}
                            size="sm"
                            variant="outline"
                            disabled={publishing !== null}
                          >
                            {publishing === "all" ? "Đang công bố..." : "Công bố tất cả bài chờ chấm"}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Áp dụng cho <span className="font-medium">tất cả</span> bài nộp đang chờ chấm trong assignment này
                          </span>
                        </div>
                      </div>
                    )}

                    {isPublishedOrGraded && (
                      <div className="pt-3 border-t flex items-center gap-2 text-xs text-green-700">
                        <CheckCircle className="w-4 h-4" />
                        <span>
                          {submission.status === "published"
                            ? "Đã công bố — học sinh đang thấy kết quả này"
                            : "Đã chấm tự động — học sinh đang thấy kết quả này"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isTeacher && (
          <TabsContent value="rubric" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chấm điểm theo Rubric</CardTitle>
              </CardHeader>
              <CardContent>
                <RubricGradingPanel submissionId={submissionId} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
