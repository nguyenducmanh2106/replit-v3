import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import {
  McqForm, TrueFalseForm, FillBlankForm, WordSelectionForm,
  MatchingForm, DragDropForm, SentenceReorderForm, ReadingForm,
  ListeningForm, VideoInteractiveForm, EssayForm, OpenEndForm,
  safeJson, newSubQuestion,
  type McqOption, type MatchingPair, type DragZone, type SubQuestion, type VideoQuestion,
} from "@/components/question-type-forms";

const SKILLS = ["reading", "writing", "listening", "speaking"] as const;
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const SKILL_LABELS: Record<string, string> = { reading: "Đọc", writing: "Viết", listening: "Nghe", speaking: "Nói" };

const QUESTION_TYPES = [
  { value: "mcq", label: "Trắc nghiệm" },
  { value: "true_false", label: "Đúng/Sai" },
  { value: "fill_blank", label: "Điền vào chỗ trống" },
  { value: "word_selection", label: "Chọn từ" },
  { value: "matching", label: "Nối cặp" },
  { value: "drag_drop", label: "Kéo thả" },
  { value: "sentence_reorder", label: "Sắp xếp câu" },
  { value: "reading", label: "Đọc hiểu" },
  { value: "listening", label: "Nghe hiểu" },
  { value: "video_interactive", label: "Video tương tác" },
  { value: "essay", label: "Bài luận" },
  { value: "open_end", label: "Câu hỏi mở" },
] as const;

interface CreateQuestionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: QuestionData) => void;
  saving?: boolean;
  defaultEssayAutoGrade?: boolean;
}

export interface QuestionData {
  type: string;
  skill: string;
  level: string;
  content: string;
  options: string | null;
  correctAnswer: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  passage: string | null;
  explanation: string | null;
  metadata: string | null;
  points: number;
}

export function CreateQuestionDialog({ open, onClose, onSave, saving, defaultEssayAutoGrade = false }: CreateQuestionDialogProps) {
  const [type, setType] = useState("mcq");
  const [skill, setSkill] = useState("reading");
  const [level, setLevel] = useState("A1");
  const [content, setContent] = useState("");
  const [points, setPoints] = useState(10);
  const [explanation, setExplanation] = useState("");

  const [mcqOptions, setMcqOptions] = useState<McqOption[]>([
    { text: "", isCorrect: true }, { text: "", isCorrect: false },
    { text: "", isCorrect: false }, { text: "", isCorrect: false },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [tfAnswer, setTfAnswer] = useState("true");
  const [fillBlanks, setFillBlanks] = useState<string[]>([""]);
  const [passage, setPassage] = useState("");
  const [correctWords, setCorrectWords] = useState<string[]>([]);
  const [pairs, setPairs] = useState<MatchingPair[]>([{ left: "", right: "" }]);
  const [dragItems, setDragItems] = useState<string[]>([""]);
  const [dragZones, setDragZones] = useState<DragZone[]>([{ label: "", accepts: [] }]);
  const [reorderItems, setReorderItems] = useState<string[]>([""]);
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([newSubQuestion()]);
  const [audioUrl, setAudioUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [timedQuestions, setTimedQuestions] = useState<VideoQuestion[]>([]);
  const [essayAutoGrade, setEssayAutoGrade] = useState(defaultEssayAutoGrade);
  const [openEndAllowedTypes, setOpenEndAllowedTypes] = useState<string[]>(["text", "audio", "image"]);

  // Sync essay auto-grade default whenever the dialog opens (handles async data load)
  useEffect(() => {
    if (open) setEssayAutoGrade(defaultEssayAutoGrade);
  }, [open, defaultEssayAutoGrade]);

  function resetForm() {
    setType("mcq"); setSkill("reading"); setLevel("A1");
    setContent(""); setPoints(10); setExplanation("");
    setMcqOptions([{ text: "", isCorrect: true }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }]);
    setAllowMultiple(false); setTfAnswer("true"); setFillBlanks([""]); setPassage("");
    setCorrectWords([]); setPairs([{ left: "", right: "" }]); setDragItems([""]); setDragZones([{ label: "", accepts: [] }]);
    setReorderItems([""]); setSubQuestions([newSubQuestion()]); setAudioUrl(""); setVideoUrl(""); setTimedQuestions([]);
    setEssayAutoGrade(defaultEssayAutoGrade);
    setOpenEndAllowedTypes(["text", "audio", "image"]);
  }

  function buildQuestionData(): QuestionData {
    let options: string | null = null;
    let correctAnswer: string | null = null;
    let metadata: string | null = null;
    let qContent = content;
    let qPassage: string | null = null;

    switch (type) {
      case "mcq": {
        options = JSON.stringify(mcqOptions.map(o => o.text));
        const corrects = mcqOptions.filter(o => o.isCorrect).map(o => o.text);
        correctAnswer = corrects.join(",");
        if (allowMultiple) metadata = JSON.stringify({ allowMultiple: true });
        break;
      }
      case "true_false":
        correctAnswer = tfAnswer;
        break;
      case "fill_blank":
        correctAnswer = JSON.stringify(fillBlanks);
        break;
      case "word_selection":
        qPassage = passage;
        correctAnswer = JSON.stringify(correctWords);
        break;
      case "matching":
        options = JSON.stringify(pairs);
        break;
      case "drag_drop":
        options = JSON.stringify({ items: dragItems, zones: dragZones });
        break;
      case "sentence_reorder":
        options = JSON.stringify(reorderItems);
        break;
      case "reading":
        qPassage = passage;
        options = JSON.stringify(subQuestions);
        return {
          type, skill, level, content: qContent,
          options, correctAnswer,
          audioUrl: audioUrl || null, videoUrl: videoUrl || null,
          imageUrl: null, passage: qPassage,
          explanation: explanation || null, metadata,
          points: subQuestions.reduce((s, sq) => s + (sq.points ?? 1), 0),
        };
      case "listening":
        options = JSON.stringify(subQuestions);
        return {
          type, skill, level, content: qContent,
          options, correctAnswer,
          audioUrl: audioUrl || null, videoUrl: videoUrl || null,
          imageUrl: null, passage: qPassage,
          explanation: explanation || null, metadata,
          points: subQuestions.reduce((s, sq) => s + (sq.points ?? 1), 0),
        };
      case "video_interactive":
        options = JSON.stringify(timedQuestions);
        break;
      case "essay":
        metadata = JSON.stringify({ autoGrade: essayAutoGrade });
        break;
      case "open_end":
        metadata = JSON.stringify({ allowedTypes: openEndAllowedTypes });
        break;
    }

    return {
      type, skill, level, content: qContent,
      options, correctAnswer,
      audioUrl: audioUrl || null, videoUrl: videoUrl || null,
      imageUrl: null, passage: qPassage,
      explanation: explanation || null, metadata, points,
    };
  }

  function canSave() {
    if (["reading", "listening", "video_interactive"].includes(type)) {
      return content.trim().length > 0 || passage.trim().length > 0 || audioUrl.trim().length > 0 || videoUrl.trim().length > 0;
    }
    return content.trim().length > 0;
  }

  function handleSave() {
    if (!canSave()) return;
    const data = buildQuestionData();
    onSave(data);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo câu hỏi mới</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm font-medium">Loại câu hỏi *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Kỹ năng *</Label>
              <Select value={skill} onValueChange={setSkill}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SKILLS.map(s => (
                    <SelectItem key={s} value={s}>{SKILL_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Cấp độ *</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Điểm</Label>
            {(type === "reading" || type === "listening") ? (
              <div className="mt-1">
                <div className="h-9 flex items-center px-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 font-medium w-24">
                  {subQuestions.reduce((s, sq) => s + (sq.points ?? 1), 0)}
                </div>
                <p className="text-xs text-gray-400 mt-1">Tổng điểm câu thành phần</p>
              </div>
            ) : (
              <Input type="number" min={1} value={points} onChange={e => setPoints(Number(e.target.value))} className="mt-1 w-24" />
            )}
          </div>

          <div className="border rounded-xl p-4 bg-gray-50/50">
            {type === "mcq" && (
              <McqForm content={content} setContent={setContent} options={mcqOptions} setOptions={setMcqOptions}
                allowMultiple={allowMultiple} setAllowMultiple={setAllowMultiple} explanation={explanation} setExplanation={setExplanation} />
            )}
            {type === "true_false" && (
              <TrueFalseForm content={content} setContent={setContent} correctAnswer={tfAnswer} setCorrectAnswer={setTfAnswer} explanation={explanation} setExplanation={setExplanation} />
            )}
            {type === "fill_blank" && (
              <FillBlankForm content={content} setContent={setContent} blanksAnswers={fillBlanks} setBlanksAnswers={setFillBlanks} explanation={explanation} setExplanation={setExplanation} />
            )}
            {type === "word_selection" && (
              <WordSelectionForm instruction={content} setInstruction={setContent} passage={passage} setPassage={setPassage}
                selectedWords={correctWords} setSelectedWords={setCorrectWords} explanation={explanation} setExplanation={setExplanation} />
            )}
            {type === "matching" && (
              <MatchingForm content={content} setContent={setContent} pairs={pairs} setPairs={setPairs} explanation={explanation} setExplanation={setExplanation} />
            )}
            {type === "drag_drop" && (
              <DragDropForm content={content} setContent={setContent} items={dragItems} setItems={setDragItems}
                zones={dragZones} setZones={setDragZones} explanation={explanation} setExplanation={setExplanation} />
            )}
            {type === "sentence_reorder" && (
              <SentenceReorderForm content={content} setContent={setContent} sentences={reorderItems} setSentences={setReorderItems} explanation={explanation} setExplanation={setExplanation} />
            )}
            {type === "reading" && (
              <>
                <div className="mb-4">
                  <Label className="text-sm font-medium">Tiêu đề / Hướng dẫn</Label>
                  <Input value={content} onChange={e => setContent(e.target.value)} placeholder="Đọc đoạn văn và trả lời câu hỏi" className="mt-1" />
                </div>
                <ReadingForm passage={passage} setPassage={setPassage}
                  subQuestions={subQuestions} setSubQuestions={setSubQuestions} explanation={explanation} setExplanation={setExplanation} />
              </>
            )}
            {type === "listening" && (
              <>
                <div className="mb-4">
                  <Label className="text-sm font-medium">Tiêu đề / Hướng dẫn</Label>
                  <Input value={content} onChange={e => setContent(e.target.value)} placeholder="Nghe đoạn audio và trả lời câu hỏi" className="mt-1" />
                </div>
                <ListeningForm audioUrl={audioUrl} setAudioUrl={setAudioUrl} passage={passage} setPassage={setPassage}
                  subQuestions={subQuestions} setSubQuestions={setSubQuestions} explanation={explanation} setExplanation={setExplanation} />
              </>
            )}
            {type === "video_interactive" && (
              <>
                <div className="mb-4">
                  <Label className="text-sm font-medium">Tiêu đề / Hướng dẫn</Label>
                  <Input value={content} onChange={e => setContent(e.target.value)} placeholder="Xem video và trả lời câu hỏi" className="mt-1" />
                </div>
                <VideoInteractiveForm videoUrl={videoUrl} setVideoUrl={setVideoUrl}
                  timedQuestions={timedQuestions} setTimedQuestions={setTimedQuestions} explanation={explanation} setExplanation={setExplanation} />
              </>
            )}
            {type === "essay" && (
              <EssayForm content={content} setContent={setContent} explanation={explanation} setExplanation={setExplanation} autoGrade={essayAutoGrade} setAutoGrade={setEssayAutoGrade} />
            )}
            {type === "open_end" && (
              <OpenEndForm content={content} setContent={setContent} explanation={explanation} setExplanation={setExplanation} allowedTypes={openEndAllowedTypes} setAllowedTypes={setOpenEndAllowedTypes} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving || !canSave()}>
            {saving ? "Đang lưu..." : "Tạo câu hỏi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
