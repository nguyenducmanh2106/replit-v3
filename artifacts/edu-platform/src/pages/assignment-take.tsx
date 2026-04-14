import { useParams, useLocation } from "wouter";
import { useGetAssignment, useCreateSubmission, useReportFraudEvent, useRequestUploadUrl, getGetAssignmentQueryKey, getListSubmissionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Clock, ChevronLeft, ChevronRight, Send, Play, Pause, Volume2,
  Bold, Italic, Underline, List, AlignLeft, CheckCircle2, XCircle,
  ArrowRight, Headphones, BookOpen, Video, Type, X, HelpCircle,
  MousePointerClick, ArrowUpDown, Layers, RotateCcw, Gauge,
  GripVertical, GripHorizontal, Lightbulb, ChevronDown, ChevronUp,
  FileText, Circle, Mic, Square, Loader2, AlertTriangle,
  Flag, Save, Cloud, CloudOff, WifiOff, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function padTwo(n: number) { return String(n).padStart(2, "0"); }

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string; gradient: string }> = {
  mcq:              { label: "Trắc nghiệm",      icon: CheckCircle2,    color: "text-blue-600",    bgColor: "bg-blue-100",    gradient: "from-blue-500 to-indigo-600" },
  true_false:       { label: "Đúng / Sai",        icon: CheckCircle2,    color: "text-teal-600",    bgColor: "bg-teal-100",    gradient: "from-teal-500 to-emerald-600" },
  fill_blank:       { label: "Điền chỗ trống",    icon: Type,            color: "text-purple-600",  bgColor: "bg-purple-100",  gradient: "from-purple-500 to-violet-600" },
  word_selection:   { label: "Chọn từ",           icon: MousePointerClick,color: "text-indigo-600", bgColor: "bg-indigo-100",  gradient: "from-indigo-500 to-blue-600" },
  matching:         { label: "Nối cặp",           icon: ArrowRight,      color: "text-orange-600",  bgColor: "bg-orange-100",  gradient: "from-orange-500 to-amber-600" },
  drag_drop:        { label: "Kéo thả",           icon: Layers,          color: "text-pink-600",    bgColor: "bg-pink-100",    gradient: "from-pink-500 to-rose-600" },
  sentence_reorder: { label: "Sắp xếp câu",       icon: ArrowUpDown,     color: "text-cyan-600",    bgColor: "bg-cyan-100",    gradient: "from-cyan-500 to-sky-600" },
  reading:          { label: "Đọc hiểu",          icon: BookOpen,        color: "text-emerald-600", bgColor: "bg-emerald-100", gradient: "from-emerald-500 to-green-600" },
  listening:        { label: "Nghe hiểu",         icon: Headphones,      color: "text-green-600",   bgColor: "bg-green-100",   gradient: "from-green-500 to-teal-600" },
  video_interactive:{ label: "Video tương tác",   icon: Video,           color: "text-red-600",     bgColor: "bg-red-100",     gradient: "from-red-500 to-rose-600" },
  essay:            { label: "Bài luận",          icon: BookOpen,        color: "text-amber-600",   bgColor: "bg-amber-100",   gradient: "from-amber-500 to-orange-600" },
  open_end:         { label: "Câu hỏi mở",       icon: HelpCircle,      color: "text-violet-600",  bgColor: "bg-violet-100",  gradient: "from-violet-500 to-fuchsia-600" },
};

// ─── Audio Player ────────────────────────────────────────────────────────────
function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const speeds = [0.75, 1, 1.25, 1.5, 2];

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else void audioRef.current.play();
    setPlaying(!playing);
  };

  const replay = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    void audioRef.current.play();
    setPlaying(true);
  };

  const setPlaybackSpeed = (s: number) => {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };

  const formatTime = (s: number) => `${padTwo(Math.floor(s / 60))}:${padTwo(Math.floor(s % 60))}`;
  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border-2 border-green-200 rounded-2xl p-5 mb-5 shadow-sm">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => { if (audioRef.current) setProgress(audioRef.current.currentTime); }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={toggle}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg flex-shrink-0 active:scale-95"
        >
          {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-green-700 font-medium mb-1.5">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="relative h-3 bg-green-200 rounded-full overflow-hidden cursor-pointer group">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
            <div className="absolute inset-0 h-full opacity-0" style={{ height: "12px" }}>
              <input
                type="range" min={0} max={duration || 1} value={progress}
                onChange={(e) => { const t = Number(e.target.value); setProgress(t); if (audioRef.current) audioRef.current.currentTime = t; }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-3"
              />
            </div>
          </div>
        </div>
        <button onClick={replay} className="w-9 h-9 rounded-xl bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors" title="Phát lại">
          <RotateCcw className="w-4 h-4" />
        </button>
        <Volume2 className="w-5 h-5 text-green-500 flex-shrink-0" />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Gauge className="w-3.5 h-3.5 text-green-600 mr-0.5" />
        <span className="text-xs text-green-700 font-medium mr-1">Tốc độ:</span>
        {speeds.map(s => (
          <button
            key={s}
            onClick={() => setPlaybackSpeed(s)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
              speed === s ? "bg-green-500 text-white shadow-sm" : "bg-green-100 text-green-700 hover:bg-green-200"
            )}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Rich Text Editor (Essay) ─────────────────────────────────────────────────
function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const exec = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value;
  }, []);

  const wordCount = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(w => w.length > 0).length;
  const charCount = value.replace(/<[^>]*>/g, "").length;

  const toolbarBtns = [
    { cmd: "bold", icon: Bold, tip: "In đậm (Ctrl+B)" },
    { cmd: "italic", icon: Italic, tip: "In nghiêng (Ctrl+I)" },
    { cmd: "underline", icon: Underline, tip: "Gạch chân (Ctrl+U)" },
  ];

  return (
    <div className="border-2 border-amber-200 rounded-2xl overflow-hidden shadow-sm focus-within:border-amber-400 transition-colors">
      <div className="flex items-center gap-1 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
        {toolbarBtns.map(({ cmd, icon: Icon, tip }) => (
          <button key={cmd} type="button" onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-amber-200/60 transition-colors text-amber-700" title={tip}>
            <Icon className="w-4 h-4" />
          </button>
        ))}
        <div className="w-px h-5 bg-amber-300 mx-1" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-amber-200/60 transition-colors text-amber-700" title="Danh sách">
          <List className="w-4 h-4" />
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("justifyLeft"); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-amber-200/60 transition-colors text-amber-700" title="Căn trái">
          <AlignLeft className="w-4 h-4" />
        </button>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="text-amber-600 font-medium">{wordCount} từ</span>
          <span className="text-amber-400">|</span>
          <span className="text-amber-500">{charCount} ký tự</span>
        </div>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[280px] p-5 text-sm text-gray-800 leading-relaxed focus:outline-none"
        onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        data-placeholder="Nhập bài làm của bạn tại đây..."
        style={{ whiteSpace: "pre-wrap" }}
      />
    </div>
  );
}

// ─── True/False ────────────────────────────────────────────────────────────────
function TrueFalseInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = [
    { val: "true",  label: "ĐÚNG",  sub: "True",  icon: CheckCircle2, active: "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-green-200", iconCls: "text-green-500", labelCls: "text-green-700", shadow: "shadow-green-100", hover: "hover:border-green-300 hover:bg-green-50/50" },
    { val: "false", label: "SAI",   sub: "False", icon: XCircle,      active: "border-red-500 bg-gradient-to-br from-red-50 to-rose-50 shadow-red-200",     iconCls: "text-red-500",   labelCls: "text-red-700",   shadow: "shadow-red-100",   hover: "hover:border-red-300 hover:bg-red-50/50" },
  ];
  return (
    <div className="grid grid-cols-2 gap-5">
      {opts.map(({ val, label, sub, icon: Icon, active, iconCls, labelCls, shadow, hover }) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={cn(
            "flex flex-col items-center justify-center gap-4 p-10 rounded-3xl border-2 transition-all duration-200",
            value === val ? `${active} shadow-xl scale-[1.03]` : `border-gray-200 bg-white ${hover}`
          )}
        >
          <Icon className={cn("w-16 h-16 transition-all duration-200", value === val ? iconCls : "text-gray-200")} />
          <div className="text-center">
            <div className={cn("text-2xl font-black tracking-wider", value === val ? labelCls : "text-gray-400")}>{label}</div>
            <div className={cn("text-sm font-medium mt-0.5", value === val ? (val === "true" ? "text-green-500" : "text-red-400") : "text-gray-300")}>{sub}</div>
          </div>
          {value === val && (
            <div className={cn("w-3 h-3 rounded-full", val === "true" ? "bg-green-500" : "bg-red-500")} />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Fill Blank ───────────────────────────────────────────────────────────────
function FillBlankInput({ content, value, onChange }: { content: string; value: string; onChange: (v: string) => void }) {
  const blankToken = content.includes("__BLANK__") ? "__BLANK__" : null;
  const parts = blankToken ? content.split("__BLANK__") : content.split(/_{3,}/);
  const blankCount = parts.length - 1;

  const answers: string[] = useMemo(() => {
    if (!value) return Array(blankCount).fill("");
    try { const arr = JSON.parse(value); if (Array.isArray(arr)) return arr; } catch {}
    return blankCount <= 1 ? [value] : Array(blankCount).fill("");
  }, [value, blankCount]);

  const updateAnswer = (idx: number, val: string) => {
    const next = [...answers];
    while (next.length < blankCount) next.push("");
    next[idx] = val;
    onChange(blankCount <= 1 ? next[0] : JSON.stringify(next));
  };

  if (blankCount > 0) {
    let blankIdx = 0;
    return (
      <div>
        <p className="text-sm text-purple-600 font-medium mb-3 flex items-center gap-2">
          <Type className="w-4 h-4" />
          Điền từ thích hợp vào chỗ trống
        </p>
        <div className="p-5 bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-200 rounded-2xl text-base leading-loose text-gray-800 font-medium">
          {parts.map((part, i) => {
            const curIdx = blankIdx;
            const showBlank = i < parts.length - 1;
            if (showBlank) blankIdx++;
            return (
              <span key={i}>
                <span>{part}</span>
                {showBlank && (
                  <input
                    type="text"
                    value={answers[curIdx] ?? ""}
                    onChange={(e) => updateAnswer(curIdx, e.target.value)}
                    placeholder={`(${curIdx + 1})`}
                    className="inline-block mx-1 border-0 border-b-2 border-purple-400 bg-white/60 text-purple-700 font-bold text-base focus:outline-none focus:border-purple-600 rounded-t-lg min-w-[100px] text-center px-3 py-1"
                    style={{ width: Math.max(100, (answers[curIdx]?.length ?? 0) * 10 + 50) }}
                  />
                )}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
        <Type className="w-4 h-4" />
        Câu trả lời của bạn:
      </label>
      <Input
        placeholder="Nhập câu trả lời..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-base border-2 border-purple-200 focus:border-purple-500 rounded-xl h-12 px-4 font-medium"
      />
    </div>
  );
}

// ─── Word Selection ───────────────────────────────────────────────────────────
function WordSelectionInput({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const selected = value ? value.split(",").filter(Boolean) : [];
  const toggleWord = (word: string) => {
    const next = selected.includes(word) ? selected.filter(w => w !== word) : [...selected, word];
    onChange(next.join(","));
  };
  return (
    <div>
      <p className="text-sm text-indigo-600 font-semibold mb-4 flex items-center gap-2">
        <MousePointerClick className="w-4 h-4" />
        Nhấn vào các từ đúng để chọn — nhấn lại để bỏ chọn
      </p>
      <div className="flex flex-wrap gap-2.5 p-4 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 rounded-2xl border border-indigo-100">
        {options.map((word, i) => (
          <button
            key={i}
            onClick={() => toggleWord(word)}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-200",
              selected.includes(word)
                ? "border-indigo-500 bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-200 scale-105"
                : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            )}
          >
            {selected.includes(word) && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />}
            {word}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="mt-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700 flex flex-wrap items-center gap-2">
          <span className="font-semibold">Đã chọn ({selected.length}):</span>
          {selected.map((w, i) => (
            <span key={i} className="px-2.5 py-0.5 bg-indigo-500 text-white rounded-lg text-xs font-medium">{w}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Puzzle Piece SVG shapes ──────────────────────────────────────────────────
const PUZZLE_COLORS = [
  { left: "#3B82F6", leftLight: "#DBEAFE", right: "#EC4899", rightLight: "#FCE7F3" },
  { left: "#8B5CF6", leftLight: "#EDE9FE", right: "#F97316", rightLight: "#FFEDD5" },
  { left: "#06B6D4", leftLight: "#CFFAFE", right: "#EF4444", rightLight: "#FEE2E2" },
  { left: "#10B981", leftLight: "#D1FAE5", right: "#F59E0B", rightLight: "#FEF3C7" },
  { left: "#6366F1", leftLight: "#E0E7FF", right: "#14B8A6", rightLight: "#CCFBF1" },
];
const MATCHED_COLOR = { left: "#22C55E", leftLight: "#DCFCE7", right: "#16A34A", rightLight: "#D1FAE5" };

function PuzzleLeft({ color, light, children, className, ...props }: {
  color: string; light: string; children: React.ReactNode; className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative", className)} {...props}>
      <svg viewBox="0 0 200 60" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" style={{ filter: "drop-shadow(1px 2px 3px rgba(0,0,0,0.1))" }}>
        <path
          d="M8,0 H170 C170,0 170,16 180,20 C190,24 200,24 200,30 C200,36 190,36 180,40 C170,44 170,60 170,60 H8 C3,60 0,57 0,52 V8 C0,3 3,0 8,0 Z"
          fill={light} stroke={color} strokeWidth="2.5"
        />
      </svg>
      <div className="relative z-10 px-4 py-3 pr-12 min-h-[60px] flex items-center">
        {children}
      </div>
    </div>
  );
}

function PuzzleRight({ color, light, children, className, isDragging, ...props }: {
  color: string; light: string; children: React.ReactNode; className?: string; isDragging?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative", className)} {...props}>
      <svg viewBox="0 0 200 60" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" style={{ filter: isDragging ? "drop-shadow(3px 4px 8px rgba(0,0,0,0.25))" : "drop-shadow(1px 2px 3px rgba(0,0,0,0.1))" }}>
        <path
          d="M30,0 H192 C197,0 200,3 200,8 V52 C200,57 197,60 192,60 H30 C30,60 30,44 20,40 C10,36 0,36 0,30 C0,24 10,24 20,20 C30,16 30,0 30,0 Z"
          fill={light} stroke={color} strokeWidth="2.5"
        />
      </svg>
      <div className="relative z-10 px-4 py-3 pl-10 min-h-[60px] flex items-center">
        {children}
      </div>
    </div>
  );
}

// ─── Matching (Puzzle Pieces) ─────────────────────────────────────────────────
function MatchingInput({ pairs, value, onChange }: { pairs: Array<{ left: string; right: string }>; value: string; onChange: (v: string) => void }) {
  const currentMatches: Record<string, string> = useMemo(() => {
    if (!value) return {};
    try { return JSON.parse(value); } catch { return {}; }
  }, [value]);

  const [shuffledRights] = useState(() =>
    [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5)
  );

  const [draggingRight, setDraggingRight] = useState<string | null>(null);
  const [dragOverLeft, setDragOverLeft] = useState<string | null>(null);

  const matchedCount = Object.keys(currentMatches).length;
  const isRightUsed = (right: string) => Object.values(currentMatches).includes(right);

  const handleDrop = (left: string) => {
    if (!draggingRight) return;
    const newMatches = { ...currentMatches };
    Object.keys(newMatches).forEach(k => { if (newMatches[k] === draggingRight) delete newMatches[k]; });
    newMatches[left] = draggingRight;
    onChange(JSON.stringify(newMatches));
    setDraggingRight(null);
    setDragOverLeft(null);
  };

  const detachFromLeft = (left: string) => {
    const newM = { ...currentMatches };
    delete newM[left];
    onChange(JSON.stringify(newM));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-orange-600 font-semibold flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Kéo mảnh ghép bên phải ghép vào mảnh bên trái
        </p>
        <span className={cn(
          "text-xs font-bold px-3 py-1.5 rounded-full transition-colors",
          matchedCount === pairs.length ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"
        )}>
          {matchedCount === pairs.length ? "🧩 Hoàn thành!" : `🧩 ${matchedCount}/${pairs.length}`}
        </span>
      </div>

      {/* Assembled puzzle area */}
      <div className="space-y-4 mb-6">
        {pairs.map((pair, i) => {
          const matched = currentMatches[pair.left];
          const isOver = dragOverLeft === pair.left;
          const colors = matched ? MATCHED_COLOR : PUZZLE_COLORS[i % PUZZLE_COLORS.length];
          return (
            <div
              key={i}
              className={cn(
                "flex items-center transition-all duration-300",
                isOver ? "scale-[1.02]" : "",
                matched ? "gap-0" : "gap-3",
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOverLeft(pair.left); }}
              onDragLeave={() => setDragOverLeft(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop(pair.left); }}
            >
              {/* Left piece */}
              <PuzzleLeft
                color={colors.left}
                light={colors.leftLight}
                className={cn("flex-1 transition-all duration-300", matched ? "flex-[1.1]" : "")}
              >
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white mr-2.5"
                  style={{ backgroundColor: colors.left }}>
                  {i + 1}
                </span>
                <span className="text-sm font-semibold" style={{ color: colors.left }}>{pair.left}</span>
              </PuzzleLeft>

              {/* Right piece — matched or slot */}
              {matched ? (
                <PuzzleRight
                  color={colors.right ?? colors.left}
                  light={colors.rightLight ?? colors.leftLight}
                  className="flex-1 cursor-pointer group hover:opacity-80 transition-opacity"
                  draggable
                  onDragStart={() => { detachFromLeft(pair.left); setDraggingRight(matched); }}
                  onClick={() => detachFromLeft(pair.left)}
                >
                  <span className="text-sm font-semibold" style={{ color: colors.right ?? colors.left }}>{matched}</span>
                  <X className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-red-400" />
                </PuzzleRight>
              ) : (
                <div className={cn(
                  "flex-1 min-h-[60px] rounded-2xl border-3 border-dashed flex items-center justify-center text-sm transition-all duration-200",
                  isOver
                    ? "border-orange-400 bg-orange-50 text-orange-500 scale-105 shadow-inner"
                    : "border-gray-200 bg-gray-50/50 text-gray-300"
                )}>
                  <div className="flex items-center gap-2">
                    {isOver ? (
                      <>
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-orange-400 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                        <span className="font-medium">Thả vào đây!</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl">🧩</span>
                        <span>Kéo mảnh ghép vào</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Available puzzle pieces */}
      {shuffledRights.some(r => !isRightUsed(r)) && (
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="text-base">🧩</span> Mảnh ghép chưa dùng
          </div>
          <div className="flex flex-wrap gap-3">
            {shuffledRights.map((right, i) => {
              const used = isRightUsed(right);
              if (used) return null;
              const colorIdx = pairs.findIndex(p => p.right === right);
              const colors = PUZZLE_COLORS[colorIdx % PUZZLE_COLORS.length];
              return (
                <div key={i} className="w-[calc(50%-6px)]">
                  <PuzzleRight
                    color={colors.right}
                    light={colors.rightLight}
                    isDragging={draggingRight === right}
                    className={cn(
                      "transition-all duration-200 select-none",
                      draggingRight === right
                        ? "scale-110 cursor-grabbing opacity-80"
                        : "cursor-grab hover:scale-105 active:scale-110"
                    )}
                    draggable
                    onDragStart={() => setDraggingRight(right)}
                    onDragEnd={() => { setDraggingRight(null); setDragOverLeft(null); }}
                  >
                    <GripHorizontal className="w-4 h-4 flex-shrink-0 mr-2" style={{ color: colors.right }} />
                    <span className="text-sm font-semibold" style={{ color: colors.right }}>{right}</span>
                  </PuzzleRight>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {matchedCount === pairs.length && (
        <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl text-center">
          <p className="text-green-700 font-bold text-sm flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Tuyệt vời! Bạn đã ghép xong tất cả các mảnh! 🎉
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────
type DragDropZone = { label: string; accepts: string[] };

function DragDropInput({
  items, zones, value, onChange,
}: { items: string[]; zones: DragDropZone[]; value: string; onChange: (v: string) => void }) {
  // Answer: { [zoneLabel]: string[] }  — or flat string[] for legacy (no zones)
  const hasZones = zones.length > 0;

  const zoneMap: Record<string, string[]> = useMemo(() => {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        // legacy flat array → put all in first zone
        return hasZones ? { [zones[0].label]: parsed } : { __default__: parsed };
      }
      return parsed as Record<string, string[]>;
    } catch { return {}; }
  }, [value]);

  const allPlaced = useMemo(() => Object.values(zoneMap).flat(), [zoneMap]);
  const available = items.filter(item => !allPlaced.includes(item));

  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<string | null>(null); // zone label or "available"
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  const ZONE_COLORS = [
    { border: "border-pink-400", bg: "bg-pink-50", text: "text-pink-700", badge: "bg-pink-200 text-pink-800", hover: "hover:border-pink-500" },
    { border: "border-violet-400", bg: "bg-violet-50", text: "text-violet-700", badge: "bg-violet-200 text-violet-800", hover: "hover:border-violet-500" },
    { border: "border-cyan-400", bg: "bg-cyan-50", text: "text-cyan-700", badge: "bg-cyan-200 text-cyan-800", hover: "hover:border-cyan-500" },
    { border: "border-amber-400", bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-200 text-amber-800", hover: "hover:border-amber-500" },
    { border: "border-emerald-400", bg: "bg-emerald-50", text: "text-emerald-700", badge: "bg-emerald-200 text-emerald-800", hover: "hover:border-emerald-500" },
  ];

  const dropIntoZone = (zoneLabel: string, item: string) => {
    const newMap = { ...zoneMap };
    // Remove from its current location
    Object.keys(newMap).forEach(z => { newMap[z] = (newMap[z] ?? []).filter(i => i !== item); });
    newMap[zoneLabel] = [...(newMap[zoneLabel] ?? []), item];
    onChange(JSON.stringify(newMap));
  };

  const removeFromZone = (zoneLabel: string, item: string) => {
    const newMap = { ...zoneMap };
    newMap[zoneLabel] = (newMap[zoneLabel] ?? []).filter(i => i !== item);
    onChange(JSON.stringify(newMap));
  };

  const displayZones: DragDropZone[] = hasZones ? zones : [{ label: "__default__", accepts: items }];

  return (
    <div>
      <p className="text-sm text-pink-600 font-semibold mb-4 flex items-center gap-2">
        <Layers className="w-4 h-4" />
        Kéo & thả các mục vào đúng vùng — nhấn mục trong vùng để lấy lại
      </p>

      {/* Drop zones */}
      <div className={cn("gap-3 mb-5", hasZones && zones.length > 1 ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col")}>
        {displayZones.map((zone, zi) => {
          const col = ZONE_COLORS[zi % ZONE_COLORS.length];
          const placed = zoneMap[zone.label] ?? [];
          const isOver = dragOverZone === zone.label;
          const label = zone.label === "__default__" ? "Khu vực trả lời" : zone.label;
          return (
            <div
              key={zone.label}
              className={cn(
                "rounded-2xl border-2 border-dashed p-4 min-h-[100px] transition-all duration-200",
                isOver ? `${col.border} ${col.bg} scale-[1.01] shadow-md` : "border-gray-200 bg-gray-50/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOverZone(zone.label); }}
              onDragLeave={() => setDragOverZone(null)}
              onDrop={(e) => {
                e.preventDefault();
                const item = e.dataTransfer.getData("text/plain");
                if (item) dropIntoZone(zone.label, item);
                setDragOverZone(null);
                setDraggingItem(null);
              }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <p className={cn("text-xs font-bold uppercase tracking-wider", isOver ? col.text : "text-gray-500")}>
                  {label}
                </p>
                {placed.length > 0 && (
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", col.badge)}>
                    {placed.length} mục
                  </span>
                )}
              </div>
              {placed.length === 0 ? (
                <p className={cn("text-sm italic", isOver ? col.text : "text-gray-300")}>
                  {isOver ? "Thả vào đây ↓" : "Kéo mục vào đây..."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {placed.map((item, ii) => (
                    <button
                      key={ii}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", item);
                        setDraggingItem(item);
                        setDraggingFrom(zone.label);
                      }}
                      onDragEnd={() => { setDraggingItem(null); setDraggingFrom(null); }}
                      onClick={() => removeFromZone(zone.label, item)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all group cursor-grab active:cursor-grabbing shadow-sm",
                        col.border, col.bg, col.text, "hover:opacity-80"
                      )}
                    >
                      <GripVertical className="w-3 h-3 opacity-50" />
                      {item}
                      <X className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Available items bank */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
          <span className="text-base">📦</span>
          Mục chưa sắp xếp {available.length > 0 && `(${available.length})`}
        </p>
        <div
          className={cn(
            "p-3 rounded-2xl border-2 border-dashed min-h-[54px] transition-all",
            dragOverZone === "__pool__" ? "border-gray-400 bg-gray-100" : "border-gray-200 bg-white"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOverZone("__pool__"); }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={(e) => {
            e.preventDefault();
            const item = e.dataTransfer.getData("text/plain");
            if (item && draggingFrom) removeFromZone(draggingFrom, item);
            setDragOverZone(null);
            setDraggingItem(null);
            setDraggingFrom(null);
          }}
        >
          {available.length === 0 ? (
            <p className="text-sm text-gray-400 italic px-1">Tất cả mục đã được đặt vào vùng</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {available.map((item, i) => (
                <button
                  key={i}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item);
                    setDraggingItem(item);
                    setDraggingFrom("available");
                  }}
                  onDragEnd={() => { setDraggingItem(null); setDraggingFrom(null); }}
                  onClick={() => {
                    // click → drop into first zone with capacity
                    const target = displayZones.find(z => !(zoneMap[z.label] ?? []).includes(item));
                    if (target) dropIntoZone(target.label, item);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700",
                    "hover:border-pink-400 hover:bg-pink-50 hover:text-pink-700 transition-all duration-200 cursor-grab active:cursor-grabbing active:scale-95 active:shadow-md",
                    draggingItem === item ? "opacity-50 scale-95" : ""
                  )}
                >
                  <GripVertical className="w-3.5 h-3.5 text-gray-400" />
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {available.length === 0 && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
          <p className="text-sm text-green-700 font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Tất cả mục đã được sắp xếp!
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sentence Reorder ─────────────────────────────────────────────────────────
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

// ─── Open End Input ──────────────────────────────────────────────────────────
type AudioState = "idle" | "recording" | "processing" | "transcribed";

interface OpenEndPayload {
  input_type: "text" | "audio" | "combined";
  text_content?: string;
  audio_url?: string;
  transcript?: string;
  duration_seconds?: number;
  stt_confidence?: number;
}

function OpenEndInput({ allowedTypes, value, onChange }: { allowedTypes: string[]; value: string; onChange: (v: string) => void }) {
  const { toast } = useToast();
  const { mutateAsync: requestUploadUrl } = useRequestUploadUrl();

  const parsed = useMemo<OpenEndPayload>(() => {
    try {
      const p = JSON.parse(value);
      if (p && typeof p === "object" && (p.input_type || p.text_content || p.audio_url || p.transcript)) return p;
      if (p?.mode === "text" && p.text) return { input_type: "text", text_content: p.text };
      if (p?.mode === "audio" && p.audioUrl) return { input_type: "audio", audio_url: p.audioUrl };
      return { input_type: "text" };
    } catch { return { input_type: "text" }; }
  }, [value]);

  const hasText = allowedTypes.includes("text");
  const hasAudio = allowedTypes.includes("audio");

  const [textContent, setTextContent] = useState(parsed.text_content || "");
  const [pasteCount, setPasteCount] = useState(0);

  const [audioState, setAudioState] = useState<AudioState>(parsed.audio_url ? "transcribed" : "idle");
  const [audioUrl, setAudioUrl] = useState(parsed.audio_url || "");
  const [localAudioUrl, setLocalAudioUrl] = useState("");
  const [transcript, setTranscript] = useState(parsed.transcript || "");
  const [sttConfidence, setSttConfidence] = useState(parsed.stt_confidence ?? 0);
  const [duration, setDuration] = useState(parsed.duration_seconds ?? 0);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sttRecognitionRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const recordingTimerRef = useRef(0);
  const mountedRef = useRef(true);

  const MIN_TEXT_LENGTH = 10;
  const charCount = textContent.length;

  const emitValue = useCallback((overrides?: Partial<OpenEndPayload>) => {
    const hasTxt = (overrides?.text_content ?? textContent).trim().length > 0;
    const hasAud = (overrides?.audio_url ?? audioUrl).length > 0;
    const inputType: OpenEndPayload["input_type"] = hasTxt && hasAud ? "combined" : hasAud ? "audio" : "text";
    const payload: OpenEndPayload = {
      input_type: inputType,
      text_content: (overrides?.text_content ?? textContent) || undefined,
      audio_url: (overrides?.audio_url ?? audioUrl) || undefined,
      transcript: (overrides?.transcript ?? transcript) || undefined,
      duration_seconds: (overrides?.duration_seconds ?? duration) || undefined,
      stt_confidence: (overrides?.stt_confidence ?? sttConfidence) || undefined,
    };
    onChange(JSON.stringify(payload));
  }, [textContent, audioUrl, transcript, duration, sttConfidence, onChange]);

  const handleTextChange = (val: string) => {
    setTextContent(val);
    const hasTxt = val.trim().length > 0;
    const hasAud = audioUrl.length > 0;
    const inputType: OpenEndPayload["input_type"] = hasTxt && hasAud ? "combined" : hasAud ? "audio" : "text";
    onChange(JSON.stringify({
      input_type: inputType,
      text_content: val || undefined,
      audio_url: audioUrl || undefined,
      transcript: transcript || undefined,
      duration_seconds: duration || undefined,
      stt_confidence: sttConfidence || undefined,
    }));
  };

  const handlePaste = () => {
    setPasteCount(c => c + 1);
    if (pasteCount >= 2) {
      toast({ title: "Cảnh báo", description: "Bạn đã dán nội dung nhiều lần. Hãy tự viết câu trả lời.", variant: "destructive" });
    }
  };

  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bufLen = analyser.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArr);
      ctx.fillStyle = "#F5F3FF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#7C3AED";
      ctx.beginPath();
      const sliceW = canvas.width / bufLen;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const v = dataArr[i]! / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceW;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    draw();
  }, []);

  const supportsMediaRecorder = typeof window !== "undefined" && typeof MediaRecorder !== "undefined";

  const startRecording = async () => {
    setMicError(null);
    setUploadError(null);
    if (!supportsMediaRecorder) {
      setMicError("Trình duyệt không hỗ trợ ghi âm. Vui lòng dùng Chrome hoặc Firefox.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const liveDuration = recordingTimerRef.current;
        handleRecordingComplete(blob, liveDuration);
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        cancelAnimationFrame(animFrameRef.current);
        analyserRef.current = null;
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
      };

      mr.start(250);
      setAudioState("recording");
      setRecordingTimer(0);
      recordingTimerRef.current = 0;
      setLiveTranscript("");
      timerRef.current = setInterval(() => {
        recordingTimerRef.current += 1;
        setRecordingTimer(recordingTimerRef.current);
      }, 1000);

      try {
        if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
          const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          const recognition = new SpeechRecognitionCtor();
          recognition.lang = "vi-VN";
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          recognition.continuous = true;
          const finalChunks: string[] = [];
          recognition.onresult = (event: any) => {
            let interim = "";
            for (let i = 0; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                if (i >= finalChunks.length) finalChunks.push(event.results[i][0].transcript);
              } else {
                interim += event.results[i][0].transcript;
              }
            }
            setLiveTranscript(finalChunks.join(" ") + (interim ? " " + interim : ""));
          };
          recognition.onerror = () => {};
          recognition.onend = () => {
            if (mediaRecorderRef.current?.state === "recording") {
              try { recognition.start(); } catch {}
            }
          };
          recognition.start();
          sttRecognitionRef.current = recognition;
        }
      } catch {}

      setTimeout(() => drawWaveform(), 100);
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setMicError("Quyền truy cập microphone bị từ chối. Vui lòng cho phép trong cài đặt trình duyệt.");
      } else {
        setMicError("Không thể truy cập microphone. Kiểm tra thiết bị và thử lại.");
      }
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { sttRecognitionRef.current?.stop(); } catch {}
    sttRecognitionRef.current = null;
    mediaRecorderRef.current?.stop();
  };

  const handleRecordingComplete = async (blob: Blob, liveDuration: number) => {
    setDuration(liveDuration);
    setAudioState("processing");

    if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
    const localUrl = URL.createObjectURL(blob);
    setLocalAudioUrl(localUrl);

    let uploadedUrl = "";
    try {
      const { uploadURL, objectPath } = await requestUploadUrl({
        data: { name: `audio_${Date.now()}.webm`, size: blob.size, contentType: blob.type || "audio/webm" },
      });
      await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob });
      uploadedUrl = `/api/storage${objectPath}`;
      if (!mountedRef.current) return;
      setAudioUrl(uploadedUrl);
      setUploadError(null);
    } catch {
      if (!mountedRef.current) return;
      setUploadError("Upload audio thất bại. Kiểm tra kết nối mạng và thử lại.");
      setAudioState("idle");
      return;
    }

    if (liveTranscript) {
      setTranscript(liveTranscript);
      setSttConfidence(0.5);
    }
    setAudioState("transcribed");
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append("audio", blob, `recording_${Date.now()}.webm`);
      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.transcript && mountedRef.current) {
          setTranscript(data.transcript);
          setSttConfidence(0.95);
          const hasTxt = textContent.trim().length > 0;
          const inputType: OpenEndPayload["input_type"] = hasTxt ? "combined" : "audio";
          onChange(JSON.stringify({
            input_type: inputType,
            text_content: textContent || undefined,
            audio_url: uploadedUrl || undefined,
            transcript: data.transcript,
            duration_seconds: liveDuration || undefined,
            stt_confidence: 0.95,
          }));
          setIsTranscribing(false);
          return;
        }
      }
    } catch {}

    if (!mountedRef.current) return;
    setIsTranscribing(false);

    const fallbackTranscript = transcript || liveTranscript || "";
    const hasTxt = textContent.trim().length > 0;
    const inputType: OpenEndPayload["input_type"] = hasTxt ? "combined" : "audio";
    onChange(JSON.stringify({
      input_type: inputType,
      text_content: textContent || undefined,
      audio_url: uploadedUrl || undefined,
      transcript: fallbackTranscript || undefined,
      duration_seconds: liveDuration || undefined,
      stt_confidence: fallbackTranscript ? 0.5 : undefined,
    }));
  };

  const handleTranscriptEdit = (val: string) => {
    setTranscript(val);
    emitValue({ transcript: val });
  };

  const removeAudio = () => {
    if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
    setAudioState("idle");
    setAudioUrl("");
    setLocalAudioUrl("");
    setTranscript("");
    setSttConfidence(0);
    setDuration(0);
    emitValue({ audio_url: "", transcript: "", duration_seconds: 0, stt_confidence: 0 });
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
    };
  }, []);

  const formatTime = (s: number) => `${padTwo(Math.floor(s / 60))}:${padTwo(s % 60)}`;

  return (
    <div className="space-y-5">
      {hasText && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-violet-700 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Câu trả lời văn bản
          </label>
          <div className="relative">
            <textarea
              value={textContent}
              onChange={e => handleTextChange(e.target.value)}
              onPaste={handlePaste}
              placeholder="Nhập câu trả lời của bạn tại đây... (tối thiểu 10 ký tự)"
              rows={6}
              className={cn(
                "w-full p-4 text-sm border-2 rounded-2xl resize-y transition-colors",
                charCount === 0
                  ? "border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  : charCount < MIN_TEXT_LENGTH
                    ? "border-amber-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    : "border-green-300 focus:border-green-400 focus:ring-2 focus:ring-green-100"
              )}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                charCount === 0 ? "bg-gray-100 text-gray-400"
                  : charCount < MIN_TEXT_LENGTH ? "bg-amber-100 text-amber-600"
                    : "bg-green-100 text-green-600"
              )}>
                {charCount} ký tự
              </span>
            </div>
          </div>
          {charCount > 0 && charCount < MIN_TEXT_LENGTH && (
            <p className="text-xs text-amber-600">Cần tối thiểu {MIN_TEXT_LENGTH} ký tự ({MIN_TEXT_LENGTH - charCount} ký tự nữa)</p>
          )}
          {pasteCount >= 2 && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Phát hiện dán nhiều lần. Hãy viết bằng chính suy nghĩ của bạn.
            </div>
          )}
        </div>
      )}

      {hasAudio && (
        <div className="space-y-3">
          <label className="text-sm font-semibold text-violet-700 flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Ghi âm câu trả lời
            {hasText && <span className="text-xs font-normal text-gray-400 ml-1">(tuỳ chọn — bổ sung vào văn bản)</span>}
          </label>

          {micError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {micError}
            </div>
          )}
          {uploadError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {uploadError}
            </div>
          )}

          {audioState === "idle" && (
            <div className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-violet-200 rounded-2xl bg-violet-50/30">
              {!supportsMediaRecorder ? (
                <p className="text-sm text-gray-500 text-center">Trình duyệt không hỗ trợ ghi âm. Vui lòng sử dụng Chrome hoặc Firefox.</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startRecording}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                  >
                    <Mic className="w-7 h-7" />
                  </button>
                  <p className="text-sm text-gray-500">Nhấn để bắt đầu ghi âm</p>
                </>
              )}
            </div>
          )}

          {audioState === "recording" && (
            <div className="p-4 border-2 border-red-300 rounded-2xl bg-red-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-semibold text-red-700">Đang ghi âm</span>
                </div>
                <span className="text-lg font-mono font-bold text-red-700">{formatTime(recordingTimer)}</span>
              </div>
              <canvas ref={canvasRef} width={400} height={60} className="w-full h-[60px] rounded-lg" />
              {liveTranscript && (
                <div className="p-2 bg-white/70 rounded-lg border border-red-200">
                  <p className="text-xs text-gray-400 mb-1">Đang nhận dạng:</p>
                  <p className="text-sm text-gray-700 italic">{liveTranscript}</p>
                </div>
              )}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={stopRecording}
                  className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-all hover:scale-105 active:scale-95"
                >
                  <Square className="w-6 h-6 fill-white" />
                </button>
              </div>
            </div>
          )}

          {audioState === "processing" && (
            <div className="p-6 border-2 border-violet-200 rounded-2xl bg-violet-50/50 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
              <p className="text-sm font-medium text-violet-700">Đang xử lý & chuyển đổi giọng nói...</p>
              <p className="text-xs text-gray-400">Upload audio & chạy nhận dạng giọng nói</p>
            </div>
          )}

          {audioState === "transcribed" && (
            <div className="space-y-3 p-4 border-2 border-green-200 rounded-2xl bg-green-50/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-700">Ghi âm hoàn tất</span>
                  {duration > 0 && <span className="text-xs text-gray-400">({formatTime(duration)})</span>}
                </div>
                <div className="flex items-center gap-2">
                  {sttConfidence > 0 && (
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      sttConfidence >= 0.8 ? "bg-green-100 text-green-700"
                        : sttConfidence >= 0.5 ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    )}>
                      Độ chính xác: {Math.round(sttConfidence * 100)}%
                    </span>
                  )}
                  <button type="button" onClick={removeAudio} className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
                    <X className="w-3 h-3" />
                    Xoá
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-green-200 p-2">
                <audio controls src={localAudioUrl || audioUrl} className="w-full h-10" />
              </div>

              {isTranscribing && (
                <div className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg border border-violet-200">
                  <Loader2 className="w-3 h-3 text-violet-600 animate-spin" />
                  <span className="text-xs text-violet-700">Đang nhận dạng chính xác bằng AI...</span>
                </div>
              )}
              {transcript ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500">Bản chuyển đổi (có thể chỉnh sửa):</label>
                  <textarea
                    value={transcript}
                    onChange={e => handleTranscriptEdit(e.target.value)}
                    rows={3}
                    className="w-full p-3 text-sm border border-gray-200 rounded-xl focus:border-violet-400 focus:ring-1 focus:ring-violet-100 resize-y bg-white"
                  />
                </div>
              ) : !isTranscribing ? (
                <p className="text-xs text-gray-400 italic">Không nhận dạng được giọng nói. Bạn có thể ghi âm lại hoặc nhập văn bản.</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SentenceReorderInput({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  const [shuffledItems] = useState(() => shuffleArray(items));

  const ordered: string[] = useMemo(() => {
    if (!value) return [];
    try { return JSON.parse(value); } catch { return []; }
  }, [value]);

  const available = shuffledItems.filter(item => !ordered.includes(item));

  const addItem = (item: string) => onChange(JSON.stringify([...ordered, item]));
  const removeItem = (idx: number) => onChange(JSON.stringify(ordered.filter((_, i) => i !== idx)));

  return (
    <div>
      <p className="text-sm font-bold text-gray-800 mb-3">Sắp xếp các từ thành câu đúng:</p>

      <div className="mb-4 px-4 py-3 border border-indigo-200 bg-white rounded-xl min-h-[52px] flex flex-wrap items-center gap-2">
        {ordered.length === 0 && (
          <p className="text-sm text-gray-300 italic">Nhấn vào các từ bên dưới để xếp câu...</p>
        )}
        {ordered.map((item, i) => (
          <button
            key={i}
            onClick={() => removeItem(i)}
            className="px-3 py-1.5 bg-indigo-50 border-2 border-indigo-300 rounded-lg text-sm font-semibold text-indigo-800 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all cursor-pointer"
          >
            {item}
          </button>
        ))}
      </div>

      {available.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Các từ còn lại:</p>
          <div className="flex flex-wrap gap-2">
            {available.map((item, i) => (
              <button
                key={i}
                onClick={() => addItem(item)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all cursor-pointer"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {ordered.length > 0 && available.length === 0 && (
        <div className="mt-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-center">
          <p className="text-sm text-green-700 font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Đã xếp xong tất cả các từ!
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Reading (Split Pane) ─────────────────────────────────────────────────────
function ReadingInput({ passage, options, value, onChange }: { passage?: string | null; options?: unknown[]; value: string; onChange: (v: string) => void }) {
  type SubQ = { question: string; choices: string[]; correctAnswer: string };
  const subQuestions: SubQ[] = useMemo(() => {
    if (!options || options.length === 0) return [];
    const first = options[0];
    if (typeof first === "object" && first !== null && "question" in first) {
      return (options as SubQ[]).map(sq => ({
        question: sq.question ?? "",
        choices: Array.isArray(sq.choices) ? sq.choices : [],
        correctAnswer: sq.correctAnswer ?? "",
      }));
    }
    return [];
  }, [options]);

  const subAnswers: Record<number, string> = useMemo(() => {
    if (!value) return {};
    try { return JSON.parse(value); } catch { return {}; }
  }, [value]);

  const setSubAnswer = (qi: number, ans: string) => {
    const newA = { ...subAnswers, [qi]: ans };
    onChange(JSON.stringify(newA));
  };

  const passagePanel = passage ? (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-bold text-emerald-700">Bài đọc</span>
      </div>
      <div className="flex-1 p-5 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl overflow-y-auto" style={{ maxHeight: "480px" }}>
        <div className="text-sm text-gray-800 leading-[1.9] whitespace-pre-wrap font-serif">{passage}</div>
      </div>
      <p className="text-xs text-emerald-600 mt-2 text-center">↕ Cuộn để đọc toàn bộ bài</p>
    </div>
  ) : null;

  if (subQuestions.length > 0) {
    return (
      <div className={passage ? "grid grid-cols-2 gap-5" : "space-y-4"}>
        {passagePanel}
        <div className="flex flex-col space-y-3 overflow-y-auto" style={{ maxHeight: passage ? "480px" : undefined }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Type className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-emerald-700">Câu hỏi</span>
          </div>
          {subQuestions.map((sq, qi) => (
            <div key={qi} className="p-4 bg-white border border-emerald-200 rounded-2xl space-y-3">
              <p className="text-sm font-semibold text-gray-800">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold mr-2">{qi + 1}</span>
                {sq.question}
              </p>
              <div className="space-y-2 ml-8">
                {sq.choices.map((ch, ci) => (
                  <label key={ci} className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-sm",
                    subAnswers[qi] === ch
                      ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-800"
                      : "border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30 text-gray-700"
                  )}>
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2 transition-all",
                      subAnswers[qi] === ch ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 text-gray-500"
                    )}>{String.fromCharCode(65 + ci)}</div>
                    <input type="radio" name={`reading-sq-${qi}`} value={ch} checked={subAnswers[qi] === ch} onChange={() => setSubAnswer(qi, ch)} className="sr-only" />
                    <span>{ch}</span>
                    {subAnswers[qi] === ch && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (passage) {
    return (
      <div className="grid grid-cols-2 gap-5">
        {passagePanel}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Type className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-emerald-700">Câu trả lời của bạn</span>
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Nhập câu trả lời dựa trên bài đọc..."
            className="flex-1 p-4 border-2 border-emerald-200 focus:border-emerald-400 rounded-2xl text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-0 bg-white min-h-[200px]"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
        <BookOpen className="w-4 h-4" />
        Câu trả lời của bạn:
      </label>
      <Input
        placeholder="Nhập câu trả lời..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-base border-2 border-emerald-200 focus:border-emerald-400 rounded-xl h-12"
      />
    </div>
  );
}

// ─── Video Interactive ────────────────────────────────────────────────────────
function getYouTubeIdTake(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function buildYTEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1&rel=0`;
}

function VideoInteractiveInput({ videoUrl, timedQuestions: rawTq, value, onChange }: { videoUrl?: string | null; timedQuestions: unknown[]; value: string; onChange: (v: string) => void }) {
  type TQ = { timestamp: number; type?: "note" | "question"; content?: string; question: string; choices: string[]; correctAnswer: string; points?: number };
  const timedQuestions: TQ[] = useMemo(() => {
    if (!rawTq || rawTq.length === 0) return [];
    return (rawTq as TQ[]).filter(tq => typeof tq === "object" && tq !== null).map(tq => ({
      timestamp: tq.timestamp ?? 0, type: tq.type ?? "question", content: tq.content ?? "",
      question: tq.question ?? "", choices: Array.isArray(tq.choices) ? tq.choices : [],
      correctAnswer: tq.correctAnswer ?? "", points: tq.points ?? 10,
    }));
  }, [rawTq]);

  const sortedCheckpoints = useMemo(() =>
    timedQuestions.map((tq, i) => ({ ...tq, originalIndex: i })).sort((a, b) => a.timestamp - b.timestamp)
  , [timedQuestions]);

  const questionItems = useMemo(() =>
    sortedCheckpoints.filter(tq => (tq.type ?? "question") === "question")
  , [sortedCheckpoints]);

  const answers: Record<number, string> = useMemo(() => {
    if (!value) return {};
    try { const p = JSON.parse(value); return typeof p === "object" && p !== null && !Array.isArray(p) ? p : {}; } catch { return {}; }
  }, [value]);

  const setAnswer = (qi: number, ans: string) => {
    const newA = { ...answers, [qi]: ans };
    onChange(JSON.stringify(newA));
  };

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const passedRef = useRef<Set<number>>(new Set());
  const lastPauseIdxRef = useRef<number>(-1);
  const triggeredRef = useRef<Set<number>>(new Set());

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [activeCheckpoint, setActiveCheckpoint] = useState<(TQ & { originalIndex: number }) | null>(null);
  const [passedCheckpoints, setPassedCheckpoints] = useState<Set<number>>(new Set());

  const ytId = videoUrl ? getYouTubeIdTake(videoUrl) : null;
  const isYouTube = !!ytId;

  const postToYT = useCallback((func: string, args?: unknown[]) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func, args: args ?? [] }), "*"
    );
  }, []);

  const ytPlay = useCallback(() => postToYT("playVideo"), [postToYT]);
  const ytPause = useCallback(() => postToYT("pauseVideo"), [postToYT]);

  const handleIframeLoad = useCallback(() => {
    setTimeout(() => {
      if (!iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*"
      );
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "addEventListener", args: ["onReady"], id: 1, channel: "widget" }), "*"
      );
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"], id: 1, channel: "widget" }), "*"
      );
    }, 1000);
  }, []);

  useEffect(() => {
    if (!isYouTube) return;
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.includes("youtube.com")) return;
      let data: Record<string, unknown>;
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }

      if (data.event === "onReady") setPlayerReady(true);

      if (data.event === "onStateChange") {
        const state = data.info as number;
        if (state === 1) setIsPlaying(true);
        if (state === 2 || state === 0) setIsPlaying(false);
      }

      if (data.event === "infoDelivery" && data.info && typeof data.info === "object") {
        const info = data.info as Record<string, unknown>;
        if (typeof info.currentTime === "number") setCurrentTime(info.currentTime);
        if (typeof info.duration === "number" && info.duration > 0) setDuration(info.duration);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isYouTube]);

  useEffect(() => {
    if (!isPlaying) return;
    for (const cp of sortedCheckpoints) {
      if (
        !passedRef.current.has(cp.originalIndex) &&
        !triggeredRef.current.has(cp.originalIndex) &&
        currentTime >= cp.timestamp &&
        currentTime < cp.timestamp + 2
      ) {
        triggeredRef.current.add(cp.originalIndex);
        if (isYouTube) ytPause();
        else if (videoRef.current) videoRef.current.pause();
        setIsPlaying(false);
        setActiveCheckpoint(cp);
        break;
      }
    }
  }, [currentTime, isPlaying, sortedCheckpoints, isYouTube, ytPause]);

  useEffect(() => {
    passedRef.current = new Set();
    triggeredRef.current = new Set();
    setPassedCheckpoints(new Set());
    setActiveCheckpoint(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setPlayerReady(false);
    lastPauseIdxRef.current = -1;
  }, [videoUrl, rawTq]);

  function fmtMM(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function togglePlay() {
    if (activeCheckpoint) return;
    if (isYouTube) {
      if (isPlaying) ytPause();
      else ytPlay();
    } else if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }

  function resumeFromCheckpoint() {
    if (!activeCheckpoint) return;
    passedRef.current = new Set([...passedRef.current, activeCheckpoint.originalIndex]);
    setPassedCheckpoints(new Set(passedRef.current));
    setActiveCheckpoint(null);
    if (isYouTube) ytPlay();
    else if (videoRef.current) videoRef.current.play().catch(() => {});
    setIsPlaying(true);
  }

  function seekToTs(ts: number) {
    if (isYouTube) {
      postToYT("seekTo", [ts, true]);
      ytPlay();
    } else if (videoRef.current) {
      videoRef.current.currentTime = ts;
      videoRef.current.play().catch(() => {});
    }
    setIsPlaying(true);
  }

  const passedCount = passedCheckpoints.size;
  const totalCheckpoints = sortedCheckpoints.length;
  const progressPct = totalCheckpoints > 0 ? Math.round((passedCount / totalCheckpoints) * 100) : 0;
  const playPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="space-y-0">
      {videoUrl && (
        <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
          <div className="relative bg-black group/video">
            {isYouTube && ytId ? (
              <iframe
                ref={iframeRef}
                src={buildYTEmbedUrl(ytId)}
                className="w-full aspect-video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onLoad={handleIframeLoad}
              />
            ) : (
              <video ref={videoRef} src={videoUrl!} className="w-full aspect-video"
                onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); }}
                onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration || 0); }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)} />
            )}
            {activeCheckpoint && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] z-10 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full text-white text-sm">
                  <Pause className="w-4 h-4" />
                  Video đã tạm dừng
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pt-3 pb-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button type="button" onClick={togglePlay} disabled={!!activeCheckpoint}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                    activeCheckpoint ? "opacity-40 cursor-not-allowed border-gray-200 text-gray-400 bg-gray-50"
                      : isPlaying ? "border-orange-300 bg-orange-500 text-white hover:bg-orange-600"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}>
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isPlaying ? "Tạm dừng" : "Phát"}
                </button>
                <span className="text-sm font-mono text-gray-700">{fmtMM(currentTime)} / {duration > 0 ? fmtMM(duration) : "--:--"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", isPlaying ? "bg-green-500" : "bg-gray-400")} />
                <span className={cn("text-xs font-medium", isPlaying ? "text-green-600" : "text-gray-500")}>
                  {isPlaying ? "Đang phát" : "Đã dừng"}
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${playPct}%` }} />
              </div>
              {duration > 0 && sortedCheckpoints.map((cp, i) => {
                const pct = Math.max(0, Math.min(100, (cp.timestamp / duration) * 100));
                const isPassed = passedCheckpoints.has(cp.originalIndex);
                const isNote = (cp.type ?? "question") === "note";
                return (
                  <div key={i} className={cn(
                    "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10 cursor-pointer transition-colors",
                    isPassed ? "bg-green-500" : isNote ? "bg-amber-400" : "bg-blue-500"
                  )} style={{ left: `${pct}%` }} onClick={() => seekToTs(cp.timestamp)}
                    title={`${isNote ? "Ghi chú" : "Câu hỏi"} — ${fmtMM(cp.timestamp)}`} />
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Ghi chú</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Câu hỏi</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Hoàn thành</span>
              </div>
              <span className="text-gray-500 font-medium">{passedCount}/{totalCheckpoints} điểm dừng</span>
            </div>

            <div className="border-t border-gray-100 pt-2 pb-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Tiến độ điểm dừng</span>
                <span className="text-xs font-semibold text-gray-700">{progressPct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeCheckpoint && (activeCheckpoint.type ?? "question") === "note" && (
        <div className="mt-4 border border-amber-200 rounded-2xl bg-amber-50/80 overflow-hidden">
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-bold text-amber-800 tracking-wide">GHI CHÚ</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-800 text-white">
                {fmtMM(activeCheckpoint.timestamp)}
              </span>
            </div>
            <p className="text-sm text-gray-800 leading-relaxed pl-[52px]">{activeCheckpoint.content}</p>
          </div>
          <div className="px-5 pb-4 flex justify-end">
            <Button type="button" onClick={resumeFromCheckpoint}
              className="bg-[#378ADD] hover:bg-[#2d75c2] text-white gap-2 rounded-lg h-10 px-5 text-sm font-semibold shadow-sm">
              <ChevronRight className="w-4 h-4" /> Tiếp tục xem video
            </Button>
          </div>
        </div>
      )}

      {activeCheckpoint && (activeCheckpoint.type ?? "question") === "question" && (
        <div className="mt-4 border border-blue-200 rounded-2xl bg-blue-50/50 overflow-hidden">
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-bold text-blue-800 tracking-wide">CÂU HỎI</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-800 text-white">
                {fmtMM(activeCheckpoint.timestamp)}
              </span>
              {activeCheckpoint.points && <span className="ml-auto text-xs text-gray-400">{activeCheckpoint.points} điểm</span>}
            </div>
            <p className="text-sm font-semibold text-gray-800 leading-relaxed pl-[52px]">{activeCheckpoint.question}</p>
            <div className="pl-[52px] space-y-2">
              {activeCheckpoint.choices.map((ch, ci) => {
                const selected = answers[activeCheckpoint.originalIndex] ?? "";
                return (
                  <label key={ci} className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all text-sm",
                    selected === ch
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
                  )}>
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2 transition-all",
                      selected === ch ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-500"
                    )}>{String.fromCharCode(65 + ci)}</div>
                    <input type="radio" name={`video-q-${activeCheckpoint.originalIndex}`} value={ch} checked={selected === ch}
                      onChange={() => setAnswer(activeCheckpoint.originalIndex, ch)} className="sr-only" />
                    <span className={cn("font-medium", selected === ch ? "text-blue-800" : "text-gray-700")}>{ch}</span>
                    {selected === ch && <CheckCircle2 className="w-4 h-4 text-blue-500 ml-auto" />}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="px-5 pb-4 flex justify-end">
            <Button type="button" onClick={resumeFromCheckpoint}
              disabled={!answers[activeCheckpoint.originalIndex]}
              className="bg-[#378ADD] hover:bg-[#2d75c2] text-white gap-2 rounded-lg h-10 px-5 text-sm font-semibold shadow-sm disabled:opacity-50">
              <ChevronRight className="w-4 h-4" /> Tiếp tục xem video
            </Button>
          </div>
        </div>
      )}

      {!activeCheckpoint && questionItems.length > 0 && passedCheckpoints.size > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-500" />
            Câu hỏi đã trả lời
          </p>
          {questionItems.filter(q => answers[q.originalIndex]).map((tq, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-sm">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-white">{fmtMM(tq.timestamp)}</span>
              <span className="text-gray-700 flex-1 truncate">{tq.question}</span>
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-xs text-green-600 font-medium">{answers[tq.originalIndex]}</span>
            </div>
          ))}
        </div>
      )}

      {sortedCheckpoints.length === 0 && (
        <div className="mt-4">
          <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Type className="w-4 h-4" />
            Ghi chú / Câu trả lời của bạn:
          </label>
          <RichTextEditor value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// ─── Listening Input ──────────────────────────────────────────────────────────
function ListeningInput({ audioUrl, options, value, onChange }: { audioUrl?: string | null; options: unknown[]; value: string; onChange: (v: string) => void }) {
  type SubQ = { question: string; choices: string[]; correctAnswer: string };
  const subQuestions: SubQ[] = useMemo(() => {
    if (!options || options.length === 0) return [];
    const first = options[0];
    if (typeof first === "object" && first !== null && "question" in first) {
      return (options as SubQ[]).map(sq => ({
        question: sq.question ?? "",
        choices: Array.isArray(sq.choices) ? sq.choices : [],
        correctAnswer: sq.correctAnswer ?? "",
      }));
    }
    return [];
  }, [options]);

  const answers: Record<number, string> = useMemo(() => {
    if (!value) return {};
    try { return JSON.parse(value); } catch { return {}; }
  }, [value]);

  const setSubAnswer = (qi: number, ans: string) => {
    const newA = { ...answers, [qi]: ans };
    onChange(JSON.stringify(newA));
  };

  if (subQuestions.length > 0) {
    return (
      <div className="space-y-5">
        {audioUrl && <AudioPlayer src={audioUrl} />}
        {subQuestions.map((sq, qi) => (
          <div key={qi} className="p-4 bg-white border border-green-200 rounded-2xl space-y-3">
            <p className="text-sm font-semibold text-gray-800">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold mr-2">{qi + 1}</span>
              {sq.question}
            </p>
            <div className="space-y-2 ml-8">
              {sq.choices.map((ch, ci) => (
                <label key={ci} className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-sm",
                  answers[qi] === ch
                    ? "border-green-500 bg-green-50 font-semibold text-green-800"
                    : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/30 text-gray-700"
                )}>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2 transition-all",
                    answers[qi] === ch ? "border-green-500 bg-green-500 text-white" : "border-gray-300 text-gray-500"
                  )}>{String.fromCharCode(65 + ci)}</div>
                  <input type="radio" name={`listening-sq-${qi}`} value={ch} checked={answers[qi] === ch} onChange={() => setSubAnswer(qi, ch)} className="sr-only" />
                  <span>{ch}</span>
                  {answers[qi] === ch && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const flatOptions = options.filter(o => typeof o === "string") as string[];
  if (flatOptions.length > 0) {
    return (
      <div>
        {audioUrl && <AudioPlayer src={audioUrl} />}
        <p className="text-sm text-green-700 font-semibold mb-3">Chọn đáp án đúng:</p>
        <div className="space-y-2.5">
          {flatOptions.map((opt, i) => (
            <label key={i} className={cn(
              "flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200",
              value === opt
                ? "border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 shadow-md shadow-green-100 scale-[1.01]"
                : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/30"
            )}>
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all",
                value === opt ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow" : "bg-gray-100 text-gray-500"
              )}>{String.fromCharCode(65 + i)}</div>
              <input type="radio" name="listening-opt" value={opt} checked={value === opt} onChange={() => onChange(opt)} className="sr-only" />
              <span className={cn("text-sm font-medium", value === opt ? "text-green-800" : "text-gray-700")}>{opt}</span>
              {value === opt && <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {audioUrl && <AudioPlayer src={audioUrl} />}
      <label className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
        <Headphones className="w-4 h-4" />
        Câu trả lời của bạn:
      </label>
      <Input
        placeholder="Nhập câu trả lời sau khi nghe..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-base border-2 border-green-200 focus:border-green-400 rounded-xl h-12"
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type SaveStatus = "idle" | "pending" | "saving" | "saved" | "offline";

function SaveIndicator({ status, lastSaved }: { status: SaveStatus; lastSaved: string | null }) {
  if (status === "idle") return null;
  const config = {
    pending: { icon: Save, text: "Sẽ lưu sau 2s...", color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200" },
    saving: { icon: Cloud, text: "Đang lưu...", color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200" },
    saved: { icon: CheckCircle2, text: lastSaved ? `Đã lưu lúc ${lastSaved}` : "Đã lưu", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
    offline: { icon: WifiOff, text: "Offline — đã lưu cục bộ", color: "text-red-500", bg: "bg-red-50", border: "border-red-200" },
  }[status];
  const Icon = config.icon;
  return (
    <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all", config.bg, config.color, config.border)}>
      <Icon className={cn("w-3.5 h-3.5", status === "saving" && "animate-spin")} />
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
        <h2 className="text-xl font-bold text-gray-900 mb-2">Phát hiện phiên làm bài cũ</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Bạn đã có một phiên làm bài chưa hoàn thành. Bạn muốn tiếp tục hay bắt đầu lại từ đầu?
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
  const isPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1";

  const { data: assignment, isLoading } = useGetAssignment(assignmentId, {
    query: { enabled: !!assignmentId, queryKey: getGetAssignmentQueryKey(assignmentId) },
  });
  const { mutate: createSubmission, isPending: submitting } = useCreateSubmission();
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
        setLastSavedTime(`${padTwo(now.getHours())}:${padTwo(now.getMinutes())}:${padTwo(now.getSeconds())}`);
        setSaveStatus("saved");
        localStorage.removeItem(`quiz_draft_${sessionIdRef.current}`);
      } else {
        throw new Error("save failed");
      }
    } catch {
      setSaveStatus("offline");
      localStorage.setItem(`quiz_draft_${sessionIdRef.current}`, JSON.stringify({
        answers: answersRef.current,
        flagged: flaggedRef.current,
        currentQuestion: currentIdxRef.current,
        timeLeftSeconds: timeLeftRef.current,
        savedLocally: Date.now(),
      }));
    }
  }, [assignmentId, isPreview]);

  const scheduleSave = useCallback(() => {
    if (!sessionReady.current || isPreview) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("pending");
    saveTimerRef.current = setTimeout(() => { autoSave(); }, 2000);
  }, [autoSave, isPreview]);

  useEffect(() => {
    if (!sessionId || isPreview) return;
    intervalSaveRef.current = setInterval(() => { autoSave(); }, 30000);
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
      localStorage.setItem(`quiz_draft_${sessionId}`, JSON.stringify({
        answers: answersRef.current,
        flagged: flaggedRef.current,
        currentQuestion: currentIdxRef.current,
        timeLeftSeconds: timeLeftRef.current,
        savedLocally: Date.now(),
      }));
      const body = JSON.stringify({
        sessionId,
        answers: answersRef.current,
        flagged: flaggedRef.current,
        currentQuestion: currentIdxRef.current,
        timeLeftSeconds: timeLeftRef.current,
      });
      navigator.sendBeacon(`/api/assignments/${assignmentId}/session/beacon`, new Blob([body], { type: "application/json" }));
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
        const res = await fetch(`/api/assignments/${assignmentId}/session`, { credentials: "include" });
        if (cancelled) return;
        const data = await res.json();
        if (data.session) {
          setPendingSession(data.session);
          setShowResumeBanner(true);
        }
      } catch {}
      if (!cancelled) setSessionLoading(false);
    })();
    return () => { cancelled = true; };
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
        if (assignment?.timeLimitMinutes) setTimeLeft(assignment.timeLimitMinutes * 60);
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
    setFlagged(Array.isArray(pendingSession.flagged) ? pendingSession.flagged : []);
    setCurrentIdx(pendingSession.currentQuestion ?? 0);
    if (pendingSession.timeLeftSeconds !== null && pendingSession.timeLeftSeconds !== undefined) {
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
    if (!assignmentId || isPreview || sessionLoading || showResumeBanner || sessionId) return;
    if (assignment && !pendingSession) {
      startNewSession();
    }
  }, [assignmentId, isPreview, sessionLoading, showResumeBanner, sessionId, assignment, pendingSession, startNewSession]);

  useEffect(() => {
    if (isPreview && assignment?.timeLimitMinutes) setTimeLeft(assignment.timeLimitMinutes * 60);
  }, [isPreview, assignment?.timeLimitMinutes]);

  useEffect(() => {
    if (!assignmentId || submitted) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCount.current += 1;
        const severity = tabSwitchCount.current >= 3 ? "high" : tabSwitchCount.current >= 2 ? "medium" : "low";
        reportFraud({
          data: { assignmentId, eventType: tabSwitchCount.current >= 3 ? "multiple_tab_switches" : "tab_switch", severity, details: `Chuyển tab lần ${tabSwitchCount.current}` },
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [assignmentId, submitted, reportFraud]);

  const handleSubmit = useCallback(() => {
    if (!assignment) return;
    const answerPayload = (assignment.questions ?? []).map((aq) => ({
      questionId: aq.id,
      answer: answers[aq.id] ?? "",
    }));
    createSubmission(
      { data: { assignmentId, answers: answerPayload, ...(isPreview ? { isPreview: true } : {}) } },
      {
        onSuccess: (result) => {
          setSubmitted(true);
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
            queryClient.invalidateQueries({ queryKey: getListSubmissionsQueryKey() });
            setTimeout(() => navigate(`/submissions/${result.id}`), 1500);
          }
        },
      }
    );
  }, [assignment, answers, assignmentId, createSubmission, navigate, queryClient, isPreview, sessionId]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const interval = setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
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
    return <ResumeSessionBanner onResume={handleResume} onRestart={handleRestart} />;
  }

  const myAttempts = assignment?.myAttemptCount ?? 0;
  const maxAttempts = assignment?.maxAttempts ?? 0;
  const exceededLimit = !isPreview && maxAttempts > 0 && myAttempts >= maxAttempts;

  if (!isLoading && assignment && exceededLimit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-3xl shadow-lg border border-red-100 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-xl font-semibold text-gray-700">Đã hết lượt làm bài</p>
          <p className="text-sm text-muted-foreground mt-2">
            Bạn đã sử dụng hết {maxAttempts}/{maxAttempts} lượt cho phép của bài tập này.
          </p>
          <Button className="mt-6 rounded-xl" onClick={() => navigate("/assignments")}>Quay lại danh sách</Button>
        </div>
      </div>
    );
  }

  if (!assignment || !assignment.questions || assignment.questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-3xl shadow-lg border border-gray-100 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-xl font-semibold text-gray-700">Không tìm thấy bài tập hoặc bài tập chưa có câu hỏi</p>
          <Button className="mt-6 rounded-xl" onClick={() => navigate("/assignments")}>Quay lại</Button>
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
            {isPreview ? "Đây là bài làm thử, không lưu kết quả." : "Đang chuyển đến trang kết quả..."}
          </p>
          {isPreview ? (
            <Button className="rounded-xl" onClick={() => navigate(`/assignments/${assignmentId}`)}>Quay lại bài tập</Button>
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
    try { return JSON.parse(str) as T; } catch { return fallback; }
  };

  const rawOptionsArray: unknown[] = currentQ?.options
    ? (() => { const v = parseJson<unknown>(currentQ.options, []); return Array.isArray(v) ? v : []; })()
    : [];
  const rawOptions = rawOptionsArray as string[];
  const questionMetadata = parseJson<Record<string, unknown>>(currentQ?.metadata, {});
  const allowMultiple = questionMetadata.allowMultiple === true;
  const wordSelectionWords: string[] = currentQ?.type === "word_selection" && currentQ?.passage
    ? currentQ.passage.trim().split(/\s+/).filter(Boolean)
    : [];
  const pairs: Array<{ left: string; right: string }> = currentQ?.type === "matching"
    ? (rawOptionsArray as Array<{ left?: string; right?: string } | string>).map(item => {
        if (typeof item === "object" && item !== null) return { left: (item as {left?:string}).left ?? "", right: (item as {right?:string}).right ?? "" };
        const [l, r] = String(item).split("|").map(x => x.trim());
        return { left: l || String(item), right: r || "" };
      })
    : [];
  const ddParsed = parseJson<{ items: string[]; zones: Array<{label:string;accepts:string[]}> }>(
    currentQ?.options, { items: [], zones: [] }
  );
  const items: string[] = currentQ?.type === "sentence_reorder"
    ? (rawOptionsArray as string[])
    : currentQ?.type === "drag_drop"
      ? (Array.isArray(ddParsed.items) ? ddParsed.items : [])
      : [];

  const setAnswer = (v: string) => {
    if (currentAQ) {
      setAnswers((prev) => ({ ...prev, [currentAQ.id]: v }));
      scheduleSave();
    }
  };
  const toggleFlag = (idx: number) => {
    setFlagged((prev) => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
    scheduleSave();
  };
  const isFlagged = (idx: number) => flagged.includes(idx);
  const currentAnswer = currentAQ ? (answers[currentAQ.id] ?? "") : "";
  const answeredCount = questions.filter(aq => {
    const ans = answers[aq.id] ?? "";
    if (["matching", "drag_drop", "sentence_reorder", "video_interactive", "listening", "reading"].includes(aq.question?.type ?? "")) {
      try { const parsed = JSON.parse(ans); return Array.isArray(parsed) ? parsed.length > 0 : Object.keys(parsed).length > 0; } catch { return ans.trim().length > 0; }
    }
    return ans.trim().length > 0;
  }).length;

  const typeConfig = currentQ ? (TYPE_CONFIG[currentQ.type] || TYPE_CONFIG.essay) : TYPE_CONFIG.essay;
  const TypeIcon = typeConfig.icon;
  const progressPercent = (answeredCount / questions.length) * 100;
  const isAnswered = (aqId: number, qType: string) => {
    const ans = answers[aqId] ?? "";
    if (["matching", "drag_drop", "sentence_reorder", "video_interactive", "listening", "reading"].includes(qType)) {
      try { const parsed = JSON.parse(ans); return Array.isArray(parsed) ? parsed.length > 0 : Object.keys(parsed).length > 0; } catch { return ans.trim().length > 0; }
    }
    return ans.trim().length > 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/40 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200/80 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={cn("w-11 h-11 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center font-black text-lg shadow-lg", "from-blue-500 to-indigo-600")}>
            {assignment.title.charAt(0)}
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-tight">{assignment.title}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span>{questions.length} câu hỏi</span>
              <span>·</span>
              <span>{assignment.totalPoints} điểm</span>
              <span>·</span>
              <span className="font-semibold text-emerald-600">{answeredCount}/{questions.length} đã trả lời</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isPreview && <SaveIndicator status={saveStatus} lastSaved={lastSavedTime} />}
          {timeLeft !== null && (
            <div className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-2xl font-mono font-bold text-lg transition-all",
              isLowTime ? "bg-red-100 text-red-600 animate-pulse ring-2 ring-red-200" : "bg-slate-100 text-slate-700"
            )}>
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
          <span className="text-xs font-bold text-gray-500 w-12 text-right">{Math.round(progressPercent)}%</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="w-64 border-r border-gray-200/80 bg-white/90 backdrop-blur-sm p-5 overflow-y-auto flex-shrink-0">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Danh sách câu hỏi</p>
          <div className="space-y-1.5">
            {questions.map((aq, i) => {
              const answered = isAnswered(aq.id, aq.question?.type ?? "");
              const qCfg = TYPE_CONFIG[aq.question?.type ?? ""] || TYPE_CONFIG.essay;
              const QIcon = qCfg.icon;
              const active = i === currentIdx;
              return (
                <button
                  key={aq.id}
                  onClick={() => { setCurrentIdx(i); scheduleSave(); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left",
                    active
                      ? `bg-gradient-to-r ${qCfg.gradient.replace("from-", "from-").replace("to-", "to-")} text-white shadow-md`
                      : isFlagged(i)
                      ? "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                      : answered
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0",
                    active ? "bg-white/20 text-white" : isFlagged(i) ? "bg-amber-200 text-amber-700" : answered ? "bg-emerald-200 text-emerald-700" : "bg-gray-100 text-gray-500"
                  )}>{i + 1}</span>
                  <QIcon className={cn("w-3.5 h-3.5 flex-shrink-0", active ? "text-white/80" : answered ? "text-emerald-500" : "text-gray-400")} />
                  <span className="truncate text-xs leading-tight">{qCfg.label}</span>
                  {isFlagged(i) && !active && <Flag className="w-3.5 h-3.5 text-amber-500 ml-auto flex-shrink-0" />}
                  {answered && !active && !isFlagged(i) && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto flex-shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-2 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /></div>
              <span className="text-gray-500">Đã trả lời <span className="font-bold text-emerald-600">{answeredCount}</span></span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-lg bg-gray-100 border border-gray-200" />
              <span className="text-gray-500">Chưa trả lời <span className="font-bold text-gray-600">{questions.length - answeredCount}</span></span>
            </div>
            {flagged.length > 0 && (
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center"><Flag className="w-2.5 h-2.5 text-amber-500" /></div>
                <span className="text-gray-500">Đánh dấu xem lại <span className="font-bold text-amber-600">{flagged.length}</span></span>
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
                  <div className={cn("w-13 h-13 min-w-[52px] min-h-[52px] rounded-2xl bg-gradient-to-br text-white flex items-center justify-center text-xl font-black shadow-lg", typeConfig.gradient)}>
                    {currentIdx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={cn("text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border", typeConfig.bgColor, typeConfig.color, "border-current/20")}>
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
                            : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-amber-50 hover:text-amber-500 hover:border-amber-200"
                        )}
                      >
                        <Flag className="w-3.5 h-3.5" />
                        {isFlagged(currentIdx) ? "Đã đánh dấu" : "Đánh dấu"}
                      </button>
                    </div>
                    <p className="text-base font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap">{currentQ.content}</p>
                  </div>
                </div>

                {/* Image (if any) */}
                {currentQ?.imageUrl && (
                  <div className="ml-16">
                    <img src={currentQ?.imageUrl} alt="Hình ảnh câu hỏi" className="rounded-xl border border-gray-200 max-h-64 object-contain" />
                  </div>
                )}

                {/* Question type input */}
                <div className="ml-16">
                  {currentQ.type === "mcq" && rawOptions.length > 0 && !allowMultiple && (
                    <div className="space-y-3">
                      {rawOptions.map((opt, i) => (
                        <label
                          key={i}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200",
                            currentAnswer === opt
                              ? "border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg shadow-blue-100 scale-[1.01]"
                              : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-sm"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 transition-all",
                            currentAnswer === opt ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md" : "bg-gray-100 text-gray-500"
                          )}>
                            {String.fromCharCode(65 + i)}
                          </div>
                          <input type="radio" name={`q-${currentQ.id}`} value={opt} checked={currentAnswer === opt} onChange={() => setAnswer(opt)} className="sr-only" />
                          <span className={cn("text-sm font-medium flex-1 leading-relaxed", currentAnswer === opt ? "text-blue-800" : "text-gray-700")}>{opt}</span>
                          {currentAnswer === opt && <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />}
                        </label>
                      ))}
                    </div>
                  )}

                  {currentQ.type === "mcq" && rawOptions.length > 0 && allowMultiple && (() => {
                    const selectedAnswers = currentAnswer ? currentAnswer.split(",").filter(Boolean) : [];
                    const toggleOption = (opt: string) => {
                      const next = selectedAnswers.includes(opt)
                        ? selectedAnswers.filter(a => a !== opt)
                        : [...selectedAnswers, opt];
                      setAnswer(next.join(","));
                    };
                    return (
                      <div className="space-y-3">
                        <p className="text-sm text-blue-600 font-medium flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Chọn tất cả đáp án đúng
                        </p>
                        {rawOptions.map((opt, i) => {
                          const isSelected = selectedAnswers.includes(opt);
                          return (
                            <label
                              key={i}
                              className={cn(
                                "flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200",
                                isSelected
                                  ? "border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg shadow-blue-100 scale-[1.01]"
                                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-sm"
                              )}
                            >
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 transition-all",
                                isSelected ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md" : "bg-gray-100 text-gray-500"
                              )}>
                                {String.fromCharCode(65 + i)}
                              </div>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleOption(opt)} className="sr-only" />
                              <span className={cn("text-sm font-medium flex-1 leading-relaxed", isSelected ? "text-blue-800" : "text-gray-700")}>{opt}</span>
                              {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />}
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {currentQ.type === "true_false" && (
                    <TrueFalseInput value={currentAnswer} onChange={setAnswer} />
                  )}

                  {currentQ.type === "fill_blank" && (
                    <FillBlankInput content={currentQ.content} value={currentAnswer} onChange={setAnswer} />
                  )}

                  {currentQ.type === "word_selection" && wordSelectionWords.length > 0 && (
                    <WordSelectionInput options={wordSelectionWords} value={currentAnswer} onChange={setAnswer} />
                  )}

                  {currentQ.type === "matching" && pairs.length > 0 && (
                    <MatchingInput pairs={pairs} value={currentAnswer} onChange={setAnswer} />
                  )}

                  {currentQ.type === "drag_drop" && items.length > 0 && (
                    <DragDropInput items={items} zones={ddParsed.zones ?? []} value={currentAnswer} onChange={setAnswer} />
                  )}

                  {currentQ.type === "sentence_reorder" && items.length > 0 && (
                    <SentenceReorderInput items={items} value={currentAnswer} onChange={setAnswer} />
                  )}

                  {currentQ.type === "reading" && (
                    <ReadingInput passage={currentQ?.passage} options={rawOptionsArray} value={currentAnswer} onChange={setAnswer} />
                  )}

                  {currentQ.type === "listening" && (
                    <ListeningInput audioUrl={currentQ.audioUrl} options={rawOptionsArray} value={currentAnswer} onChange={setAnswer} />
                  )}

                  {currentQ.type === "video_interactive" && (
                    <VideoInteractiveInput videoUrl={currentQ?.videoUrl} timedQuestions={rawOptionsArray} value={currentAnswer} onChange={setAnswer} />
                  )}

                  {currentQ.type === "essay" && (
                    <div>
                      <label className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Bài làm của bạn:
                      </label>
                      <RichTextEditor value={currentAnswer} onChange={setAnswer} />
                    </div>
                  )}

                  {currentQ.type === "open_end" && (() => {
                    const meta = currentQ.metadata ? (() => { try { return JSON.parse(currentQ.metadata); } catch { return {}; } })() : {};
                    const allowedTypes: string[] = (meta.allowedTypes ?? ["text", "audio"]).filter((t: string) => t !== "image");
                    return <OpenEndInput allowedTypes={allowedTypes} value={currentAnswer} onChange={setAnswer} />;
                  })()}
                </div>

                {/* Explanation hint (shown only if answer given, teacher mode) */}
                {currentAnswer && currentQ?.explanation && (
                  <div className="ml-16 flex items-start gap-3 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl">
                    <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-700 mb-1">Gợi ý giải thích</p>
                      <p className="text-sm text-amber-800 leading-relaxed">{currentQ?.explanation}</p>
                    </div>
                  </div>
                )}
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
                {questions.slice(Math.max(0, currentIdx - 2), Math.min(questions.length, currentIdx + 3)).map((_, relIdx) => {
                  const absIdx = Math.max(0, currentIdx - 2) + relIdx;
                  return (
                    <button
                      key={absIdx}
                      onClick={() => setCurrentIdx(absIdx)}
                      className={cn(
                        "w-9 h-9 rounded-xl text-sm font-bold transition-all",
                        absIdx === currentIdx ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {absIdx + 1}
                    </button>
                  );
                })}
              </div>
              {currentIdx < questions.length - 1 ? (
                <Button onClick={() => setCurrentIdx((i) => i + 1)} className="rounded-2xl gap-1.5 px-5">
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
