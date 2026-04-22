import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageIcon } from "lucide-react";
import {
  McqForm, TrueFalseForm, FillBlankForm, WordSelectionForm,
  MatchingForm, DragDropForm, SentenceReorderForm, ReadingForm,
  ListeningForm, VideoInteractiveForm, EssayForm, OpenEndForm,
  newSubQuestion,
  type McqOption, type MatchingPair, type DragZone, type SubQuestion, type VideoQuestion,
} from "@/components/question-type-forms";

export const TYPE_LABELS: Record<string, string> = {
  mcq: "Trắc nghiệm", true_false: "Đúng/Sai", fill_blank: "Điền vào chỗ trống",
  word_selection: "Chọn từ", matching: "Nối cặp", drag_drop: "Kéo thả",
  sentence_reorder: "Sắp xếp câu", reading: "Đọc hiểu", listening: "Nghe hiểu",
  video_interactive: "Video tương tác", essay: "Bài luận", open_end: "Câu hỏi mở",
  short_answer: "Tự luận ngắn", long_answer: "Tự luận dài",
};

export const TYPE_ICONS: Record<string, string> = {
  mcq: "🔤", true_false: "✓✗", fill_blank: "___", word_selection: "Aa",
  matching: "↔", drag_drop: "⇅", sentence_reorder: "↕", reading: "📖",
  listening: "🎧", video_interactive: "🎬", essay: "✍️", open_end: "💬",
  short_answer: "✍️", long_answer: "✍️",
};

export const SKILLS = ["reading", "writing", "listening", "speaking"] as const;
export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const SKILL_LABELS: Record<string, string> = { reading: "Đọc", writing: "Viết", listening: "Nghe", speaking: "Nói" };

export function safeJson<T>(str: unknown, fallback: T): T {
  if (str == null) return fallback;
  if (typeof str === "object") return str as T;
  if (typeof str !== "string" || !str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

export interface EditDraft {
  content: string;
  points: number;
  skill: string;
  level: string;
  options: string;
  correctAnswer: string;
  imageUrl: string;
  audioUrl: string;
  videoUrl: string;
  passage: string;
  explanation: string;
  metadata: string;
}

export function QuestionEditDialog({ q, open, onClose, onSave, saving }: {
  q: any; open: boolean; onClose: () => void;
  onSave: (data: Partial<EditDraft>) => void; saving: boolean;
}) {
  const [points, setPoints] = useState(1);
  const [skill, setSkill] = useState("reading");
  const [level, setLevel] = useState("B1");
  const [imageUrl, setImageUrl] = useState("");
  const [content, setContent] = useState("");
  const [explanation, setExplanation] = useState("");

  const [mcqOptions, setMcqOptions] = useState<McqOption[]>([
    { text: "", isCorrect: false }, { text: "", isCorrect: false },
    { text: "", isCorrect: false }, { text: "", isCorrect: false },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [tfAnswer, setTfAnswer] = useState("");
  const [blanksAnswers, setBlanksAnswers] = useState<string[]>([]);
  const [wsInstruction, setWsInstruction] = useState("");
  const [wsPassage, setWsPassage] = useState("");
  const [wsSelectedWords, setWsSelectedWords] = useState<string[]>([]);
  const [matchPairs, setMatchPairs] = useState<MatchingPair[]>([
    { left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" },
  ]);
  const [ddItems, setDdItems] = useState<string[]>(["", "", ""]);
  const [ddZones, setDdZones] = useState<DragZone[]>([
    { label: "Vùng 1", accepts: [] }, { label: "Vùng 2", accepts: [] },
  ]);
  const [srSentences, setSrSentences] = useState<string[]>(["", "", ""]);
  const [readPassage, setReadPassage] = useState("");
  const [readSubQs, setReadSubQs] = useState<SubQuestion[]>([newSubQuestion()]);
  const [lisAudioUrl, setLisAudioUrl] = useState("");
  const [lisTranscript, setLisTranscript] = useState("");
  const [lisSubQs, setLisSubQs] = useState<SubQuestion[]>([newSubQuestion()]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTimedQs, setVideoTimedQs] = useState<VideoQuestion[]>([]);
  const [essayAutoGrade, setEssayAutoGrade] = useState(false);
  const [openEndAllowedTypes, setOpenEndAllowedTypes] = useState<string[]>(["text", "audio"]);

  useEffect(() => {
    if (!q) return;
    setPoints(q.points ?? 1);
    setSkill(q.skill ?? "reading");
    setLevel(q.level ?? "B1");
    setImageUrl(q.imageUrl ?? "");
    setContent(q.content ?? "");
    setExplanation(q.explanation ?? "");

    const meta = safeJson<Record<string, unknown>>(q.metadata, {});
    const opts = safeJson<unknown[]>(typeof q.options === "string" ? q.options : JSON.stringify(q.options ?? []), []);

    if (q.type === "mcq") {
      const strOpts = opts as string[];
      const corrects = (q.correctAnswer ?? "").split(",").map((s: string) => s.trim());
      const am = (meta.allowMultiple as boolean) ?? false;
      setAllowMultiple(am);
      setMcqOptions(strOpts.length > 0
        ? strOpts.map(t => ({ text: t, isCorrect: corrects.includes(t) }))
        : [{ text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }]);
    }
    if (q.type === "true_false") {
      const raw = (q.correctAnswer ?? "").toLowerCase();
      if (raw === "true" || raw === "đúng") setTfAnswer("Đúng");
      else if (raw === "false" || raw === "sai") setTfAnswer("Sai");
      else setTfAnswer(q.correctAnswer ?? "");
    }
    if (q.type === "fill_blank") {
      const parsed = safeJson<string[]>(q.correctAnswer, null as any);
      setBlanksAnswers(Array.isArray(parsed) ? parsed : (q.correctAnswer ? [q.correctAnswer] : []));
    }
    if (q.type === "word_selection") {
      setWsInstruction(q.content ?? "");
      setWsPassage(q.passage ?? "");
      const wsParsed = safeJson<string[]>(q.correctAnswer, null as any);
      setWsSelectedWords(Array.isArray(wsParsed) ? wsParsed : (q.correctAnswer ? q.correctAnswer.split(",").map((s: string) => s.trim()) : []));
    }
    if (q.type === "matching") {
      const rawPairs = Array.isArray(opts) ? opts : [];
      const normalized = rawPairs.map((p: any) => {
        if (typeof p === "string") {
          const [left, right] = p.split(" | ");
          return { left: left ?? "", right: right ?? "" };
        }
        return { left: p?.left ?? "", right: p?.right ?? "" };
      });
      setMatchPairs(normalized.length > 0 ? normalized : [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }]);
    }
    if (q.type === "drag_drop") {
      const ddParsed = safeJson<any>(typeof q.options === "string" ? q.options : JSON.stringify(q.options ?? {}), {});
      const ddItemsParsed: string[] = Array.isArray(ddParsed) ? ddParsed : (Array.isArray(ddParsed.items) ? ddParsed.items : []);
      const ddZonesParsed: DragZone[] = Array.isArray(ddParsed.zones) ? ddParsed.zones : [];
      setDdItems(ddItemsParsed.length ? ddItemsParsed : ["", "", ""]);
      setDdZones(ddZonesParsed.length ? ddZonesParsed : [{ label: "Vùng 1", accepts: [] }, { label: "Vùng 2", accepts: [] }]);
    }
    if (q.type === "sentence_reorder") setSrSentences((opts as string[]).length > 0 ? opts as string[] : ["", "", ""]);
    if (q.type === "reading") {
      setReadPassage(q.passage ?? "");
      const rawSubs = opts as SubQuestion[];
      setReadSubQs(rawSubs.length > 0
        ? rawSubs.map(sq => ({ question: sq.question ?? "", choices: Array.isArray(sq.choices) ? sq.choices : ["", "", "", ""], correctAnswer: sq.correctAnswer ?? "", points: sq.points ?? 1 }))
        : [newSubQuestion()]);
    }
    if (q.type === "listening") {
      setLisAudioUrl(q.audioUrl ?? "");
      setLisTranscript(q.passage ?? "");
      const rawSubs2 = opts as SubQuestion[];
      setLisSubQs(rawSubs2.length > 0
        ? rawSubs2.map(sq => ({ question: sq.question ?? "", choices: Array.isArray(sq.choices) ? sq.choices : ["", "", "", ""], correctAnswer: sq.correctAnswer ?? "", points: sq.points ?? 1 }))
        : [newSubQuestion()]);
    }
    if (q.type === "video_interactive") {
      setVideoUrl(q.videoUrl ?? "");
      const rawVids = opts as VideoQuestion[];
      setVideoTimedQs(rawVids.map(vq => ({ timestamp: vq.timestamp ?? 0, type: vq.type ?? "question", content: vq.content ?? "", question: vq.question ?? "", choices: Array.isArray(vq.choices) ? vq.choices : ["", "", "", ""], correctAnswer: vq.correctAnswer ?? "", points: vq.points ?? 10 })));
    }
    if (q.type === "essay") {
      setEssayAutoGrade((meta.autoGrade as boolean) ?? false);
    }
    if (q.type === "open_end") {
      setOpenEndAllowedTypes(((meta.allowedTypes as string[]) ?? ["text", "audio"]).filter(t => t !== "image"));
    }
  }, [q]);

  if (!q) return null;

  function buildPayload(): Partial<EditDraft> {
    const base: Record<string, unknown> = { points, skill, level, imageUrl: imageUrl || null };
    const qType = q.type;

    if (qType === "mcq") {
      const validOpts = mcqOptions.filter(o => o.text.trim());
      const corrects = validOpts.filter(o => o.isCorrect).map(o => o.text);
      return {
        ...base, content,
        options: JSON.stringify(validOpts.map(o => o.text)),
        correctAnswer: allowMultiple ? corrects.join(",") : (corrects[0] ?? ""),
        metadata: JSON.stringify({ allowMultiple }),
        explanation: explanation || null,
      } as any;
    }
    if (qType === "true_false") {
      return { ...base, content, correctAnswer: tfAnswer, options: JSON.stringify(["Đúng", "Sai"]), explanation: explanation || null } as any;
    }
    if (qType === "fill_blank") {
      return { ...base, content, correctAnswer: JSON.stringify(blanksAnswers), explanation: explanation || null } as any;
    }
    if (qType === "word_selection") {
      return { ...base, content: wsInstruction || content, passage: wsPassage || null, correctAnswer: JSON.stringify(wsSelectedWords), explanation: explanation || null } as any;
    }
    if (qType === "matching") {
      return { ...base, content, options: JSON.stringify(matchPairs), explanation: explanation || null } as any;
    }
    if (qType === "drag_drop") {
      return { ...base, content, options: JSON.stringify({ items: ddItems.filter(Boolean), zones: ddZones }), explanation: explanation || null } as any;
    }
    if (qType === "sentence_reorder") {
      return { ...base, content, options: JSON.stringify(srSentences.filter(Boolean)), explanation: explanation || null } as any;
    }
    if (qType === "reading") {
      const totalReadPts = readSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0);
      return { ...base, points: totalReadPts, content, passage: readPassage || null, options: JSON.stringify(readSubQs), explanation: explanation || null } as any;
    }
    if (qType === "listening") {
      const totalLisPts = lisSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0);
      return { ...base, points: totalLisPts, content, audioUrl: lisAudioUrl || null, passage: lisTranscript || null, options: JSON.stringify(lisSubQs), explanation: explanation || null } as any;
    }
    if (qType === "video_interactive") {
      return { ...base, content, videoUrl: videoUrl || null, options: JSON.stringify(videoTimedQs), explanation: explanation || null } as any;
    }
    if (qType === "open_end") {
      return { ...base, content, explanation: explanation || null, metadata: JSON.stringify({ allowedTypes: openEndAllowedTypes }) } as any;
    }
    if (qType === "short_answer" || qType === "long_answer") {
      return { ...base, content, correctAnswer: tfAnswer || (typeof q.correctAnswer === "string" ? q.correctAnswer : ""), explanation: explanation || null } as any;
    }
    // essay
    return { ...base, content, explanation: explanation || null, metadata: JSON.stringify({ autoGrade: essayAutoGrade }) } as any;
  }

  function handleSave() { onSave(buildPayload()); }

  function renderTypeForm() {
    switch (q.type) {
      case "mcq":
        return <McqForm content={content} setContent={setContent} options={mcqOptions} setOptions={setMcqOptions}
          allowMultiple={allowMultiple} setAllowMultiple={setAllowMultiple} explanation={explanation} setExplanation={setExplanation} />;
      case "true_false":
        return <TrueFalseForm content={content} setContent={setContent} correctAnswer={tfAnswer} setCorrectAnswer={setTfAnswer}
          explanation={explanation} setExplanation={setExplanation} />;
      case "fill_blank":
        return <FillBlankForm content={content} setContent={setContent} blanksAnswers={blanksAnswers} setBlanksAnswers={setBlanksAnswers}
          explanation={explanation} setExplanation={setExplanation} />;
      case "word_selection":
        return <WordSelectionForm instruction={wsInstruction} setInstruction={setWsInstruction} passage={wsPassage} setPassage={setWsPassage}
          selectedWords={wsSelectedWords} setSelectedWords={setWsSelectedWords} explanation={explanation} setExplanation={setExplanation} />;
      case "matching":
        return <MatchingForm content={content} setContent={setContent} pairs={matchPairs} setPairs={setMatchPairs}
          explanation={explanation} setExplanation={setExplanation} />;
      case "drag_drop":
        return <DragDropForm content={content} setContent={setContent} items={ddItems} setItems={setDdItems}
          zones={ddZones} setZones={setDdZones} explanation={explanation} setExplanation={setExplanation} />;
      case "sentence_reorder":
        return <SentenceReorderForm content={content} setContent={setContent} sentences={srSentences} setSentences={setSrSentences}
          explanation={explanation} setExplanation={setExplanation} />;
      case "reading":
        return <ReadingForm passage={readPassage} setPassage={setReadPassage} subQuestions={readSubQs} setSubQuestions={setReadSubQs}
          explanation={explanation} setExplanation={setExplanation} />;
      case "listening":
        return <ListeningForm audioUrl={lisAudioUrl} setAudioUrl={setLisAudioUrl} passage={lisTranscript} setPassage={setLisTranscript}
          subQuestions={lisSubQs} setSubQuestions={setLisSubQs} explanation={explanation} setExplanation={setExplanation} />;
      case "video_interactive":
        return <VideoInteractiveForm videoUrl={videoUrl} setVideoUrl={setVideoUrl} timedQuestions={videoTimedQs} setTimedQuestions={setVideoTimedQs}
          explanation={explanation} setExplanation={setExplanation} />;
      case "essay":
        return <EssayForm content={content} setContent={setContent} explanation={explanation} setExplanation={setExplanation} autoGrade={essayAutoGrade} setAutoGrade={setEssayAutoGrade} />;
      case "open_end":
        return <OpenEndForm content={content} setContent={setContent} explanation={explanation} setExplanation={setExplanation} allowedTypes={openEndAllowedTypes} setAllowedTypes={setOpenEndAllowedTypes} />;
      default:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Nội dung *</Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} rows={3} className="text-sm" />
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Giải thích</Label>
              <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className="text-sm" />
            </div>
          </div>
        );
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{TYPE_ICONS[q.type] ?? "❓"}</span>
            Chỉnh sửa câu hỏi — {TYPE_LABELS[q.type] ?? q.type}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 pb-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Kỹ năng</Label>
              <Select value={skill} onValueChange={setSkill}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SKILLS.map(s => <SelectItem key={s} value={s}>{SKILL_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Cấp độ</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-sm font-semibold text-gray-700 block mb-1.5">Điểm</Label>
              {(q.type === "reading" || q.type === "listening") ? (
                <div>
                  <div className="h-9 flex items-center px-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 font-medium w-24">
                    {q.type === "reading"
                      ? readSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0)
                      : lisSubQs.reduce((s, sq) => s + (sq.points ?? 1), 0)
                    }
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Tổng điểm câu thành phần</p>
                </div>
              ) : (
                <Input type="number" min={0} value={points} onChange={e => setPoints(Number(e.target.value))} className="w-24 text-sm" />
              )}
            </div>
            <div className="flex-1">
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
                <ImageIcon className="w-4 h-4" /> URL ảnh minh hoạ
              </Label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="text-sm" />
            </div>
          </div>

          {imageUrl && (
            <div className="rounded-lg overflow-hidden border border-gray-200 max-w-xs">
              <img src={imageUrl} alt="" className="w-full h-auto object-contain max-h-32" />
            </div>
          )}

          {renderTypeForm()}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
