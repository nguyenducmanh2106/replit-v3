import { useState } from "react";
import { useParams, Link } from "@/lib/routing";
import {
  useGetCourseCurriculum,
  useCreateChapter,
  useUpdateChapter,
  useDeleteChapter,
  useReorderChapters,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useReorderLessons,
  useListLessonBlocks,
  useCreateLessonBlock,
  useUpdateLessonBlock,
  useDeleteLessonBlock,
  getGetCourseCurriculumQueryKey,
  getListLessonBlocksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, BookOpen, ArrowLeft, FileText, Video, Image as ImageIcon, HelpCircle, ClipboardList, Heading, Type, Youtube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BLOCK_TYPES = [
  { value: "heading", label: "Tiêu đề", icon: Heading },
  { value: "text", label: "Văn bản", icon: Type },
  { value: "youtube", label: "Video YouTube", icon: Youtube },
  { value: "upload", label: "Tệp đính kèm (PDF/Video/Hình)", icon: FileText },
  { value: "quiz", label: "Trắc nghiệm", icon: HelpCircle },
  { value: "assignment", label: "Bài tập", icon: ClipboardList },
];

export default function CurriculumBuilderPage() {
  const { id: idRaw } = useParams<{ id: string }>();
  const courseId = parseInt(idRaw, 10);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: curriculum, isLoading } = useGetCourseCurriculum(courseId);
  const { mutateAsync: createChapter } = useCreateChapter();
  const { mutateAsync: updateChapter } = useUpdateChapter();
  const { mutateAsync: deleteChapter } = useDeleteChapter();
  const { mutateAsync: reorderChapters } = useReorderChapters();
  const { mutateAsync: createLesson } = useCreateLesson();
  const { mutateAsync: deleteLesson } = useDeleteLesson();
  const { mutateAsync: reorderLessons } = useReorderLessons();

  const [chapterTitle, setChapterTitle] = useState("");
  const [editingChapter, setEditingChapter] = useState<{ id: number; title: string } | null>(null);
  const [lessonForChapter, setLessonForChapter] = useState<number | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetCourseCurriculumQueryKey(courseId) });

  async function handleAddChapter() {
    if (!chapterTitle.trim()) return;
    try {
      await createChapter({ id: courseId, data: { title: chapterTitle.trim() } });
      setChapterTitle("");
      invalidate();
      toast({ title: "Đã thêm chương" });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    }
  }

  async function handleAddLesson() {
    if (!lessonForChapter || !lessonTitle.trim()) return;
    try {
      await createLesson({ chapterId: lessonForChapter, data: { title: lessonTitle.trim() } });
      setLessonTitle("");
      setLessonForChapter(null);
      invalidate();
      toast({ title: "Đã thêm bài học" });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    }
  }

  async function moveChapter(chapterId: number, dir: -1 | 1) {
    if (!curriculum) return;
    const ids = curriculum.chapters.map((c) => c.id);
    const i = ids.indexOf(chapterId);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderChapters({ id: courseId, data: { ids } });
    invalidate();
  }

  async function moveLesson(chapterId: number, lessonId: number, dir: -1 | 1) {
    const chapter = curriculum?.chapters.find((c) => c.id === chapterId);
    if (!chapter) return;
    const ids = chapter.lessons.map((l) => l.id);
    const i = ids.indexOf(lessonId);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderLessons({ chapterId, data: { ids } });
    invalidate();
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/courses/${courseId}`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Trình xây dựng chương trình</h1>
            <p className="text-muted-foreground text-sm">Tạo chương → bài học → khối nội dung (Frappe-style)</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Thêm chương mới</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Tên chương..." value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} />
          <Button onClick={handleAddChapter}><Plus className="w-4 h-4 mr-1" />Thêm chương</Button>
        </CardContent>
      </Card>

      {curriculum && curriculum.chapters.length === 0 && (
        <Card><CardContent className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
          Chưa có chương nào. Hãy tạo chương đầu tiên!
        </CardContent></Card>
      )}

      {curriculum?.chapters.map((chapter, idx) => (
        <Card key={chapter.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline">Chương {idx + 1}</Badge>
              <CardTitle className="text-lg">{chapter.title}</CardTitle>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => moveChapter(chapter.id, -1)}><ChevronUp className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => moveChapter(chapter.id, 1)}><ChevronDown className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => setEditingChapter({ id: chapter.id, title: chapter.title })}><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={async () => {
                if (!confirm("Xóa chương này?")) return;
                await deleteChapter({ id: chapter.id });
                invalidate();
              }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {chapter.lessons.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Chưa có bài học</p>
            )}
            {chapter.lessons.map((lesson, lidx) => (
              <div key={lesson.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-sm text-muted-foreground w-6">{lidx + 1}.</span>
                  <span className="flex-1 cursor-pointer" onClick={() => setEditingLessonId(lesson.id)}>{lesson.title}</span>
                  {lesson.includeInPreview && <Badge variant="secondary" className="text-xs">Preview</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => moveLesson(chapter.id, lesson.id, -1)}><ChevronUp className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => moveLesson(chapter.id, lesson.id, 1)}><ChevronDown className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingLessonId(lesson.id)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm("Xóa bài học?")) return;
                    await deleteLesson({ id: lesson.id });
                    invalidate();
                  }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setLessonForChapter(chapter.id)}>
              <Plus className="w-4 h-4 mr-1" />Thêm bài học
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Add lesson dialog */}
      <Dialog open={lessonForChapter !== null} onOpenChange={(o) => !o && setLessonForChapter(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Thêm bài học mới</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Tên bài học</Label>
            <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonForChapter(null)}>Hủy</Button>
            <Button onClick={handleAddLesson}>Thêm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit chapter dialog */}
      <Dialog open={editingChapter !== null} onOpenChange={(o) => !o && setEditingChapter(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sửa chương</DialogTitle></DialogHeader>
          <Input value={editingChapter?.title ?? ""} onChange={(e) => setEditingChapter((c) => c ? { ...c, title: e.target.value } : null)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingChapter(null)}>Hủy</Button>
            <Button onClick={async () => {
              if (!editingChapter) return;
              await updateChapter({ id: editingChapter.id, data: { title: editingChapter.title } });
              setEditingChapter(null);
              invalidate();
            }}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingLessonId !== null && (
        <LessonEditor lessonId={editingLessonId} onClose={() => { setEditingLessonId(null); invalidate(); }} />
      )}
    </div>
  );
}

function LessonEditor({ lessonId, onClose }: { lessonId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: blocks, isLoading } = useListLessonBlocks(lessonId);
  const { mutateAsync: createBlock } = useCreateLessonBlock();
  const { mutateAsync: updateBlock } = useUpdateLessonBlock();
  const { mutateAsync: deleteBlock } = useDeleteLessonBlock();
  const [newType, setNewType] = useState("text");

  const refresh = () => qc.invalidateQueries({ queryKey: getListLessonBlocksQueryKey(lessonId) });

  async function addBlock() {
    const defaults: Record<string, any> = {
      heading: { text: "Tiêu đề mới", level: 2 },
      text: { content: "" },
      youtube: { url: "" },
      upload: { url: "", filename: "", mimeType: "" },
      quiz: { questions: [] },
      assignment: { description: "", dueDate: null },
    };
    await createBlock({ lessonId, data: { type: newType, data: defaults[newType] ?? {} } });
    refresh();
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Soạn nội dung bài học</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {isLoading && <Skeleton className="h-32" />}
          {blocks?.map((block: any) => (
            <BlockEditor key={block.id} block={block} onUpdate={async (data) => {
              await updateBlock({ id: block.id, data: { data } });
              refresh();
              toast({ title: "Đã lưu" });
            }} onDelete={async () => {
              if (!confirm("Xóa khối?")) return;
              await deleteBlock({ id: block.id });
              refresh();
            }} />
          ))}
          {blocks?.length === 0 && (
            <p className="text-center py-8 text-sm text-muted-foreground">Chưa có khối nào</p>
          )}
          <div className="flex gap-2 pt-3 border-t">
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={addBlock}><Plus className="w-4 h-4 mr-1" />Thêm khối</Button>
          </div>
        </div>
        <DialogFooter><Button onClick={onClose}>Đóng</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockEditor({ block, onUpdate, onDelete }: { block: any; onUpdate: (data: any) => void; onDelete: () => void }) {
  const [data, setData] = useState(block.data ?? {});
  const meta = BLOCK_TYPES.find((b) => b.value === block.type);
  const Icon = meta?.icon ?? FileText;

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="w-4 h-4" />
          {meta?.label ?? block.type}
        </div>
        <div className="flex gap-1">
          <Button size="sm" onClick={() => onUpdate(data)}>Lưu</Button>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="w-4 h-4 text-red-500" /></Button>
        </div>
      </div>
      {block.type === "heading" && (
        <Input placeholder="Tiêu đề" value={data.text ?? ""} onChange={(e) => setData({ ...data, text: e.target.value, level: data.level ?? 2 })} />
      )}
      {block.type === "text" && (
        <Textarea placeholder="Nội dung..." rows={4} value={data.content ?? ""} onChange={(e) => setData({ ...data, content: e.target.value })} />
      )}
      {block.type === "youtube" && (
        <Input placeholder="URL YouTube (https://www.youtube.com/watch?v=...)" value={data.url ?? ""} onChange={(e) => setData({ ...data, url: e.target.value })} />
      )}
      {block.type === "upload" && (
        <div className="space-y-2">
          <Input placeholder="URL tệp đã upload" value={data.url ?? ""} onChange={(e) => setData({ ...data, url: e.target.value })} />
          <Input placeholder="Tên tệp" value={data.filename ?? ""} onChange={(e) => setData({ ...data, filename: e.target.value })} />
          <Input placeholder="MIME type (vd: application/pdf)" value={data.mimeType ?? ""} onChange={(e) => setData({ ...data, mimeType: e.target.value })} />
        </div>
      )}
      {block.type === "quiz" && (
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Mã JSON câu hỏi (mảng):</p>
          <Textarea rows={5} value={JSON.stringify(data.questions ?? [], null, 2)} onChange={(e) => {
            try { setData({ ...data, questions: JSON.parse(e.target.value) }); } catch {}
          }} />
        </div>
      )}
      {block.type === "assignment" && (
        <div className="space-y-2">
          <Textarea placeholder="Mô tả bài tập" rows={3} value={data.description ?? ""} onChange={(e) => setData({ ...data, description: e.target.value })} />
          <Input type="datetime-local" value={data.dueDate ?? ""} onChange={(e) => setData({ ...data, dueDate: e.target.value })} />
        </div>
      )}
    </div>
  );
}
