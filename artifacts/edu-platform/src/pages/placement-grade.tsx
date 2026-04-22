import React, { useEffect, useState } from "react";
import { useParams, Link } from "@/lib/routing";
import { placementApi, type PlacementSubmission, type PlacementTest, type PlacementTestQuestion, type PlacementAnswer } from "@/lib/placement-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Mail, CheckCircle, XCircle, Clock, Star, BookOpen } from "lucide-react";
import { SubmissionAnswerView, type AnswerLike } from "@/components/submission-answer-view";
import { MarkdownView } from "@/components/markdown-view";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("vi-VN"); } catch { return iso ?? "—"; }
}

function safeJson<T>(s: unknown, fallback: T): T {
  if (s == null) return fallback;
  if (typeof s !== "string") {
    try { return s as T; } catch { return fallback; }
  }
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: "Trắc nghiệm", true_false: "Đúng/Sai", fill_blank: "Điền chỗ trống",
  word_selection: "Chọn từ", matching: "Nối cặp", drag_drop: "Kéo thả",
  sentence_reorder: "Sắp xếp câu", reading: "Đọc hiểu", listening: "Nghe hiểu",
  video_interactive: "Video tương tác", essay: "Bài luận", open_end: "Câu hỏi mở",
};

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-green-100 text-green-700", A2: "bg-green-200 text-green-800",
  B1: "bg-blue-100 text-blue-700", B2: "bg-blue-200 text-blue-800",
  C1: "bg-purple-100 text-purple-700", C2: "bg-purple-200 text-purple-800",
};

function makeAnswerLike(q: PlacementTestQuestion, a: PlacementAnswer | undefined): AnswerLike {
  const ca = a?.isCorrect === true || a?.isCorrect === false ? a!.isCorrect : null;
  return {
    questionType: q.type,
    questionContent: q.content,
    questionPassage: q.passage ?? null,
    questionOptions: typeof q.options === "string" ? q.options : (q.options != null ? JSON.stringify(q.options) : null),
    answer: a?.studentAnswer ?? null,
    correctAnswer: q.correctAnswer,
    isCorrect: ca,
  };
}

type Grade = { manualScore: string; comment: string };

export default function PlacementGradePage() {
  const { sid } = useParams<{ sid: string }>();
  const subId = Number(sid);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    submission: PlacementSubmission;
    test: PlacementTest;
    questions: PlacementTestQuestion[];
    answers: PlacementAnswer[];
  } | null>(null);
  const [grades, setGrades] = useState<Record<number, Grade>>({});
  const [overallComment, setOverallComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await placementApi.getSubmission(subId);
      setData(d);
      setOverallComment(d.submission.teacherComment ?? "");
      const g: Record<number, Grade> = {};
      for (const a of d.answers) {
        g[a.id] = {
          manualScore: a.manualScore != null ? String(a.manualScore) : (a.autoScore != null ? String(a.autoScore) : ""),
          comment: a.teacherComment ?? "",
        };
      }
      setGrades(g);
    } catch (e: any) {
      toast({ title: "Không tải được", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (subId) load(); }, [subId]);

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    try {
      const answerGrades = data.answers.map(a => {
        const g = grades[a.id];
        return {
          answerId: a.id,
          manualScore: g?.manualScore.trim() ? Number(g.manualScore) : null,
          teacherComment: g?.comment.trim() ? g.comment : null,
        };
      });
      await placementApi.gradeSubmission(subId, {
        teacherComment: overallComment.trim() || null,
        answerGrades,
      });
      toast({ title: "Đã lưu chấm điểm" });
      load();
    } catch (e: any) {
      toast({ title: "Không lưu được", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendResult() {
    if (!data) return;
    if (data.submission.gradingStatus !== "graded") {
      toast({ title: "Cần lưu chấm điểm trước khi gửi", variant: "destructive" }); return;
    }
    if (!confirm(`Gửi kết quả cho ${data.submission.studentName} (${data.submission.studentEmail})?`)) return;
    setSending(true);
    try {
      await placementApi.sendResult(subId);
      toast({ title: "Đã gửi email kết quả" });
      load();
    } catch (e: any) {
      toast({ title: "Không gửi được", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const { submission: sub, test, questions, answers } = data;
  const ansMap = new Map<number, PlacementAnswer>(answers.map(a => [a.questionId, a]));
  const currentTotal = answers.reduce((s, a) => {
    const g = grades[a.id];
    const pts = g?.manualScore.trim() ? Number(g.manualScore) : (a.autoScore ?? 0);
    return s + (isNaN(pts) ? 0 : pts);
  }, 0);
  const percentage = test.maxScore > 0 ? Math.round((currentTotal / test.maxScore) * 100) : 0;
  const isGraded = sub.gradingStatus === "graded";
  const isEssayType = (type: string) => type === "essay" || type === "open_end";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link href={`/placement-tests/${test.id}/submissions`}>
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Danh sách</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{sub.studentName}</h1>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
              <span>Email: <span className="font-medium text-gray-700">{sub.studentEmail}</span></span>
              <span>Bài test: <span className="font-medium text-gray-700">{test.title}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Score card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className={`text-5xl font-extrabold ${
                percentage >= 80 ? "text-green-600" : percentage >= 50 ? "text-amber-500" : "text-red-500"
              }`}>
                {currentTotal}
              </div>
              <div className="text-sm text-muted-foreground mt-1">/ {test.maxScore} điểm</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {isGraded ? `${percentage}%` : "Chờ chấm điểm"}
                </span>
                {isGraded ? (
                  <Badge className={percentage >= 80 ? "bg-green-100 text-green-700 border-0" : percentage >= 50 ? "bg-amber-100 text-amber-700 border-0" : "bg-red-100 text-red-600 border-0"}>
                    {percentage >= 80 ? "Đạt" : percentage >= 50 ? "Trung bình" : "Chưa đạt"}
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border-0">
                    <Clock className="w-3 h-3 mr-1" />
                    Chờ chấm
                  </Badge>
                )}
              </div>
              {isGraded && <Progress value={percentage} className="h-3" />}
              {sub.teacherComment && (
                <p className="text-sm text-muted-foreground mt-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {sub.teacherComment}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card className="bg-gray-50/50">
        <CardContent className="py-3 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={isGraded ? "default" : "secondary"}>{isGraded ? "Đã chấm" : "Chờ chấm"}</Badge>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Nộp lúc: </span>
            <span className="font-medium">{formatDate(sub.submittedAt)}</span>
          </div>
          {sub.gradedAt && (
            <div className="text-sm">
              <span className="text-muted-foreground">Chấm lúc: </span>
              <span className="font-medium">{formatDate(sub.gradedAt)}</span>
            </div>
          )}
          {test.passScore != null && (
            <div className="text-sm">
              <span className="text-muted-foreground">Điểm đạt: </span>
              <span className="font-medium">{test.passScore}</span>
            </div>
          )}
          {sub.resultSentAt && (
            <div className="flex items-center gap-1.5 text-green-700 text-sm">
              <Mail className="w-4 h-4" />
              <span>Đã gửi kết quả {formatDate(sub.resultSentAt)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="answers">
        <TabsList>
          <TabsTrigger value="answers">Chi tiết bài làm</TabsTrigger>
          <TabsTrigger value="grade">Chấm điểm</TabsTrigger>
        </TabsList>

        {/* Tab: Chi tiết bài làm */}
        <TabsContent value="answers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Chi tiết từng câu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {questions.map((q, idx) => {
                  const a = ansMap.get(q.id);
                  const g = a ? grades[a.id] : undefined;
                  const isEssay = isEssayType(q.type);
                  const isCorrect = a?.isCorrect ?? null;
                  const isGradedCorrect = isCorrect === true;
                  const isGradedWrong = isCorrect === false;

                  return (
                    <div key={q.id} className={`rounded-xl border-2 overflow-hidden ${
                      isEssay
                        ? isGradedCorrect || isGradedWrong ? "border-green-200" : "border-amber-200"
                        : isGradedCorrect ? "border-green-200" : isGradedWrong ? "border-red-200" : "border-gray-200"
                    }`}>
                      {/* Header */}
                      <div className={`flex items-center justify-between px-4 py-2.5 ${
                        isEssay
                          ? isGradedCorrect || isGradedWrong ? "bg-green-50" : "bg-amber-50"
                          : isGradedCorrect ? "bg-green-50" : isGradedWrong ? "bg-red-50" : "bg-gray-50"
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white border shadow-sm">
                            {isEssay ? (
                              isGradedCorrect || isGradedWrong
                                ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                : <Clock className="w-3.5 h-3.5 text-amber-500" />
                            ) : isGradedCorrect ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            ) : isGradedWrong ? (
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-800">Câu {idx + 1}</span>
                          <Badge variant="outline" className="text-xs py-0 h-5">
                            {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                          </Badge>
                          {q.skill && (
                            <Badge variant="outline" className="text-xs py-0 h-5">
                              {q.skill}
                            </Badge>
                          )}
                          {q.level && (
                            <Badge className={`text-xs py-0 h-5 border-0 ${LEVEL_COLORS[q.level] ?? "bg-gray-100 text-gray-600"}`}>
                              {q.level}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-sm font-semibold text-gray-700">
                            {g?.manualScore.trim() ? `${g.manualScore}` : (a?.autoScore ?? "—")}
                          </span>
                          <span className="text-xs text-gray-400">/ {q.points}</span>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-4 bg-white space-y-3">
                        {/* Question content */}
                        {q.content && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Đề bài</p>
                            <div className="text-sm text-gray-900">
                              <MarkdownView source={q.content} />
                            </div>
                          </div>
                        )}

                        {/* Passage for reading/listening */}
                        {q.passage && (q.type === "reading" || q.type === "listening") && (
                          <details className="rounded-lg border border-blue-100 bg-blue-50/40">
                            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-semibold text-blue-700 select-none">
                              <BookOpen className="w-3.5 h-3.5" />
                              Xem đoạn văn / transcript
                            </summary>
                            <div className="px-4 pb-3 pt-1 text-sm text-gray-800">
                              <MarkdownView source={q.passage} />
                            </div>
                          </details>
                        )}

                        {/* Student answer */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                            {isEssay ? "Câu trả lời của học sinh" : "Bài làm"}
                          </p>
                          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                            <SubmissionAnswerView
                              answer={makeAnswerLike(q, a)}
                              canShowCorrect={true}
                            />
                          </div>
                        </div>

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                            <p className="text-xs font-semibold text-amber-700 mb-1">💡 Giải thích</p>
                            <div className="text-sm text-amber-900">
                              <MarkdownView source={q.explanation} />
                            </div>
                          </div>
                        )}

                        {/* Teacher comment */}
                        {a?.teacherComment && (
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-xs font-semibold text-blue-700 mb-1">Nhận xét giáo viên</p>
                            <p className="text-sm text-blue-900">{a.teacherComment}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Chấm điểm */}
        <TabsContent value="grade" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chấm điểm &amp; nhận xét</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((q, idx) => {
                const a = ansMap.get(q.id);
                const g = a ? grades[a.id] : undefined;
                const isEssay = isEssayType(q.type);
                const qg = g ?? { manualScore: "", comment: "" };

                return (
                  <div key={q.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">Câu {idx + 1}</p>
                        <Badge variant="outline" className="text-xs py-0 h-5">
                          {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                        </Badge>
                        {q.level && (
                          <Badge className={`text-xs py-0 h-5 border-0 ${LEVEL_COLORS[q.level] ?? "bg-gray-100 text-gray-600"}`}>
                            {q.level}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {a?.isCorrect === true && <Badge className="bg-green-100 text-green-700 border-0 text-xs">Đúng</Badge>}
                        {a?.isCorrect === false && <Badge variant="destructive" className="text-xs">Sai</Badge>}
                        {isEssay && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Cần chấm tay</Badge>}
                      </div>
                    </div>

                    {/* Question */}
                    {q.content && (
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-400 mb-1">Đề bài:</p>
                        <div className="text-sm text-gray-800">
                          <MarkdownView source={q.content} />
                        </div>
                      </div>
                    )}

                    {/* Passage */}
                    {q.passage && (q.type === "reading" || q.type === "listening") && (
                      <details className="rounded-lg border border-blue-100 bg-blue-50/40">
                        <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-semibold text-blue-700 select-none">
                          <BookOpen className="w-3.5 h-3.5" />
                          Xem đoạn văn / transcript
                        </summary>
                        <div className="px-4 pb-3 pt-1 text-sm text-gray-800">
                          <MarkdownView source={q.passage} />
                        </div>
                      </details>
                    )}

                    {/* Student answer */}
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">
                        {isEssay ? "Câu trả lời của học sinh:" : "Bài làm:"}
                      </p>
                      <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                        <SubmissionAnswerView
                          answer={makeAnswerLike(q, a)}
                          canShowCorrect={true}
                        />
                      </div>
                    </div>

                    {/* Manual grade */}
                    {isEssay && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Điểm
                          <span className="text-muted-foreground font-normal ml-1">(tối đa {q.points})</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={q.points}
                            step={0.5}
                            value={qg.manualScore}
                            onChange={e => {
                              if (!a) return;
                              const val = e.target.value;
                              const num = parseFloat(val);
                              const max = q.points ?? Infinity;
                              if (!isNaN(num) && num > max) {
                                setGrades(prev => ({ ...prev, [a.id]: { ...(prev[a.id] ?? { manualScore: "", comment: "" }), manualScore: String(max) } }));
                              } else {
                                setGrades(prev => ({ ...prev, [a.id]: { ...(prev[a.id] ?? { manualScore: "", comment: "" }), manualScore: val } }));
                              }
                            }}
                            className="w-28 h-8 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">/ {q.points} điểm</span>
                          {a?.autoScore != null && (
                            <span className="text-xs text-muted-foreground">(Tự động: {a.autoScore})</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Non-essay auto grade override */}
                    {!isEssay && a && (
                      <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <Label className="text-xs">Điểm tự động: <span className="font-semibold">{a.autoScore ?? 0}</span></Label>
                        <span className="text-xs text-gray-400">— có thể điều chỉnh thủ công</span>
                      </div>
                    )}

                    {/* Comment */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nhận xét cho câu này</Label>
                      <Textarea
                        value={qg.comment}
                        onChange={e => {
                          if (!a) return;
                          setGrades(prev => ({ ...prev, [a.id]: { ...(prev[a.id] ?? { manualScore: "", comment: "" }), comment: e.target.value } }));
                        }}
                        placeholder="Nhận xét riêng cho câu này (tuỳ chọn)..."
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Overall comment */}
              <div className="border-t pt-4 space-y-2">
                <div>
                  <p className="text-sm font-semibold">Nhận xét chung</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sẽ được gửi kèm trong email kết quả cho học sinh
                  </p>
                </div>
                <Textarea
                  value={overallComment}
                  onChange={e => setOverallComment(e.target.value)}
                  placeholder="Nhận xét chung cho học sinh..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 items-center pt-2 border-t">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Đang lưu..." : "Lưu chấm điểm"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSendResult}
                  disabled={sending || !isGraded}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {sending ? "Đang gửi..." : sub.resultSentAt ? "Gửi lại kết quả" : "Gửi kết quả"}
                </Button>
                {isGraded && (
                  <div className="flex items-center gap-2 text-xs text-green-700 ml-auto">
                    <CheckCircle className="w-4 h-4" />
                    <span>Đã chấm — điểm đang hiệu lực</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
