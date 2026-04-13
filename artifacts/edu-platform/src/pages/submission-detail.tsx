import { useState, useRef } from "react";
import { useParams } from "wouter";
import {
  useGetSubmission, useGradeSubmission,
  useGetSubmissionAnnotations, getGetSubmissionAnnotationsQueryKey, useCreateAnnotation, useDeleteAnnotation,
  useGetSubmissionRubricGrades, useSaveRubricGrades, useListRubrics,
  useGetPersonalizedFeedback,
  getGetSubmissionQueryKey
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
import { CheckCircle, XCircle, Clock, Star, MessageSquare, Trash2, Target, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy HH:mm"); } catch { return iso ?? "—"; }
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

  const selectedRubric = (rubrics ?? []).find(r => r.id === parseInt(selectedRubricId));
  const existingMap = Object.fromEntries((existingGrades ?? []).map(g => [g.criterionId, g]));

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
          grades: selectedRubric.criteria.map(c => ({
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
    ? selectedRubric.criteria.reduce((sum, c) => sum + (gradeInputs[c.id]?.score ?? 0), 0)
    : 0;
  const maxScore = selectedRubric
    ? selectedRubric.criteria.reduce((sum, c) => sum + c.maxPoints, 0)
    : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Chọn bộ tiêu chí</Label>
        <Select
          value={selectedRubricId}
          onValueChange={v => {
            setSelectedRubricId(v);
            const r = (rubrics ?? []).find(r => r.id === parseInt(v));
            if (r) initGradeInputs(r);
          }}
        >
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Chọn rubric..." />
          </SelectTrigger>
          <SelectContent>
            {(rubrics ?? []).map(r => (
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
          {existingGrades.map(g => (
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
          {selectedRubric.criteria.map(c => (
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

                {feedback.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">✅ Điểm mạnh</p>
                    <ul className="space-y-1">
                      {feedback.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">•</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {feedback.areasForImprovement.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-700 mb-2 uppercase tracking-wide">📈 Cần cải thiện</p>
                    <ul className="space-y-1">
                      {feedback.areasForImprovement.map((a, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-orange-400 mt-0.5">•</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {feedback.nextSteps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">🎯 Bước tiếp theo</p>
                    <ul className="space-y-1">
                      {feedback.nextSteps.map((s, i) => (
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [gradeScore, setGradeScore] = useState<string>("");
  const [gradeFeedback, setGradeFeedback] = useState<string>("");

  const isTeacher = me?.role && ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"].includes(me.role);

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
    (annotations ?? []).filter(a => a.questionId === questionId);

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

  async function handleGrade() {
    const score = parseFloat(gradeScore);
    if (isNaN(score)) { toast({ title: "Vui lòng nhập điểm hợp lệ", variant: "destructive" }); return; }
    try {
      await gradeSubmission({ id: submissionId, data: { score, feedback: gradeFeedback || undefined } });
      await queryClient.invalidateQueries({ queryKey: getGetSubmissionQueryKey(submissionId) });
      toast({ title: "Đã chấm điểm thành công" });
    } catch {
      toast({ title: "Lỗi", description: "Không thể chấm điểm", variant: "destructive" });
    }
  }

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
                  {submission.status === "graded" ? `${percentage.toFixed(1)}%` : "Chờ chấm điểm"}
                </span>
                {submission.status === "graded" ? (
                  <Badge className={percentage >= 80 ? "bg-green-100 text-success border-0" : percentage >= 50 ? "bg-amber-100 text-warning border-0" : "bg-red-100 text-red-600 border-0"}>
                    {percentage >= 80 ? "Đạt" : percentage >= 50 ? "Trung bình" : "Chưa đạt"}
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-warning border-0">
                    <Clock className="w-3 h-3 mr-1" />
                    Chờ chấm
                  </Badge>
                )}
              </div>
              {submission.status === "graded" && (
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

      {/* AI Personalized Feedback */}
      {submission.status === "graded" && (
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
                {(submission.answers ?? []).map((answer, index) => {
                  const isEssay = answer.isCorrect === undefined || answer.isCorrect === null;
                  const anns = annotationsForAnswer(answer.questionId);
                  return (
                    <div key={answer.questionId} className={`p-4 rounded-xl border-2 ${
                      isEssay ? "border-amber-100 bg-amber-50/30" :
                      answer.isCorrect ? "border-green-100 bg-green-50/30" :
                      "border-red-100 bg-red-50/30"
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white border">
                            {isEssay ? (
                              <Clock className="w-4 h-4 text-warning" />
                            ) : answer.isCorrect ? (
                              <CheckCircle className="w-4 h-4 text-success" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">Câu {index + 1}</p>
                            <div className="mt-2 space-y-1">
                              {isEssay ? (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Bài luận:</p>
                                  {isTeacher ? (
                                    <AnnotatedText
                                      text={answer.answer || "(Bỏ trống)"}
                                      annotations={anns.map(a => ({
                                        id: a.id,
                                        startOffset: a.startOffset,
                                        endOffset: a.endOffset,
                                        comment: a.comment ?? null,
                                        color: a.color,
                                      }))}
                                      onAnnotate={(start, end, color, comment) => handleAnnotate(answer.questionId, start, end, color, comment)}
                                      canAnnotate={!!isTeacher}
                                    />
                                  ) : (
                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{answer.answer || "(Bỏ trống)"}</p>
                                  )}
                                  {anns.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {anns.map(a => (
                                        <div key={a.id} className="flex items-center justify-between px-2 py-1 rounded bg-white border text-xs">
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
                                  {isTeacher && (
                                    <p className="text-xs text-muted-foreground mt-1 italic">💡 Chọn văn bản để thêm nhận xét inline</p>
                                  )}
                                  {!isTeacher && (
                                    <Badge className="bg-amber-100 text-warning border-0 text-xs mt-1">Chờ chấm tay</Badge>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <div className="flex gap-2">
                                    <span className="text-xs text-muted-foreground w-24 flex-shrink-0">Câu trả lời:</span>
                                    <span className="text-sm text-gray-900">{answer.answer || "(Bỏ trống)"}</span>
                                  </div>
                                  {answer.correctAnswer && (
                                    <div className="flex gap-2">
                                      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">Đáp án đúng:</span>
                                      <span className="text-sm text-success font-medium">{answer.correctAnswer}</span>
                                    </div>
                                  )}
                                </>
                              )}
                              {answer.feedback && (
                                <p className="text-xs text-muted-foreground mt-1 italic">{answer.feedback}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Star className="w-4 h-4 text-warning" />
                          <span className="text-sm font-semibold">{answer.pointsEarned}</span>
                        </div>
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
                <CardTitle className="text-base">Chấm điểm thủ công</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Điểm (tối đa: {submission.totalPoints})</Label>
                  <Input
                    type="number"
                    min={0}
                    max={submission.totalPoints}
                    step={0.5}
                    value={gradeScore}
                    onChange={e => setGradeScore(e.target.value)}
                    placeholder={submission.score !== null ? String(submission.score) : "Nhập điểm..."}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nhận xét tổng thể</Label>
                  <Textarea
                    value={gradeFeedback}
                    onChange={e => setGradeFeedback(e.target.value)}
                    placeholder={submission.feedback ?? "Nhận xét cho học sinh..."}
                    rows={4}
                  />
                </div>
                <Button onClick={handleGrade}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Lưu điểm
                </Button>
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
