import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "@/lib/routing";
import {
  useCreateQuestion, useUpdateQuestion,
  getListQuestionsQueryKey, getGetQuestionQueryKey, getQuestion,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/components/markdown-editor";
import { AIQuestionGeneratorDialog } from "@/components/ai-question-generator-dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Save, Plus, Trash2, CheckCircle2, Circle, GripVertical,
  ChevronUp, ChevronDown, Play, Pause, Volume2, Video as VideoIcon,
  BookOpen, Headphones, Clock, Info, AlertCircle, X, RotateCcw,
  MessageSquare, HelpCircle, StickyNote, Sparkles, Check, ChevronRight,
  FileQuestion, Type, Image, Mic, AlignLeft, ListOrdered, Layers,
} from "lucide-react";

// ─── Design System: Nature-Inspired IELTS Platform ─────────────────────────────
// Colors
const DS = {
  // Surfaces
  surface: '#fbf9f4',
  surfaceDim: '#dbdad5',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f5f3ee',
  surfaceContainer: '#f0eee9',
  surfaceContainerHigh: '#eae8e3',
  surfaceContainerHighest: '#e4e2dd',
  // On
  onSurface: '#1b1c19',
  onSurfaceVariant: '#424843',
  inverseSurface: '#30312e',
  inverseOnSurface: '#f2f1ec',
  // Primary (Sage Green)
  primary: '#4b6451',
  primaryLight: '#7e9983',
  primaryPale: '#cdead1',
  primaryPaleDim: '#b1ceb6',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#183020',
  inversePrimary: '#b1ceb6',
  // Secondary (Forest Green)
  secondary: '#45664b',
  secondaryContainer: '#c4e9c7',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#4a6a4f',
  // Tertiary (Wood Tones)
  tertiary: '#725a38',
  tertiaryContainer: '#aa8e68',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#3b280a',
  // Error
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',
  // Utility
  outline: '#737972',
  outlineVariant: '#c2c8c0',
  surfaceTint: '#4b6451',
} as const;

// ─── Constants ─────────────────────────────────────────────────────────────

const SKILLS = ["reading", "writing", "listening", "speaking"] as const;
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const SKILL_LABELS: Record<string, string> = { reading: "Reading", writing: "Writing", listening: "Listening", speaking: "Speaking" };
const SKILL_COLORS: Record<string, string> = { reading: "emerald", writing: "amber", listening: "blue", speaking: "rose" };

const QUESTION_TYPES = [
  { value: "mcq", label: "Multiple Choice", icon: "A", color: "primary" },
  { value: "true_false", label: "True / False", icon: "T/F", color: "secondary" },
  { value: "fill_blank", label: "Fill in the Blank", icon: "_", color: "tertiary" },
  { value: "word_selection", label: "Word Selection", icon: "W", color: "primary" },
  { value: "matching", label: "Matching", icon: "M", color: "secondary" },
  { value: "drag_drop", label: "Drag & Drop", icon: "D", color: "tertiary" },
  { value: "sentence_reorder", label: "Sentence Reorder", icon: "S", color: "primary" },
  { value: "reading", label: "Reading Comprehension", icon: "R", color: "secondary" },
  { value: "listening", label: "Listening Comprehension", icon: "L", color: "primary" },
  { value: "video_interactive", label: "Video Interactive", icon: "V", color: "tertiary" },
  { value: "essay", label: "Essay", icon: "E", color: "secondary" },
  { value: "open_end", label: "Open Ended", icon: "O", color: "tertiary" },
] as const;

const QUESTION_CATEGORIES = [
  {
    title: "Basic",
    types: ["mcq", "true_false", "fill_blank", "word_selection"],
  },
  {
    title: "Interactive",
    types: ["matching", "drag_drop", "sentence_reorder"],
  },
  {
    title: "Comprehension",
    types: ["reading", "listening", "video_interactive"],
  },
  {
    title: "Writing",
    types: ["essay", "open_end"],
  },
];

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

type ColorKey = "primary" | "secondary" | "tertiary";

function getColorClasses(color: ColorKey) {
  const map: Record<ColorKey, { bg: string; border: string; text: string; light: string; hover: string }> = {
    primary: {
      bg: DS.primary,
      border: DS.primary,
      text: DS.primary,
      light: DS.primaryPale,
      hover: DS.primaryPaleDim,
    },
    secondary: {
      bg: DS.secondary,
      border: DS.secondary,
      text: DS.secondary,
      light: DS.secondaryContainer,
      hover: DS.onSecondaryContainer,
    },
    tertiary: {
      bg: DS.tertiary,
      border: DS.tertiary,
      text: DS.tertiary,
      light: DS.tertiaryContainer,
      hover: DS.onTertiaryContainer,
    },
  };
  return map[color];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SubQuestionBuilder({
  items, onChange, accentColor,
}: { items: SubQuestion[]; onChange: (v: SubQuestion[]) => void; accentColor: ColorKey }) {
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
  const colors = getColorClasses(accentColor);

  return (
    <div className="space-y-4">
      {items.map((sq, qi) => (
        <div key={qi} className="rounded-xl p-5" style={{ backgroundColor: DS.surfaceContainerLow, border: `1px solid ${DS.outlineVariant}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white" style={{ backgroundColor: DS.primary }}>
                {qi + 1}
              </span>
              <span className="text-sm font-medium" style={{ color: DS.onSurface }}>Question {qi + 1}</span>
            </div>
            <button type="button" onClick={() => onChange(items.filter((_, i) => i !== qi))}
              className="p-2 rounded-lg transition-colors hover:bg-red-50" style={{ color: DS.error }}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <Textarea
            value={sq.question}
            onChange={e => update(qi, { question: e.target.value })}
            placeholder="Enter question content..."
            rows={2}
            className="text-sm mb-3"
            style={{ backgroundColor: DS.surfaceContainerLowest, borderColor: DS.outlineVariant }}
          />
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: DS.onSurfaceVariant }}>Choices (click circle to mark correct)</p>
            {(sq.choices ?? []).map((ch, ci) => (
              <div key={ci} className="flex items-center gap-3">
                <button type="button" onClick={() => update(qi, { correctAnswer: ch })}
                  className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                  style={{
                    borderColor: sq.correctAnswer === ch ? DS.secondary : DS.outlineVariant,
                    backgroundColor: sq.correctAnswer === ch ? DS.secondary : 'transparent',
                  }}>
                  {sq.correctAnswer === ch && <div className="w-2 h-2 rounded-full bg-white" />}
                </button>
                <span className="text-xs font-semibold w-5" style={{ color: DS.onSurfaceVariant }}>{String.fromCharCode(65 + ci)}.</span>
                <Input value={ch} onChange={e => updateChoice(qi, ci, e.target.value)}
                  placeholder={`Choice ${String.fromCharCode(65 + ci)}`} className="flex-1 h-8 text-sm" />
                {(sq.choices ?? []).length > 2 && (
                  <button type="button" onClick={() => removeChoice(qi, ci)} className="text-gray-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => addChoice(qi)} className="h-7 text-xs" style={{ color: DS.primary }}>
              <Plus className="w-3 h-3 mr-1" /> Add choice
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, newSubQuestion()])}
        className="w-full border-2"
        style={{ borderColor: DS.outlineVariant, color: DS.primary, backgroundColor: DS.surfaceContainerLow }}>
        <Plus className="w-4 h-4 mr-2" /> Add question
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
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Question Content *</Label>
        <MarkdownEditor value={content} onChange={setContent} rows={4}
          placeholder="Enter question content (Markdown supported)..." />
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: DS.primaryPale, border: `1px solid ${DS.primaryPaleDim}` }}>
        <Switch checked={allowMultiple} onCheckedChange={setAllowMultiple} id="allow-multiple" />
        <Label htmlFor="allow-multiple" className="text-sm font-medium cursor-pointer" style={{ color: DS.onPrimaryContainer }}>
          Allow multiple correct answers
        </Label>
        <span className="text-xs ml-auto px-2 py-1 rounded-full" style={{ backgroundColor: DS.secondaryContainer, color: DS.onSecondaryContainer }}>
          {allowMultiple ? "Multiple answers" : "Single answer"}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium" style={{ color: DS.onSurface }}>Answer Choices</Label>
          <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ backgroundColor: DS.secondaryContainer, color: DS.onSecondaryContainer }}>
            {options.filter(o => o.isCorrect).length} correct
          </span>
        </div>
        <div className="space-y-3">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-3 p-4 rounded-xl transition-all"
              style={{
                backgroundColor: opt.isCorrect ? DS.secondaryContainer : DS.surfaceContainerLowest,
                border: `2px solid ${opt.isCorrect ? DS.secondary : DS.outlineVariant}`,
              }}>
              <button type="button" onClick={() => toggleCorrect(i)}
                className="flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: opt.isCorrect ? DS.secondary : DS.outlineVariant,
                  backgroundColor: opt.isCorrect ? DS.secondary : 'transparent',
                }}>
                {opt.isCorrect
                  ? allowMultiple ? <CheckCircle2 className="w-4 h-4 text-white" /> : <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  : <Circle className="w-4 h-4" style={{ color: DS.outline }} />}
              </button>
              <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{
                  backgroundColor: opt.isCorrect ? DS.secondary : DS.surfaceContainer,
                  color: opt.isCorrect ? DS.onSecondary : DS.onSurfaceVariant,
                }}>
                {letters[i]}
              </span>
              <Input value={opt.text} onChange={e => updateOption(i, { text: e.target.value })}
                placeholder={`Choice ${letters[i]}`}
                className="flex-1 border-0 shadow-none p-0 h-auto text-sm focus-visible:ring-0 bg-transparent"
                style={{ backgroundColor: 'transparent' }} />
              <button type="button" onClick={() => removeOption(i)} disabled={options.length <= 2}
                className="text-gray-400 hover:text-red-400 disabled:opacity-30 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addOption}
          className="mt-3 w-full border-2 border-dashed"
          style={{ borderColor: DS.outlineVariant, color: DS.primary, backgroundColor: DS.surfaceContainerLow }}>
          <Plus className="w-4 h-4 mr-1" /> Add choice
        </Button>
      </div>

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Explanation (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={3}
          placeholder="Explain why this is the correct answer (Markdown supported)..." />
      </div>
    </div>
  );
}

function TrueFalseForm({ content, setContent, correctAnswer, setCorrectAnswer, explanation, setExplanation }:
  { content: string; setContent: (v: string) => void; correctAnswer: string; setCorrectAnswer: (v: string) => void;
    explanation: string; setExplanation: (v: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Statement *</Label>
        <MarkdownEditor value={content} onChange={setContent} rows={3}
          placeholder="Enter the statement to evaluate as true or false (Markdown supported)..." />
      </div>

      <div>
        <Label className="text-sm font-medium block mb-3" style={{ color: DS.onSurface }}>Correct Answer *</Label>
        <div className="grid grid-cols-2 gap-4">
          {[{ value: "Đúng", label: "True", color: "secondary" }, { value: "Sai", label: "False", color: "tertiary" }].map(({ value, label, color }) => {
            const c = getColorClasses(color as ColorKey);
            const isSelected = correctAnswer === value;
            return (
              <button key={value} type="button" onClick={() => setCorrectAnswer(value)}
                className="py-6 rounded-2xl border-2 text-xl font-semibold transition-all"
                style={{
                  borderColor: isSelected ? c.bg : c.light,
                  backgroundColor: isSelected ? c.bg : c.light,
                  color: isSelected ? c.text === DS.secondary ? DS.onSecondary : DS.onTertiary : c.text,
                  boxShadow: isSelected ? `0 4px 12px ${c.bg}30` : 'none',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Explanation (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={3}
          placeholder="Explain why this statement is true or false (Markdown supported)..." />
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
      <span style={{ color: DS.onSurface }}>{part}</span>
      {i < arr.length - 1 && (
        <span className="inline-block mx-1 px-3 py-0.5 rounded font-medium text-sm" style={{ backgroundColor: DS.tertiaryContainer, color: DS.onTertiaryContainer }}>
          [{i + 1}]
        </span>
      )}
    </span>
  ));

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Text Content *</Label>
        <p className="text-xs mb-2 flex items-center gap-1" style={{ color: DS.tertiary }}>
          <Info className="w-3.5 h-3.5" />
          Type <code className="px-1 rounded text-xs font-mono" style={{ backgroundColor: DS.tertiaryContainer }}>__BLANK__</code> to create a blank
        </p>
        <Textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="Example: The cat __BLANK__ on the mat and the dog __BLANK__ outside."
          rows={4} className="text-sm font-mono"
          style={{ backgroundColor: DS.surfaceContainerLowest, borderColor: DS.outlineVariant }} />
      </div>

      {blanks > 0 && (
        <div className="p-4 rounded-xl" style={{ backgroundColor: DS.surfaceContainerLow, border: `1px solid ${DS.outlineVariant}` }}>
          <p className="text-xs font-medium mb-2" style={{ color: DS.onSurfaceVariant }}>Preview:</p>
          <p className="text-sm leading-relaxed" style={{ color: DS.onSurface }}>{preview}</p>
        </div>
      )}

      {blanks > 0 ? (
        <div>
          <Label className="text-sm font-medium block mb-3" style={{ color: DS.onSurface }}>
            Answers for {blanks} blank{blanks > 1 ? "s" : ""}
          </Label>
          <div className="space-y-3">
            {Array.from({ length: blanks }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: DS.tertiaryContainer, color: DS.onTertiaryContainer }}>{i + 1}</span>
                <Input value={blanksAnswers[i] ?? ""}
                  onChange={e => {
                    const next = [...blanksAnswers];
                    next[i] = e.target.value;
                    setBlanksAnswers(next);
                  }}
                  placeholder={`Answer for blank ${i + 1}`}
                  className="flex-1 text-sm"
                  style={{ borderColor: DS.tertiaryContainer }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl text-center text-sm" style={{ backgroundColor: DS.tertiaryContainer, color: DS.onTertiaryContainer }}>
          No blanks yet. Type <code className="font-mono px-1 rounded">__BLANK__</code> in the text above.
        </div>
      )}

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Explanation (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={3} placeholder="Explain the answers (Markdown supported)..." />
      </div>
    </div>
  );
}

function WordSelectionForm({ instruction, setInstruction, passage, setPassage, selectedWords, setSelectedWords, explanation, setExplanation }:
  { instruction: string; setInstruction: (v: string) => void; passage: string; setPassage: (v: string) => void;
    selectedWords: string[]; setSelectedWords: (v: string[]) => void; explanation: string; setExplanation: (v: string) => void }) {

  const words = passage.trim() ? passage.trim().split(/\s+/) : [];

  function toggleWord(w: string) {
    setSelectedWords(selectedWords.includes(w)
      ? selectedWords.filter(s => s !== w)
      : [...selectedWords, w]);
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Instructions *</Label>
        <Input value={instruction} onChange={e => setInstruction(e.target.value)}
          placeholder="Example: Select the misspelled words in the passage" className="text-sm" />
      </div>

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Passage *</Label>
        <Textarea value={passage} onChange={e => { setPassage(e.target.value); setSelectedWords([]); }}
          placeholder="Enter the passage for students to select words from..." rows={4} className="text-sm" />
      </div>

      {words.length > 0 && (
        <div>
          <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>
            Click words to mark as correct answer
          </Label>
          <div className="p-5 rounded-xl leading-loose" style={{ backgroundColor: DS.surfaceContainerLow, border: `1px solid ${DS.outlineVariant}` }}>
            {passage.trim().split(/\s+/).map((word, i) => {
              const clean = word.replace(/[^\w]/g, "");
              const isSelected = selectedWords.includes(word) || selectedWords.includes(clean);
              return (
                <span key={i}>
                  <button type="button" onClick={() => toggleWord(word)}
                    className="inline-block px-1.5 py-1 rounded-lg text-sm font-medium mx-0.5 transition-all"
                    style={{
                      backgroundColor: isSelected ? DS.primary : 'transparent',
                      color: isSelected ? DS.onPrimary : DS.onSurface,
                    }}>
                    {word}
                  </button>
                  {" "}
                </span>
              );
            })}
          </div>
          {selectedWords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs font-medium w-full mb-1" style={{ color: DS.onSurfaceVariant }}>Selected words ({selectedWords.length}):</span>
              {selectedWords.map((w, i) => (
                <span key={i} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: DS.primaryPale, color: DS.onPrimaryContainer }}>
                  {w}
                  <button type="button" onClick={() => toggleWord(w)} className="font-bold ml-1 hover:opacity-70">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Explanation (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={3} placeholder="Explain the answers (Markdown supported)..." />
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
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Instructions</Label>
        <Input value={content} onChange={e => setContent(e.target.value)}
          placeholder="Example: Match the words with their corresponding meanings" className="text-sm" />
      </div>

      <div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="text-center py-2.5 rounded-xl" style={{ backgroundColor: DS.primaryPale, border: `1px solid ${DS.primaryPaleDim}` }}>
            <span className="text-sm font-semibold" style={{ color: DS.onPrimaryContainer }}>Column A (Left)</span>
          </div>
          <div className="text-center py-2.5 rounded-xl" style={{ backgroundColor: DS.secondaryContainer, border: `1px solid ${DS.onSecondaryContainer}` }}>
            <span className="text-sm font-semibold" style={{ color: DS.onSecondaryContainer }}>Column B (Right)</span>
          </div>
        </div>
        <div className="space-y-3">
          {pairs.map((pair, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: DS.primaryPale, color: DS.onPrimaryContainer }}>{i + 1}</span>
              <Input value={pair.left} onChange={e => updatePair(i, "left", e.target.value)}
                placeholder={`A${i + 1}`} className="flex-1 text-sm"
                style={{ borderColor: DS.primaryPaleDim, backgroundColor: DS.surfaceContainerLowest }} />
              <span className="text-lg font-bold" style={{ color: DS.onSurfaceVariant }}>↔</span>
              <Input value={pair.right} onChange={e => updatePair(i, "right", e.target.value)}
                placeholder={`B${i + 1}`} className="flex-1 text-sm"
                style={{ borderColor: DS.secondaryContainer }} />
              <button type="button" onClick={() => removePair(i)} disabled={pairs.length <= 2}
                className="text-gray-400 hover:text-red-400 disabled:opacity-30 transition-colors flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addPair}
          className="mt-3 w-full border-2 border-dashed"
          style={{ borderColor: DS.outlineVariant, color: DS.tertiary, backgroundColor: DS.surfaceContainerLow }}>
          <Plus className="w-4 h-4 mr-1" /> Add pair
        </Button>
      </div>

      <div className="p-3 rounded-xl" style={{ backgroundColor: DS.surfaceContainer, border: `1px solid ${DS.outlineVariant}` }}>
        <p className="text-xs flex items-center gap-1" style={{ color: DS.onSurfaceVariant }}>
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          When students take the quiz, Column B will be shuffled randomly. The order you entered is the correct answer.
        </p>
      </div>

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Explanation (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={3} placeholder="Explain the answers (Markdown supported)..." />
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
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Instructions</Label>
        <Input value={content} onChange={e => setContent(e.target.value)}
          placeholder="Example: Drag words to their correct word type categories" className="text-sm" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium" style={{ color: DS.onSurface }}>Draggable Items</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setItems([...items, ""])}
            className="h-7 text-xs" style={{ color: DS.tertiary }}>
            <Plus className="w-3 h-3 mr-1" /> Add item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 flex-shrink-0" style={{ color: DS.outline }} />
              <span className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: DS.tertiaryContainer, color: DS.onTertiaryContainer }}>{i + 1}</span>
              <Input value={item} onChange={e => setItems(items.map((x, idx) => idx === i ? e.target.value : x))}
                placeholder={`Item ${i + 1}`} className="flex-1 h-9 text-sm" />
              <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                className="text-gray-400 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium" style={{ color: DS.onSurface }}>Drop Zones</Label>
          <Button type="button" variant="ghost" size="sm"
            onClick={() => setZones([...zones, { label: `Zone ${zones.length + 1}`, accepts: [] }])}
            className="h-7 text-xs" style={{ color: DS.tertiary }}>
            <Plus className="w-3 h-3 mr-1" /> Add zone
          </Button>
        </div>
        <div className="space-y-4">
          {zones.map((zone, zi) => (
            <div key={zi} className="p-4 rounded-xl" style={{ backgroundColor: DS.surfaceContainer, border: `2px solid ${DS.outlineVariant}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Input value={zone.label}
                  onChange={e => setZones(zones.map((z, i) => i === zi ? { ...z, label: e.target.value } : z))}
                  className="h-9 text-sm font-medium flex-1"
                  style={{ backgroundColor: DS.surfaceContainerLowest }} />
                <button type="button" onClick={() => setZones(zones.filter((_, i) => i !== zi))}
                  className="text-gray-400 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs mb-2" style={{ color: DS.onSurfaceVariant }}>Select items accepted by this zone:</p>
              <div className="flex flex-wrap gap-2">
                {items.filter(Boolean).map((item, ii) => {
                  const accepted = zone.accepts.includes(item);
                  return (
                    <button key={ii} type="button"
                      onClick={() => updateZoneAccepts(zi, item, !accepted)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all"
                      style={{
                        borderColor: accepted ? DS.tertiary : DS.outlineVariant,
                        backgroundColor: accepted ? DS.tertiary : DS.surfaceContainerLowest,
                        color: accepted ? DS.onTertiary : DS.onSurfaceVariant,
                      }}>
                      {item || `Item ${ii + 1}`}
                      {accepted && " ✓"}
                    </button>
                  );
                })}
                {items.filter(Boolean).length === 0 && (
                  <span className="text-xs italic" style={{ color: DS.onSurfaceVariant }}>Add items above first</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Explanation (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={3} placeholder="Explain the answers (Markdown supported)..." />
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
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Correct Sentence</Label>
        <p className="text-xs mb-2" style={{ color: DS.onSurfaceVariant }}>Enter the complete sentence. The system will split it into words and shuffle them when displaying to students.</p>
        <div className="flex gap-2">
          <Input value={rawSentence} onChange={e => setRawSentence(e.target.value)}
            placeholder="Example: how are you today" className="flex-1 text-sm"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); splitWords(); } }} />
          <Button type="button" variant="outline" onClick={splitWords} className="shrink-0 text-sm font-medium"
            style={{ borderColor: DS.primary, color: DS.primary }}>
            Split
          </Button>
        </div>
      </div>

      {sentences.filter(s => s.trim()).length > 0 && (
        <div>
          <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>
            Correct Order <span className="text-xs font-normal" style={{ color: DS.onSurfaceVariant }}>(use arrows to reorder)</span>
          </Label>
          <div className="space-y-2 mt-2">
            {sentences.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs w-5 text-right font-medium" style={{ color: DS.onSurfaceVariant }}>{i + 1}.</span>
                <Input value={s} onChange={e => setSentences(sentences.map((x, idx) => idx === i ? e.target.value : x))}
                  placeholder={`Word ${i + 1}...`} className="flex-1 h-9 text-sm"
                  style={{ backgroundColor: DS.surfaceContainerLow, borderColor: DS.outlineVariant }} />
                <div className="flex gap-0.5 flex-shrink-0">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                    style={{ color: DS.onSurfaceVariant }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = DS.surfaceContainerHigh}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === sentences.length - 1}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                    style={{ color: DS.onSurfaceVariant }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = DS.surfaceContainerHigh}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
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
            className="mt-2 text-xs" style={{ color: DS.onSurfaceVariant }}>
            <Plus className="w-3 h-3 mr-1" /> Add word
          </Button>

          {completeSentence && (
            <div className="mt-3 px-4 py-3 rounded-xl" style={{ backgroundColor: DS.surfaceContainerLow, border: `1px solid ${DS.outlineVariant}` }}>
              <span className="text-sm" style={{ color: DS.onSurfaceVariant }}>Complete sentence: </span>
              <span className="text-sm font-semibold" style={{ color: DS.onSurface }}>{completeSentence}</span>
            </div>
          )}
        </div>
      )}

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Explanation (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={3} placeholder="Explain the correct order (Markdown supported)..." />
      </div>
    </div>
  );
}

function ReadingForm({ passage, setPassage, subQuestions, setSubQuestions, explanation, setExplanation }:
  { passage: string; setPassage: (v: string) => void; subQuestions: SubQuestion[];
    setSubQuestions: (v: SubQuestion[]) => void; explanation: string; setExplanation: (v: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Passage *</Label>
        <Textarea value={passage} onChange={e => setPassage(e.target.value)}
          placeholder="Paste the reading comprehension passage here..." rows={6} className="text-sm leading-relaxed" />
        {passage && <p className="text-xs mt-1" style={{ color: DS.onSurfaceVariant }}>{passage.split(/\s+/).length} words</p>}
      </div>

      <div>
        <Label className="text-sm font-semibold block mb-3" style={{ color: DS.onSurface }}>
          Questions ({subQuestions.length})
        </Label>
        <SubQuestionBuilder items={subQuestions} onChange={setSubQuestions} accentColor="secondary" />
      </div>

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Explanation (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={3} placeholder="Explain the answers (Markdown supported)..." />
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
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Audio URL *</Label>
        <div className="flex gap-2">
          <Input value={audioUrl} onChange={e => { setAudioUrl(e.target.value); setPlaying(false); }}
            placeholder="https://example.com/audio.mp3" className="flex-1 text-sm" />
        </div>
      </div>

      {audioUrl && (
        <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${DS.primary} 0%, ${DS.secondary} 100%)` }}>
          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
          <div className="flex items-center gap-4">
            <button type="button" onClick={toggle}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-md"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">Audio Preview</p>
              <div className="flex items-end gap-0.5 h-8">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} className={`w-1.5 rounded-full ${playing ? "animate-pulse" : ""}`}
                    style={{
                      height: `${30 + Math.sin(i) * 50}%`,
                      animationDelay: `${i * 0.05}s`,
                      backgroundColor: 'rgba(255,255,255,0.7)'
                    }} />
                ))}
              </div>
            </div>
            <Volume2 className="w-5 h-5 opacity-70" />
          </div>
        </div>
      )}

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Transcript (optional)</Label>
        <Textarea value={passage} onChange={e => setPassage(e.target.value)}
          placeholder="Transcript content of the audio file..." rows={4} className="text-sm" />
      </div>

      <div>
        <Label className="text-sm font-semibold block mb-3" style={{ color: DS.onSurface }}>
          Questions ({subQuestions.length})
        </Label>
        <SubQuestionBuilder items={subQuestions} onChange={setSubQuestions} accentColor="primary" />
      </div>

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Explanation (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={3} placeholder="Explain the answers (Markdown supported)..." />
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
    if (t === "note") return tq.content?.slice(0, 60) || "No content";
    return tq.question?.slice(0, 60) || "No question";
  }

  const sortedIndices = timedQuestions.map((_, i) => i).sort((a, b) => timedQuestions[a].timestamp - timedQuestions[b].timestamp);

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>YouTube Video URL</Label>
        <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... or direct video URL" className="text-sm" />
      </div>

      {videoUrl && (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DS.outlineVariant}` }}>
          {isYouTube ? (
            <div ref={ytContainerRef} className="w-full aspect-video bg-black" />
          ) : (
            <video ref={videoRef} src={videoUrl} controls className="w-full aspect-video"
              onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration || 0); }}
              onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); }} />
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm" style={{ color: DS.onSurfaceVariant }}>
          <Play className="w-3.5 h-3.5" />
          <span className="font-mono">{fmtMM(currentTime)} / {duration > 0 ? fmtMM(duration) : "--:--"}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={markAtCurrentTime}
          className="h-8 text-xs gap-1.5"
          style={{ borderColor: DS.tertiary, color: DS.tertiary }}>
          <Clock className="w-3.5 h-3.5" /> Mark {fmtMM(currentTime)}
        </Button>
      </div>

      {videoUrl && (
        <div className="space-y-1">
          <p className="text-xs" style={{ color: DS.onSurfaceVariant }}>Load video to display timeline</p>
          <div ref={timelineRef} className="relative h-3 cursor-pointer rounded-full"
            style={{ backgroundColor: DS.surfaceContainerHigh, border: `1px solid ${DS.outlineVariant}` }}
            onClick={handleTimelineClick}>
            {duration > 0 && (
              <>
                <div className="absolute top-0 left-0 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%`, backgroundColor: DS.tertiaryContainer }} />
                {timedQuestions.map((tq, qi) => {
                  const pct = Math.max(0, Math.min(100, (tq.timestamp / duration) * 100));
                  const isNote = (tq.type ?? "question") === "note";
                  return (
                    <div key={qi} className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow z-10`}
                      style={{ left: `${pct}%`, backgroundColor: isNote ? DS.tertiary : DS.primary }}
                      title={`${isNote ? "Note" : "Question"} — ${fmtMM(tq.timestamp)}`} />
                  );
                })}
              </>
            )}
          </div>
          {duration === 0 && (
            <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 mt-1"
              style={{ backgroundColor: DS.surfaceContainer, color: DS.onSurfaceVariant }}>
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              Press Play to load video duration. The timeline will display accurately after.
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: DS.onSurfaceVariant }} />
            <Label className="text-sm font-semibold" style={{ color: DS.onSurface }}>Timestamps ({timedQuestions.length})</Label>
          </div>
          <Button type="button" variant="outline" size="sm"
            onClick={() => { setTimedQuestions([...timedQuestions, newVideoQuestion("question")]); setExpandedIdx(timedQuestions.length); }}
            className="h-7 text-xs gap-1"
            style={{ borderColor: DS.outlineVariant, color: DS.primary }}>
            <Plus className="w-3 h-3" /> Add Timestamp
          </Button>
        </div>

        <div className="space-y-2">
          {sortedIndices.map((qi) => {
            const tq = timedQuestions[qi];
            const isExpanded = expandedIdx === qi;
            const tsType = tq.type ?? "question";
            const isNote = tsType === "note";

            return (
              <div key={qi} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DS.outlineVariant}`, backgroundColor: DS.surfaceContainerLowest }}>
                <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors"
                  onClick={() => toggleExpand(qi)}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = DS.surfaceContainerLow}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); seekToTimestamp(qi); }}
                    className="text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0">
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: isNote ? DS.tertiary : DS.primary }}>
                    {fmtMM(tq.timestamp)}
                  </span>
                  <span className="text-xs font-semibold flex-shrink-0"
                    style={{ color: isNote ? DS.onTertiaryContainer : DS.onPrimaryContainer }}>
                    {isNote ? "Note" : "Question"}
                  </span>
                  <span className="text-xs truncate flex-1 min-w-0" style={{ color: DS.onSurfaceVariant }}>{previewText(tq)}</span>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                    <button type="button" onClick={(e) => { e.stopPropagation(); seekToTimestamp(qi); }}
                      className="p-1 rounded transition-colors"
                      style={{ color: DS.onSurfaceVariant }}
                      title="Jump to timestamp">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteTimestamp(qi); }}
                      className="p-1 rounded transition-colors"
                      style={{ color: DS.error }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: DS.onSurfaceVariant }} /> : <ChevronDown className="w-4 h-4" style={{ color: DS.onSurfaceVariant }} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: DS.outlineVariant, backgroundColor: DS.surfaceContainerLow }}>
                    <div className="grid grid-cols-[1fr_auto] gap-4">
                      <div>
                        <Label className="text-xs font-medium block mb-1" style={{ color: DS.onSurfaceVariant }}>Timestamp (MM:SS)</Label>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                            style={{ border: `1px solid ${DS.outlineVariant}`, backgroundColor: DS.surfaceContainerLowest }}>
                            <Clock className="w-3.5 h-3.5" style={{ color: DS.onSurfaceVariant }} />
                            <Input value={fmtMM(tq.timestamp)}
                              onChange={e => updateQ(qi, { timestamp: parseMM(e.target.value) })}
                              className="w-20 h-6 border-0 shadow-none p-0 text-sm font-mono focus-visible:ring-0"
                              style={{ backgroundColor: 'transparent' }} />
                          </div>
                          <button type="button"
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ border: `1px solid ${DS.outlineVariant}`, backgroundColor: DS.surfaceContainerLowest }}
                            onClick={() => { updateQ(qi, { timestamp: Math.round(currentTime) }); }}
                            title="Set to current time">
                            <RotateCcw className="w-3.5 h-3.5" style={{ color: DS.onSurfaceVariant }} />
                          </button>
                        </div>
                        <p className="text-xs mt-1" style={{ color: DS.onSurfaceVariant }}>Current: <span className="font-mono" style={{ color: DS.onSurface }}>{fmtMM(currentTime)}</span></p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium block mb-1" style={{ color: DS.onSurfaceVariant }}>Type</Label>
                        <Select value={tsType} onValueChange={(v: "note" | "question") => updateQ(qi, { type: v })}>
                          <SelectTrigger className="w-[140px] h-9 text-sm" style={{ backgroundColor: DS.surfaceContainerLowest }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="note">
                              <span className="flex items-center gap-2"><StickyNote className="w-3.5 h-3.5" style={{ color: DS.tertiary }} /> Note</span>
                            </SelectItem>
                            <SelectItem value="question">
                              <span className="flex items-center gap-2"><HelpCircle className="w-3.5 h-3.5" style={{ color: DS.primary }} /> Question</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {isNote ? (
                      <div>
                        <Label className="text-xs font-medium block mb-1" style={{ color: DS.onSurfaceVariant }}>Note Content</Label>
                        <Textarea value={tq.content ?? ""} onChange={e => updateQ(qi, { content: e.target.value })}
                          placeholder="Enter note or tip for students at this timestamp..."
                          rows={3} className="text-sm"
                          style={{ backgroundColor: DS.surfaceContainerLowest }} />
                      </div>
                    ) : (
                      <>
                        <div>
                          <Label className="text-xs font-medium block mb-1" style={{ color: DS.onSurfaceVariant }}>Question</Label>
                          <Input value={tq.question} onChange={e => updateQ(qi, { question: e.target.value })}
                            placeholder="Enter question at this timestamp..."
                            className="text-sm"
                            style={{ backgroundColor: DS.surfaceContainerLowest }} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs font-medium block mb-1" style={{ color: DS.onSurfaceVariant }}>Question Type</Label>
                            <Select value="mcq">
                              <SelectTrigger className="h-9 text-sm" style={{ backgroundColor: DS.surfaceContainerLowest }}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mcq">Multiple Choice</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-medium block mb-1" style={{ color: DS.onSurfaceVariant }}>Points</Label>
                            <Input type="number" min={0} value={tq.points ?? 10}
                              onChange={e => updateQ(qi, { points: parseInt(e.target.value, 10) || 0 })}
                              className="h-9 text-sm"
                              style={{ backgroundColor: DS.surfaceContainerLowest }} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-medium block mb-1.5" style={{ color: DS.onSurfaceVariant }}>Choices</Label>
                          <div className="space-y-2">
                            {tq.choices.map((ch, ci) => (
                              <div key={ci} className="flex items-center gap-2">
                                <button type="button" onClick={() => updateQ(qi, { correctAnswer: ch })}
                                  className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                                  style={{
                                    borderColor: ch && tq.correctAnswer === ch ? DS.secondary : DS.outlineVariant,
                                    backgroundColor: ch && tq.correctAnswer === ch ? DS.secondary : 'transparent',
                                  }}>
                                  {ch && tq.correctAnswer === ch && <div className="w-2 h-2 rounded-full bg-white" />}
                                </button>
                                <Input value={ch} onChange={e => updateChoice(qi, ci, e.target.value)}
                                  placeholder={`Choice ${ci + 1}`}
                                  className="flex-1 h-9 text-sm"
                                  style={{ backgroundColor: DS.surfaceContainerLowest }} />
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
                            className="flex items-center gap-1 text-xs font-medium mt-2" style={{ color: DS.primary }}>
                            <Plus className="w-3 h-3" /> Add choice
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
            <div className="text-center py-10 border-2 border-dashed rounded-xl text-sm"
              style={{ borderColor: DS.outlineVariant, color: DS.onSurfaceVariant }}>
              {videoUrl
                ? 'Press "Mark" or "+ Add Timestamp" to add questions and notes at specific timestamps.'
                : "Enter video URL first, then add questions at specific timestamps."}
            </div>
          )}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Explanation (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={3} placeholder="Explain the answers (Markdown supported)..." />
      </div>
    </div>
  );
}

function EssayForm({ content, setContent, explanation, setExplanation, autoGrade, setAutoGrade }:
  { content: string; setContent: (v: string) => void; explanation: string; setExplanation: (v: string) => void; autoGrade?: boolean; setAutoGrade?: (v: boolean) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Prompt / Question *</Label>
        <MarkdownEditor value={content} onChange={setContent} rows={5}
          placeholder="Enter the essay prompt or question (Markdown supported)..." />
      </div>
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Rubric / Guidelines (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={6}
          placeholder="Sample answer or grading criteria for teachers (Markdown supported)..." />
      </div>
      {setAutoGrade && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: DS.surfaceContainer, border: `1px solid ${DS.outlineVariant}` }}>
          <input type="checkbox" id="essay-auto-grade-qf" checked={autoGrade ?? false} onChange={e => setAutoGrade(e.target.checked)} className="rounded" />
          <div>
            <label htmlFor="essay-auto-grade-qf" className="text-sm font-medium cursor-pointer" style={{ color: DS.onSurface }}>Auto-grade with AI</label>
            <p className="text-xs mt-0.5" style={{ color: DS.onSurfaceVariant }}>AI will automatically grade this essay when students submit</p>
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
    { value: "text", label: "Text", icon: AlignLeft, color: DS.primary },
    { value: "audio", label: "Audio", icon: Mic, color: DS.tertiary },
    { value: "image", label: "Image", icon: Image, color: DS.secondary },
  ];
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Prompt / Question *</Label>
        <MarkdownEditor value={content} onChange={setContent} rows={5}
          placeholder="Enter the open-ended question (Markdown supported)..." />
      </div>
      <div>
        <Label className="text-sm font-medium block mb-3" style={{ color: DS.onSurface }}>Allowed Response Types *</Label>
        <div className="flex gap-4">
          {typeOptions.map(opt => {
            const Icon = opt.icon;
            const isActive = allowedTypes.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleType(opt.value)}
                className="flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 text-sm font-medium transition-all"
                style={{
                  borderColor: isActive ? opt.color : DS.outlineVariant,
                  backgroundColor: isActive ? `${opt.color}15` : DS.surfaceContainerLowest,
                  color: isActive ? opt.color : DS.onSurfaceVariant,
                }}
              >
                <Icon className="w-5 h-5" />
                {opt.label}
                {isActive && <Check className="w-4 h-4 ml-1" />}
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-2" style={{ color: DS.onSurfaceVariant }}>Select at least 1 type. Students will choose how to respond when taking the quiz.</p>
      </div>
      <div>
        <Label className="text-sm font-medium block mb-2" style={{ color: DS.onSurface }}>Rubric / Guidelines (optional)</Label>
        <MarkdownEditor value={explanation} onChange={setExplanation} rows={4}
          placeholder="Grading criteria for teachers (Markdown supported)..." />
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
    { label: "Zone 1", accepts: [] }, { label: "Zone 2", accepts: [] },
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

  // AI generator dialog
  const [aiOpen, setAiOpen] = useState(false);

  const applyAIDraft = (draft: {
    type: string; skill: string; level: string; content: string;
    explanation: string | null; options: string | null;
    correctAnswer: string | null; passage: string | null; points: number;
  }) => {
    setQType(draft.type);
    setSkill(draft.skill);
    setLevel(draft.level);
    setPoints(draft.points || 1);
    setContent(draft.content);
    setExplanation(draft.explanation ?? "");

    const opts = draft.options ? safeJson<unknown>(draft.options, null) : null;

    if (draft.type === "mcq" && Array.isArray(opts)) {
      const optList = opts as Array<{ id?: string; text?: string; isCorrect?: boolean }>;
      const correctId = (draft.correctAnswer ?? "").trim().toLowerCase();
      setMcqOptions(optList.map(o => ({
        text: o.text ?? "",
        isCorrect: o.isCorrect === true || (o.id ?? "").toLowerCase() === correctId,
      })));
      setAllowMultiple(false);
    } else if (draft.type === "true_false") {
      setTfAnswer((draft.correctAnswer ?? "").toLowerCase() === "true" ? "true" : "false");
    } else if (draft.type === "fill_blank") {
      setContent(draft.content.replace(/_{3,}/g, "__BLANK__"));
      const ans = draft.correctAnswer ? safeJson<string[]>(draft.correctAnswer, []) : [];
      setBlanksAnswers(Array.isArray(ans) ? ans : []);
    } else if (draft.type === "reading") {
      setReadPassage(draft.passage ?? "");
      if (Array.isArray(opts)) {
        const subs = (opts as any[]).map(s => {
          const choices: string[] = Array.isArray(s.options)
            ? s.options.map((o: any) => o.text ?? "")
            : Array.isArray(s.choices) ? s.choices : ["", "", "", ""];
          let correct = "";
          if (Array.isArray(s.options)) {
            const c = s.options.find((o: any) => o.isCorrect);
            correct = c?.text ?? "";
          } else if (s.correctAnswer) {
            correct = String(s.correctAnswer);
          }
          return {
            question: String(s.question ?? ""),
            choices: (choices.length >= 2 ? choices : ["", "", "", ""]) as string[],
            correctAnswer: correct,
            points: typeof s.points === "number" ? s.points : 1,
          } as SubQuestion;
        });
        setReadSubQs(subs.length > 0 ? subs : [newSubQuestion()]);
      }
    }
  };

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
      <div className="max-w-6xl mx-auto space-y-4 p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const typeCfg = QUESTION_TYPES.find(t => t.value === qType);
  const typeColors = getColorClasses(typeCfg?.color as ColorKey || "primary");

  return (
    <div className="min-h-screen" style={{ backgroundColor: DS.surface }}>
      {/* Modern Header - Nature Inspired */}
      <header className="sticky top-0 z-30 backdrop-blur-xl shadow-sm" style={{ backgroundColor: `${DS.surface}F2`, borderBottom: `1px solid ${DS.outlineVariant}` }}>
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/questions")}
                className="gap-2"
                style={{ color: DS.onSurfaceVariant }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = DS.surfaceContainer}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="h-8 w-px" style={{ backgroundColor: DS.outlineVariant }} />
              <div>
                <h1 className="text-lg font-semibold" style={{ color: DS.onSurface, fontFamily: 'Lexend, sans-serif' }}>
                  {isEditing ? "Edit Question" : "Create Question"}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs font-medium"
                    style={{ borderColor: DS.primaryPaleDim, color: DS.primary, backgroundColor: DS.primaryPale }}>
                    {SKILL_LABELS[skill]}
                  </Badge>
                  <span className="text-xs" style={{ color: DS.onSurfaceVariant }}>Level {level}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAiOpen(true)}
                className="gap-2 text-white border-0 shadow-md"
                style={{ background: `linear-gradient(135deg, ${DS.tertiary} 0%, ${DS.secondary} 100%)` }}>
                <Sparkles className="w-4 h-4" />
                AI Generate
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="gap-2 text-white shadow-lg"
                style={{
                  backgroundColor: DS.primary,
                  boxShadow: `0 4px 12px ${DS.primary}40`,
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = DS.secondary}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = DS.primary}>
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : isEditing ? "Update" : "Save Question"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Question Types */}
          <aside className="w-80 flex-shrink-0">
            <div className="rounded-2xl overflow-hidden shadow-sm sticky top-28"
              style={{ backgroundColor: DS.surfaceContainerLowest, border: `1px solid ${DS.outlineVariant}` }}>
              {/* Header */}
              <div className="px-4 py-3"
                style={{ background: `linear-gradient(135deg, ${DS.primary} 0%, ${DS.secondary} 100%)` }}>
                <h2 className="text-sm font-semibold flex items-center gap-2 text-white" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  <FileQuestion className="w-4 h-4" />
                  Question Type
                </h2>
              </div>

              {/* Question Categories */}
              <div className="p-3">
                {QUESTION_CATEGORIES.map((category) => (
                  <div key={category.title} className="mb-4 last:mb-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-2"
                      style={{ color: DS.onSurfaceVariant, fontFamily: 'Lexend, sans-serif' }}>
                      {category.title}
                    </p>
                    <div className="space-y-1">
                      {category.types.map((typeValue) => {
                        const t = QUESTION_TYPES.find(qt => qt.value === typeValue);
                        if (!t) return null;
                        const isActive = qType === t.value;
                        const tc = getColorClasses(t.color as ColorKey);

                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setQType(t.value)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                            style={{
                              backgroundColor: isActive ? tc.bg : 'transparent',
                              color: isActive ? DS.onPrimary : DS.onSurface,
                              boxShadow: isActive ? `0 2px 8px ${tc.bg}30` : 'none',
                            }}
                            onMouseEnter={e => {
                              if (!isActive) e.currentTarget.style.backgroundColor = DS.surfaceContainer;
                            }}
                            onMouseLeave={e => {
                              if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                            }}>
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                              style={{
                                backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : tc.light,
                                color: isActive ? DS.onPrimary : tc.bg,
                              }}>
                              {t.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>
                                {t.label}
                              </p>
                            </div>
                            {isActive && <ChevronRight className="w-4 h-4 opacity-70" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Settings Section */}
              <div className="border-t px-4 py-4" style={{ borderColor: DS.outlineVariant }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-3"
                  style={{ color: DS.onSurfaceVariant, fontFamily: 'Lexend, sans-serif' }}>
                  Settings
                </p>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium block mb-1" style={{ color: DS.onSurfaceVariant }}>Skill</Label>
                    <Select value={skill} onValueChange={setSkill}>
                      <SelectTrigger className="h-9 text-sm" style={{ backgroundColor: DS.surfaceContainerLow, borderColor: DS.outlineVariant }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SKILLS.map(s => (
                          <SelectItem key={s} value={s}>{SKILL_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-medium block mb-1" style={{ color: DS.onSurfaceVariant }}>Level</Label>
                    <Select value={level} onValueChange={setLevel}>
                      <SelectTrigger className="h-9 text-sm" style={{ backgroundColor: DS.surfaceContainerLow, borderColor: DS.outlineVariant }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map(l => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(qType === "reading" || qType === "listening") ? (
                    <div>
                      <Label className="text-xs font-medium block mb-1" style={{ color: DS.onSurfaceVariant }}>Points (auto)</Label>
                      <div className="h-9 flex items-center px-3 rounded-lg text-sm font-medium"
                        style={{ backgroundColor: DS.primaryPale, color: DS.onPrimaryContainer }}>
                        {qType === "reading"
                          ? readSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0)
                          : lisSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0)
                        } points
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs font-medium block mb-1" style={{ color: DS.onSurfaceVariant }}>Points</Label>
                      <Input type="number" min={1} value={points} onChange={e => setPoints(parseInt(e.target.value, 10) || 1)}
                        className="h-9 text-sm"
                        style={{ backgroundColor: DS.surfaceContainerLow, borderColor: DS.outlineVariant }} />
                    </div>
                  )}

                  <div>
                    <Label className="text-xs font-medium block mb-1" style={{ color: DS.onSurfaceVariant }}>Image URL (optional)</Label>
                    <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                      placeholder="https://..." className="h-9 text-xs"
                      style={{ backgroundColor: DS.surfaceContainerLow, borderColor: DS.outlineVariant }} />
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Question Type Header */}
            <div className="mb-6 p-5 rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${DS.surfaceContainerLowest} 0%, ${typeColors.light}30 100%)`,
                border: `2px solid ${typeColors.light}`,
              }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-lg"
                  style={{ backgroundColor: typeColors.bg }}>
                  {typeCfg?.icon}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold" style={{ color: DS.onSurface, fontFamily: 'Lexend, sans-serif' }}>{typeCfg?.label}</h2>
                  <p className="text-sm mt-0.5" style={{ color: DS.onSurfaceVariant }}>
                    {qType === "mcq" && "Create multiple choice questions with one or more correct answers"}
                    {qType === "true_false" && "Students determine if a statement is true or false"}
                    {qType === "fill_blank" && "Fill in missing words in a sentence or paragraph"}
                    {qType === "word_selection" && "Students click on correct words in a passage"}
                    {qType === "matching" && "Match items from two columns correctly"}
                    {qType === "drag_drop" && "Drag items and drop them into correct zones"}
                    {qType === "sentence_reorder" && "Arrange words into the correct sentence order"}
                    {qType === "reading" && "Reading comprehension with multiple questions"}
                    {qType === "listening" && "Audio-based comprehension questions"}
                    {qType === "video_interactive" && "Interactive video with timestamped questions"}
                    {qType === "essay" && "Open-ended writing prompts for detailed responses"}
                    {qType === "open_end" && "Flexible responses: text, audio, or images"}
                  </p>
                </div>
                <Badge className="px-3 py-1.5 text-sm font-medium"
                  style={{ backgroundColor: typeColors.bg, color: DS.onPrimary, fontFamily: 'Lexend, sans-serif' }}>
                  {typeCfg?.icon} {typeCfg?.label}
                </Badge>
              </div>
            </div>

            {/* Form Content */}
            <div className="rounded-2xl overflow-hidden shadow-sm"
              style={{ backgroundColor: DS.surfaceContainerLowest, border: `1px solid ${DS.outlineVariant}` }}>
              {/* Image Preview */}
              {imageUrl && (
                <div className="border-b px-4 py-4" style={{ borderColor: DS.outlineVariant }}>
                  <div className="rounded-xl overflow-hidden max-h-48" style={{ border: `1px solid ${DS.outlineVariant}` }}>
                    <img src={imageUrl} alt="Question image" className="w-full h-full object-contain" style={{ backgroundColor: DS.surfaceContainer }} />
                  </div>
                </div>
              )}

              {/* Form Sections */}
              <div className="p-6">
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

              {/* Bottom Actions */}
              <div className="border-t px-6 py-4 flex items-center justify-between"
                style={{ backgroundColor: DS.surfaceContainerLow, borderColor: DS.outlineVariant }}>
                <Button variant="ghost" onClick={() => navigate("/questions")}
                  style={{ color: DS.onSurfaceVariant }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2 text-white shadow-lg px-8"
                  style={{
                    backgroundColor: DS.primary,
                    boxShadow: `0 4px 12px ${DS.primary}40`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = DS.secondary}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = DS.primary}>
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : isEditing ? "Update Question" : "Save Question"}
                </Button>
              </div>
            </div>

            {/* AI Generator Dialog */}
            <AIQuestionGeneratorDialog
              open={aiOpen}
              onOpenChange={setAiOpen}
              defaultType={qType}
              defaultSkill={skill}
              defaultLevel={level}
              onApply={applyAIDraft}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
