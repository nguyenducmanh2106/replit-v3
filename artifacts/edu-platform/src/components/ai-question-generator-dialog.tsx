import { useState, useEffect } from "react";
import { Sparkles, Loader2, Wand2, Check } from "lucide-react";
import { useGenerateQuestions } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MarkdownView } from "./markdown-view";

interface GeneratedDraft {
  type: string;
  skill: string;
  level: string;
  content: string;
  explanation: string | null;
  options: string | null;
  correctAnswer: string | null;
  passage: string | null;
  points: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: string;
  defaultSkill?: string;
  defaultLevel?: string;
  onApply: (draft: GeneratedDraft) => void;
}

const QUESTION_TYPES = [
  { value: "mcq", label: "Trắc nghiệm (MCQ)" },
  { value: "true_false", label: "Đúng / Sai" },
  { value: "fill_blank", label: "Điền vào chỗ trống" },
  { value: "reading", label: "Đọc hiểu" },
  { value: "essay", label: "Tự luận (Essay)" },
  { value: "open_end", label: "Câu trả lời ngắn" },
];

const SKILLS = [
  { value: "reading", label: "Đọc" },
  { value: "writing", label: "Viết" },
  { value: "listening", label: "Nghe" },
  { value: "speaking", label: "Nói" },
  { value: "grammar", label: "Ngữ pháp" },
  { value: "vocabulary", label: "Từ vựng" },
];

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function AIQuestionGeneratorDialog({
  open,
  onOpenChange,
  defaultType = "mcq",
  defaultSkill = "reading",
  defaultLevel = "B1",
  onApply,
}: Props) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [type, setType] = useState(defaultType);
  const [skill, setSkill] = useState(defaultSkill);
  const [level, setLevel] = useState(defaultLevel);
  const [count, setCount] = useState(3);
  const [language, setLanguage] = useState("vi");
  const [instructions, setInstructions] = useState("");
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);
  const [appliedIdx, setAppliedIdx] = useState<Set<number>>(new Set());

  // Resync local form state from defaults whenever the dialog is (re)opened
  useEffect(() => {
    if (open) {
      setType(defaultType);
      setSkill(defaultSkill);
      setLevel(defaultLevel);
    }
  }, [open, defaultType, defaultSkill, defaultLevel]);

  const mutation = useGenerateQuestions({
    mutation: {
      onSuccess: (data: { questions?: GeneratedDraft[]; notes?: string | null }) => {
        const list = (data.questions ?? []) as GeneratedDraft[];
        setDrafts(list);
        setAppliedIdx(new Set());
        if (list.length === 0) {
          toast({
            title: "Không sinh được câu hỏi",
            description: "AI không trả về câu hỏi nào. Hãy thử mô tả chi tiết hơn.",
            variant: "destructive",
          });
        } else {
          toast({
            title: `Đã sinh ${list.length} câu hỏi`,
            description: data.notes ?? "Bấm \"Áp dụng\" để chèn vào form.",
          });
        }
      },
      onError: (err: any) => {
        toast({
          title: "Sinh câu hỏi thất bại",
          description: err?.message ?? "Lỗi không xác định",
          variant: "destructive",
        });
      },
    },
  });

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast({
        title: "Thiếu chủ đề",
        description: "Hãy nhập chủ đề hoặc ngữ cảnh trước khi sinh câu hỏi.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({
      data: {
        topic: topic.trim(),
        type,
        skill,
        level,
        count,
        language,
        instructions: instructions.trim() || null,
      },
    });
  };

  const handleApply = (idx: number, draft: GeneratedDraft) => {
    onApply(draft);
    setAppliedIdx((prev) => new Set(prev).add(idx));
    toast({ title: "Đã áp dụng", description: "Đã chèn câu hỏi vào form. Bạn có thể chỉnh sửa thêm." });
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setDrafts([]);
      setAppliedIdx(new Set());
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Sinh câu hỏi bằng AI
          </DialogTitle>
          <DialogDescription>
            Mô tả chủ đề và AI sẽ sinh sẵn nội dung, đáp án và giải thích cho bạn. Bạn vẫn có thể chỉnh sửa trước khi lưu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-topic">
              Chủ đề / Ngữ cảnh <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="ai-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ví dụ: Câu hỏi về thì hiện tại hoàn thành, sử dụng ngữ cảnh du lịch. Hoặc: Đoạn đọc về biến đổi khí hậu."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Loại câu hỏi</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kỹ năng</Label>
              <Select value={skill} onValueChange={setSkill}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SKILLS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Trình độ</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Số câu (1-10)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Ngôn ngữ nội dung</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vi">Tiếng Việt</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hướng dẫn thêm (tuỳ chọn)</Label>
              <Input
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ví dụ: tránh từ vựng học thuật"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={mutation.isPending || !topic.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          >
            {mutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang sinh câu hỏi...</>
            ) : (
              <><Wand2 className="h-4 w-4 mr-2" /> Sinh câu hỏi bằng AI</>
            )}
          </Button>

          {drafts.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <h3 className="font-semibold text-sm">Kết quả ({drafts.length} câu hỏi)</h3>
              {drafts.map((d, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono">
                        #{idx + 1} · {d.type} · {d.level}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={appliedIdx.has(idx) ? "secondary" : "default"}
                      onClick={() => handleApply(idx, d)}
                      disabled={appliedIdx.has(idx)}
                    >
                      {appliedIdx.has(idx) ? (
                        <><Check className="h-3 w-3 mr-1" /> Đã áp dụng</>
                      ) : (
                        "Áp dụng"
                      )}
                    </Button>
                  </div>
                  {d.passage && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Đoạn đọc ({d.passage.length} ký tự)
                      </summary>
                      <div className="mt-1 p-2 bg-background rounded border max-h-40 overflow-auto whitespace-pre-wrap">
                        {d.passage}
                      </div>
                    </details>
                  )}
                  <div className="text-sm">
                    <MarkdownView source={d.content} compact />
                  </div>
                  {d.explanation && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Giải thích
                      </summary>
                      <div className="mt-1 p-2 bg-background rounded border">
                        <MarkdownView source={d.explanation} compact />
                      </div>
                    </details>
                  )}
                  {d.correctAnswer && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Đáp án:</span> <code>{d.correctAnswer}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
