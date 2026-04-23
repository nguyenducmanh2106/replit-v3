import { useParams, useLocation } from "@/lib/routing";
import {
  useGetAssignment,
  useCreateSubmission,
  useReportFraudEvent,
  useRequestUploadUrl,
  getGetAssignmentQueryKey,
  getListSubmissionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownView } from "@/components/markdown-view";
import { ReadingPassageViewer } from "@/components/reading-passage-viewer";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  Play,
  Pause,
  Volume2,
  Bold,
  Italic,
  Underline,
  List,
  AlignLeft,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Headphones,
  BookOpen,
  Video,
  Type,
  X,
  HelpCircle,
  MousePointerClick,
  ArrowUpDown,
  Layers,
  RotateCcw,
  Gauge,
  GripVertical,
  GripHorizontal,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  FileText,
  Circle,
  Mic,
  Square,
  Loader2,
  AlertTriangle,
  Flag,
  Save,
  Cloud,
  CloudOff,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import {
  padTwo,
  TYPE_CONFIG,
  AudioPlayer,
  RichTextEditor,
  TrueFalseInput,
  FillBlankInput,
  WordSelectionInput,
  MatchingInput,
  DragDropInput,
  OpenEndInput,
  SentenceReorderInput,
  ReadingInput,
  VideoInteractiveInput,
  ListeningInput,
  QuestionRenderer,
} from "@/components/question-take-inputs";

// ─── Main Page ────────────────────────────────────────────────────────────────
type SaveStatus = "idle" | "pending" | "saving" | "saved" | "offline";

function SaveIndicator({
  status,
  lastSaved,
}: {
  status: SaveStatus;
  lastSaved: string | null;
}) {
  if (status === "idle") return null;
  const config = {
    pending: {
      icon: Save,
      text: "Sẽ lưu sau 2s...",
      color: "text-amber-500",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
    saving: {
      icon: Cloud,
      text: "Đang lưu...",
      color: "text-blue-500",
      bg: "bg-blue-50",
      border: "border-blue-200",
    },
    saved: {
      icon: CheckCircle2,
      text: lastSaved ? `Đã lưu lúc ${lastSaved}` : "Đã lưu",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
    offline: {
      icon: WifiOff,
      text: "Offline — đã lưu cục bộ",
      color: "text-red-500",
      bg: "bg-red-50",
      border: "border-red-200",
    },
  }[status];
  const Icon = config.icon;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
        config.bg,
        config.color,
        config.border,
      )}
    >
      <Icon
        className={cn("w-3.5 h-3.5", status === "saving" && "animate-spin")}
      />
      {config.text}
    </div>
  );
}

function ResumeSessionBanner({
  onResume,
  onRestart,
}: {
  onResume: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/40">
      <div className="text-center p-10 bg-white rounded-3xl shadow-xl border border-blue-100 max-w-md">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200">
          <RefreshCw className="w-9 h-9 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Phát hiện phiên làm bài cũ
        </h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Bạn đã có một phiên làm bài chưa hoàn thành. Bạn muốn tiếp tục hay bắt
          đầu lại từ đầu?
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={onRestart}
            variant="outline"
            className="rounded-xl gap-2 px-5"
          >
            <RotateCcw className="w-4 h-4" />
            Làm lại
          </Button>
          <Button
            onClick={onResume}
            className="rounded-xl gap-2 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200"
          >
            <Play className="w-4 h-4" />
            Tiếp tục
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AssignmentTakePage() {
  const { id } = useParams<{ id: string }>();
  const assignmentId = Number(id);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const isPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "1";

  const { data: assignment, isLoading } = useGetAssignment(assignmentId, {
    query: {
      enabled: !!assignmentId,
      queryKey: getGetAssignmentQueryKey(assignmentId),
    },
  });
  const { mutate: createSubmission, isPending: submitting } =
    useCreateSubmission();
  const { mutate: reportFraud } = useReportFraudEvent();

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const tabSwitchCount = useRef(0);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(!isPreview);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [pendingSession, setPendingSession] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionReady = useRef(false);

  const answersRef = useRef(answers);
  const flaggedRef = useRef(flagged);
  const currentIdxRef = useRef(currentIdx);
  const timeLeftRef = useRef(timeLeft);
  const sessionIdRef = useRef(sessionId);
  answersRef.current = answers;
  flaggedRef.current = flagged;
  currentIdxRef.current = currentIdx;
  timeLeftRef.current = timeLeft;
  sessionIdRef.current = sessionId;

  const autoSave = useCallback(async () => {
    if (!sessionIdRef.current || !assignmentId || isPreview) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          answers: answersRef.current,
          flagged: flaggedRef.current,
          currentQuestion: currentIdxRef.current,
          timeLeftSeconds: timeLeftRef.current,
        }),
      });
      if (res.ok) {
        const now = new Date();
        setLastSavedTime(
          `${padTwo(now.getHours())}:${padTwo(now.getMinutes())}:${padTwo(now.getSeconds())}`,
        );
        setSaveStatus("saved");
        localStorage.removeItem(`quiz_draft_${sessionIdRef.current}`);
      } else {
        throw new Error("save failed");
      }
    } catch {
      setSaveStatus("offline");
      localStorage.setItem(
        `quiz_draft_${sessionIdRef.current}`,
        JSON.stringify({
          answers: answersRef.current,
          flagged: flaggedRef.current,
          currentQuestion: currentIdxRef.current,
          timeLeftSeconds: timeLeftRef.current,
          savedLocally: Date.now(),
        }),
      );
    }
  }, [assignmentId, isPreview]);

  const scheduleSave = useCallback(() => {
    if (!sessionReady.current || isPreview) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("pending");
    saveTimerRef.current = setTimeout(() => {
      autoSave();
    }, 2000);
  }, [autoSave, isPreview]);

  useEffect(() => {
    if (!sessionId || isPreview) return;
    intervalSaveRef.current = setInterval(() => {
      autoSave();
    }, 30000);
    heartbeatRef.current = setInterval(async () => {
      try {
        await fetch(`/api/assignments/${assignmentId}/session/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId }),
        });
      } catch {}
    }, 60000);
    return () => {
      if (intervalSaveRef.current) clearInterval(intervalSaveRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [sessionId, assignmentId, autoSave, isPreview]);

  useEffect(() => {
    if (!sessionId || isPreview) return;
    const handleBeforeUnload = () => {
      localStorage.setItem(
        `quiz_draft_${sessionId}`,
        JSON.stringify({
          answers: answersRef.current,
          flagged: flaggedRef.current,
          currentQuestion: currentIdxRef.current,
          timeLeftSeconds: timeLeftRef.current,
          savedLocally: Date.now(),
        }),
      );
      const body = JSON.stringify({
        sessionId,
        answers: answersRef.current,
        flagged: flaggedRef.current,
        currentQuestion: currentIdxRef.current,
        timeLeftSeconds: timeLeftRef.current,
      });
      navigator.sendBeacon(
        `/api/assignments/${assignmentId}/session/beacon`,
        new Blob([body], { type: "application/json" }),
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId, assignmentId, isPreview]);

  useEffect(() => {
    if (!sessionId || isPreview) return;
    const handleOnline = async () => {
      const draft = localStorage.getItem(`quiz_draft_${sessionId}`);
      if (draft) {
        await autoSave();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [sessionId, autoSave, isPreview]);

  useEffect(() => {
    if (!assignmentId || isPreview || !assignment) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/assignments/${assignmentId}/session`, {
          credentials: "include",
        });
        if (cancelled) return;
        const data = await res.json();
        if (data.session) {
          setPendingSession(data.session);
          setShowResumeBanner(true);
        }
      } catch {}
      if (!cancelled) setSessionLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, isPreview, assignment]);

  const startNewSession = useCallback(async () => {
    const newId = crypto.randomUUID();
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: newId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.sessionId ?? newId);
        sessionReady.current = true;
        if (assignment?.timeLimitMinutes)
          setTimeLeft(assignment.timeLimitMinutes * 60);
      }
    } catch {}
    setSessionLoading(false);
  }, [assignmentId, assignment]);

  const handleResume = useCallback(() => {
    if (!pendingSession) return;
    setSessionId(pendingSession.sessionId);
    sessionReady.current = true;
    const restoredAnswers: Record<number, string> = {};
    if (pendingSession.answers && typeof pendingSession.answers === "object") {
      for (const [key, val] of Object.entries(pendingSession.answers)) {
        restoredAnswers[Number(key)] = String(val);
      }
    }
    setAnswers(restoredAnswers);
    setFlagged(
      Array.isArray(pendingSession.flagged) ? pendingSession.flagged : [],
    );
    setCurrentIdx(pendingSession.currentQuestion ?? 0);
    if (
      pendingSession.timeLeftSeconds !== null &&
      pendingSession.timeLeftSeconds !== undefined
    ) {
      setTimeLeft(Math.max(0, pendingSession.timeLeftSeconds));
    } else if (assignment?.timeLimitMinutes) {
      setTimeLeft(assignment.timeLimitMinutes * 60);
    }
    setShowResumeBanner(false);
    setSessionLoading(false);
  }, [pendingSession, assignment]);

  const handleRestart = useCallback(async () => {
    try {
      await fetch(`/api/assignments/${assignmentId}/session`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {}
    setPendingSession(null);
    setShowResumeBanner(false);
    await startNewSession();
  }, [assignmentId, startNewSession]);

  useEffect(() => {
    if (
      !assignmentId ||
      isPreview ||
      sessionLoading ||
      showResumeBanner ||
      sessionId
    )
      return;
    if (assignment && !pendingSession) {
      startNewSession();
    }
  }, [
    assignmentId,
    isPreview,
    sessionLoading,
    showResumeBanner,
    sessionId,
    assignment,
    pendingSession,
    startNewSession,
  ]);

  useEffect(() => {
    if (isPreview && assignment?.timeLimitMinutes)
      setTimeLeft(assignment.timeLimitMinutes * 60);
  }, [isPreview, assignment?.timeLimitMinutes]);

  useEffect(() => {
    if (!assignmentId || submitted) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCount.current += 1;
        const severity =
          tabSwitchCount.current >= 3
            ? "high"
            : tabSwitchCount.current >= 2
              ? "medium"
              : "low";
        reportFraud({
          data: {
            assignmentId,
            eventType:
              tabSwitchCount.current >= 3
                ? "multiple_tab_switches"
                : "tab_switch",
            severity,
            details: `Chuyển tab lần ${tabSwitchCount.current}`,
          },
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [assignmentId, submitted, reportFraud]);

  const handleSubmit = useCallback(() => {
    if (!assignment) return;
    const answerPayload = (assignment.questions ?? []).map((aq: any) => ({
      questionId: aq.id,
      answer: answers[aq.id] ?? "",
    }));
    createSubmission(
      {
        data: {
          assignmentId,
          answers: answerPayload,
          ...(isPreview ? { isPreview: true } : {}),
        },
      },
      {
        onSuccess: (result: any) => {
          setSubmitted(true);
          if (isPreview) {
            setPreviewResult(result);
          }
          if (sessionId) {
            fetch(`/api/assignments/${assignmentId}/session/submit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ sessionId }),
            }).catch(() => {});
            localStorage.removeItem(`quiz_draft_${sessionId}`);
          }
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          if (intervalSaveRef.current) clearInterval(intervalSaveRef.current);
          if (heartbeatRef.current) clearInterval(heartbeatRef.current);
          if (!isPreview && result.id) {
            queryClient.invalidateQueries({
              queryKey: getListSubmissionsQueryKey(),
            });
            setTimeout(() => navigate(`/submissions/${result.id}`), 1500);
          }
        },
      },
    );
  }, [
    assignment,
    answers,
    assignmentId,
    createSubmission,
    navigate,
    queryClient,
    isPreview,
    sessionId,
  ]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const interval = setInterval(
      () => setTimeLeft((t) => (t !== null ? t - 1 : null)),
      1000,
    );
    return () => clearInterval(interval);
  }, [timeLeft, handleSubmit]);

  if (isLoading || (!isPreview && sessionLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="flex gap-6">
          <Skeleton className="w-64 h-[500px] rounded-2xl" />
          <Skeleton className="flex-1 h-[500px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (showResumeBanner && pendingSession) {
    return (
      <ResumeSessionBanner onResume={handleResume} onRestart={handleRestart} />
    );
  }

  const myAttempts = assignment?.myAttemptCount ?? 0;
  const maxAttempts = assignment?.maxAttempts ?? 0;
  const exceededLimit =
    !isPreview && maxAttempts > 0 && myAttempts >= maxAttempts;

  if (!isLoading && assignment && exceededLimit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-3xl shadow-lg border border-red-100 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-xl font-semibold text-gray-700">
            Đã hết lượt làm bài
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Bạn đã sử dụng hết {maxAttempts}/{maxAttempts} lượt cho phép của bài
            tập này.
          </p>
          <Button
            className="mt-6 rounded-xl"
            onClick={() => navigate("/assignments")}
          >
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  if (
    !assignment ||
    !assignment.questions ||
    assignment.questions.length === 0
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-3xl shadow-lg border border-gray-100 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-xl font-semibold text-gray-700">
            Không tìm thấy bài tập hoặc bài tập chưa có câu hỏi
          </p>
          <Button
            className="mt-6 rounded-xl"
            onClick={() => navigate("/assignments")}
          >
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  if (submitted && isPreview && previewResult) {
    const { percentage, score, totalPoints, status, answers = [] } = previewResult;
    const correctCount = answers.filter((a: any) => a.isCorrect === true).length;
    const wrongCount = answers.filter((a: any) => a.isCorrect === false).length;
    const blankCount = answers.length - correctCount - wrongCount;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/40 p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-green-200">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Hoàn thành làm thử!</h2>
            <p className="text-muted-foreground">Kết quả không được lưu. Chỉ dành cho giáo viên xem trước.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center">
              <CardContent className="pt-4">
                <p className="text-3xl font-black text-blue-600">{percentage ?? 0}%</p>
                <p className="text-xs text-muted-foreground mt-1">Tỷ lệ đúng</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4">
                <p className="text-3xl font-black text-emerald-600">{score ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">Điểm đạt</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4">
                <p className="text-3xl font-black text-gray-700">{totalPoints}</p>
                <p className="text-xs text-muted-foreground mt-1">Tổng điểm</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4">
                <p className="text-3xl font-black text-amber-600">{status === "graded" ? "Đã chấm" : "Chờ duyệt"}</p>
                <p className="text-xs text-muted-foreground mt-1">Trạng thái</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chi tiết đáp án</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {correctCount} đúng</span>
                <span className="flex items-center gap-1"><XCircle className="w-4 h-4 text-red-500" /> {wrongCount} sai</span>
                <span className="flex items-center gap-1"><Circle className="w-4 h-4 text-gray-400" /> {blankCount} bỏ trống</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {answers.map((ar: any, idx: number) => {
                  const q = assignment?.questions?.find((aq: any) => aq.id === ar.questionId)?.question;
                  const typeCfg = q ? (TYPE_CONFIG[q.type] || TYPE_CONFIG.essay) : TYPE_CONFIG.essay;
                  const TypeIcon = typeCfg.icon;
                  return (
                    <div key={idx} className="p-4 rounded-xl border bg-white">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white", ar.isCorrect === true ? "bg-emerald-500" : ar.isCorrect === false ? "bg-red-500" : "bg-gray-400")}>
                          {idx + 1}
                        </span>
                        <TypeIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">{typeCfg.label}</span>
                        <span className={cn("ml-auto text-xs font-bold px-2 py-0.5 rounded-full", ar.isCorrect === true ? "bg-emerald-100 text-emerald-700" : ar.isCorrect === false ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500")}>
                          {ar.isCorrect === true ? "Đúng" : ar.isCorrect === false ? "Sai" : "Bỏ trống"}
                        </span>
                        <span className="text-xs text-muted-foreground">{ar.pointsEarned}/{q?.points ?? 0} điểm</span>
                      </div>
                      <p className="text-sm text-gray-800 mb-2">{q?.content}</p>
                      <div className="flex gap-4 text-xs">
                        <div className="flex-1">
                          <span className="text-muted-foreground">Câu trả lời: </span>
                          <span className={ar.isCorrect === false ? "text-red-600 font-medium" : "text-gray-700"}>{ar.answer || <span className="italic">—</span>}</span>
                        </div>
                        {ar.correctAnswer && ar.isCorrect === false && (
                          <div className="flex-1">
                            <span className="text-muted-foreground">Đáp án đúng: </span>
                            <span className="text-emerald-600 font-medium">{ar.correctAnswer}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button onClick={() => navigate(`/assignments/${assignmentId}`)} className="rounded-xl gap-2">
              <ArrowRight className="w-4 h-4" />
              Quay lại bài tập
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="text-center p-12 bg-white rounded-3xl shadow-xl border border-green-100">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-200">
            <Send className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isPreview ? "Hoàn thành làm thử!" : "Bài thi đã nộp thành công!"}
          </h2>
          <p className="text-muted-foreground mb-4">
            {isPreview
              ? "Đây là bài làm thử, không lưu kết quả."
              : "Đang chuyển đến trang kết quả..."}
          </p>
          {isPreview ? (
            <Button
              className="rounded-xl"
              onClick={() => navigate(`/assignments/${assignmentId}`)}
            >
              Quay lại bài tập
            </Button>
          ) : (
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  const questions = assignment.questions;
  const currentAQ = questions[currentIdx];
  const currentQ = currentAQ?.question;

  const minutes = timeLeft !== null ? Math.floor(timeLeft / 60) : null;
  const seconds = timeLeft !== null ? timeLeft % 60 : null;
  const isLowTime = timeLeft !== null && timeLeft < 300;

  const parseJson = <T,>(str: string | null | undefined, fallback: T): T => {
    if (!str) return fallback;
    try {
      return JSON.parse(str) as T;
    } catch {
      return fallback;
    }
  };

  const rawOptionsArray: unknown[] = currentQ?.options
    ? (() => {
        const v = parseJson<unknown>(currentQ.options, []);
        return Array.isArray(v) ? v : [];
      })()
    : [];
  const rawOptions = rawOptionsArray as string[];
  const questionMetadata = parseJson<Record<string, unknown>>(
    currentQ?.metadata,
    {},
  );
  const allowMultiple = questionMetadata.allowMultiple === true;
  const wordSelectionWords: string[] =
    currentQ?.type === "word_selection" && currentQ?.passage
      ? currentQ.passage.trim().split(/\s+/).filter(Boolean)
      : [];
  const pairs: Array<{ left: string; right: string }> =
    currentQ?.type === "matching"
      ? (
          rawOptionsArray as Array<{ left?: string; right?: string } | string>
        ).map((item) => {
          if (typeof item === "object" && item !== null)
            return {
              left: (item as { left?: string }).left ?? "",
              right: (item as { right?: string }).right ?? "",
            };
          const [l, r] = String(item)
            .split("|")
            .map((x) => x.trim());
          return { left: l || String(item), right: r || "" };
        })
      : [];
  const ddParsed = parseJson<{
    items: string[];
    zones: Array<{ label: string; accepts: string[] }>;
  }>(currentQ?.options, { items: [], zones: [] });
  const items: string[] =
    currentQ?.type === "sentence_reorder"
      ? (rawOptionsArray as string[])
      : currentQ?.type === "drag_drop"
        ? Array.isArray(ddParsed.items)
          ? ddParsed.items
          : []
        : [];

  const setAnswer = (v: string) => {
    if (currentAQ) {
      setAnswers((prev) => ({ ...prev, [currentAQ.id]: v }));
      scheduleSave();
    }
  };
  const toggleFlag = (idx: number) => {
    setFlagged((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
    scheduleSave();
  };
  const isFlagged = (idx: number) => flagged.includes(idx);
  const currentAnswer = currentAQ ? (answers[currentAQ.id] ?? "") : "";
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

  const answeredCount = questions.filter((aq: any) => {
    const ans = answers[aq.id] ?? "";
    const qType = aq.question?.type ?? "";
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
    return ans.trim().length > 0;
  }).length;

  const typeConfig = currentQ
    ? TYPE_CONFIG[currentQ.type] || TYPE_CONFIG.essay
    : TYPE_CONFIG.essay;
  const TypeIcon = typeConfig.icon;
  const progressPercent = (answeredCount / questions.length) * 100;
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
    return ans.trim().length > 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/40 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200/80 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-11 h-11 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center font-black text-lg shadow-lg",
              "from-blue-500 to-indigo-600",
            )}
          >
            {assignment.title.charAt(0)}
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-tight">
              {assignment.title}
            </h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span>{questions.length} câu hỏi</span>
              <span>·</span>
              <span>{assignment.totalPoints} điểm</span>
              <span>·</span>
              <span className="font-semibold text-emerald-600">
                {answeredCount}/{questions.length} đã trả lời
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isPreview && (
            <SaveIndicator status={saveStatus} lastSaved={lastSavedTime} />
          )}
          {timeLeft !== null && (
            <div
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-2xl font-mono font-bold text-lg transition-all",
                isLowTime
                  ? "bg-red-100 text-red-600 animate-pulse ring-2 ring-red-200"
                  : "bg-slate-100 text-slate-700",
              )}
            >
              <Clock className="w-5 h-5" />
              {padTwo(minutes!)}:{padTwo(seconds!)}
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200 px-6"
          >
            <Send className="w-4 h-4" />
            {submitting ? "Đang nộp..." : "Nộp bài"}
          </Button>
        </div>
      </header>

      {/* ── Progress Bar ── */}
      <div className="px-6 py-1.5 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-bold text-gray-500 w-12 text-right">
            {Math.round(progressPercent)}%
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="w-64 border-r border-gray-200/80 bg-white/90 backdrop-blur-sm p-5 overflow-y-auto flex-shrink-0">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
            Danh sách câu hỏi
          </p>
          <div className="space-y-1.5">
            {questions.map((aq: any, i: number) => {
              const answered = isAnswered(aq.id, aq.question?.type ?? "");
              const qCfg =
                TYPE_CONFIG[aq.question?.type ?? ""] || TYPE_CONFIG.essay;
              const QIcon = qCfg.icon;
              const active = i === currentIdx;
              return (
                <button
                  key={aq.id}
                  onClick={() => {
                    setCurrentIdx(i);
                    scheduleSave();
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left",
                    active
                      ? `bg-gradient-to-r ${qCfg.gradient.replace("from-", "from-").replace("to-", "to-")} text-white shadow-md`
                      : isFlagged(i)
                        ? "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                        : answered
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  <span
                    className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0",
                      active
                        ? "bg-white/20 text-white"
                        : isFlagged(i)
                          ? "bg-amber-200 text-amber-700"
                          : answered
                            ? "bg-emerald-200 text-emerald-700"
                            : "bg-gray-100 text-gray-500",
                    )}
                  >
                    {i + 1}
                  </span>
                  <QIcon
                    className={cn(
                      "w-3.5 h-3.5 flex-shrink-0",
                      active
                        ? "text-white/80"
                        : answered
                          ? "text-emerald-500"
                          : "text-gray-400",
                    )}
                  />
                  <span className="truncate text-xs leading-tight">
                    {qCfg.label}
                  </span>
                  {isFlagged(i) && !active && (
                    <Flag className="w-3.5 h-3.5 text-amber-500 ml-auto flex-shrink-0" />
                  )}
                  {answered && !active && !isFlagged(i) && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-2 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
              </div>
              <span className="text-gray-500">
                Đã trả lời{" "}
                <span className="font-bold text-emerald-600">
                  {answeredCount}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-lg bg-gray-100 border border-gray-200" />
              <span className="text-gray-500">
                Chưa trả lời{" "}
                <span className="font-bold text-gray-600">
                  {questions.length - answeredCount}
                </span>
              </span>
            </div>
            {flagged.length > 0 && (
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center">
                  <Flag className="w-2.5 h-2.5 text-amber-500" />
                </div>
                <span className="text-gray-500">
                  Đánh dấu xem lại{" "}
                  <span className="font-bold text-amber-600">
                    {flagged.length}
                  </span>
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {currentQ && (
              <div className="space-y-6">
                {/* Question header */}
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "w-13 h-13 min-w-[52px] min-h-[52px] rounded-2xl bg-gradient-to-br text-white flex items-center justify-center text-xl font-black shadow-lg",
                      typeConfig.gradient,
                    )}
                  >
                    {currentIdx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span
                        className={cn(
                          "text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border",
                          typeConfig.bgColor,
                          typeConfig.color,
                          "border-current/20",
                        )}
                      >
                        <TypeIcon className="w-3.5 h-3.5" />
                        {typeConfig.label}
                      </span>
                      <span className="text-xs font-bold bg-purple-100 text-purple-600 px-3 py-1.5 rounded-full capitalize border border-purple-200/50">
                        {currentQ.skill}
                      </span>
                      <span className="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full border border-gray-200">
                        Cấp {currentQ.level}
                      </span>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200/50">
                        {currentQ.points} điểm
                      </span>
                      <button
                        onClick={() => toggleFlag(currentIdx)}
                        className={cn(
                          "text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border transition-all ml-auto",
                          isFlagged(currentIdx)
                            ? "bg-amber-100 text-amber-600 border-amber-300"
                            : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-amber-50 hover:text-amber-500 hover:border-amber-200",
                        )}
                      >
                        <Flag className="w-3.5 h-3.5" />
                        {isFlagged(currentIdx) ? "Đã đánh dấu" : "Đánh dấu"}
                      </button>
                    </div>
                    <div className="text-base font-semibold text-gray-900 leading-relaxed">
                      <MarkdownView
                        source={
                          currentQ.type === "fill_blank"
                            ? (() => {
                                const blankToken = currentQ.content.includes(
                                  "__BLANK__",
                                )
                                  ? "__BLANK__"
                                  : null;
                                const parts = blankToken
                                  ? currentQ.content.split("__BLANK__")
                                  : currentQ.content.split(/_{3,}/);
                                const blankCount = parts.length - 1;
                                const circled = blankCount;
                                let n = 0;
                                return currentQ.content.replace(
                                  /__BLANK__/g,
                                  () => `***[___${++n}___]***`,
                                );
                              })()
                            : currentQ.content
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Image (if any) */}
                {currentQ?.imageUrl && (
                  <div className="ml-16">
                    <img
                      src={currentQ?.imageUrl}
                      alt="Hình ảnh câu hỏi"
                      className="rounded-xl border border-gray-200 max-h-64 object-contain"
                    />
                  </div>
                )}

                {/* Question type input */}
                <div className="ml-16">
                  <QuestionRenderer
                    q={currentQ as any}
                    value={currentAnswer}
                    onChange={setAnswer}
                  />
                </div>

                {/* Giải thích chỉ hiển thị sau khi nộp bài, không hiển thị trong lúc làm */}
              </div>
            )}

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
                  .map((_: any, relIdx: number) => {
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
                  onClick={handleSubmit}
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
