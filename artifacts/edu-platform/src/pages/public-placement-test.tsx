import { useEffect, useState } from "react";
import { useParams } from "@/lib/routing";
import { placementPublicApi } from "@/lib/placement-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Clock, AlertCircle, FileText, ArrowRight } from "lucide-react";

type TestData = Awaited<ReturnType<typeof placementPublicApi.getBySlug>>;

export default function PublicPlacementTestPage() {
  const { slug } = useParams<{ slug: string }>();
  const [stage, setStage] = useState<"landing" | "taking" | "submitted">("landing");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestData | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ autoScore: number; maxScore: number; showScore: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    placementPublicApi.getBySlug(slug!)
      .then(setTest)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  // countdown
  useEffect(() => {
    if (stage !== "taking" || timeLeft == null) return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    const t = setTimeout(() => setTimeLeft(v => (v != null ? v - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [stage, timeLeft]);

  async function handleStart() {
    if (!studentName.trim() || !studentEmail.trim()) return;
    setStarting(true);
    setStartError(null);
    try {
      const r = await placementPublicApi.start(slug!, studentName.trim(), studentEmail.trim());
      setSubmissionId(r.submissionId);
      setToken(r.token);
      setStage("taking");
      if (test?.timeLimitMinutes) setTimeLeft(test.timeLimitMinutes * 60);
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      // Keep user on landing form — show inline error so they can fix and retry
      setStartError(e.message || "Không bắt đầu được, vui lòng thử lại.");
    } finally { setStarting(false); }
  }

  async function handleSubmit(auto = false) {
    if (!submissionId || !token || !test) return;
    if (!auto && !confirm("Bạn chắc chắn muốn nộp bài?")) return;
    setSubmitting(true);
    try {
      const payload = test.questions.map(q => ({ questionId: q.id, answer: answers[q.id] ?? null }));
      const r = await placementPublicApi.submit(submissionId, token, payload);
      setResult({ autoScore: r.autoScore, maxScore: r.maxScore, showScore: r.showScore });
      setStage("submitted");
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      alert(e.message);
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="max-w-2xl mx-auto p-6"><Skeleton className="h-64" /></div>;
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full"><CardContent className="py-8 text-center space-y-3">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
        <p className="font-medium text-red-700">{error}</p>
        <p className="text-sm text-muted-foreground">Vui lòng kiểm tra lại link hoặc liên hệ giáo viên.</p>
      </CardContent></Card>
    </div>
  );
  if (!test) return null;

  // ========== LANDING ==========
  if (stage === "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"><FileText className="w-3.5 h-3.5" /> Bài kiểm tra đánh giá đầu vào</div>
            <h1 className="text-3xl font-bold text-gray-900">{test.title}</h1>
            {test.description && <p className="text-gray-600 max-w-2xl mx-auto">{test.description}</p>}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Thông tin bài test</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-gray-50 rounded"><div className="text-2xl font-bold">{test.questionCount}</div><div className="text-xs text-muted-foreground">câu hỏi</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-2xl font-bold">{test.maxScore}</div><div className="text-xs text-muted-foreground">điểm tối đa</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-2xl font-bold">{test.timeLimitMinutes ?? "∞"}</div><div className="text-xs text-muted-foreground">phút</div></div>
              </div>
              {test.instructions && (
                <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded">
                  <p className="text-sm font-medium text-amber-900 mb-1">Hướng dẫn làm bài</p>
                  <p className="text-sm text-amber-800 whitespace-pre-wrap">{test.instructions}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Thông tin của bạn</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Họ và tên *</Label><Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Nguyễn Văn A" /></div>
              <div><Label>Email *</Label><Input type="email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} placeholder="email@example.com" /><p className="text-xs text-muted-foreground mt-1">Kết quả sẽ được gửi về email này</p></div>
              {startError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{startError}</span>
                </div>
              )}
              <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5" />
                <span className="text-muted-foreground">Tôi đồng ý rằng thông tin và bài làm sẽ được lưu lại để giáo viên chấm và phản hồi kết quả.</span>
              </label>
              <Button
                className="w-full" size="lg"
                disabled={!studentName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail) || !agree || starting}
                onClick={handleStart}
              >{starting ? "Đang bắt đầu..." : <>Bắt đầu làm bài <ArrowRight className="w-4 h-4 ml-1" /></>}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ========== TAKING ==========
  if (stage === "taking") {
    const answered = Object.values(answers).filter(v => v && v.trim() !== "").length;
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{test.title}</div>
              <div className="text-xs text-muted-foreground">{studentName} · {answered}/{test.questions.length} câu đã trả lời</div>
            </div>
            {timeLeft != null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-semibold ${timeLeft < 60 ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                <Clock className="w-4 h-4" />
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
              </div>
            )}
            <Button onClick={() => handleSubmit(false)} disabled={submitting}>{submitting ? "Đang nộp..." : "Nộp bài"}</Button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-4 space-y-4">
          {test.questions.map((q, idx) => (
            <Card key={q.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">{idx + 1}</div>
                  <div className="flex-1">
                    <div className="flex gap-2 mb-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{q.points} điểm</Badge>
                    </div>
                    <p className="text-base font-medium whitespace-pre-wrap">{q.content}</p>
                  </div>
                </div>
                <div className="pl-11">
                  <QuestionInput q={q} value={answers[q.id] ?? ""} onChange={v => setAnswers(a => ({ ...a, [q.id]: v }))} />
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-end">
            <Button size="lg" onClick={() => handleSubmit(false)} disabled={submitting}>{submitting ? "Đang nộp..." : "Nộp bài"}</Button>
          </div>
        </div>
      </div>
    );
  }

  // ========== SUBMITTED ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="py-10 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100"><CheckCircle className="w-10 h-10 text-green-600" /></div>
          <h1 className="text-2xl font-bold">Đã nộp bài thành công!</h1>
          <p className="text-muted-foreground">Cảm ơn <strong>{studentName}</strong> đã hoàn thành bài test. Email xác nhận đã được gửi đến <strong>{studentEmail}</strong>.</p>
          {result?.showScore && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">Điểm trắc nghiệm tự động (chưa bao gồm tự luận)</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{result.autoScore} / {result.maxScore}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Kết quả chính thức kèm nhận xét từ giáo viên sẽ được gửi qua email sau khi chấm xong.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionInput({ q, value, onChange }: { q: { id: number; type: string; options: unknown }; value: string; onChange: (v: string) => void }) {
  if (q.type === "mcq") {
    const options = Array.isArray(q.options) ? (q.options as string[]) : [];
    return (
      <div className="space-y-1.5">
        {options.map((o, i) => (
          <label key={i} className={`flex items-center gap-2 p-2.5 border rounded cursor-pointer transition-colors ${value === o ? "bg-blue-50 border-blue-400" : "hover:bg-gray-50"}`}>
            <input type="radio" name={`q_${q.id}`} checked={value === o} onChange={() => onChange(o)} />
            <span className="text-sm">{o}</span>
          </label>
        ))}
      </div>
    );
  }
  if (q.type === "true_false") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {["Đúng", "Sai"].map(o => (
          <label key={o} className={`flex items-center justify-center gap-2 p-3 border rounded cursor-pointer ${value === o ? "bg-blue-50 border-blue-400" : "hover:bg-gray-50"}`}>
            <input type="radio" name={`q_${q.id}`} checked={value === o} onChange={() => onChange(o)} />
            <span className="font-medium">{o}</span>
          </label>
        ))}
      </div>
    );
  }
  if (q.type === "long_answer") {
    return <Textarea value={value} onChange={e => onChange(e.target.value)} rows={6} placeholder="Nhập câu trả lời của bạn..." />;
  }
  // short_answer, fill_blank
  return <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Nhập câu trả lời..." />;
}
