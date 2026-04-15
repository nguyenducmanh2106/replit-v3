import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import {
  useCreateQuestion, useUpdateQuestion,
  getListQuestionsQueryKey, getGetQuestionQueryKey, getQuestion,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Save, Plus, Trash2, CheckCircle2, Circle, GripVertical,
  ChevronUp, ChevronDown, Play, Pause, Volume2, Video as VideoIcon,
  BookOpen, Headphones, Clock, Info, AlertCircle, X, RotateCcw,
  MessageSquare, HelpCircle, StickyNote,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────

const SKILLS = ["reading", "writing", "listening", "speaking"] as const;
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const SKILL_LABELS: Record<string, string> = { reading: "Đọc", writing: "Viết", listening: "Nghe", speaking: "Nói" };

const QUESTION_TYPES = [
  { value: "mcq", label: "Trắc nghiệm", icon: "🔤", desc: "Nhiều lựa chọn, 1 đáp án" },
  { value: "true_false", label: "Đúng/Sai", icon: "✓✗", desc: "Xác định đúng hay sai" },
  { value: "fill_blank", label: "Điền vào chỗ trống", icon: "___", desc: "Điền từ vào chỗ trống" },
  { value: "word_selection", label: "Chọn từ", icon: "Aa", desc: "Click chọn từ trong đoạn" },
  { value: "matching", label: "Nối cặp", icon: "↔", desc: "Ghép đôi hai cột" },
  { value: "drag_drop", label: "Kéo thả", icon: "⇅", desc: "Kéo thả vào vùng đúng" },
  { value: "sentence_reorder", label: "Sắp xếp câu", icon: "↕", desc: "Sắp xếp lại thứ tự" },
  { value: "reading", label: "Đọc hiểu", icon: "📖", desc: "Bài đọc + câu hỏi" },
  { value: "listening", label: "Nghe hiểu", icon: "🎧", desc: "Audio + câu hỏi" },
  { value: "video_interactive", label: "Video tương tác", icon: "🎬", desc: "Video + câu hỏi theo mốc" },
  { value: "essay", label: "Bài luận", icon: "✍️", desc: "Viết tự do" },
  { value: "open_end", label: "Câu hỏi mở", icon: "💬", desc: "Trả lời bằng text, audio, hoặc hình ảnh" },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface McqOption { text: string; isCorrect: boolean; }
interface MatchingPair { left: string; right: string; }
interface DragZone { label: string; accepts: string[]; }
interface SubQuestion { question: string; choices: string[]; correctAnswer: string; points?: number; }
interface VideoQuestion { timestamp: number; type?: "note" | "question"; content?: string; question: string; choices: string[]; correctAnswer: string; points?: number; }

// ─── Helper ──────────────────────────────────────────────────────────────────

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function newSubQuestion(): SubQuestion {
  return { question: "", choices: ["", "", "", ""], correctAnswer: "" };
}
function newVideoQuestion(type: "note" | "question" = "question", timestamp = 0): VideoQuestion {
  return { timestamp, type, content: "", question: "", choices: ["", "", "", ""], correctAnswer: "", points: 10 };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SubQuestionBuilder({
  items, onChange,
}: { items: SubQuestion[]; onChange: (v: SubQuestion[]) => void }) {
  function update(i: number, patch: Partial<SubQuestion>) {
    const next = items.map((q, idx) => idx === i ? { ...q, ...patch } : q);
    onChange(next);
  }
  function updateChoice(qi: number, ci: number, val: string) {
    const next = items.map((q, idx) => idx === qi
      ? { ...q, choices: (q.choices ?? []).map((c, cIdx) => cIdx === ci ? val : c) }
      : q);
    onChange(next);
  }
  function addChoice(qi: number) {
    const next = items.map((q, idx) => idx === qi ? { ...q, choices: [...(q.choices ?? []), ""] } : q);
    onChange(next);
  }
  function removeChoice(qi: number, ci: number) {
    const next = items.map((q, idx) => idx === qi
      ? { ...q, choices: (q.choices ?? []).filter((_, cIdx) => cIdx !== ci) }
      : q);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {items.map((sq, qi) => (
        <div key={qi} className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Câu hỏi {qi + 1}</span>
            <button type="button" onClick={() => onChange(items.filter((_, i) => i !== qi))}
              className="text-red-400 hover:text-red-600 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <Textarea
            value={sq.question}
            onChange={e => update(qi, { question: e.target.value })}
            placeholder="Nhập nội dung câu hỏi..."
            rows={2}
            className="text-sm"
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">Các lựa chọn (click vòng tròn để đánh dấu đúng)</p>
            {(sq.choices ?? []).map((ch, ci) => (
              <div key={ci} className="flex items-center gap-2">
                <button type="button" onClick={() => update(qi, { correctAnswer: ch })}
                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    sq.correctAnswer === ch ? "border-green-500 bg-green-500" : "border-gray-300 hover:border-green-400"
                  }`}>
                  {sq.correctAnswer === ch && <div className="w-2 h-2 rounded-full bg-white" />}
                </button>
                <span className="text-xs font-bold text-gray-400 w-5">{String.fromCharCode(65 + ci)}.</span>
                <Input value={ch} onChange={e => updateChoice(qi, ci, e.target.value)}
                  placeholder={`Lựa chọn ${String.fromCharCode(65 + ci)}`} className="flex-1 h-8 text-sm" />
                {(sq.choices ?? []).length > 2 && (
                  <button type="button" onClick={() => removeChoice(qi, ci)} className="text-gray-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => addChoice(qi)} className="h-7 text-xs text-blue-600">
              <Plus className="w-3 h-3 mr-1" /> Thêm lựa chọn
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, newSubQuestion()])}
        className="w-full border-dashed">
        <Plus className="w-4 h-4 mr-2" /> Thêm câu hỏi
      </Button>
    </div>
  );
}

// ─── Per-type form sections ───────────────────────────────────────────────────

function McqForm({ content, setContent, options, setOptions, allowMultiple, setAllowMultiple, explanation, setExplanation }:
  { content: string; setContent: (v: string) => void; options: McqOption[]; setOptions: (v: McqOption[]) => void;
    allowMultiple: boolean; setAllowMultiple: (v: boolean) => void; explanation: string; setExplanation: (v: string) => void }) {

  function updateOption(i: number, patch: Partial<McqOption>) {
    setOptions(options.map((o, idx) => idx === i ? { ...o, ...patch } : o));
  }
  function toggleCorrect(i: number) {
    if (!allowMultiple) {
      setOptions(options.map((o, idx) => ({ ...o, isCorrect: idx === i })));
    } else {
      updateOption(i, { isCorrect: !options[i].isCorrect });
    }
  }
  function addOption() {
    setOptions([...options, { text: "", isCorrect: false }]);
  }
  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  }

  const letters = "ABCDEFGHIJ";

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Nội dung câu hỏi *</Label>
        <Textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="Nhập nội dung câu hỏi..." rows={3} className="text-sm" />
      </div>

      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
        <Switch checked={allowMultiple} onCheckedChange={setAllowMultiple} id="allow-multiple" />
        <Label htmlFor="allow-multiple" className="text-sm font-medium text-blue-800 cursor-pointer">
          Cho phép nhiều đáp án
        </Label>
        <span className="text-xs text-blue-600 ml-auto">{allowMultiple ? "Chọn nhiều đáp án đúng" : "Chỉ 1 đáp án đúng"}</span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold text-gray-700">
            Các lựa chọn
            <span className="ml-2 text-xs font-normal text-gray-400">Click vòng tròn để đánh dấu đáp án đúng</span>
          </Label>
          <span className="text-xs text-green-600 font-medium">
            {options.filter(o => o.isCorrect).length} đáp án đúng
          </span>
        </div>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
              opt.isCorrect ? "border-green-300 bg-green-50" : "border-gray-200 bg-white hover:border-gray-300"
            }`}>
              <button type="button" onClick={() => toggleCorrect(i)}
                className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  opt.isCorrect ? "border-green-500 bg-green-500 text-white" : "border-gray-300 hover:border-green-400 hover:bg-green-50"
                }`}>
                {opt.isCorrect
                  ? allowMultiple ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  : <Circle className="w-3.5 h-3.5 text-gray-300" />}
              </button>
              <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                opt.isCorrect ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500"
              }`}>{letters[i]}</span>
              <Input value={opt.text} onChange={e => updateOption(i, { text: e.target.value })}
                placeholder={`Lựa chọn ${letters[i]}`} className="flex-1 border-0 shadow-none p-0 h-auto text-sm focus-visible:ring-0 bg-transparent" />
              <button type="button" onClick={() => removeOption(i)} disabled={options.length <= 2}
                className="text-gray-300 hover:text-red-400 disabled:opacity-30 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addOption}
          className="mt-2 w-full border-dashed text-blue-600 border-blue-300 hover:bg-blue-50">
          <Plus className="w-4 h-4 mr-1" /> Thêm lựa chọn
        </Button>
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)}
          placeholder="Giải thích tại sao đây là đáp án đúng..." rows={2} className="text-sm" />
      </div>
    </div>
  );
}

function TrueFalseForm({ content, setContent, correctAnswer, setCorrectAnswer, explanation, setExplanation }:
  { content: string; setContent: (v: string) => void; correctAnswer: string; setCorrectAnswer: (v: string) => void;
    explanation: string; setExplanation: (v: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Nhận định *</Label>
        <Textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="Nhập nhận định cần đánh giá đúng/sai..." rows={3} className="text-sm" />
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-2">Đáp án đúng *</Label>
        <div className="grid grid-cols-2 gap-3">
          {[{ value: "Đúng", label: "✓ Đúng", color: "green" }, { value: "Sai", label: "✗ Sai", color: "red" }].map(({ value, label, color }) => (
            <button key={value} type="button" onClick={() => setCorrectAnswer(value)}
              className={`py-5 rounded-2xl border-2 text-lg font-bold transition-all ${
                correctAnswer === value
                  ? color === "green"
                    ? "border-green-400 bg-green-500 text-white shadow-md scale-105"
                    : "border-red-400 bg-red-500 text-white shadow-md scale-105"
                  : color === "green"
                    ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)}
          placeholder="Giải thích tại sao nhận định này đúng/sai..." rows={3} className="text-sm" />
      </div>
    </div>
  );
}

function FillBlankForm({ content, setContent, blanksAnswers, setBlanksAnswers, explanation, setExplanation }:
  { content: string; setContent: (v: string) => void; blanksAnswers: string[]; setBlanksAnswers: (v: string[]) => void;
    explanation: string; setExplanation: (v: string) => void }) {

  const blanks = (content.match(/__BLANK__/g) || []).length;
  useEffect(() => {
    if (blanks !== blanksAnswers.length) {
      const next = Array.from({ length: blanks }, (_, i) => blanksAnswers[i] ?? "");
      setBlanksAnswers(next);
    }
  }, [blanks]);

  const preview = content.split("__BLANK__").map((part, i, arr) => (
    <span key={i}>
      <span className="text-gray-800">{part}</span>
      {i < arr.length - 1 && (
        <span className="inline-block mx-1 px-3 py-0.5 border-b-2 border-purple-400 bg-purple-50 text-purple-600 text-sm font-medium rounded-t min-w-[60px] text-center">
          [{i + 1}]
        </span>
      )}
    </span>
  ));

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1">Soạn văn bản *</Label>
        <p className="text-xs text-purple-600 mb-1.5 flex items-center gap-1">
          <Info className="w-3.5 h-3.5" />
          Gõ <code className="bg-purple-100 px-1 rounded font-mono">__BLANK__</code> để tạo chỗ trống
        </p>
        <Textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="VD: The cat __BLANK__ on the mat and the dog __BLANK__ outside."
          rows={4} className="text-sm font-mono" />
      </div>

      {blanks > 0 && (
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-xs font-medium text-gray-500 mb-2">Xem trước:</p>
          <p className="text-sm leading-relaxed">{preview}</p>
        </div>
      )}

      {blanks > 0 ? (
        <div>
          <Label className="text-sm font-semibold text-gray-700 block mb-2">
            Đáp án cho {blanks} chỗ trống
          </Label>
          <div className="space-y-2">
            {Array.from({ length: blanks }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-sm font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <Input value={blanksAnswers[i] ?? ""}
                  onChange={e => {
                    const next = [...blanksAnswers];
                    next[i] = e.target.value;
                    setBlanksAnswers(next);
                  }}
                  placeholder={`Đáp án chỗ trống ${i + 1}`}
                  className="flex-1 text-sm border-purple-200 focus-visible:ring-purple-400" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-center text-sm text-purple-600">
          Chưa có chỗ trống. Hãy gõ <code className="font-mono bg-purple-100 px-1 rounded">__BLANK__</code> vào văn bản.
        </div>
      )}

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className="text-sm" />
      </div>
    </div>
  );
}

function WordSelectionForm({ instruction, setInstruction, passage, setPassage, selectedWords, setSelectedWords, explanation, setExplanation }:
  { instruction: string; setInstruction: (v: string) => void; passage: string; setPassage: (v: string) => void;
    selectedWords: string[]; setSelectedWords: (v: string[]) => void; explanation: string; setExplanation: (v: string) => void }) {

  const words = passage.trim() ? passage.trim().split(/\s+/) : [];
  const uniqueWords = [...new Set(words)];

  function toggleWord(w: string) {
    setSelectedWords(selectedWords.includes(w)
      ? selectedWords.filter(s => s !== w)
      : [...selectedWords, w]);
  }

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Câu lệnh / Yêu cầu *</Label>
        <Input value={instruction} onChange={e => setInstruction(e.target.value)}
          placeholder="VD: Chọn các từ sai chính tả trong đoạn văn sau" className="text-sm" />
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Nhập đoạn văn *</Label>
        <Textarea value={passage} onChange={e => { setPassage(e.target.value); setSelectedWords([]); }}
          placeholder="Nhập đoạn văn để học sinh click chọn từ..." rows={4} className="text-sm" />
      </div>

      {words.length > 0 && (
        <div>
          <Label className="text-sm font-semibold text-gray-700 block mb-2">
            Click trực tiếp vào từ để đánh dấu đáp án đúng
          </Label>
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 leading-loose">
            {passage.trim().split(/\s+/).map((word, i) => {
              const clean = word.replace(/[^\w]/g, "");
              const isSelected = selectedWords.includes(word) || selectedWords.includes(clean);
              return (
                <span key={i}>
                  <button type="button" onClick={() => toggleWord(word)}
                    className={`inline-block px-1 py-0.5 rounded text-sm font-medium mx-0.5 transition-all ${
                      isSelected
                        ? "bg-indigo-500 text-white shadow-sm scale-105"
                        : "hover:bg-indigo-100 text-gray-700"
                    }`}>
                    {word}
                  </button>
                  {" "}
                </span>
              );
            })}
          </div>
          {selectedWords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs font-semibold text-gray-500 w-full">Từ được chọn ({selectedWords.length}):</span>
              {selectedWords.map((w, i) => (
                <span key={i} className="flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full">
                  {w}
                  <button type="button" onClick={() => toggleWord(w)} className="hover:text-red-500">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className="text-sm" />
      </div>
    </div>
  );
}

function MatchingForm({ content, setContent, pairs, setPairs, explanation, setExplanation }:
  { content: string; setContent: (v: string) => void; pairs: MatchingPair[]; setPairs: (v: MatchingPair[]) => void;
    explanation: string; setExplanation: (v: string) => void }) {

  function updatePair(i: number, side: "left" | "right", val: string) {
    setPairs(pairs.map((p, idx) => idx === i ? { ...p, [side]: val } : p));
  }
  function addPair() { setPairs([...pairs, { left: "", right: "" }]); }
  function removePair(i: number) {
    if (pairs.length <= 2) return;
    setPairs(pairs.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Câu lệnh</Label>
        <Input value={content} onChange={e => setContent(e.target.value)}
          placeholder="VD: Nối từ với nghĩa tương ứng" className="text-sm" />
      </div>

      <div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="text-center py-2 bg-blue-50 border border-blue-200 rounded-xl">
            <span className="text-sm font-bold text-blue-700">Cột A (bên trái)</span>
          </div>
          <div className="text-center py-2 bg-pink-50 border border-pink-200 rounded-xl">
            <span className="text-sm font-bold text-pink-700">Cột B (bên phải)</span>
          </div>
        </div>
        <div className="space-y-2">
          {pairs.map((pair, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <Input value={pair.left} onChange={e => updatePair(i, "left", e.target.value)}
                placeholder={`A${i + 1}`} className="flex-1 text-sm border-blue-200 focus-visible:ring-blue-400" />
              <span className="text-gray-400 font-bold">↔</span>
              <Input value={pair.right} onChange={e => updatePair(i, "right", e.target.value)}
                placeholder={`B${i + 1}`} className="flex-1 text-sm border-pink-200 focus-visible:ring-pink-400" />
              <button type="button" onClick={() => removePair(i)} disabled={pairs.length <= 2}
                className="text-gray-300 hover:text-red-400 disabled:opacity-30 transition-colors flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addPair}
          className="mt-2 w-full border-dashed text-pink-600 border-pink-300 hover:bg-pink-50">
          <Plus className="w-4 h-4 mr-1" /> Thêm cặp nối
        </Button>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs text-amber-700 flex items-center gap-1">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Khi học sinh làm bài, cột B sẽ được trộn ngẫu nhiên. Thứ tự nhập vào là đáp án đúng.
        </p>
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className="text-sm" />
      </div>
    </div>
  );
}

function DragDropForm({ content, setContent, items, setItems, zones, setZones, explanation, setExplanation }:
  { content: string; setContent: (v: string) => void; items: string[]; setItems: (v: string[]) => void;
    zones: DragZone[]; setZones: (v: DragZone[]) => void; explanation: string; setExplanation: (v: string) => void }) {

  function updateZoneAccepts(zi: number, item: string, add: boolean) {
    setZones(zones.map((z, i) => i === zi
      ? { ...z, accepts: add ? [...z.accepts, item] : z.accepts.filter(a => a !== item) }
      : z));
  }

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Câu lệnh</Label>
        <Input value={content} onChange={e => setContent(e.target.value)}
          placeholder="VD: Kéo thả các từ vào đúng nhóm từ loại" className="text-sm" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold text-gray-700">Danh sách mục kéo thả</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setItems([...items, ""])}
            className="h-7 text-xs text-orange-600">
            <Plus className="w-3 h-3 mr-1" /> Thêm mục
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <span className="w-6 h-6 rounded bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <Input value={item} onChange={e => setItems(items.map((x, idx) => idx === i ? e.target.value : x))}
                placeholder={`Mục ${i + 1}`} className="flex-1 h-8 text-sm" />
              <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                className="text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold text-gray-700">Cấu hình vùng thả</Label>
          <Button type="button" variant="ghost" size="sm"
            onClick={() => setZones([...zones, { label: `Vùng ${zones.length + 1}`, accepts: [] }])}
            className="h-7 text-xs text-orange-600">
            <Plus className="w-3 h-3 mr-1" /> Thêm vùng
          </Button>
        </div>
        <div className="space-y-3">
          {zones.map((zone, zi) => (
            <div key={zi} className="border border-orange-200 rounded-xl p-3 bg-orange-50">
              <div className="flex items-center gap-2 mb-2">
                <Input value={zone.label}
                  onChange={e => setZones(zones.map((z, i) => i === zi ? { ...z, label: e.target.value } : z))}
                  className="h-8 text-sm font-medium flex-1 bg-white" />
                <button type="button" onClick={() => setZones(zones.filter((_, i) => i !== zi))}
                  className="text-gray-400 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-2">Chọn mục nào được chấp nhận vào vùng này:</p>
              <div className="flex flex-wrap gap-2">
                {items.filter(Boolean).map((item, ii) => {
                  const accepted = zone.accepts.includes(item);
                  return (
                    <button key={ii} type="button"
                      onClick={() => updateZoneAccepts(zi, item, !accepted)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border-2 transition-all ${
                        accepted ? "border-orange-400 bg-orange-400 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-orange-300"
                      }`}>
                      {item || `Mục ${ii + 1}`}
                      {accepted && " ✓"}
                    </button>
                  );
                })}
                {items.filter(Boolean).length === 0 && (
                  <span className="text-xs text-gray-400 italic">Thêm mục vào danh sách trước</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className="text-sm" />
      </div>
    </div>
  );
}

function SentenceReorderForm({ content, setContent, sentences, setSentences, explanation, setExplanation }:
  { content: string; setContent: (v: string) => void; sentences: string[]; setSentences: (v: string[]) => void;
    explanation: string; setExplanation: (v: string) => void }) {

  const [rawSentence, setRawSentence] = useState(sentences.filter(s => s.trim()).join(" "));

  function splitWords() {
    const words = rawSentence.trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) setSentences(words);
  }

  function move(i: number, dir: number) {
    const next = [...sentences];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    setSentences(next);
  }

  const completeSentence = sentences.filter(s => s.trim()).join(" ");

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1">Câu gốc đúng thứ tự</Label>
        <p className="text-xs text-gray-400 mb-2">Nhập câu hoàn chỉnh. Hệ thống sẽ tách thành các từ và xáo trộn khi hiển thị cho học viên.</p>
        <div className="flex gap-2">
          <Input value={rawSentence} onChange={e => setRawSentence(e.target.value)}
            placeholder="VD: xin chào bạn" className="flex-1 text-sm"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); splitWords(); } }} />
          <Button type="button" variant="outline" onClick={splitWords} className="shrink-0 text-sm font-semibold">
            Tách từ
          </Button>
        </div>
      </div>

      {sentences.filter(s => s.trim()).length > 0 && (
        <div>
          <Label className="text-sm font-semibold text-gray-700 block mb-1">
            Thứ tự đúng <span className="text-xs font-normal text-gray-400">(dùng mũi tên để sắp xếp lại thứ tự đúng)</span>
          </Label>
          <div className="space-y-1.5 mt-2">
            {sentences.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 text-right font-medium">{i + 1}.</span>
                <Input value={s} onChange={e => setSentences(sentences.map((x, idx) => idx === i ? e.target.value : x))}
                  placeholder={`Từ ${i + 1}...`} className="flex-1 h-9 text-sm bg-gray-50 border-gray-200" />
                <div className="flex gap-0.5 flex-shrink-0">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 transition-colors">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === sentences.length - 1}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 transition-colors">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <button type="button" onClick={() => setSentences(sentences.filter((_, idx) => idx !== i))}
                  disabled={sentences.length <= 1} className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSentences([...sentences, ""])}
            className="mt-1.5 text-xs text-gray-500 hover:text-gray-700">
            <Plus className="w-3 h-3 mr-1" /> Thêm từ
          </Button>

          {completeSentence && (
            <div className="mt-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-sm text-gray-500">Câu hoàn chỉnh: </span>
              <span className="text-sm font-bold text-gray-800">{completeSentence}</span>
            </div>
          )}
        </div>
      )}

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className="text-sm" />
      </div>
    </div>
  );
}

function ReadingForm({ passage, setPassage, subQuestions, setSubQuestions, explanation, setExplanation }:
  { passage: string; setPassage: (v: string) => void; subQuestions: SubQuestion[];
    setSubQuestions: (v: SubQuestion[]) => void; explanation: string; setExplanation: (v: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Đoạn văn *</Label>
        <Textarea value={passage} onChange={e => setPassage(e.target.value)}
          placeholder="Dán đoạn văn đọc hiểu vào đây..." rows={6} className="text-sm leading-relaxed" />
        {passage && <p className="text-xs text-gray-400 mt-1">{passage.split(/\s+/).length} từ</p>}
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-2">
          Câu hỏi trắc nghiệm ({subQuestions.length})
        </Label>
        <SubQuestionBuilder items={subQuestions} onChange={setSubQuestions} />
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className="text-sm" />
      </div>
    </div>
  );
}

function ListeningForm({ audioUrl, setAudioUrl, passage, setPassage, subQuestions, setSubQuestions, explanation, setExplanation }:
  { audioUrl: string; setAudioUrl: (v: string) => void; passage: string; setPassage: (v: string) => void;
    subQuestions: SubQuestion[]; setSubQuestions: (v: SubQuestion[]) => void; explanation: string; setExplanation: (v: string) => void }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play().catch(() => {});
    setPlaying(!playing);
  }

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">URL Audio *</Label>
        <div className="flex gap-2">
          <Input value={audioUrl} onChange={e => { setAudioUrl(e.target.value); setPlaying(false); }}
            placeholder="https://example.com/audio.mp3" className="flex-1 text-sm" />
        </div>
      </div>

      {audioUrl && (
        <div className="rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 p-4 text-white">
          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={toggle}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Preview Audio</p>
              <div className="flex items-end gap-0.5 h-6">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className={`w-1 rounded-full bg-white/70 ${playing ? "animate-pulse" : ""}`}
                    style={{ height: `${30 + Math.sin(i) * 50}%`, animationDelay: `${i * 0.05}s` }} />
                ))}
              </div>
            </div>
            <Volume2 className="w-4 h-4 text-white/70" />
          </div>
        </div>
      )}

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Transcript (tuỳ chọn)</Label>
        <Textarea value={passage} onChange={e => setPassage(e.target.value)}
          placeholder="Nội dung transcript của file audio..." rows={4} className="text-sm" />
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-2">
          Câu hỏi trắc nghiệm ({subQuestions.length})
        </Label>
        <SubQuestionBuilder items={subQuestions} onChange={setSubQuestions} />
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className="text-sm" />
      </div>
    </div>
  );
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

let _ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (_ytApiPromise) return _ytApiPromise;
  if ((window as any).YT?.Player) { _ytApiPromise = Promise.resolve(); return _ytApiPromise; }
  _ytApiPromise = new Promise<void>((resolve) => {
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
  return _ytApiPromise;
}

function VideoInteractiveForm({ videoUrl, setVideoUrl, timedQuestions, setTimedQuestions, explanation, setExplanation }:
  { videoUrl: string; setVideoUrl: (v: string) => void; timedQuestions: VideoQuestion[];
    setTimedQuestions: (v: VideoQuestion[]) => void; explanation: string; setExplanation: (v: string) => void }) {

  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ytId = getYouTubeId(videoUrl);
  const isYouTube = !!ytId;

  useEffect(() => {
    if (!isYouTube || !ytId) return;
    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled || !ytContainerRef.current) return;
      ytContainerRef.current.innerHTML = "";
      const div = document.createElement("div");
      div.id = "yt-player-" + Date.now();
      ytContainerRef.current.appendChild(div);
      ytPlayerRef.current = new (window as any).YT.Player(div.id, {
        videoId: ytId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: (e: any) => {
            if (cancelled) return;
            setDuration(e.target.getDuration() || 0);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
              if (cancelled) return;
              if (ytPlayerRef.current?.getCurrentTime) {
                setCurrentTime(ytPlayerRef.current.getCurrentTime());
              }
              if (ytPlayerRef.current?.getDuration) {
                const d = ytPlayerRef.current.getDuration();
                if (d > 0) setDuration(d);
              }
            }, 500);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (ytPlayerRef.current?.destroy) ytPlayerRef.current.destroy();
      ytPlayerRef.current = null;
    };
  }, [ytId, isYouTube]);

  function updateQ(i: number, patch: Partial<VideoQuestion>) {
    setTimedQuestions(timedQuestions.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  }
  function updateChoice(qi: number, ci: number, val: string) {
    setTimedQuestions(timedQuestions.map((q, idx) => idx === qi
      ? { ...q, choices: q.choices.map((c, cIdx) => cIdx === ci ? val : c) }
      : q));
  }
  function addChoice(qi: number) {
    setTimedQuestions(timedQuestions.map((q, idx) => idx === qi
      ? { ...q, choices: [...q.choices, ""] } : q));
  }
  function removeChoice(qi: number, ci: number) {
    setTimedQuestions(timedQuestions.map((q, idx) => idx === qi
      ? { ...q, choices: q.choices.filter((_, i) => i !== ci), correctAnswer: q.choices[ci] === q.correctAnswer ? "" : q.correctAnswer } : q));
  }

  function fmtMM(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function parseMM(str: string): number {
    const parts = str.replace(/[^0-9:]/g, "").split(":");
    if (parts.length === 2) return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    return parseInt(parts[0], 10) || 0;
  }

  function seekTo(ts: number) {
    if (isYouTube && ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(ts, true);
      setCurrentTime(ts);
    } else if (videoRef.current) {
      videoRef.current.currentTime = ts;
      setCurrentTime(ts);
    }
  }

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(Math.round(pct * duration));
  }

  function markAtCurrentTime() {
    const ts = Math.round(currentTime);
    const newQ = newVideoQuestion("question", ts);
    setTimedQuestions([...timedQuestions, newQ]);
    setExpandedIdx(timedQuestions.length);
  }

  function seekToTimestamp(qi: number) {
    seekTo(timedQuestions[qi]?.timestamp ?? 0);
  }

  function toggleExpand(qi: number) {
    setExpandedIdx(expandedIdx === qi ? null : qi);
  }

  function deleteTimestamp(qi: number) {
    setTimedQuestions(timedQuestions.filter((_, i) => i !== qi));
    if (expandedIdx === qi) setExpandedIdx(null);
    else if (expandedIdx !== null && expandedIdx > qi) setExpandedIdx(expandedIdx - 1);
  }

  function previewText(tq: VideoQuestion) {
    const t = tq.type ?? "question";
    if (t === "note") return tq.content?.slice(0, 60) || "Chưa có nội dung";
    return tq.question?.slice(0, 60) || "Chưa có câu hỏi";
  }

  const sortedIndices = timedQuestions.map((_, i) => i).sort((a, b) => timedQuestions[a].timestamp - timedQuestions[b].timestamp);

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">YouTube Video URL</Label>
        <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... hoặc URL video trực tiếp" className="text-sm" />
      </div>

      {videoUrl && (
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
          {isYouTube ? (
            <div ref={ytContainerRef} className="w-full aspect-video" />
          ) : (
            <video ref={videoRef} src={videoUrl} controls className="w-full aspect-video"
              onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration || 0); }}
              onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); }} />
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Play className="w-3.5 h-3.5" />
          <span className="font-mono">{fmtMM(currentTime)} / {duration > 0 ? fmtMM(duration) : "--:--"}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={markAtCurrentTime}
          className="h-8 text-xs gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50">
          <Clock className="w-3.5 h-3.5" /> Đánh dấu {fmtMM(currentTime)}
        </Button>
      </div>

      {videoUrl && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Tải video để hiển thị timeline</p>
          <div ref={timelineRef} className="relative h-3 cursor-pointer rounded-full bg-gray-100 border border-gray-200 overflow-visible"
            onClick={handleTimelineClick}>
            {duration > 0 && (
              <>
                <div className="absolute top-0 left-0 h-full bg-orange-200 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }} />
                {timedQuestions.map((tq, qi) => {
                  const pct = Math.max(0, Math.min(100, (tq.timestamp / duration) * 100));
                  const isNote = (tq.type ?? "question") === "note";
                  return (
                    <div key={qi} className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow z-10 ${
                      isNote ? "bg-amber-400" : "bg-blue-500"
                    }`} style={{ left: `${pct}%` }} title={`${isNote ? "Ghi chú" : "Câu hỏi"} — ${fmtMM(tq.timestamp)}`} />
                  );
                })}
              </>
            )}
          </div>
          {duration === 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              Nhấn Play để tải thời lượng video. Sau đó timeline sẽ hiển thị chính xác.
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <Label className="text-sm font-semibold text-gray-700">Timestamps ({timedQuestions.length})</Label>
          </div>
          <Button type="button" variant="outline" size="sm"
            onClick={() => { setTimedQuestions([...timedQuestions, newVideoQuestion("question")]); setExpandedIdx(timedQuestions.length); }}
            className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" /> Thêm Timestamp
          </Button>
        </div>

        <div className="space-y-2">
          {sortedIndices.map((qi) => {
            const tq = timedQuestions[qi];
            const isExpanded = expandedIdx === qi;
            const tsType = tq.type ?? "question";
            const isNote = tsType === "note";

            return (
              <div key={qi} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(qi)}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); seekToTimestamp(qi); }}
                    className="text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0">
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white flex-shrink-0 ${
                    isNote ? "bg-amber-500" : "bg-blue-500"
                  }`}>
                    D {fmtMM(tq.timestamp)}
                  </span>
                  <span className={`text-xs font-semibold flex-shrink-0 ${isNote ? "text-amber-700" : "text-blue-700"}`}>
                    {isNote ? "Ghi Chú" : "Câu Hỏi"}
                  </span>
                  <span className="text-xs text-gray-500 truncate flex-1 min-w-0">{previewText(tq)}</span>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                    <button type="button" onClick={(e) => { e.stopPropagation(); seekToTimestamp(qi); }}
                      className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors" title="Nhảy đến mốc">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteTimestamp(qi); }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/50">
                    <div className="grid grid-cols-[1fr_auto] gap-4">
                      <div>
                        <Label className="text-xs font-medium text-gray-500 block mb-1">Thời điểm (MM:SS)</Label>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg bg-white px-3 py-1.5">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <Input value={fmtMM(tq.timestamp)}
                              onChange={e => updateQ(qi, { timestamp: parseMM(e.target.value) })}
                              className="w-20 h-6 border-0 shadow-none p-0 text-sm font-mono focus-visible:ring-0" />
                          </div>
                          <button type="button" onClick={() => { updateQ(qi, { timestamp: Math.round(currentTime) }); }}
                            className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors bg-white"
                            title="Đặt thời điểm hiện tại">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Hiện tại: <span className="font-mono text-gray-500">{fmtMM(currentTime)}</span></p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500 block mb-1">Loại</Label>
                        <Select value={tsType} onValueChange={(v: "note" | "question") => updateQ(qi, { type: v })}>
                          <SelectTrigger className="w-[140px] h-9 text-sm bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="note">
                              <span className="flex items-center gap-2"><StickyNote className="w-3.5 h-3.5 text-amber-500" /> Ghi chú</span>
                            </SelectItem>
                            <SelectItem value="question">
                              <span className="flex items-center gap-2"><HelpCircle className="w-3.5 h-3.5 text-blue-500" /> Câu hỏi</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {isNote ? (
                      <div>
                        <Label className="text-xs font-medium text-gray-500 block mb-1">Nội dung ghi chú</Label>
                        <Textarea value={tq.content ?? ""} onChange={e => updateQ(qi, { content: e.target.value })}
                          placeholder="Nhập ghi chú hoặc tip cho học sinh tại mốc thời gian này..."
                          rows={3} className="text-sm bg-white" />
                      </div>
                    ) : (
                      <>
                        <div>
                          <Label className="text-xs font-medium text-gray-500 block mb-1">Câu hỏi</Label>
                          <Input value={tq.question} onChange={e => updateQ(qi, { question: e.target.value })}
                            placeholder="Nhập câu hỏi tại mốc thời gian này..."
                            className="text-sm bg-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs font-medium text-gray-500 block mb-1">Loại câu hỏi</Label>
                            <Select value="mcq">
                              <SelectTrigger className="h-9 text-sm bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mcq">Trắc nghiệm</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-gray-500 block mb-1">Điểm</Label>
                            <Input type="number" min={0} value={tq.points ?? 10}
                              onChange={e => updateQ(qi, { points: parseInt(e.target.value, 10) || 0 })}
                              className="h-9 text-sm bg-white" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-500 block mb-1.5">Các lựa chọn</Label>
                          <div className="space-y-2">
                            {tq.choices.map((ch, ci) => (
                              <div key={ci} className="flex items-center gap-2">
                                <button type="button" onClick={() => updateQ(qi, { correctAnswer: ch })}
                                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    ch && tq.correctAnswer === ch ? "border-green-500 bg-green-500" : "border-gray-300 hover:border-green-400"
                                  }`}>
                                  {ch && tq.correctAnswer === ch && <div className="w-2 h-2 rounded-full bg-white" />}
                                </button>
                                <Input value={ch} onChange={e => updateChoice(qi, ci, e.target.value)}
                                  placeholder={`Lựa chọn ${ci + 1}`}
                                  className="flex-1 h-9 text-sm bg-white" />
                                {tq.choices.length > 2 && (
                                  <button type="button" onClick={() => removeChoice(qi, ci)}
                                    className="text-gray-400 hover:text-red-500 transition-colors p-0.5">
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => addChoice(qi)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-2 font-medium">
                            <Plus className="w-3 h-3" /> Thêm lựa chọn
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {timedQuestions.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400">
              {videoUrl
                ? "Nhấn \"Đánh dấu\" hoặc \"+ Thêm Timestamp\" để thêm câu hỏi và ghi chú theo mốc thời gian."
                : "Nhập URL video trước, sau đó thêm câu hỏi tại các mốc thời gian."}
            </div>
          )}
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className="text-sm" />
      </div>
    </div>
  );
}

function EssayForm({ content, setContent, explanation, setExplanation, autoGrade, setAutoGrade }:
  { content: string; setContent: (v: string) => void; explanation: string; setExplanation: (v: string) => void; autoGrade?: boolean; setAutoGrade?: (v: boolean) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Đề bài / Câu hỏi *</Label>
        <Textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="Nhập đề bài hoặc câu hỏi cho bài luận..." rows={4} className="text-sm" />
      </div>
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Gợi ý / Rubric chấm điểm (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)}
          placeholder="Bài mẫu hoặc tiêu chí chấm điểm cho giáo viên..." rows={5} className="text-sm" />
      </div>
      {setAutoGrade && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <input type="checkbox" id="essay-auto-grade-qf" checked={autoGrade ?? false} onChange={e => setAutoGrade(e.target.checked)} className="rounded" />
          <div>
            <label htmlFor="essay-auto-grade-qf" className="text-sm font-medium text-gray-800 cursor-pointer">Tự động chấm bằng AI</label>
            <p className="text-xs text-gray-500 mt-0.5">AI sẽ tự chấm điểm bài luận này khi học viên nộp bài</p>
          </div>
        </div>
      )}
    </div>
  );
}

function OpenEndForm({ content, setContent, explanation, setExplanation, allowedTypes, setAllowedTypes }:
  { content: string; setContent: (v: string) => void; explanation: string; setExplanation: (v: string) => void; allowedTypes: string[]; setAllowedTypes: (v: string[]) => void }) {
  const toggleType = (t: string) => {
    if (allowedTypes.includes(t)) {
      if (allowedTypes.length <= 1) return;
      setAllowedTypes(allowedTypes.filter(x => x !== t));
    } else {
      setAllowedTypes([...allowedTypes, t]);
    }
  };
  const typeOptions = [
    { value: "text", label: "Văn bản", icon: "📝" },
    { value: "audio", label: "Ghi âm", icon: "🎙️" },
    { value: "image", label: "Hình ảnh", icon: "📷" },
  ];
  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Đề bài / Câu hỏi *</Label>
        <Textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="Nhập câu hỏi mở..." rows={4} className="text-sm" />
      </div>
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-2">Hình thức trả lời cho phép *</Label>
        <div className="flex gap-3">
          {typeOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleType(opt.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                allowedTypes.includes(opt.value)
                  ? "border-violet-400 bg-violet-50 text-violet-700 shadow-sm"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              }`}
            >
              <span className="text-lg">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1.5">Chọn ít nhất 1 hình thức. Học sinh sẽ chọn cách trả lời khi làm bài.</p>
      </div>
      <div>
        <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Gợi ý / Tiêu chí chấm (tuỳ chọn)</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)}
          placeholder="Tiêu chí chấm điểm cho giáo viên..." rows={3} className="text-sm" />
      </div>
    </div>
  );
}

// ─── Main Form Page ───────────────────────────────────────────────────────────

export default function QuestionFormPage() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const questionId = params.id ? parseInt(params.id, 10) : undefined;
  const isEditing = !!questionId;

  const { data: existingQ, isLoading: loadingQ } = useQuery({
    queryKey: getGetQuestionQueryKey(questionId ?? 0),
    queryFn: () => getQuestion(questionId!),
    enabled: isEditing,
  });

  const { mutate: createQuestion, isPending: creating } = useCreateQuestion();
  const { mutate: updateQuestion, isPending: updating } = useUpdateQuestion();
  const isSaving = creating || updating;

  // ── Basic fields ──────────────────────────────────────────────────────────
  const [qType, setQType] = useState("mcq");
  const [skill, setSkill] = useState("reading");
  const [level, setLevel] = useState("B1");
  const [points, setPoints] = useState(1);
  const [imageUrl, setImageUrl] = useState("");

  // ── Per-type state ────────────────────────────────────────────────────────
  const [content, setContent] = useState("");
  const [explanation, setExplanation] = useState("");

  // MCQ
  const [mcqOptions, setMcqOptions] = useState<McqOption[]>([
    { text: "", isCorrect: false }, { text: "", isCorrect: false },
    { text: "", isCorrect: false }, { text: "", isCorrect: false },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);

  // True/False
  const [tfAnswer, setTfAnswer] = useState("");

  // Fill in Blank
  const [blanksAnswers, setBlanksAnswers] = useState<string[]>([]);

  // Word Selection
  const [wsInstruction, setWsInstruction] = useState("");
  const [wsPassage, setWsPassage] = useState("");
  const [wsSelectedWords, setWsSelectedWords] = useState<string[]>([]);

  // Matching
  const [matchPairs, setMatchPairs] = useState<MatchingPair[]>([
    { left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" },
  ]);

  // Drag & Drop
  const [ddItems, setDdItems] = useState<string[]>(["", "", ""]);
  const [ddZones, setDdZones] = useState<DragZone[]>([
    { label: "Vùng 1", accepts: [] }, { label: "Vùng 2", accepts: [] },
  ]);

  // Sentence Reorder
  const [srSentences, setSrSentences] = useState<string[]>(["", "", ""]);

  // Reading
  const [readPassage, setReadPassage] = useState("");
  const [readSubQs, setReadSubQs] = useState<SubQuestion[]>([newSubQuestion()]);

  // Listening
  const [lisAudioUrl, setLisAudioUrl] = useState("");
  const [lisTranscript, setLisTranscript] = useState("");
  const [lisSubQs, setLisSubQs] = useState<SubQuestion[]>([newSubQuestion()]);

  // Video Interactive
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTimedQs, setVideoTimedQs] = useState<VideoQuestion[]>([]);

  // Essay
  const [essayAutoGrade, setEssayAutoGrade] = useState(false);

  // Open End
  const [openEndAllowedTypes, setOpenEndAllowedTypes] = useState<string[]>(["text", "audio"]);

  // ── Load existing question ────────────────────────────────────────────────
  useEffect(() => {
    if (!existingQ) return;
    setQType(existingQ.type);
    setSkill(existingQ.skill);
    setLevel(existingQ.level);
    setPoints(existingQ.points);
    setImageUrl(existingQ.imageUrl ?? "");
    setContent(existingQ.content);
    setExplanation(existingQ.explanation ?? "");

    const meta = safeJson<Record<string, unknown>>(existingQ.metadata, {});
    const opts = safeJson<unknown[]>(existingQ.options, []);

    if (existingQ.type === "mcq") {
      const strOpts = opts as string[];
      const corrects = (existingQ.correctAnswer ?? "").split(",").map((s: string) => s.trim());
      const am = (meta.allowMultiple as boolean) ?? false;
      setAllowMultiple(am);
      setMcqOptions(strOpts.map(t => ({ text: t, isCorrect: corrects.includes(t) })));
    }
    if (existingQ.type === "true_false") setTfAnswer(existingQ.correctAnswer ?? "");
    if (existingQ.type === "fill_blank") setBlanksAnswers(safeJson<string[]>(existingQ.correctAnswer, []));
    if (existingQ.type === "word_selection") {
      setWsInstruction(existingQ.content);
      setWsPassage(existingQ.passage ?? "");
      setWsSelectedWords(safeJson<string[]>(existingQ.correctAnswer, []));
    }
    if (existingQ.type === "matching") setMatchPairs((opts as MatchingPair[]).map(p => ({ left: p.left ?? "", right: p.right ?? "" })));
    if (existingQ.type === "drag_drop") {
      const parsed = safeJson<{ items: string[]; zones: DragZone[] }>(existingQ.options, { items: [], zones: [] });
      setDdItems(parsed.items ?? []);
      setDdZones(parsed.zones ?? []);
    }
    if (existingQ.type === "sentence_reorder") setSrSentences(opts as string[]);
    if (existingQ.type === "reading") {
      setReadPassage(existingQ.passage ?? "");
      const rawSubs = opts as SubQuestion[];
      const normSubs = rawSubs.length > 0
        ? rawSubs.map(sq => ({ question: sq.question ?? "", choices: Array.isArray(sq.choices) ? sq.choices : ["", "", "", ""], correctAnswer: sq.correctAnswer ?? "", points: sq.points ?? 1 }))
        : [newSubQuestion()];
      setReadSubQs(normSubs);
    }
    if (existingQ.type === "listening") {
      setLisAudioUrl(existingQ.audioUrl ?? "");
      setLisTranscript(existingQ.passage ?? "");
      const rawSubs2 = opts as SubQuestion[];
      const normSubs2 = rawSubs2.length > 0
        ? rawSubs2.map(sq => ({ question: sq.question ?? "", choices: Array.isArray(sq.choices) ? sq.choices : ["", "", "", ""], correctAnswer: sq.correctAnswer ?? "", points: sq.points ?? 1 }))
        : [newSubQuestion()];
      setLisSubQs(normSubs2);
    }
    if (existingQ.type === "video_interactive") {
      setVideoUrl(existingQ.videoUrl ?? "");
      const rawVids = opts as VideoQuestion[];
      setVideoTimedQs(rawVids.map(vq => ({ timestamp: vq.timestamp ?? 0, type: vq.type ?? "question", content: vq.content ?? "", question: vq.question ?? "", choices: Array.isArray(vq.choices) ? vq.choices : ["", "", "", ""], correctAnswer: vq.correctAnswer ?? "", points: vq.points ?? 10 })));
    }
    if (existingQ.type === "essay") {
      setEssayAutoGrade((meta.autoGrade as boolean) ?? false);
    }
    if (existingQ.type === "open_end") {
      const allowed = ((meta.allowedTypes as string[]) ?? ["text", "audio"]).filter((t: string) => t !== "image");
      setOpenEndAllowedTypes(allowed);
    }
  }, [existingQ]);

  // ── Serialize & save ──────────────────────────────────────────────────────
  function buildPayload() {
    const base = { type: qType, skill, level, points, imageUrl: imageUrl || undefined };

    if (qType === "mcq") {
      const validOpts = mcqOptions.filter(o => o.text.trim());
      const corrects = validOpts.filter(o => o.isCorrect).map(o => o.text);
      return {
        ...base, content,
        options: JSON.stringify(validOpts.map(o => o.text)),
        correctAnswer: allowMultiple ? corrects.join(",") : (corrects[0] ?? ""),
        metadata: JSON.stringify({ allowMultiple }),
        explanation: explanation || undefined,
      };
    }
    if (qType === "true_false") {
      return { ...base, content, correctAnswer: tfAnswer, options: JSON.stringify(["Đúng", "Sai"]), explanation: explanation || undefined };
    }
    if (qType === "fill_blank") {
      return { ...base, content, correctAnswer: JSON.stringify(blanksAnswers), explanation: explanation || undefined };
    }
    if (qType === "word_selection") {
      return {
        ...base, content: wsInstruction || content,
        passage: wsPassage,
        correctAnswer: JSON.stringify(wsSelectedWords),
        explanation: explanation || undefined,
      };
    }
    if (qType === "matching") {
      return { ...base, content, options: JSON.stringify(matchPairs), explanation: explanation || undefined };
    }
    if (qType === "drag_drop") {
      return {
        ...base, content,
        options: JSON.stringify({ items: ddItems.filter(Boolean), zones: ddZones }),
        explanation: explanation || undefined,
      };
    }
    if (qType === "sentence_reorder") {
      return { ...base, content, options: JSON.stringify(srSentences.filter(Boolean)), explanation: explanation || undefined };
    }
    if (qType === "reading") {
      const totalReadPoints = readSubQs.reduce((sum, sq) => sum + (sq.points ?? 1), 0);
      return { ...base, points: totalReadPoints, content, passage: readPassage, options: JSON.stringify(readSubQs), explanation: explanation || undefined };
    }
    if (qType === "listening") {
      const totalLisPoints = lisSubQs.reduce((sum, sq) => sum + (sq.points ?? 1), 0);
      return {
        ...base, points: totalLisPoints, content,
        audioUrl: lisAudioUrl || undefined,
        passage: lisTranscript || undefined,
        options: JSON.stringify(lisSubQs),
        explanation: explanation || undefined,
      };
    }
    if (qType === "video_interactive") {
      return {
        ...base, content,
        videoUrl: videoUrl || undefined,
        options: JSON.stringify(videoTimedQs),
        explanation: explanation || undefined,
      };
    }
    if (qType === "open_end") {
      return { ...base, content, explanation: explanation || undefined, metadata: JSON.stringify({ allowedTypes: openEndAllowedTypes }) };
    }
    // essay
    return { ...base, content, explanation: explanation || undefined, metadata: JSON.stringify({ autoGrade: essayAutoGrade }) };
  }

  function handleSave() {
    const payload = buildPayload();
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey() });
      navigate("/questions");
    };
    if (isEditing) {
      updateQuestion({ id: questionId!, data: payload }, { onSuccess });
    } else {
      createQuestion({ data: payload as any }, { onSuccess });
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isEditing && loadingQ) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 p-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const typeCfg = QUESTION_TYPES.find(t => t.value === qType);

  return (
    <div className="max-w-5xl mx-auto space-y-0">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate("/questions")} className="gap-2 text-gray-600">
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">
            {isEditing ? "Chỉnh sửa câu hỏi" : "Tạo câu hỏi mới"}
          </h1>
          <p className="text-xs text-gray-500">{typeCfg?.label} · {SKILL_LABELS[skill]} · {level}</p>
        </div>
        <Badge variant="outline" className="text-sm">{typeCfg?.icon} {typeCfg?.label}</Badge>
        <Button onClick={handleSave} disabled={isSaving} className="bg-[#378ADD] hover:bg-[#2a6bb5] gap-2">
          <Save className="w-4 h-4" />
          {isSaving ? "Đang lưu..." : isEditing ? "Cập nhật" : "Lưu câu hỏi"}
        </Button>
      </div>

      <div className="flex gap-0">
        {/* Left Sidebar: Type + Basic Info */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-gray-50 min-h-screen p-5 space-y-6">
          {/* Type Selector */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Loại câu hỏi</p>
            <div className="space-y-1">
              {QUESTION_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setQType(t.value)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    qType === t.value
                      ? "bg-[#378ADD] text-white shadow-md"
                      : "hover:bg-white hover:shadow-sm text-gray-700"
                  }`}
                >
                  <span className="text-lg leading-none flex-shrink-0 mt-0.5">{t.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${qType === t.value ? "text-white" : "text-gray-800"}`}>{t.label}</p>
                    <p className={`text-xs mt-0.5 ${qType === t.value ? "text-blue-100" : "text-gray-400"}`}>{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Basic Settings */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cài đặt</p>
            <div>
              <Label className="text-xs font-medium text-gray-600 block mb-1">Kỹ năng</Label>
              <Select value={skill} onValueChange={setSkill}>
                <SelectTrigger className="h-8 text-sm bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SKILLS.map(s => <SelectItem key={s} value={s}>{SKILL_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 block mb-1">Cấp độ</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="h-8 text-sm bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(qType === "reading" || qType === "listening") ? (
              <div>
                <Label className="text-xs font-medium text-gray-600 block mb-1">Điểm số (tự động)</Label>
                <div className="h-8 flex items-center px-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 font-medium">
                  {qType === "reading"
                    ? readSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0)
                    : lisSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0)
                  } điểm
                </div>
                <p className="text-xs text-gray-400 mt-1">Tổng điểm các câu thành phần</p>
              </div>
            ) : (
              <div>
                <Label className="text-xs font-medium text-gray-600 block mb-1">Điểm số</Label>
                <Input type="number" min={1} value={points} onChange={e => setPoints(parseInt(e.target.value, 10) || 1)}
                  className="h-8 text-sm bg-white" />
              </div>
            )}
            <div>
              <Label className="text-xs font-medium text-gray-600 block mb-1">URL Hình ảnh (tuỳ chọn)</Label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                placeholder="https://..." className="h-8 text-sm bg-white text-xs" />
            </div>
          </div>

          {/* Tips */}
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Lưu ý
            </p>
            <p className="text-xs text-blue-600 leading-relaxed">
              {qType === "mcq" && "Click vòng tròn bên cạnh lựa chọn để đánh dấu đáp án đúng."}
              {qType === "true_false" && "Chọn Đúng hoặc Sai bên phải để xác định đáp án."}
              {qType === "fill_blank" && "Gõ __BLANK__ vào chỗ cần tạo ô trống trong câu."}
              {qType === "word_selection" && "Click trực tiếp vào từng từ trong đoạn văn để chọn đáp án đúng."}
              {qType === "matching" && "Nhập các cặp theo thứ tự. Cột B sẽ tự động bị trộn khi học sinh làm."}
              {qType === "drag_drop" && "Thêm mục và cấu hình từng vùng chấp nhận mục nào."}
              {qType === "sentence_reorder" && "Nhập câu theo thứ tự đúng. Học sinh sẽ thấy chúng bị đảo."}
              {qType === "reading" && "Dán bài đọc và thêm các câu hỏi trắc nghiệm bên dưới."}
              {qType === "listening" && "Nhập URL audio, thêm transcript và câu hỏi."}
              {qType === "video_interactive" && "Nhập URL video và thêm câu hỏi xuất hiện tại mốc thời gian cụ thể."}
              {qType === "essay" && "Nhập đề bài. Học sinh sẽ trả lời tự do, giáo viên chấm tay."}
              {qType === "open_end" && "Học sinh trả lời bằng text, ghi âm, hoặc chụp/upload ảnh. Giáo viên chấm tay."}
            </p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6 space-y-6">
          {imageUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-200 max-h-48">
              <img src={imageUrl} alt="Hình ảnh câu hỏi" className="w-full h-full object-contain bg-gray-50" />
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
              <span className="text-2xl">{typeCfg?.icon}</span>
              <div>
                <h2 className="text-base font-bold text-gray-900">Nội dung câu hỏi — {typeCfg?.label}</h2>
                <p className="text-xs text-gray-500">{typeCfg?.desc}</p>
              </div>
            </div>

            {qType === "mcq" && (
              <McqForm
                content={content} setContent={setContent}
                options={mcqOptions} setOptions={setMcqOptions}
                allowMultiple={allowMultiple} setAllowMultiple={setAllowMultiple}
                explanation={explanation} setExplanation={setExplanation}
              />
            )}
            {qType === "true_false" && (
              <TrueFalseForm
                content={content} setContent={setContent}
                correctAnswer={tfAnswer} setCorrectAnswer={setTfAnswer}
                explanation={explanation} setExplanation={setExplanation}
              />
            )}
            {qType === "fill_blank" && (
              <FillBlankForm
                content={content} setContent={setContent}
                blanksAnswers={blanksAnswers} setBlanksAnswers={setBlanksAnswers}
                explanation={explanation} setExplanation={setExplanation}
              />
            )}
            {qType === "word_selection" && (
              <WordSelectionForm
                instruction={wsInstruction} setInstruction={setWsInstruction}
                passage={wsPassage} setPassage={setWsPassage}
                selectedWords={wsSelectedWords} setSelectedWords={setWsSelectedWords}
                explanation={explanation} setExplanation={setExplanation}
              />
            )}
            {qType === "matching" && (
              <MatchingForm
                content={content} setContent={setContent}
                pairs={matchPairs} setPairs={setMatchPairs}
                explanation={explanation} setExplanation={setExplanation}
              />
            )}
            {qType === "drag_drop" && (
              <DragDropForm
                content={content} setContent={setContent}
                items={ddItems} setItems={setDdItems}
                zones={ddZones} setZones={setDdZones}
                explanation={explanation} setExplanation={setExplanation}
              />
            )}
            {qType === "sentence_reorder" && (
              <SentenceReorderForm
                content={content} setContent={setContent}
                sentences={srSentences} setSentences={setSrSentences}
                explanation={explanation} setExplanation={setExplanation}
              />
            )}
            {qType === "reading" && (
              <ReadingForm
                passage={readPassage} setPassage={setReadPassage}
                subQuestions={readSubQs} setSubQuestions={setReadSubQs}
                explanation={explanation} setExplanation={setExplanation}
              />
            )}
            {qType === "listening" && (
              <ListeningForm
                audioUrl={lisAudioUrl} setAudioUrl={setLisAudioUrl}
                passage={lisTranscript} setPassage={setLisTranscript}
                subQuestions={lisSubQs} setSubQuestions={setLisSubQs}
                explanation={explanation} setExplanation={setExplanation}
              />
            )}
            {qType === "video_interactive" && (
              <VideoInteractiveForm
                videoUrl={videoUrl} setVideoUrl={setVideoUrl}
                timedQuestions={videoTimedQs} setTimedQuestions={setVideoTimedQs}
                explanation={explanation} setExplanation={setExplanation}
              />
            )}
            {qType === "essay" && (
              <EssayForm
                content={content} setContent={setContent}
                explanation={explanation} setExplanation={setExplanation}
                autoGrade={essayAutoGrade} setAutoGrade={setEssayAutoGrade}
              />
            )}
            {qType === "open_end" && (
              <OpenEndForm
                content={content} setContent={setContent}
                explanation={explanation} setExplanation={setExplanation}
                allowedTypes={openEndAllowedTypes} setAllowedTypes={setOpenEndAllowedTypes}
              />
            )}
          </div>

          {/* Bottom save */}
          <div className="flex justify-end gap-3 pb-8">
            <Button variant="outline" onClick={() => navigate("/questions")}>Hủy</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-[#378ADD] hover:bg-[#2a6bb5] gap-2 px-8">
              <Save className="w-4 h-4" />
              {isSaving ? "Đang lưu..." : isEditing ? "Cập nhật câu hỏi" : "Lưu câu hỏi"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
