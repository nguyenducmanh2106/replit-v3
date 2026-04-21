import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Highlighter,
  Eraser,
  StickyNote,
  ZoomIn,
  ZoomOut,
  AlignJustify,
  Focus,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface Highlight {
  id: string;
  start: number;
  end: number;
  color: string;
  note?: string;
}

interface Props {
  passage: string;
  storageKey?: string;
  className?: string;
}

const COLORS: { id: string; name: string; bg: string; text: string }[] = [
  { id: "yellow", name: "Vàng", bg: "bg-yellow-200", text: "text-yellow-900" },
  { id: "green", name: "Xanh", bg: "bg-green-200", text: "text-green-900" },
  { id: "pink", name: "Hồng", bg: "bg-pink-200", text: "text-pink-900" },
  { id: "blue", name: "Xanh dương", bg: "bg-blue-200", text: "text-blue-900" },
];

const FONT_SIZES = [
  { id: "sm", label: "Nhỏ", cls: "text-sm leading-7" },
  { id: "md", label: "Vừa", cls: "text-base leading-8" },
  { id: "lg", label: "Lớn", cls: "text-lg leading-9" },
  { id: "xl", label: "Rất lớn", cls: "text-xl leading-10" },
];

export function ReadingPassageViewer({ passage, storageKey, className }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [activeColor, setActiveColor] = useState<string>("yellow");
  const [fontSizeIdx, setFontSizeIdx] = useState(1);
  const [relaxed, setRelaxed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [hoveredPara, setHoveredPara] = useState<number | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [noteText, setNoteText] = useState("");
  const passageRef = useRef<HTMLDivElement>(null);
  const fullKey = storageKey ? `reading-hl:${storageKey}` : null;

  // Load from localStorage (or reset to defaults when key changes and no saved data exists)
  useEffect(() => {
    if (!fullKey) {
      setHighlights([]);
      setFontSizeIdx(1);
      setRelaxed(false);
      return;
    }
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const data = JSON.parse(raw);
        setHighlights(Array.isArray(data.highlights) ? data.highlights : []);
        setFontSizeIdx(typeof data.fontSizeIdx === "number" ? data.fontSizeIdx : 1);
        setRelaxed(typeof data.relaxed === "boolean" ? data.relaxed : false);
      } else {
        setHighlights([]);
        setFontSizeIdx(1);
        setRelaxed(false);
      }
    } catch {
      setHighlights([]);
      setFontSizeIdx(1);
      setRelaxed(false);
    }
  }, [fullKey]);

  // Persist
  useEffect(() => {
    if (!fullKey) return;
    try {
      localStorage.setItem(fullKey, JSON.stringify({ highlights, fontSizeIdx, relaxed }));
    } catch { /* ignore */ }
  }, [fullKey, highlights, fontSizeIdx, relaxed]);

  // Compute selection offsets within passage text
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const root = passageRef.current;
    if (!root) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;

    const offsetOf = (node: Node, offset: number): number => {
      let total = 0;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n: Node | null = walker.nextNode();
      while (n) {
        if (n === node) return total + offset;
        total += (n.nodeValue ?? "").length;
        n = walker.nextNode();
      }
      return total;
    };

    const start = offsetOf(range.startContainer, range.startOffset);
    const end = offsetOf(range.endContainer, range.endOffset);
    if (start === end || start < 0 || end > passage.length) {
      sel.removeAllRanges();
      return;
    }
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);

    setHighlights((prev) => {
      // Merge / replace overlapping highlights
      const filtered = prev.filter((h) => h.end <= lo || h.start >= hi);
      const newHl: Highlight = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        start: lo,
        end: hi,
        color: activeColor,
      };
      return [...filtered, newHl].sort((a, b) => a.start - b.start);
    });
    sel.removeAllRanges();
  }, [activeColor, passage.length]);

  const removeHighlight = (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    setEditingHighlight(null);
  };

  const clearAll = () => {
    if (highlights.length === 0) return;
    if (window.confirm("Xoá tất cả highlight và ghi chú?")) setHighlights([]);
  };

  const openNote = (h: Highlight) => {
    setEditingHighlight(h);
    setNoteText(h.note ?? "");
  };

  const saveNote = () => {
    if (!editingHighlight) return;
    setHighlights((prev) => prev.map((h) => h.id === editingHighlight.id ? { ...h, note: noteText.trim() || undefined } : h));
    setEditingHighlight(null);
  };

  // Render passage with highlight overlays
  const segments = useMemo(() => {
    type Seg = { text: string; hl?: Highlight };
    const out: Seg[] = [];
    let cursor = 0;
    const sorted = [...highlights].sort((a, b) => a.start - b.start);
    for (const h of sorted) {
      if (h.start > cursor) out.push({ text: passage.slice(cursor, h.start) });
      out.push({ text: passage.slice(h.start, h.end), hl: h });
      cursor = h.end;
    }
    if (cursor < passage.length) out.push({ text: passage.slice(cursor) });
    return out;
  }, [passage, highlights]);

  // Split into paragraphs for focus mode
  const paragraphs = useMemo(() => passage.split(/\n\n+/), [passage]);

  const fontCls = FONT_SIZES[fontSizeIdx]?.cls ?? FONT_SIZES[1].cls;
  const spacingCls = relaxed ? "tracking-wide [&>p]:mb-5" : "[&>p]:mb-3";

  return (
    <div className={cn("rounded-xl border border-emerald-200 bg-white overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap border-b border-emerald-100 bg-emerald-50/50 px-3 py-2">
        <div className="flex items-center gap-1 mr-2">
          <Highlighter className="h-3.5 w-3.5 text-emerald-700" />
          <span className="text-xs font-medium text-emerald-800">Highlight:</span>
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveColor(c.id)}
              title={c.name}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-transform",
                c.bg,
                activeColor === c.id ? "border-gray-700 scale-110" : "border-transparent",
              )}
              aria-label={`Màu ${c.name}`}
            />
          ))}
        </div>
        <Sep />
        <ToolBtn label="Cỡ chữ nhỏ hơn" onClick={() => setFontSizeIdx(Math.max(0, fontSizeIdx - 1))} disabled={fontSizeIdx === 0}>
          <ZoomOut className="h-3.5 w-3.5" />
        </ToolBtn>
        <span className="text-[10px] text-gray-500 tabular-nums w-6 text-center">{FONT_SIZES[fontSizeIdx].label}</span>
        <ToolBtn label="Cỡ chữ lớn hơn" onClick={() => setFontSizeIdx(Math.min(FONT_SIZES.length - 1, fontSizeIdx + 1))} disabled={fontSizeIdx === FONT_SIZES.length - 1}>
          <ZoomIn className="h-3.5 w-3.5" />
        </ToolBtn>
        <Sep />
        <ToolBtn label={relaxed ? "Giãn dòng tiêu chuẩn" : "Giãn dòng rộng"} onClick={() => setRelaxed((v) => !v)} active={relaxed}>
          <AlignJustify className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label={focusMode ? "Tắt chế độ tập trung" : "Bật chế độ tập trung"} onClick={() => setFocusMode((v) => !v)} active={focusMode}>
          <Focus className="h-3.5 w-3.5" />
        </ToolBtn>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-gray-500">{highlights.length} highlight</span>
          <ToolBtn label="Xoá tất cả" onClick={clearAll} disabled={highlights.length === 0}>
            <RotateCcw className="h-3.5 w-3.5" />
          </ToolBtn>
        </div>
      </div>

      {/* Passage */}
      <div
        ref={passageRef}
        onMouseUp={handleMouseUp}
        className={cn("p-5 font-serif text-gray-900 select-text", fontCls, spacingCls)}
      >
        {focusMode ? (
          <FocusModeRender
            paragraphs={paragraphs}
            segments={segments}
            hoveredPara={hoveredPara}
            setHoveredPara={setHoveredPara}
            onHighlightClick={openNote}
          />
        ) : (
          <p>
            {segments.map((seg, i) => seg.hl ? (
              <HighlightSpan key={i} hl={seg.hl} text={seg.text} onClick={() => openNote(seg.hl!)} />
            ) : (
              <span key={i}>{seg.text}</span>
            ))}
          </p>
        )}
      </div>

      {/* Notes list */}
      {highlights.some((h) => h.note) && (
        <div className="border-t border-emerald-100 bg-emerald-50/30 px-4 py-3">
          <div className="flex items-center gap-1 mb-2">
            <StickyNote className="h-3.5 w-3.5 text-emerald-700" />
            <h4 className="text-xs font-bold text-emerald-800">Ghi chú của bạn</h4>
          </div>
          <ul className="space-y-2">
            {highlights.filter((h) => h.note).map((h) => (
              <li key={h.id} className="text-xs flex items-start gap-2">
                <span className={cn("inline-block px-1.5 py-0.5 rounded text-[11px] flex-shrink-0", colorClass(h.color))}>
                  {passage.slice(h.start, h.end).slice(0, 40)}
                  {h.end - h.start > 40 ? "…" : ""}
                </span>
                <span className="text-gray-700 italic">— {h.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Note editor modal (inline) */}
      {editingHighlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingHighlight(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Ghi chú cho đoạn highlight</h3>
              <button onClick={() => setEditingHighlight(null)} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className={cn("p-2 rounded text-sm", colorClass(editingHighlight.color))}>
              "{passage.slice(editingHighlight.start, editingHighlight.end)}"
            </div>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Viết ghi chú của bạn..."
              rows={3}
              autoFocus
            />
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeHighlight(editingHighlight.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Eraser className="h-3.5 w-3.5 mr-1" /> Xoá highlight
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingHighlight(null)}>Huỷ</Button>
                <Button size="sm" onClick={saveNote}>Lưu</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function colorClass(id: string): string {
  const c = COLORS.find((x) => x.id === id) ?? COLORS[0];
  return `${c.bg} ${c.text}`;
}

function HighlightSpan({ hl, text, onClick }: { hl: Highlight; text: string; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      className={cn("rounded px-0.5 cursor-pointer", colorClass(hl.color), hl.note && "underline decoration-dotted decoration-2 underline-offset-4")}
      title={hl.note ?? "Bấm để thêm ghi chú"}
    >
      {text}
    </span>
  );
}

function FocusModeRender({
  paragraphs,
  segments,
  hoveredPara,
  setHoveredPara,
  onHighlightClick,
}: {
  paragraphs: string[];
  segments: { text: string; hl?: Highlight }[];
  hoveredPara: number | null;
  setHoveredPara: (n: number | null) => void;
  onHighlightClick: (h: Highlight) => void;
}) {
  // Map segments back to paragraphs by character offsets
  // Simpler: render each paragraph separately, no highlight in focus mode for simplicity
  // Better: show highlights but dim paragraphs not hovered
  const _ = segments; // unused in this simple focus mode
  return (
    <>
      {paragraphs.map((para, i) => (
        <p
          key={i}
          onMouseEnter={() => setHoveredPara(i)}
          onMouseLeave={() => setHoveredPara(null)}
          className={cn(
            "transition-opacity duration-200",
            hoveredPara !== null && hoveredPara !== i ? "opacity-30" : "opacity-100",
          )}
        >
          {para}
        </p>
      ))}
    </>
  );
}

function ToolBtn({
  children,
  onClick,
  label,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded text-emerald-700 hover:bg-emerald-100 disabled:opacity-30 disabled:hover:bg-transparent",
        active && "bg-emerald-200 text-emerald-900",
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-4 w-px bg-emerald-200" />;
}
