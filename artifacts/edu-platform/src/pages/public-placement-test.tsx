import { useEffect, useState, useMemo } from "react";
import { useParams } from "@/lib/routing";
import { placementPublicApi } from "@/lib/placement-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle2,
  Flag,
} from "lucide-react";
import {
  TYPE_CONFIG,
  QuestionRenderer,
  AudioPlayer,
} from "@/components/question-take-inputs";

type TestData = Awaited<ReturnType<typeof placementPublicApi.getBySlug>>;

export default function PublicPlacementTestPage() {
  const { slug } = useParams<{ slug: string }>();
  const [stage, setStage] = useState<"landing" | "taking" | "submitted">(
    "landing",
  );
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
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    autoScore: number;
    maxScore: number;
    showScore: boolean;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    placementPublicApi
      .getBySlug(slug!)
      .then(setTest)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (stage !== "taking" || timeLeft == null) return;
    if (timeLeft <= 0) {
      handleSubmit(true);
      return;
    }
    const t = setTimeout(
      () => setTimeLeft((v) => (v != null ? v - 1 : null)),
      1000,
    );
    return () => clearTimeout(t);
  }, [stage, timeLeft]);

  const questions = test?.questions ?? [];
  const currentQ = questions[currentIdx];
  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length,
    [questions, answers],
  );
  const typeConfig = currentQ
    ? TYPE_CONFIG[currentQ.type] || TYPE_CONFIG.essay
    : TYPE_CONFIG.essay;

  const stripHtml = (html: string) =>
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
  const isOpenEndAnswered = (ans: string) => {
    try {
      const p = JSON.parse(ans);
      if (!p || typeof p !== "object") return false;
      const hasText =
        typeof p.text_content === "string" && p.text_content.trim().length > 0;
      const hasAudio =
        typeof p.audio_url === "string" && p.audio_url.length > 0;
      return hasText || hasAudio;
    } catch {
      return false;
    }
  };
  const isAnswered = (aqId: number, qType: string) => {
    const ans = answers[aqId] ?? "";
    if (qType === "open_end") return isOpenEndAnswered(ans);
    if (
      [
        "matching",
        "drag_drop",
        "sentence_reorder",
        "video_interactive",
        "listening",
        "reading",
      ].includes(qType)
    ) {
      try {
        const parsed = JSON.parse(ans);
        return Array.isArray(parsed)
          ? parsed.length > 0
          : Object.keys(parsed).length > 0;
      } catch {
        return ans.trim().length > 0;
      }
    }
    return stripHtml(ans)?.length > 0;
  };
  async function handleStart() {
    if (!studentName.trim() || !studentEmail.trim()) return;
    setStarting(true);
    setStartError(null);
    try {
      const r = await placementPublicApi.start(
        slug!,
        studentName.trim(),
        studentEmail.trim(),
      );
      setSubmissionId(r.submissionId);
      setToken(r.token);
      setStage("taking");
      if (test?.timeLimitMinutes) setTimeLeft(test.timeLimitMinutes * 60);
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      setStartError(e.message || "Không bắt đầu được, vui lòng thử lại.");
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit(auto = false) {
    if (!submissionId || !token || !test) return;
    if (!auto && !confirm("Bạn chắc chắn muốn nộp bài?")) return;
    setSubmitting(true);
    try {
      const payload = test.questions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] ?? null,
      }));
      const r = await placementPublicApi.submit(submissionId, token, payload);
      setResult({
        autoScore: r.autoScore,
        maxScore: r.maxScore,
        showScore: r.showScore,
      });
      setStage("submitted");
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function setAnswer(v: string) {
    if (!currentQ) return;
    setAnswers((a) => ({ ...a, [currentQ.id]: v }));
  }

  function toggleFlag() {
    if (!currentQ) return;
    setFlagged((s) => {
      const next = new Set(s);
      if (next.has(currentQ.id)) next.delete(currentQ.id);
      else next.add(currentQ.id);
      return next;
    });
  }

  if (loading)
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Skeleton className="h-64" />
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-3">
            <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
            <p className="font-medium text-red-700">{error}</p>
            <p className="text-sm text-muted-foreground">
              Vui lòng kiểm tra lại link hoặc liên hệ giáo viên.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  if (!test) return null;

  // ========== LANDING ==========
  if (stage === "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              <FileText className="w-3.5 h-3.5" /> Bài kiểm tra đánh giá đầu vào
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{test.title}</h1>
            {test.description && (
              <p className="text-gray-600 max-w-2xl mx-auto">
                {test.description}
              </p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin bài test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold">{test.questionCount}</div>
                  <div className="text-xs text-muted-foreground">câu hỏi</div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold">{test.maxScore}</div>
                  <div className="text-xs text-muted-foreground">
                    điểm tối đa
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold">
                    {test.timeLimitMinutes ?? "∞"}
                  </div>
                  <div className="text-xs text-muted-foreground">phút</div>
                </div>
              </div>
              {test.instructions && (
                <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded">
                  <p className="text-sm font-medium text-amber-900 mb-1">
                    Hướng dẫn làm bài
                  </p>
                  <p className="text-sm text-amber-800 whitespace-pre-wrap">
                    {test.instructions}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin của bạn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Họ và tên *</Label>
                <Input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="email@example.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Kết quả sẽ được gửi về email này
                </p>
              </div>
              {startError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{" "}
                  <span>{startError}</span>
                </div>
              )}
              <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-muted-foreground">
                  Tôi đồng ý rằng thông tin và bài làm sẽ được lưu lại để giáo
                  viên chấm và phản hồi kết quả.
                </span>
              </label>
              <Button
                className="w-full"
                size="lg"
                disabled={
                  !studentName.trim() ||
                  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail) ||
                  !agree ||
                  starting
                }
                onClick={handleStart}
              >
                {starting ? (
                  "Đang bắt đầu..."
                ) : (
                  <>
                    Bắt đầu làm bài <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ========== TAKING ==========
  if (stage === "taking" && currentQ) {
    const TypeIcon = typeConfig.icon;
    const minutes = timeLeft != null ? Math.floor(timeLeft / 60) : null;
    const seconds = timeLeft != null ? timeLeft % 60 : null;
    const lowTime = timeLeft != null && timeLeft < 60;
    const currentAnswer = answers[currentQ.id] ?? "";

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/40">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200/80 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "w-11 h-11 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center font-black text-lg shadow-lg flex-shrink-0",
                typeConfig.gradient,
              )}
            >
              {currentIdx + 1}
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 leading-tight truncate">
                {test.title}
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{studentName}</span>
                <span>·</span>
                <span>
                  {answeredCount}/{questions.length} câu
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {timeLeft != null && (
              <div
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-2xl font-mono font-bold text-base transition-all",
                  lowTime
                    ? "bg-red-100 text-red-700 animate-pulse"
                    : "bg-blue-100 text-blue-700",
                )}
              >
                <Clock className="w-4 h-4" />
                {String(minutes!).padStart(2, "0")}:
                {String(seconds!).padStart(2, "0")}
              </div>
            )}
            <Button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl shadow-md shadow-green-200"
            >
              <Send className="w-4 h-4 mr-1" />
              {submitting ? "Đang nộp..." : "Nộp bài"}
            </Button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Sidebar: question palette */}
          <aside className="hidden lg:block">
            <Card className="sticky top-24 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Danh sách câu hỏi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
                {questions.map((q, i) => {
                  // const isAnswered = (answers[q.id] ?? "").trim() !== "";
                  const answered = isAnswered(q.id, q?.type ?? "");
                  const isCurrent = i === currentIdx;
                  const isFlagged = flagged.has(q.id);
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(i)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left",
                        isCurrent
                          ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md"
                          : answered
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-gray-50 text-gray-600 hover:bg-gray-100",
                      )}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0",
                          isCurrent
                            ? "bg-white/20"
                            : answered
                              ? "bg-emerald-100"
                              : "bg-white",
                        )}
                      >
                        {i + 1}
                      </div>
                      <span className="truncate flex-1">Câu {i + 1}</span>
                      {answered && !isCurrent && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      )}
                      {isFlagged && (
                        <Flag className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </aside>

          {/* Main */}
          <main>
            <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm p-6 md:p-8">
              <div className="space-y-6">
                {/* Type badge + flag */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border",
                      typeConfig.bgColor,
                      typeConfig.color,
                    )}
                  >
                    <TypeIcon className="w-3.5 h-3.5" />
                    {typeConfig.label}
                  </span>
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">
                    {currentQ.points} điểm
                  </span>
                  <button
                    onClick={toggleFlag}
                    className={cn(
                      "ml-auto text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border transition-all",
                      flagged.has(currentQ.id)
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-amber-50 hover:text-amber-600",
                    )}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    {flagged.has(currentQ.id) ? "Đã đánh dấu" : "Đánh dấu lại"}
                  </button>
                </div>

                {/* Content */}
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "w-13 h-13 min-w-[52px] min-h-[52px] rounded-2xl bg-gradient-to-br text-white flex items-center justify-center text-xl font-black shadow-lg",
                      typeConfig.gradient,
                    )}
                  >
                    {currentIdx + 1}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="text-base font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap">
                      {currentQ.content}
                    </div>
                  </div>
                </div>

                {/* Image */}
                {(currentQ as any).imageUrl && (
                  <div className="ml-16">
                    <img
                      src={(currentQ as any).imageUrl}
                      alt="Hình ảnh câu hỏi"
                      className="rounded-xl border border-gray-200 max-h-64 object-contain"
                    />
                  </div>
                )}

                {/* Audio outside the renderer for plain audio (the renderer also handles listening) */}
                {currentQ.type !== "listening" &&
                  currentQ.type !== "video_interactive" &&
                  (currentQ as any).audioUrl && (
                    <div className="ml-16">
                      <AudioPlayer src={(currentQ as any).audioUrl} />
                    </div>
                  )}

                {/* Renderer */}
                <div className="ml-16">
                  <QuestionRenderer
                    q={currentQ as any}
                    value={currentAnswer}
                    onChange={setAnswer}
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-200/60">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  disabled={currentIdx === 0}
                  className="rounded-2xl gap-1.5 px-5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Câu trước
                </Button>
                <div className="flex items-center gap-3">
                  {questions
                    .slice(
                      Math.max(0, currentIdx - 2),
                      Math.min(questions.length, currentIdx + 3),
                    )
                    .map((_, relIdx) => {
                      const absIdx = Math.max(0, currentIdx - 2) + relIdx;
                      return (
                        <button
                          key={absIdx}
                          onClick={() => setCurrentIdx(absIdx)}
                          className={cn(
                            "w-9 h-9 rounded-xl text-sm font-bold transition-all",
                            absIdx === currentIdx
                              ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200",
                          )}
                        >
                          {absIdx + 1}
                        </button>
                      );
                    })}
                </div>
                {currentIdx < questions.length - 1 ? (
                  <Button
                    onClick={() => setCurrentIdx((i) => i + 1)}
                    className="rounded-2xl gap-1.5 px-5"
                  >
                    Câu tiếp theo
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 gap-1.5 px-6 shadow-md shadow-green-200"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? "Đang nộp..." : "Nộp bài"}
                  </Button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ========== SUBMITTED ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="py-10 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Đã nộp bài thành công!</h1>
          <p className="text-muted-foreground">
            Cảm ơn <strong>{studentName}</strong> đã hoàn thành bài test. Email
            xác nhận đã được gửi đến <strong>{studentEmail}</strong>.
          </p>
          {result?.showScore && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                Điểm trắc nghiệm tự động (chưa bao gồm tự luận)
              </p>
              <p className="text-3xl font-bold text-blue-900 mt-1">
                {result.autoScore} / {result.maxScore}
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Kết quả chính thức kèm nhận xét từ giáo viên sẽ được gửi qua email
            sau khi chấm xong.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
