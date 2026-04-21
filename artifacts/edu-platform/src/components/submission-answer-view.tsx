import React from "react";
import { CheckCircle2, XCircle, MousePointerClick, Layers, Type, GripVertical, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

const LABELS = "ABCDEFGHIJKLMNOP";

function normTF(v: string | null | undefined): "true" | "false" | null {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "đúng" || s === "dung" || s === "t" || s === "1") return "true";
  if (s === "false" || s === "sai" || s === "f" || s === "0") return "false";
  return null;
}

function normalizeList(v: string | null | undefined): string[] {
  if (!v) return [];
  const arr = safeJson<unknown>(v, null);
  if (Array.isArray(arr)) return arr.map(String);
  return String(v).split(",").map(s => s.trim()).filter(Boolean);
}

// ───────────────────────────────── MCQ ─────────────────────────────────
function McqReview({ studentAnswer, correctAnswer, questionOptions }: {
  studentAnswer: string | null; correctAnswer: string | null; questionOptions: string | null;
}) {
  const opts = safeJson<unknown[]>(questionOptions, []).map(String);
  const studentSet = new Set(normalizeList(studentAnswer));
  const correctSet = new Set(normalizeList(correctAnswer));
  const showCorrect = correctAnswer != null;

  if (opts.length === 0) {
    return <p className="text-sm text-gray-400 italic">(Không có lựa chọn)</p>;
  }

  return (
    <div className="space-y-2">
      {opts.map((opt, i) => {
        const picked = studentSet.has(opt);
        const isCorrect = correctSet.has(opt);
        // Color logic
        let cls = "border-gray-200 bg-white text-gray-700";
        let badgeCls = "bg-gray-100 text-gray-500";
        if (showCorrect) {
          if (picked && isCorrect) { cls = "border-green-400 bg-green-50 text-green-900"; badgeCls = "bg-green-500 text-white"; }
          else if (picked && !isCorrect) { cls = "border-red-400 bg-red-50 text-red-900"; badgeCls = "bg-red-500 text-white"; }
          else if (!picked && isCorrect) { cls = "border-green-300 bg-green-50/40 text-green-800 border-dashed"; badgeCls = "bg-green-100 text-green-700"; }
        } else if (picked) {
          cls = "border-blue-400 bg-blue-50 text-blue-900"; badgeCls = "bg-blue-500 text-white";
        }

        return (
          <div key={i} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-colors", cls)}>
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0", badgeCls)}>
              {LABELS[i] ?? i + 1}
            </div>
            <span className="text-sm font-medium flex-1 leading-relaxed">{opt}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {picked && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/80 border border-current">
                  HS chọn
                </span>
              )}
              {showCorrect && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600" />}
              {showCorrect && picked && !isCorrect && <XCircle className="w-4 h-4 text-red-500" />}
            </div>
          </div>
        );
      })}
      {studentSet.size === 0 && (
        <p className="text-xs text-gray-400 italic">(Học sinh không chọn đáp án nào)</p>
      )}
    </div>
  );
}

// ────────────────────────────── True / False ──────────────────────────────
function TrueFalseReview({ studentAnswer, correctAnswer }: {
  studentAnswer: string | null; correctAnswer: string | null;
}) {
  const sa = normTF(studentAnswer);
  const ca = normTF(correctAnswer);
  const showCorrect = ca != null;

  const opts: Array<{ val: "true" | "false"; label: string; sub: string; icon: typeof CheckCircle2; activeCls: string; iconCls: string }> = [
    { val: "true",  label: "ĐÚNG", sub: "True",  icon: CheckCircle2, activeCls: "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-green-100", iconCls: "text-green-500" },
    { val: "false", label: "SAI",  sub: "False", icon: XCircle,      activeCls: "border-red-500 bg-gradient-to-br from-red-50 to-rose-50 shadow-red-100",         iconCls: "text-red-500"   },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {opts.map(({ val, label, sub, icon: Icon, activeCls, iconCls }) => {
        const picked = sa === val;
        const correct = showCorrect && ca === val;
        const wrongPick = picked && showCorrect && ca !== val;
        const cls = picked ? activeCls : correct ? "border-green-300 bg-green-50/40 border-dashed" : "border-gray-200 bg-white";
        return (
          <div key={val} className={cn("relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all", cls, picked && "shadow-md")}>
            <Icon className={cn("w-10 h-10", picked || correct ? iconCls : "text-gray-300")} />
            <div className="text-center">
              <div className={cn("text-base font-black tracking-wider", picked ? (val === "true" ? "text-green-700" : "text-red-700") : correct ? "text-green-600" : "text-gray-400")}>{label}</div>
              <div className="text-[10px] font-medium text-gray-400">{sub}</div>
            </div>
            {picked && (
              <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500 text-white uppercase tracking-wider">
                HS chọn
              </span>
            )}
            {showCorrect && correct && (
              <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500 text-white uppercase tracking-wider">
                Đáp án
              </span>
            )}
            {wrongPick && (
              <span className="absolute -top-2 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white">
                Sai
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────── Fill Blank ───────────────────────────────
function FillBlankReview({ studentAnswer, correctAnswer, questionContent }: {
  studentAnswer: string | null; correctAnswer: string | null; questionContent: string | null;
}) {
  const content = questionContent ?? "";
  const blankToken = content.includes("__BLANK__") ? "__BLANK__" : null;
  const parts = blankToken ? content.split("__BLANK__") : content.split(/_{3,}/);
  const blankCount = Math.max(0, parts.length - 1);

  const studentBlanks: string[] = (() => {
    if (!studentAnswer) return Array(blankCount).fill("");
    const arr = safeJson<unknown>(studentAnswer, null);
    if (Array.isArray(arr)) return arr.map(String);
    return blankCount <= 1 ? [studentAnswer] : Array(blankCount).fill("");
  })();
  const correctBlanks: string[] = (() => {
    if (!correctAnswer) return [];
    const arr = safeJson<unknown>(correctAnswer, null);
    if (Array.isArray(arr)) return arr.map(String);
    return [correctAnswer];
  })();

  const showCorrect = correctAnswer != null;
  const isBlankCorrect = (sa: string, idx: number) => {
    if (!showCorrect) return null;
    const ca = correctBlanks[idx];
    if (ca == null) return null;
    return sa.trim().toLowerCase() === ca.trim().toLowerCase();
  };

  if (blankCount > 0) {
    let blankIdx = 0;
    return (
      <div className="space-y-3">
        <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-200 rounded-2xl text-base leading-loose text-gray-800">
          {parts.map((part, i) => {
            const cur = blankIdx;
            const showBlank = i < parts.length - 1;
            if (showBlank) blankIdx++;
            const sa = studentBlanks[cur] ?? "";
            const correct = isBlankCorrect(sa, cur);
            const blankCls = correct == null
              ? "bg-purple-100 border-purple-300 text-purple-800"
              : correct
                ? "bg-green-100 border-green-400 text-green-800"
                : "bg-red-100 border-red-400 text-red-800 line-through";
            return (
              <span key={i}>
                <span>{part}</span>
                {showBlank && (
                  <span className={cn("inline-flex items-center gap-1 mx-1 px-2.5 py-0.5 rounded-lg border-2 font-bold text-sm align-baseline", blankCls)}>
                    <span className="text-[10px] font-mono opacity-60">{cur + 1}.</span>
                    {sa || <span className="italic opacity-50">(trống)</span>}
                  </span>
                )}
              </span>
            );
          })}
        </div>
        {showCorrect && correctBlanks.some((ca, i) => (studentBlanks[i] ?? "").trim().toLowerCase() !== (ca ?? "").trim().toLowerCase()) && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-xs font-semibold text-green-700 mb-1.5">✅ Đáp án đúng cho từng ô</p>
            <div className="flex flex-wrap gap-1.5">
              {correctBlanks.map((b, i) => (
                <span key={i} className="px-2.5 py-1 bg-white border border-green-300 rounded-lg text-sm font-medium text-green-800">
                  <span className="text-[10px] font-mono text-green-500 mr-1">{i + 1}.</span>{b}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // No __BLANK__ tokens — single-line answer
  const sa = studentBlanks[0] ?? "";
  const correct = isBlankCorrect(sa, 0);
  return (
    <div className="space-y-2">
      <div className={cn("inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 font-medium",
        correct == null ? "bg-purple-50 border-purple-200 text-purple-900"
        : correct ? "bg-green-50 border-green-300 text-green-800"
        : "bg-red-50 border-red-300 text-red-800")}>
        <Type className="w-4 h-4 opacity-60" />
        {sa || <span className="italic opacity-60">(Bỏ trống)</span>}
      </div>
      {showCorrect && !correct && correctBlanks[0] && (
        <div className="text-xs text-green-700 flex items-center gap-2">
          <span className="font-semibold">Đáp án đúng:</span>
          <span className="px-2 py-0.5 bg-green-50 border border-green-300 rounded-lg font-medium">{correctBlanks[0]}</span>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────── Word Selection ─────────────────────────────
function WordSelectionReview({ studentAnswer, correctAnswer, questionContent, questionPassage }: {
  studentAnswer: string | null; correctAnswer: string | null; questionContent: string | null; questionPassage: string | null;
}) {
  const passage = (questionPassage ?? questionContent ?? "").trim();
  const words = passage.split(/\s+/).filter(Boolean);
  const studentSet = new Set(normalizeList(studentAnswer));
  const correctSet = new Set(normalizeList(correctAnswer));
  const showCorrect = correctAnswer != null;

  if (words.length === 0) {
    // fallback: show student picks as chips
    const picks = [...studentSet];
    return (
      <div className="flex flex-wrap gap-2">
        {picks.length === 0 && <span className="text-xs text-gray-400 italic">(Không chọn từ nào)</span>}
        {picks.map((w, i) => (
          <span key={i} className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-medium text-indigo-800">{w}</span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-indigo-600">
        <MousePointerClick className="w-3.5 h-3.5" />
        Các từ học sinh đã chọn
      </div>
      <div className="flex flex-wrap gap-1.5 p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl">
        {words.map((w, i) => {
          const picked = studentSet.has(w);
          const isCorrect = correctSet.has(w);
          let cls = "bg-white text-gray-500 border-gray-200";
          if (showCorrect) {
            if (picked && isCorrect) cls = "bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-600 shadow-sm";
            else if (picked && !isCorrect) cls = "bg-red-100 text-red-700 border-red-300 line-through";
            else if (!picked && isCorrect) cls = "bg-green-50 text-green-700 border-green-300 border-dashed";
          } else if (picked) {
            cls = "bg-gradient-to-br from-indigo-500 to-blue-600 text-white border-indigo-600";
          }
          return (
            <span key={i} className={cn("px-2 py-1 rounded-lg text-sm font-medium border-2 transition-colors", cls)}>
              {picked && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
              {w}
            </span>
          );
        })}
      </div>
      {showCorrect && (
        <div className="flex items-center gap-2 text-[11px] text-gray-500 px-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-gradient-to-br from-green-500 to-emerald-600" /> Đúng
          <span className="inline-block w-3 h-3 rounded-sm bg-red-200 border border-red-300 ml-2" /> Sai
          <span className="inline-block w-3 h-3 rounded-sm bg-green-50 border border-green-300 border-dashed ml-2" /> HS bỏ sót
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────── Matching ─────────────────────────────────
function MatchingReview({ studentAnswer, questionOptions, correctAnswer, canShowCorrect }: {
  studentAnswer: string | null; questionOptions: string | null; correctAnswer: string | null; canShowCorrect: boolean;
}) {
  // questionOptions = [{left, right}, ...] = correct pairings
  const pairs = safeJson<Array<{ left?: string; right?: string } | string>>(questionOptions, []).map(item => {
    if (typeof item === "object" && item !== null) {
      return { left: String((item as { left?: string }).left ?? ""), right: String((item as { right?: string }).right ?? "") };
    }
    const [l, r] = String(item).split("|").map(x => x.trim());
    return { left: l ?? String(item), right: r ?? "" };
  }).filter(p => p.left);

  // studentAnswer = { [left]: rightChosen } (modern format) OR array form (legacy)
  let studentMap: Record<string, string> = safeJson<Record<string, string>>(studentAnswer, {});
  if (Array.isArray(studentMap)) {
    const tmp: Record<string, string> = {};
    (studentMap as unknown as Array<{ left?: string; right?: string }>).forEach(p => {
      if (p?.left) tmp[String(p.left)] = String(p.right ?? "");
    });
    studentMap = tmp;
  }

  // correctAnswer can either be empty (use pairs as truth) OR a similar map
  const correctMapFromPairs: Record<string, string> = {};
  pairs.forEach(p => { correctMapFromPairs[p.left] = p.right; });
  const showCorrect = pairs.length > 0 && canShowCorrect;

  if (pairs.length === 0) {
    // No structure available — render raw map
    const entries = Object.entries(studentMap);
    if (entries.length === 0) return <p className="text-xs text-gray-400 italic">(Không nối cặp nào)</p>;
    return (
      <div className="space-y-1.5">
        {entries.map(([l, r], i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 font-medium flex-1 text-center">{l}</span>
            <span className="text-gray-400">↔</span>
            <span className="px-2.5 py-1 bg-pink-50 border border-pink-200 rounded-lg text-pink-800 font-medium flex-1 text-center">{r}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-orange-600">
        <Layers className="w-3.5 h-3.5" />
        Các cặp ghép của học sinh
      </div>
      {pairs.map((pair, i) => {
        const studentRight = studentMap[pair.left] ?? null;
        const correctRight = correctMapFromPairs[pair.left];
        const matched = studentRight != null && studentRight !== "";
        const isCorrect = matched && studentRight === correctRight;
        const isWrong = matched && !isCorrect;

        return (
          <div key={i} className="space-y-1">
            <div className={cn(
              "flex items-stretch gap-2 rounded-xl border-2 overflow-hidden",
              !matched ? "border-gray-200 bg-gray-50/60"
              : isCorrect ? "border-green-300 bg-green-50/50"
              : "border-red-300 bg-red-50/50"
            )}>
              <div className="flex items-center gap-2 px-3 py-2 flex-1 min-w-0">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="text-sm font-semibold text-gray-800 truncate">{pair.left}</span>
              </div>
              <div className={cn("flex items-center px-2 text-lg",
                !matched ? "text-gray-300" : isCorrect ? "text-green-500" : "text-red-500"
              )}>↔</div>
              <div className={cn("flex items-center gap-2 px-3 py-2 flex-1 min-w-0 border-l-2",
                !matched ? "border-gray-200 bg-white text-gray-400"
                : isCorrect ? "border-green-200 bg-white text-green-800"
                : "border-red-200 bg-white text-red-800"
              )}>
                <span className="text-sm font-semibold truncate flex-1">
                  {studentRight || <span className="italic text-gray-400">(chưa ghép)</span>}
                </span>
                {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                {isWrong && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
              </div>
            </div>
            {showCorrect && isWrong && correctRight && (
              <div className="ml-8 text-[11px] text-green-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>Đúng phải là:</span>
                <span className="px-1.5 py-0.5 bg-green-50 border border-green-300 rounded font-semibold">{correctRight}</span>
              </div>
            )}
            {showCorrect && !matched && correctRight && (
              <div className="ml-8 text-[11px] text-gray-500 flex items-center gap-1.5">
                <span>Đáp án:</span>
                <span className="px-1.5 py-0.5 bg-green-50 border border-green-200 rounded font-medium text-green-700">{correctRight}</span>
              </div>
            )}
          </div>
        );
      })}
      {/* Optionally use correctAnswer var to silence unused-var warnings, no-op */}
      {false && correctAnswer && null}
    </div>
  );
}

// ──────────────────────────────── Drag & Drop ─────────────────────────────
function DragDropReview({ studentAnswer, questionOptions, canShowCorrect }: {
  studentAnswer: string | null; questionOptions: string | null; canShowCorrect: boolean;
}) {
  const cfg = safeJson<{ items?: string[]; zones?: Array<{ label: string; accepts: string[] }> }>(questionOptions, {});
  const zones = Array.isArray(cfg.zones) ? cfg.zones : [];
  const studentMap = safeJson<Record<string, string[]>>(studentAnswer, {});
  const showCorrect = zones.length > 0 && canShowCorrect && zones.some(z => (z.accepts ?? []).length > 0);

  // Resolve each zone's correct items
  const correctOf: Record<string, Set<string>> = {};
  zones.forEach(z => { correctOf[z.label] = new Set(z.accepts ?? []); });

  // For unknown structures: just render raw zones
  if (!showCorrect) {
    const entries = Object.entries(studentMap);
    if (entries.length === 0) return <p className="text-xs text-gray-400 italic">(Không sắp xếp gì)</p>;
    return (
      <div className="space-y-2">
        {entries.map(([z, items], i) => (
          <div key={i} className="rounded-xl border border-violet-100 bg-violet-50/40 p-2.5">
            <p className="text-xs font-semibold text-violet-700 mb-1.5">{z}</p>
            <div className="flex flex-wrap gap-1.5">
              {(Array.isArray(items) ? items : []).map((it, j) => (
                <span key={j} className="px-2 py-0.5 bg-white border border-violet-200 rounded text-sm text-violet-800 font-medium">{String(it)}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const ZONE_COLORS = [
    { border: "border-pink-300", bg: "bg-pink-50/50", header: "text-pink-700", chip: "border-pink-300 text-pink-800 bg-pink-50" },
    { border: "border-violet-300", bg: "bg-violet-50/50", header: "text-violet-700", chip: "border-violet-300 text-violet-800 bg-violet-50" },
    { border: "border-cyan-300", bg: "bg-cyan-50/50", header: "text-cyan-700", chip: "border-cyan-300 text-cyan-800 bg-cyan-50" },
    { border: "border-amber-300", bg: "bg-amber-50/50", header: "text-amber-700", chip: "border-amber-300 text-amber-800 bg-amber-50" },
    { border: "border-emerald-300", bg: "bg-emerald-50/50", header: "text-emerald-700", chip: "border-emerald-300 text-emerald-800 bg-emerald-50" },
  ];

  return (
    <div className="space-y-3">
      <div className={cn("gap-3", zones.length > 1 ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col")}>
        {zones.map((zone, zi) => {
          const col = ZONE_COLORS[zi % ZONE_COLORS.length]!;
          const placed = studentMap[zone.label] ?? [];
          const correctSet = correctOf[zone.label] ?? new Set<string>();
          const missed = [...correctSet].filter(it => !placed.includes(it));
          return (
            <div key={zone.label} className={cn("rounded-2xl border-2 p-3", col.border, col.bg)}>
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-2", col.header)}>{zone.label}</p>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {placed.length === 0 && <span className="text-xs text-gray-400 italic">(Trống)</span>}
                {placed.map((it, ii) => {
                  const ok = correctSet.has(it);
                  return (
                    <span key={ii} className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold border-2",
                      ok ? "bg-green-100 border-green-400 text-green-800" : "bg-red-100 border-red-400 text-red-800 line-through"
                    )}>
                      <GripVertical className="w-3 h-3 opacity-50" />
                      {it}
                      {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />}
                    </span>
                  );
                })}
              </div>
              {missed.length > 0 && (
                <div className="mt-2 pt-2 border-t border-dashed border-current/20">
                  <p className="text-[10px] font-semibold uppercase opacity-60 mb-1">Còn thiếu</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missed.map((it, mi) => (
                      <span key={mi} className={cn("px-2 py-0.5 rounded text-xs font-medium border border-dashed", col.chip)}>
                        {it}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────── Sentence Reorder ────────────────────────────
function SentenceReorderReview({ studentAnswer, questionOptions, correctAnswer, canShowCorrect }: {
  studentAnswer: string | null; questionOptions: string | null; correctAnswer: string | null; canShowCorrect: boolean;
}) {
  const correctOrder: string[] = (() => {
    if (correctAnswer) {
      const a = safeJson<unknown>(correctAnswer, null);
      if (Array.isArray(a)) return a.map(String);
    }
    const opts = safeJson<unknown[]>(questionOptions, []);
    return Array.isArray(opts) ? opts.map(String) : [];
  })();
  const studentOrder: string[] = (() => {
    if (!studentAnswer) return [];
    const a = safeJson<unknown>(studentAnswer, null);
    if (Array.isArray(a)) return a.map(String);
    return [studentAnswer];
  })();
  const showCorrect = correctOrder.length > 0 && canShowCorrect;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Học sinh xếp</p>
        <div className="flex flex-wrap gap-1.5 p-3 border-2 border-indigo-200 bg-white rounded-xl min-h-[44px]">
          {studentOrder.length === 0 && <span className="text-xs text-gray-400 italic">(Bỏ trống)</span>}
          {studentOrder.map((w, i) => {
            const ok = showCorrect && correctOrder[i] === w;
            const isWrongSlot = showCorrect && correctOrder[i] != null && correctOrder[i] !== w;
            const cls = !showCorrect ? "bg-indigo-50 border-indigo-300 text-indigo-800"
              : ok ? "bg-green-100 border-green-400 text-green-800"
              : isWrongSlot ? "bg-red-100 border-red-400 text-red-800"
              : "bg-gray-50 border-gray-300 text-gray-700";
            return (
              <span key={i} className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold border-2", cls)}>
                <span className="text-[10px] font-mono opacity-50">{i + 1}.</span>
                {w}
                {showCorrect && ok && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                {showCorrect && isWrongSlot && <XCircle className="w-3.5 h-3.5 text-red-600" />}
              </span>
            );
          })}
        </div>
      </div>
      {showCorrect && JSON.stringify(studentOrder) !== JSON.stringify(correctOrder) && (
        <div>
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Thứ tự đúng
          </p>
          <div className="flex flex-wrap gap-1.5 p-3 border-2 border-green-300 bg-green-50/50 rounded-xl">
            {correctOrder.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold border-2 bg-white border-green-300 text-green-800">
                <span className="text-[10px] font-mono opacity-50">{i + 1}.</span>
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────── Reading / Listening sub-questions ───────────────────
function ReadingListeningReview({ studentAnswer, questionOptions, canShowCorrect }: {
  studentAnswer: string | null; questionOptions: string | null; canShowCorrect: boolean;
}) {
  type SubQ = { question: string; options?: string[]; choices?: string[]; correctAnswer?: string; points?: number };
  const subs = safeJson<SubQ[]>(questionOptions, []);
  const studentArr = safeJson<unknown>(studentAnswer, null);
  // Student answer may be array or {idx: ans}
  const studentAt = (i: number): string | null => {
    if (Array.isArray(studentArr)) return studentArr[i] != null ? String(studentArr[i]) : null;
    if (studentArr && typeof studentArr === "object") {
      const obj = studentArr as Record<string, unknown>;
      const v = obj[String(i)] ?? obj[i];
      return v != null ? String(v) : null;
    }
    return null;
  };

  if (subs.length === 0) return <span className="text-gray-500 italic text-sm">(Chưa có câu hỏi con)</span>;

  return (
    <div className="space-y-2">
      {subs.map((sq, i) => {
        const sa = studentAt(i);
        const ca = canShowCorrect ? (sq.correctAnswer ?? null) : null;
        const opts = sq.options ?? sq.choices ?? [];
        const isCorrect = sa != null && ca != null && sa.trim().toLowerCase() === ca.trim().toLowerCase();
        const wrong = sa != null && !isCorrect && ca != null;

        return (
          <div key={i} className={cn("rounded-xl border-2 p-3",
            !sa ? "border-gray-200 bg-gray-50/40"
            : isCorrect ? "border-green-200 bg-green-50/50"
            : "border-red-200 bg-red-50/50")}>
            <div className="flex items-start gap-2 mb-2">
              <span className={cn("shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                isCorrect ? "bg-green-500 text-white" : sa ? "bg-red-500 text-white" : "bg-gray-300 text-gray-600")}>
                {i + 1}
              </span>
              <p className="text-sm text-gray-800 leading-relaxed flex-1">{sq.question}</p>
            </div>

            {opts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-8">
                {opts.map((opt, oi) => {
                  const lbl = LABELS[oi] ?? String(oi);
                  const isStudent = sa === opt || sa === lbl;
                  const isCorrectOpt = ca != null && (ca === opt || ca === lbl);
                  let cls = "text-gray-600 bg-white border-gray-200";
                  if (isStudent && isCorrectOpt) cls = "bg-green-100 border-green-400 text-green-800 font-semibold";
                  else if (isStudent) cls = "bg-red-100 border-red-400 text-red-800";
                  else if (isCorrectOpt) cls = "bg-green-50 border-green-300 text-green-700 border-dashed";
                  return (
                    <div key={oi} className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border-2", cls)}>
                      <span className="font-mono w-4 shrink-0">{lbl}.</span>
                      <span className="truncate flex-1">{opt}</span>
                      {isStudent && !isCorrectOpt && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      {isCorrectOpt && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ml-8 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Trả lời:</span>
                {sa ? (
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium border",
                    isCorrect ? "bg-green-100 text-green-800 border-green-300" : "bg-red-100 text-red-800 border-red-300")}>
                    {sa}
                  </span>
                ) : (
                  <span className="text-gray-400 italic text-xs">(Bỏ trống)</span>
                )}
                {wrong && (
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

// ──────────────────────────────── Open End ─────────────────────────────────
function OpenEndReview({ studentAnswer }: { studentAnswer: string | null }) {
  if (!studentAnswer) return <span className="text-gray-400 italic text-sm">(Bỏ trống)</span>;
  let parsed: any = null;
  try { parsed = JSON.parse(studentAnswer); } catch {}
  if (!parsed) return <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{studentAnswer}</p>;

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
                <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full",
                  sttConf >= 0.8 ? "bg-green-100 text-green-700" : sttConf >= 0.5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
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

// ──────────────────────────────── Essay (read-only) ─────────────────────────
function EssayReview({ studentAnswer }: { studentAnswer: string | null }) {
  if (!studentAnswer) return <span className="text-gray-400 italic text-sm">(Bỏ trống)</span>;
  return <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{studentAnswer}</p>;
}

// ──────────────────────────────── Public API ──────────────────────────────
export interface AnswerLike {
  questionType: string | null;
  questionContent: string | null;
  questionPassage: string | null;
  questionOptions: string | null;
  answer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean | null;
}

/**
 * Read-only review of a single submitted answer, rendered with the same
 * visual idiom as assignment-take. Includes overlays of student vs correct.
 */
export function SubmissionAnswerView({ answer, canShowCorrect = true }: { answer: AnswerLike; canShowCorrect?: boolean }) {
  const t = answer.questionType ?? "";
  const ca = canShowCorrect ? answer.correctAnswer : null;
  switch (t) {
    case "mcq":
      return <McqReview studentAnswer={answer.answer} correctAnswer={ca} questionOptions={answer.questionOptions} />;
    case "true_false":
      return <TrueFalseReview studentAnswer={answer.answer} correctAnswer={ca} />;
    case "fill_blank":
      return <FillBlankReview studentAnswer={answer.answer} correctAnswer={ca} questionContent={answer.questionContent} />;
    case "word_selection":
      return <WordSelectionReview studentAnswer={answer.answer} correctAnswer={ca} questionContent={answer.questionContent} questionPassage={answer.questionPassage} />;
    case "matching":
      return <MatchingReview studentAnswer={answer.answer} questionOptions={answer.questionOptions} correctAnswer={ca} canShowCorrect={canShowCorrect} />;
    case "drag_drop":
      return <DragDropReview studentAnswer={answer.answer} questionOptions={answer.questionOptions} canShowCorrect={canShowCorrect} />;
    case "sentence_reorder":
      return <SentenceReorderReview studentAnswer={answer.answer} questionOptions={answer.questionOptions} correctAnswer={ca} canShowCorrect={canShowCorrect} />;
    case "reading":
    case "listening":
      return <ReadingListeningReview studentAnswer={answer.answer} questionOptions={answer.questionOptions} canShowCorrect={canShowCorrect} />;
    case "open_end":
      return <OpenEndReview studentAnswer={answer.answer} />;
    case "essay":
      return <EssayReview studentAnswer={answer.answer} />;
    default:
      return <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{answer.answer ?? <span className="text-gray-400 italic">(Bỏ trống)</span>}</p>;
  }
}
