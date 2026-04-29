import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  useCreateChapter,
  useCreateLesson,
  useDeleteChapter,
  useDeleteLesson,
  useGetCourseCurriculum,
  useListUsers,
  useReorderLessons,
  useUpdateChapter,
  useUpdateCourse,
  getGetCourseCurriculumQueryKey,
  getGetCourseQueryKey,
  getListCoursesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@/lib/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ImageIcon,
  ListPlus,
  MonitorPlay,
  Plus,
  Save,
  Settings,
  Trash2,
  X,
} from "lucide-react";

type CourseLike = {
  id: number;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  level?: string | null;
  category?: string | null;
  tags?: string[] | null;
  coverImage?: string | null;
  slug?: string | null;
  published: boolean;
  teacherId?: number | null;
  teacherName?: string | null;
  status: string;
};

type CourseSettingsForm = {
  name: string;
  category: string;
  level: string;
  tagsDraft: string;
  coverImage: string;
  slug: string;
  teacherId: string;
  published: boolean;
  status: string;
  shortDescription: string;
  description: string;
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Beginner", "Intermediate", "Advanced"];
const CATEGORIES = ["Business", "English", "Programming", "Design", "Data", "Marketing", "Operations"];

function toForm(course: CourseLike): CourseSettingsForm {
  return {
    name: course.name ?? "",
    category: course.category ?? "",
    level: course.level ?? "",
    tagsDraft: (course.tags ?? []).join(", "),
    coverImage: course.coverImage ?? "",
    slug: course.slug ?? "",
    teacherId: course.teacherId ? String(course.teacherId) : "none",
    published: !!course.published,
    status: course.status ?? "active",
    shortDescription: course.shortDescription ?? "",
    description: course.description ?? "",
  };
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function CourseSettingsTab({ course }: { course: CourseLike }) {
  const [form, setForm] = useState<CourseSettingsForm>(() => toForm(course));
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutateAsync: updateCourse, isPending: savingCourse } = useUpdateCourse();
  const { data: teachers } = useListUsers({ role: "teacher" });

  useEffect(() => {
    setForm(toForm(course));
  }, [course.id]);

  const tagList = useMemo(() => parseTags(form.tagsDraft), [form.tagsDraft]);

  async function handleSaveCourse() {
    if (!form.name.trim()) {
      toast({ title: "Vui lòng nhập tiêu đề khóa học", variant: "destructive" });
      return;
    }

    try {
      await updateCourse({
        id: course.id,
        data: {
          name: form.name.trim(),
          category: form.category.trim(),
          level: form.level.trim(),
          tags: tagList,
          coverImage: form.coverImage.trim(),
          slug: form.slug.trim() || undefined,
          published: form.published,
          status: form.status,
          shortDescription: form.shortDescription.trim(),
          description: form.description.trim(),
          ...(form.teacherId !== "none" ? { teacherId: Number(form.teacherId) } : {}),
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetCourseQueryKey(course.id) }),
        queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() }),
      ]);
      toast({ title: "Đã lưu cấu hình khóa học" });
    } catch (error: any) {
      toast({
        title: "Không thể lưu cấu hình",
        description: error?.message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
            <p className="text-sm text-muted-foreground">Cấu hình thông tin hiển thị và trạng thái xuất bản của khóa học.</p>
          </div>
          <Button onClick={handleSaveCourse} disabled={savingCourse}>
            <Save className="w-4 h-4" />
            {savingCourse ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="w-4 h-4" />
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category || "custom"} onValueChange={(value) => setForm((f) => ({ ...f, category: value === "custom" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                    <SelectItem value="custom">Nhập danh mục khác</SelectItem>
                  </SelectContent>
                </Select>
                {!CATEGORIES.includes(form.category) && (
                  <Input
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="VD: Business"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Instructor</Label>
                <Select value={form.teacherId} onValueChange={(value) => setForm((f) => ({ ...f, teacherId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn giảng viên" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{course.teacherName ?? "Chưa chọn giảng viên"}</SelectItem>
                    {(teachers ?? []).map((teacher) => (
                      <SelectItem key={teacher.id} value={String(teacher.id)}>
                        {teacher.name} ({teacher.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <Input
                  value={form.tagsDraft}
                  onChange={(e) => setForm((f) => ({ ...f, tagsDraft: e.target.value }))}
                  placeholder="Frappe, Demo"
                />
                {tagList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tagList.map((tag) => (
                      <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Level</Label>
                <Select value={form.level || "none"} onValueChange={(value) => setForm((f) => ({ ...f, level: value === "none" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn cấp độ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không đặt cấp độ</SelectItem>
                    {LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="a-guide-to-frappe-learning" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[176px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label>Course Image</Label>
                <div className="flex h-28 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {form.coverImage ? (
                    <img src={form.coverImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-2 self-end">
                <Input
                  value={form.coverImage}
                  onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
                  placeholder="https://.../course-image.png"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, coverImage: "" }))}>
                  <X className="w-4 h-4" />
                  Remove
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publishing Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <Label>Published</Label>
                  <p className="text-xs text-muted-foreground">Hiển thị khóa học cho người học được phép truy cập.</p>
                </div>
                <Switch checked={form.published} onCheckedChange={(checked) => setForm((f) => ({ ...f, published: checked }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((f) => ({ ...f, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Đang hoạt động</SelectItem>
                    <SelectItem value="archived">Lưu trữ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">About the Course</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Short Introduction *</Label>
              <Textarea
                value={form.shortDescription}
                onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
                rows={3}
                placeholder="Mô tả ngắn hiển thị trên danh sách khóa học."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Course Description *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={9}
                placeholder="Nội dung giới thiệu chi tiết về khóa học."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <CourseStructurePanel courseId={course.id} />
    </div>
  );
}

function CourseStructurePanel({ courseId }: { courseId: number }) {
  const { data: curriculum, isLoading } = useGetCourseCurriculum(courseId);
  const { mutateAsync: createChapter, isPending: creatingChapter } = useCreateChapter();
  const { mutateAsync: updateChapter } = useUpdateChapter();
  const { mutateAsync: deleteChapter } = useDeleteChapter();
  const { mutateAsync: createLesson, isPending: creatingLesson } = useCreateLesson();
  const { mutateAsync: deleteLesson } = useDeleteLesson();
  const { mutateAsync: reorderLessons } = useReorderLessons();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");
  const [lessonDialog, setLessonDialog] = useState<{ chapterId: number; chapterTitle: string } | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [draggingLesson, setDraggingLesson] = useState<{ chapterId: number; lessonId: number } | null>(null);

  const chapters = curriculum?.chapters ?? [];
  const curriculumKey = getGetCourseCurriculumQueryKey(courseId);

  useEffect(() => {
    if (chapters.length > 0 && expanded.size === 0) {
      setExpanded(new Set([chapters[0].id]));
    }
  }, [chapters.length, expanded.size]);

  const invalidateCurriculum = () => queryClient.invalidateQueries({ queryKey: curriculumKey });

  function toggleChapter(chapterId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(chapterId) ? next.delete(chapterId) : next.add(chapterId);
      return next;
    });
  }

  async function handleCreateChapter() {
    const title = chapterTitle.trim();
    if (!title) {
      toast({ title: "Vui lòng nhập tên chapter", variant: "destructive" });
      return;
    }
    try {
      const created = await createChapter({ id: courseId, data: { title } });
      setChapterTitle("");
      setChapterDialogOpen(false);
      setExpanded((prev) => new Set(prev).add((created as any).id));
      await invalidateCurriculum();
      toast({ title: "Đã tạo chapter" });
    } catch (error: any) {
      toast({ title: "Không thể tạo chapter", description: error?.message, variant: "destructive" });
    }
  }

  async function handleCreateLesson() {
    if (!lessonDialog) return;
    const title = lessonTitle.trim();
    if (!title) {
      toast({ title: "Vui lòng nhập tên lesson", variant: "destructive" });
      return;
    }
    try {
      await createLesson({ chapterId: lessonDialog.chapterId, data: { title } });
      setLessonTitle("");
      setLessonDialog(null);
      setExpanded((prev) => new Set(prev).add(lessonDialog.chapterId));
      await invalidateCurriculum();
      toast({ title: "Đã tạo lesson" });
    } catch (error: any) {
      toast({ title: "Không thể tạo lesson", description: error?.message, variant: "destructive" });
    }
  }

  async function renameChapter(chapterId: number, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    await updateChapter({ chapterId, data: { title: nextTitle } });
    await invalidateCurriculum();
  }

  async function removeChapter(chapterId: number) {
    await deleteChapter({ chapterId });
    await invalidateCurriculum();
  }

  async function removeLesson(lessonId: number) {
    await deleteLesson({ lessonId });
    await invalidateCurriculum();
  }

  async function dropLesson(chapterId: number, targetLessonId?: number) {
    if (!draggingLesson || draggingLesson.chapterId !== chapterId) {
      setDraggingLesson(null);
      return;
    }

    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      setDraggingLesson(null);
      return;
    }

    const ids = chapter.lessons.map((lesson) => lesson.id);
    const fromIndex = ids.indexOf(draggingLesson.lessonId);
    const toIndex = targetLessonId ? ids.indexOf(targetLessonId) : ids.length - 1;
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      setDraggingLesson(null);
      return;
    }

    const [moved] = ids.splice(fromIndex, 1);
    const insertIndex = targetLessonId && fromIndex < toIndex ? toIndex - 1 : toIndex;
    ids.splice(insertIndex, 0, moved);
    setDraggingLesson(null);

    try {
      await reorderLessons({ chapterId, data: { ids } });
      await invalidateCurriculum();
    } catch (error: any) {
      toast({ title: "Không thể sắp xếp lesson", description: error?.message, variant: "destructive" });
    }
  }

  return (
    <Card className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b p-4">
        <CardTitle className="text-base">Chapters</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setChapterDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 overflow-y-auto p-3 xl:max-h-[calc(100vh-6rem)]">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : chapters.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Chưa có chapter</p>
            <Button size="sm" className="mt-3" onClick={() => setChapterDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Tạo chapter đầu tiên
            </Button>
          </div>
        ) : (
          chapters.map((chapter) => {
            const isOpen = expanded.has(chapter.id);
            return (
              <div key={chapter.id} className="rounded-lg border bg-background">
                <div className="flex items-center gap-2 p-2">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    onClick={() => toggleChapter(chapter.id)}
                    aria-label={isOpen ? "Thu gọn chapter" : "Mở chapter"}
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <InlineText
                    value={chapter.title}
                    onSave={(title) => renameChapter(chapter.id, title)}
                    className="font-medium"
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={() => removeChapter(chapter.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {isOpen && (
                  <>
                    <Separator />
                    <div
                      className="space-y-1 p-2"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => dropLesson(chapter.id)}
                    >
                      {chapter.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          draggable
                          onClick={() => navigate(`/courses/${courseId}/lessons/${lesson.id}/edit`)}
                          onDragStart={(event: DragEvent<HTMLDivElement>) => {
                            event.dataTransfer.effectAllowed = "move";
                            setDraggingLesson({ chapterId: chapter.id, lessonId: lesson.id });
                          }}
                          onDragEnd={() => setDraggingLesson(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.stopPropagation();
                            dropLesson(chapter.id, lesson.id);
                          }}
                          className={`group flex cursor-grab items-center gap-2 rounded-md border bg-card px-2 py-2 text-sm active:cursor-grabbing ${
                            draggingLesson?.lessonId === lesson.id ? "opacity-50" : ""
                          }`}
                        >
                          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <MonitorPlay className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate" title={lesson.title}>
                            {lesson.title}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-red-600"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeLesson(lesson.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full justify-start text-primary"
                        onClick={() => {
                          setLessonDialog({ chapterId: chapter.id, chapterTitle: chapter.title });
                          setLessonTitle("");
                        }}
                      >
                        <ListPlus className="w-4 h-4" />
                        Add Lesson
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </CardContent>

      <Dialog open={chapterDialogOpen} onOpenChange={setChapterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo chapter</DialogTitle>
          </DialogHeader>
          <Input
            value={chapterTitle}
            onChange={(event) => setChapterTitle(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleCreateChapter()}
            placeholder="VD: Introduction"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChapterDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleCreateChapter} disabled={creatingChapter}>{creatingChapter ? "Đang tạo..." : "Tạo chapter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lessonDialog} onOpenChange={(open) => !open && setLessonDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm lesson</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {lessonDialog && <p className="text-sm text-muted-foreground">Chapter: {lessonDialog.chapterTitle}</p>}
            <Input
              value={lessonTitle}
              onChange={(event) => setLessonTitle(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleCreateLesson()}
              placeholder="VD: What is Learning Management Systems?"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonDialog(null)}>Hủy</Button>
            <Button onClick={handleCreateLesson} disabled={creatingLesson}>{creatingLesson ? "Đang tạo..." : "Thêm lesson"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InlineText({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit() {
    const next = draft.trim();
    if (next && next !== value) {
      await onSave(next);
    } else {
      setDraft(value);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="h-8 min-w-0 flex-1 px-2 text-sm"
        autoFocus
      />
    );
  }

  return (
    <button
      type="button"
      className={`min-w-0 flex-1 truncate rounded px-1 py-1 text-left hover:bg-muted ${className ?? ""}`}
      onClick={() => setEditing(true)}
      title={value}
    >
      {value}
    </button>
  );
}
