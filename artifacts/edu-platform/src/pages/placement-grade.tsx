import { useEffect, useState } from "react";
import { useParams, Link } from "@/lib/routing";
import { placementApi, type PlacementSubmission, type PlacementTest, type PlacementTestQuestion, type PlacementAnswer } from "@/lib/placement-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Mail, CheckCircle, XCircle } from "lucide-react";

type Grade = { manualScore: string; comment: string };

function renderValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}

export default function PlacementGradePage() {
  const { sid } = useParams<{ sid: string }>();
  const subId = Number(sid);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ submission: PlacementSubmission; test: PlacementTest; questions: PlacementTestQuestion[]; answers: PlacementAnswer[] } | null>(null);
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
    } catch (e: any) { toast({ title: "Không tải được", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
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
      await placementApi.gradeSubmission(subId, { teacherComment: overallComment.trim() || null, answerGrades });
      toast({ title: "Đã lưu chấm điểm" });
      load();
    } catch (e: any) { toast({ title: "Không lưu được", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
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
    } catch (e: any) { toast({ title: "Không gửi được", description: e.message, variant: "destructive" }); }
    finally { setSending(false); }
  }

  if (loading || !data) return <div className="space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64" /></div>;

  const { submission: sub, test, questions, answers } = data;
  const ansMap = new Map(answers.map(a => [a.questionId, a]));
  const currentTotal = answers.reduce((s, a) => {
    const g = grades[a.id];
    const pts = g?.manualScore.trim() ? Number(g.manualScore) : (a.autoScore ?? 0);
    return s + (isNaN(pts) ? 0 : pts);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/placement-tests/${test.id}/submissions`}><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Danh sách</Button></Link>
        <div>
          <h1 className="text-xl font-bold">{sub.studentName}</h1>
          <p className="text-sm text-muted-foreground">{sub.studentEmail} · {test.title}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-1" /> {saving ? "Đang lưu..." : "Lưu chấm điểm"}</Button>
          <Button variant="outline" onClick={handleSendResult} disabled={sending || sub.gradingStatus !== "graded"}><Mail className="w-4 h-4 mr-1" /> {sub.resultSentAt ? "Gửi lại kết quả" : "Gửi kết quả"}</Button>
        </div>
      </div>

      <Card className="bg-gray-50">
        <CardContent className="py-4 flex items-center gap-6 flex-wrap">
          <div><div className="text-xs text-muted-foreground">Trạng thái</div><Badge variant={sub.gradingStatus === "graded" ? "default" : "secondary"} className="mt-1">{sub.gradingStatus === "graded" ? "Đã chấm" : "Chờ chấm"}</Badge></div>
          <div><div className="text-xs text-muted-foreground">Nộp lúc</div><div className="text-sm font-medium">{sub.submittedAt ? new Date(sub.submittedAt).toLocaleString("vi-VN") : "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Điểm tạm tính</div><div className="text-xl font-bold">{currentTotal} / {test.maxScore}</div></div>
          {sub.resultSentAt && <div className="text-green-700"><Mail className="w-4 h-4 inline mr-1" /> Đã gửi kết quả {new Date(sub.resultSentAt).toLocaleString("vi-VN")}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Nhận xét tổng quát</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={overallComment} onChange={e => setOverallComment(e.target.value)} rows={3} placeholder="Nhận xét chung sẽ được gửi trong email kết quả..." />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {questions.map((q, idx) => {
          const a = ansMap.get(q.id);
          const g = a ? grades[a.id] : undefined;
          const optionStrings = Array.isArray(q.options)
            ? (q.options as unknown[]).filter((o): o is string => typeof o === "string")
            : [];
          const optionObjects = Array.isArray(q.options)
            ? (q.options as unknown[]).filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
            : [];
          return (
            <Card key={q.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{q.type}</Badge>
                      <Badge variant="secondary" className="text-xs">Tối đa {q.points} điểm</Badge>
                      {a && a.isCorrect === true && <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Đúng</Badge>}
                      {a && a.isCorrect === false && <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Sai</Badge>}
                    </div>
                    <p className="text-sm font-medium whitespace-pre-wrap">{q.content}</p>
                    {optionStrings.length > 0 && q.type !== "long_answer" && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {optionStrings.map((o, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded ${o === q.correctAnswer ? "bg-green-100 text-green-800 font-medium" : "bg-gray-100 text-gray-600"}`}>{o}</span>
                        ))}
                      </div>
                    )}
                    {optionStrings.length === 0 && optionObjects.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground">Cấu trúc câu hỏi con:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {optionObjects.slice(0, 6).map((o, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                              {renderValue((o as any).question ?? `Câu ${i + 1}`)}
                            </span>
                          ))}
                          {optionObjects.length > 6 && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                              +{optionObjects.length - 6} câu nữa
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pl-11 space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Trả lời của học sinh</Label>
                    <div className="mt-1 p-2 bg-gray-50 rounded text-sm whitespace-pre-wrap min-h-[2rem]">
                      {a?.studentAnswer != null && a.studentAnswer !== ""
                        ? renderValue(a.studentAnswer)
                        : <span className="text-muted-foreground italic">— không trả lời —</span>}
                    </div>
                  </div>
                  {q.correctAnswer && q.type !== "mcq" && q.type !== "true_false" && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Đáp án đúng</Label>
                      <div className="mt-1 p-2 bg-green-50 rounded text-sm text-green-900">{renderValue(q.correctAnswer)}</div>
                    </div>
                  )}
                  {a && (
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div>
                        <Label className="text-xs">Điểm</Label>
                        <Input type="number" min={0} max={q.points} value={g?.manualScore ?? ""} onChange={e => setGrades({ ...grades, [a.id]: { ...(g ?? { manualScore: "", comment: "" }), manualScore: e.target.value } })} />
                        <div className="text-xs text-muted-foreground mt-0.5">Tự động: {a.autoScore ?? "—"}</div>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Nhận xét riêng (tuỳ chọn)</Label>
                        <Input value={g?.comment ?? ""} onChange={e => setGrades({ ...grades, [a.id]: { ...(g ?? { manualScore: "", comment: "" }), comment: e.target.value } })} />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
