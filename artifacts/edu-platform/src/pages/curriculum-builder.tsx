import { useState, useEffect, useRef, type KeyboardEvent } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, ArrowLeft, FileText, HelpCircle,
  ClipboardList, Heading as HeadingIcon, Type, Youtube, GripVertical, BookOpen,
  Layers, Sparkles, Check, Pencil, MoreHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BLOCK_TYPES = [
  { value: "heading", label: "Tiêu đề", icon: HeadingIcon, color: "from-purple-500/10 to-purple-500/5", iconColor: "text-purple-600" },
  { value: "text", label: "Văn bản", icon: Type, color: "from-blue-500/10 to-blue-500/5", iconColor: "text-blue-600" },
  { value: "youtube", label: "Video YouTube", icon: Youtube, color: "from-red-500/10 to-red-500/5", iconColor: "text-red-600" },
  { value: "upload", label: "Tệp đính kèm", icon: FileText, color: "from-emerald-500/10 to-emerald-500/5", iconColor: "text-emerald-600" },
  { value: "quiz", label: "Trắc nghiệm", icon: HelpCircle, color: "from-amber-500/10 to-amber-500/5", iconColor: "text-amber-600" },
  { value: "assignment", label: "Bài tập", icon: ClipboardList, color: "from-indigo-500/10 to-indigo-500/5", iconColor: "text-indigo-600" },
] as const;

type BlockTypeValue = typeof BLOCK_TYPES[number]["value"];

function getBlockMeta(type: string) {
  return BLOCK_TYPES.find((b) => b.value === type) ?? BLOCK_TYPES[1];
}

export default function CurriculumBuilderPage() {
  const { id: idRaw } = useParams<{ id: string }>();
  const courseId = parseInt(idRaw, 10);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: curriculum, isLoading } = useGetCourseCurriculum(courseId);
  const { mutateAsync: createChapter, isPending: creatingChapter } = useCreateChapter();
  const { mutateAsync: updateChapter } = useUpdateChapter();
  const { mutateAsync: deleteChapter } = useDeleteChapter();
  const { mutateAsync: reorderChapters } = useReorderChapters();
  const { mutateAsync: createLesson, isPending: creatingLesson } = useCreateLesson();
  const { mutateAsync: updateLesson } = useUpdateLesson();
  const { mutateAsync: deleteLesson } = useDeleteLesson();
  const { mutateAsync: reorderLessons } = useReorderLessons();

  const [chapterTitle, setChapterTitle] = useState("");
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [lessonForChapter, setLessonForChapter] = useState<number | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "chapter" | "lesson"; id: number; name: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetCourseCurriculumQueryKey(courseId) });

  const toggleExpand = (id: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  async function handleAddChapter() {
    if (!chapterTitle.trim()) {
      toast({ title: "Vui lòng nhập tên chương", variant: "destructive" });
      return;
    }
    try {
      const created = await createChapter({ id: courseId, data: { title: chapterTitle.trim() } });
      setChapterTitle("");
      setExpandedChapters((prev) => new Set(prev).add((created as any).id));
      invalidate();
      toast({ title: "Đã thêm chương", description: chapterTitle.trim() });
    } catch (e: any) {
      toast({ title: "Lỗi khi thêm chương", description: e.message, variant: "destructive" });
    }
  }

  async function handleAddLesson() {
    if (!lessonForChapter || !lessonTitle.trim()) {
      toast({ title: "Vui lòng nhập tên bài học", variant: "destructive" });
      return;
    }
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
    const ids = curriculum.chapters.map((c: any) => c.id);
    const i = ids.indexOf(chapterId);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderChapters({ id: courseId, data: { ids } });
    invalidate();
  }

  async function moveLesson(chapterId: number, lessonId: number, dir: -1 | 1) {
    const chapter = curriculum?.chapters.find((c: any) => c.id === chapterId);
    if (!chapter) return;
    const ids = chapter.lessons.map((l: any) => l.id);
    const i = ids.indexOf(lessonId);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderLessons({ chapterId, data: { ids } });
    invalidate();
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.kind === "chapter") {
        await deleteChapter({ id: confirmDelete.id });
      } else {
        await deleteLesson({ id: confirmDelete.id });
      }
      invalidate();
      toast({ title: "Đã xóa", description: confirmDelete.name });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    } finally {
      setConfirmDelete(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto p-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const chapters = curriculum?.chapters ?? [];
  const totalLessons = chapters.reduce((acc: number, c: any) => acc + c.lessons.length, 0);

  return (
    <div className="max-w-5xl mx-auto p-4 pb-32 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <Link href={`/courses/${courseId}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trình xây dựng chương trình</h1>
            <p className="text-sm text-muted-foreground">
              Chương → Bài học → Khối nội dung. Click vào tiêu đề để sửa nhanh.
            </p>
          </div>
        </div>
        {chapters.length > 0 && (
          <div className="hidden md:flex items-center gap-3 text-sm">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <Layers className="w-3.5 h-3.5" /> {chapters.length} chương
            </Badge>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <BookOpen className="w-3.5 h-3.5" /> {totalLessons} bài học
            </Badge>
          </div>
        )}
      </div>

      {/* Empty state */}
      {chapters.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-5">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Bắt đầu xây dựng khóa học của bạn</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Một khóa học hoàn chỉnh gồm các <strong>chương</strong>, mỗi chương chứa nhiều <strong>bài học</strong>,
              mỗi bài học có thể chứa văn bản, video, quiz, bài tập...
            </p>
            <div className="flex gap-2 w-full max-w-md">
              <Input
                placeholder="Tên chương đầu tiên..."
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddChapter()}
                autoFocus
                data-testid="input-chapter-empty"
              />
              <Button onClick={handleAddChapter} disabled={creatingChapter} data-testid="button-add-chapter-empty">
                <Plus className="w-4 h-4 mr-1" />
                Tạo chương
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chapters list */}
      {chapters.length > 0 && (
        <div className="space-y-3">
          {chapters.map((chapter: any, idx: number) => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              index={idx}
              total={chapters.length}
              expanded={expandedChapters.has(chapter.id)}
              onToggleExpand={() => toggleExpand(chapter.id)}
              onMoveUp={() => moveChapter(chapter.id, -1)}
              onMoveDown={() => moveChapter(chapter.id, 1)}
              onRename={async (title) => {
                await updateChapter({ id: chapter.id, data: { title } });
                invalidate();
                toast({ title: "Đã đổi tên chương" });
              }}
              onDelete={() => setConfirmDelete({ kind: "chapter", id: chapter.id, name: chapter.title })}
              onAddLesson={() => {
                setLessonForChapter(chapter.id);
                setLessonTitle("");
              }}
              onMoveLesson={(lessonId, dir) => moveLesson(chapter.id, lessonId, dir)}
              onRenameLesson={async (lessonId, title) => {
                await updateLesson({ id: lessonId, data: { title } });
                invalidate();
              }}
              onDeleteLesson={(lessonId, name) => setConfirmDelete({ kind: "lesson", id: lessonId, name })}
              onEditLesson={(lessonId) => setEditingLessonId(lessonId)}
            />
          ))}
        </div>
      )}

      {/* Sticky add chapter bar */}
      {chapters.length > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-30 px-4 pointer-events-none">
          <div className="max-w-5xl mx-auto pointer-events-auto">
            <Card className="shadow-lg border-2">
              <CardContent className="p-3 flex gap-2">
                <Input
                  placeholder="Tên chương mới (Enter để thêm)..."
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddChapter()}
                  className="border-0 focus-visible:ring-0 shadow-none"
                  data-testid="input-chapter-sticky"
                />
                <Button onClick={handleAddChapter} disabled={creatingChapter} data-testid="button-add-chapter-sticky">
                  <Plus className="w-4 h-4 mr-1" />
                  {creatingChapter ? "Đang thêm..." : "Thêm chương"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Add lesson dialog */}
      <Dialog open={lessonForChapter !== null} onOpenChange={(o) => !o && setLessonForChapter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm bài học mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              placeholder="Tên bài học..."
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddLesson()}
              autoFocus
              data-testid="input-lesson-title"
            />
            <p className="text-xs text-muted-foreground">
              Sau khi thêm, click vào bài học để soạn nội dung.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonForChapter(null)}>Hủy</Button>
            <Button onClick={handleAddLesson} disabled={creatingLesson} data-testid="button-add-lesson-submit">
              <Plus className="w-4 h-4 mr-1" />
              {creatingLesson ? "Đang thêm..." : "Thêm bài học"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Xóa {confirmDelete?.kind === "chapter" ? "chương" : "bài học"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" sẽ bị xóa vĩnh viễn.
              {confirmDelete?.kind === "chapter" && " Tất cả bài học và nội dung trong chương cũng sẽ bị xóa."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lesson editor */}
      {editingLessonId !== null && (
        <LessonEditor
          lessonId={editingLessonId}
          onClose={() => {
            setEditingLessonId(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

/* ---------- Chapter Card ---------- */

interface ChapterCardProps {
  chapter: { id: number; title: string; lessons: any[] };
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRename: (title: string) => Promise<void>;
  onDelete: () => void;
  onAddLesson: () => void;
  onMoveLesson: (lessonId: number, dir: -1 | 1) => Promise<void> | void;
  onRenameLesson: (lessonId: number, title: string) => Promise<void>;
  onDeleteLesson: (lessonId: number, name: string) => void;
  onEditLesson: (lessonId: number) => void;
}

function ChapterCard(props: ChapterCardProps) {
  const { chapter, index, total, expanded, onToggleExpand, onMoveUp, onMoveDown, onRename, onDelete } = props;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4 flex items-center gap-3">
        <button
          onClick={onToggleExpand}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent text-muted-foreground"
          aria-label={expanded ? "Thu gọn" : "Mở rộng"}
          data-testid={`button-toggle-chapter-${chapter.id}`}
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <Badge variant="outline" className="font-mono shrink-0">
          {String(index + 1).padStart(2, "0")}
        </Badge>

        <div className="flex-1 min-w-0">
          <InlineEditableTitle
            value={chapter.title}
            onSave={onRename}
            className="text-base font-semibold"
            testId={`title-chapter-${chapter.id}`}
          />
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {chapter.lessons.length} bài học
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" onClick={onMoveUp} disabled={index === 0} className="h-8 w-8">
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onMoveDown} disabled={index === total - 1} className="h-8 w-8">
            <ChevronDown className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          <Separator />
          <div className="p-3 pl-12 space-y-1.5 bg-muted/30">
            {chapter.lessons.length === 0 && (
              <p className="text-sm text-muted-foreground italic py-2">Chưa có bài học. Thêm bài học đầu tiên bên dưới.</p>
            )}
            {chapter.lessons.map((lesson, lidx) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                index={lidx}
                total={chapter.lessons.length}
                onMoveUp={() => props.onMoveLesson(lesson.id, -1)}
                onMoveDown={() => props.onMoveLesson(lesson.id, 1)}
                onRename={(t) => props.onRenameLesson(lesson.id, t)}
                onDelete={() => props.onDeleteLesson(lesson.id, lesson.title)}
                onEdit={() => props.onEditLesson(lesson.id)}
              />
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={props.onAddLesson}
              className="text-primary hover:text-primary hover:bg-primary/10 w-full justify-start mt-2"
              data-testid={`button-add-lesson-${chapter.id}`}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Thêm bài học
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------- Lesson Row ---------- */

interface LessonRowProps {
  lesson: { id: number; title: string; includeInPreview?: boolean };
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRename: (title: string) => Promise<void>;
  onDelete: () => void;
  onEdit: () => void;
}

function LessonRow({ lesson, index, total, onMoveUp, onMoveDown, onRename, onDelete, onEdit }: LessonRowProps) {
  return (
    <div className="group flex items-center gap-2 p-2 rounded-md bg-background border hover:border-primary/40 transition-colors">
      <GripVertical className="w-4 h-4 text-muted-foreground/40" />
      <span className="text-xs text-muted-foreground font-mono w-6">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <InlineEditableTitle
          value={lesson.title}
          onSave={onRename}
          className="text-sm"
          testId={`title-lesson-${lesson.id}`}
        />
      </div>
      {lesson.includeInPreview && (
        <Badge variant="secondary" className="text-xs">Preview</Badge>
      )}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" onClick={onMoveUp} disabled={index === 0} className="h-7 w-7">
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onMoveDown} disabled={index === total - 1} className="h-7 w-7">
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} className="h-7 w-7 hover:text-red-600">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <Button size="sm" variant="outline" onClick={onEdit} className="ml-1" data-testid={`button-edit-lesson-${lesson.id}`}>
        <Pencil className="w-3 h-3 mr-1" /> Soạn
      </Button>
    </div>
  );
}

/* ---------- Inline Editable Title ---------- */

function InlineEditableTitle({
  value, onSave, className, testId,
}: { value: string; onSave: (title: string) => Promise<void>; className?: string; testId?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  async function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      try { await onSave(trimmed); } catch { setDraft(value); }
    } else {
      setDraft(value);
    }
    setEditing(false);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") { setDraft(value); setEditing(false); }
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        className={`${className} h-7 px-2`}
        data-testid={testId}
      />
    );
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={`${className} text-left truncate w-full hover:bg-accent/50 rounded px-1 -mx-1`}
      title="Click để sửa"
      data-testid={testId}
    >
      {value}
    </button>
  );
}

/* ---------- Lesson Editor (Block builder) ---------- */

function LessonEditor({ lessonId, onClose }: { lessonId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: blocks, isLoading } = useListLessonBlocks(lessonId);
  const { mutateAsync: createBlock } = useCreateLessonBlock();
  const { mutateAsync: updateBlock } = useUpdateLessonBlock();
  const { mutateAsync: deleteBlock } = useDeleteLessonBlock();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: getListLessonBlocksQueryKey(lessonId) });

  async function addBlock(type: BlockTypeValue) {
    const defaults: Record<string, any> = {
      heading: { text: "Tiêu đề mới", level: 2 },
      text: { content: "" },
      youtube: { url: "" },
      upload: { url: "", filename: "", mimeType: "" },
      quiz: { questions: [] },
      assignment: { description: "", dueDate: null },
    };
    try {
      await createBlock({ lessonId, data: { type, data: defaults[type] ?? {} } });
      refresh();
      toast({ title: `Đã thêm khối "${getBlockMeta(type).label}"` });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    }
  }

  async function handleDeleteBlock() {
    if (confirmDeleteId === null) return;
    try {
      await deleteBlock({ id: confirmDeleteId });
      refresh();
      toast({ title: "Đã xóa khối" });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    } finally {
      setConfirmDeleteId(null);
    }
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Soạn nội dung bài học
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Chọn khối nội dung để thêm. Nội dung tự động lưu khi bạn rời ô soạn.
          </p>
        </DialogHeader>

        {/* Block type picker */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
          {BLOCK_TYPES.map((bt) => (
            <button
              key={bt.value}
              onClick={() => addBlock(bt.value)}
              className={`group relative flex items-center gap-3 p-3 rounded-lg border bg-gradient-to-br ${bt.color} hover:border-primary hover:shadow-sm transition-all text-left`}
              data-testid={`button-add-block-${bt.value}`}
            >
              <div className={`w-9 h-9 rounded-md bg-background flex items-center justify-center ${bt.iconColor}`}>
                <bt.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{bt.label}</p>
                <p className="text-xs text-muted-foreground">+ Thêm khối</p>
              </div>
              <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
            </button>
          ))}
        </div>

        <Separator />

        <div className="space-y-3 pt-2">
          {isLoading && <Skeleton className="h-32" />}
          {blocks?.length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <MoreHorizontal className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Chưa có khối nào. Chọn loại khối ở trên để bắt đầu.</p>
            </div>
          )}
          {blocks?.map((block: any, idx: number) => (
            <BlockCard
              key={block.id}
              block={block}
              index={idx}
              onUpdate={async (data) => {
                await updateBlock({ id: block.id, data: { data } });
                refresh();
              }}
              onDelete={() => setConfirmDeleteId(block.id)}
            />
          ))}
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button onClick={onClose} data-testid="button-close-lesson-editor">Đóng</Button>
        </DialogFooter>

        <AlertDialog open={confirmDeleteId !== null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa khối nội dung?</AlertDialogTitle>
              <AlertDialogDescription>Khối này sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteBlock} className="bg-red-600 hover:bg-red-700">Xóa</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Block Card with Auto-Save ---------- */

function BlockCard({
  block, index, onUpdate, onDelete,
}: { block: any; index: number; onUpdate: (data: any) => Promise<void>; onDelete: () => void }) {
  const meta = getBlockMeta(block.type);
  const Icon = meta.icon;
  const [data, setData] = useState(block.data ?? {});
  const [savedHint, setSavedHint] = useState(false);
  const initialRef = useRef(JSON.stringify(block.data ?? {}));
  const lastSavedRef = useRef(JSON.stringify(block.data ?? {}));

  useEffect(() => {
    setData(block.data ?? {});
    initialRef.current = JSON.stringify(block.data ?? {});
    lastSavedRef.current = JSON.stringify(block.data ?? {});
  }, [block.id, block.updatedAt]);

  async function commit() {
    const current = JSON.stringify(data);
    if (current === lastSavedRef.current) return;
    try {
      await onUpdate(data);
      lastSavedRef.current = current;
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 1500);
    } catch {
      /* ignore; toast in parent */
    }
  }

  return (
    <div
      className="group relative rounded-lg border bg-card p-3 hover:border-primary/40 transition-colors"
      onBlur={commit}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <GripVertical className="w-4 h-4 text-muted-foreground/40" />
        <Badge variant="outline" className="font-mono text-xs">{String(index + 1).padStart(2, "0")}</Badge>
        <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${meta.color} flex items-center justify-center ${meta.iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium flex-1">{meta.label}</span>
        {savedHint && (
          <span className="text-xs text-emerald-600 flex items-center gap-1 animate-in fade-in">
            <Check className="w-3 h-3" /> Đã lưu
          </span>
        )}
        <Button size="icon" variant="ghost" onClick={onDelete} className="h-7 w-7 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <BlockEditorBody type={block.type} data={data} setData={setData} />
    </div>
  );
}

function BlockEditorBody({
  type, data, setData,
}: { type: string; data: any; setData: (d: any) => void }) {
  if (type === "heading") {
    return (
      <Input
        placeholder="Nhập tiêu đề..."
        value={data.text ?? ""}
        onChange={(e) => setData({ ...data, text: e.target.value, level: data.level ?? 2 })}
        className="text-lg font-semibold"
      />
    );
  }
  if (type === "text") {
    return (
      <Textarea
        placeholder="Nhập nội dung văn bản..."
        rows={4}
        value={data.content ?? ""}
        onChange={(e) => setData({ ...data, content: e.target.value })}
      />
    );
  }
  if (type === "youtube") {
    const url: string = data.url ?? "";
    const videoId = extractYouTubeId(url);
    return (
      <div className="space-y-2">
        <Input
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setData({ ...data, url: e.target.value })}
        />
        {videoId && (
          <div className="aspect-video rounded-md overflow-hidden border bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </div>
    );
  }
  if (type === "upload") {
    return (
      <div className="space-y-2">
        <Input
          placeholder="URL tệp đã upload"
          value={data.url ?? ""}
          onChange={(e) => setData({ ...data, url: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Tên tệp (vd: tai-lieu.pdf)"
            value={data.filename ?? ""}
            onChange={(e) => setData({ ...data, filename: e.target.value })}
          />
          <Input
            placeholder="MIME type (vd: application/pdf)"
            value={data.mimeType ?? ""}
            onChange={(e) => setData({ ...data, mimeType: e.target.value })}
          />
        </div>
      </div>
    );
  }
  if (type === "quiz") {
    const count = Array.isArray(data.questions) ? data.questions.length : 0;
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Nhập danh sách câu hỏi dạng JSON. Hiện có <strong>{count}</strong> câu hỏi.
        </p>
        <Textarea
          rows={5}
          className="font-mono text-xs"
          placeholder='[{"question": "...", "options": ["A", "B"], "answer": 0}]'
          value={JSON.stringify(data.questions ?? [], null, 2)}
          onChange={(e) => {
            try {
              setData({ ...data, questions: JSON.parse(e.target.value) });
            } catch {
              /* keep typing invalid JSON */
            }
          }}
        />
      </div>
    );
  }
  if (type === "assignment") {
    return (
      <div className="space-y-2">
        <Textarea
          placeholder="Mô tả yêu cầu bài tập..."
          rows={3}
          value={data.description ?? ""}
          onChange={(e) => setData({ ...data, description: e.target.value })}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Hạn nộp:</span>
          <Input
            type="datetime-local"
            value={data.dueDate ?? ""}
            onChange={(e) => setData({ ...data, dueDate: e.target.value })}
          />
        </div>
      </div>
    );
  }
  return null;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}
