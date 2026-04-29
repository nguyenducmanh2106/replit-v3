import { useEffect, useMemo, useState } from "react";
import {
  getGetCourseCurriculumQueryKey,
  getGetLessonQueryKey,
  useCreateLessonBlock,
  useGetCourse,
  useGetLesson,
  useUpdateLesson,
  useUpdateLessonBlock,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@/lib/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { LessonNotionEditor } from "@/components/lesson-notion-editor";
import { ArrowLeft, Info, Save } from "lucide-react";

const INSTRUCTOR_NOTES_BLOCK_TYPE = "instructor_notes";
const NOTION_CONTENT_BLOCK_TYPE = "notion_content";
const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

function getBlockText(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const value = (data as { text?: unknown }).text;
  return typeof value === "string" ? value : "";
}

function getBlockContent(data: unknown) {
  if (!data || typeof data !== "object") return EMPTY_DOC;
  const value = (data as { content?: unknown }).content;
  return value && typeof value === "object" ? value : EMPTY_DOC;
}

export default function LessonEditorPage() {
  const { id, lessonId: lessonIdRaw } = useParams<{ id: string; lessonId: string }>();
  const courseId = Number(id);
  const lessonId = Number(lessonIdRaw);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: course } = useGetCourse(courseId);
  const { data: lesson, isLoading } = useGetLesson(lessonId);
  const { mutateAsync: updateLesson, isPending: savingLesson } = useUpdateLesson();
  const { mutateAsync: createBlock } = useCreateLessonBlock();
  const { mutateAsync: updateBlock } = useUpdateLessonBlock();

  const instructorNotesBlock = useMemo(
    () => lesson?.blocks?.find((block) => block.type === INSTRUCTOR_NOTES_BLOCK_TYPE),
    [lesson?.blocks],
  );
  const notionContentBlock = useMemo(
    () => lesson?.blocks?.find((block) => block.type === NOTION_CONTENT_BLOCK_TYPE),
    [lesson?.blocks],
  );

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [includeInPreview, setIncludeInPreview] = useState(false);
  const [instructorNotes, setInstructorNotes] = useState("");
  const [contentJson, setContentJson] = useState<unknown>(null);

  useEffect(() => {
    if (!lesson) return;
    setTitle(lesson.title ?? "");
    setSlug(lesson.slug ?? "");
    setDurationMinutes(lesson.durationMinutes ? String(lesson.durationMinutes) : "");
    setIncludeInPreview(!!lesson.includeInPreview);
    setInstructorNotes(getBlockText(instructorNotesBlock?.data));
    setContentJson(getBlockContent(notionContentBlock?.data));
  }, [lesson?.id, instructorNotesBlock?.id, notionContentBlock?.id]);

  async function handleSave() {
    const nextTitle = title.trim();
    if (!nextTitle) {
      toast({ title: "Vui lòng nhập tiêu đề lesson", variant: "destructive" });
      return;
    }

    const duration = durationMinutes.trim() ? Number(durationMinutes) : undefined;
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
      toast({ title: "Thời lượng không hợp lệ", variant: "destructive" });
      return;
    }

    try {
      await updateLesson({
        lessonId,
        data: {
          title: nextTitle,
          slug: slug.trim() || undefined,
          includeInPreview,
          durationMinutes: duration,
        },
      });

      const notesData = { text: instructorNotes.trim() };
      if (instructorNotesBlock) {
        await updateBlock({ blockId: instructorNotesBlock.id, data: { data: notesData } });
      } else if (notesData.text) {
        await createBlock({
          lessonId,
          data: { type: INSTRUCTOR_NOTES_BLOCK_TYPE, data: notesData, orderIndex: -100 },
        });
      }

      const contentData = { content: contentJson || getBlockContent(notionContentBlock?.data) };
      if (notionContentBlock) {
        await updateBlock({ blockId: notionContentBlock.id, data: { data: contentData } });
      } else {
        await createBlock({
          lessonId,
          data: { type: NOTION_CONTENT_BLOCK_TYPE, data: contentData, orderIndex: 0 },
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetLessonQueryKey(lessonId) }),
        queryClient.invalidateQueries({ queryKey: getGetCourseCurriculumQueryKey(courseId) }),
      ]);
      toast({ title: "Đã lưu lesson" });
    } catch (error: any) {
      toast({ title: "Không thể lưu lesson", description: error?.message, variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-24" />
        <Skeleton className="h-[520px]" />
      </div>
    );
  }

  if (!lesson) {
    return <div className="py-20 text-center text-muted-foreground">Không tìm thấy lesson</div>;
  }

  return (
    <div className="-m-6 min-h-[calc(100vh-3rem)] bg-background">
      <div className="sticky top-0 z-20 flex h-10 items-center justify-between border-b bg-background px-6">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Link href={`/courses/${courseId}`} className="text-muted-foreground hover:text-foreground">
            Courses
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link href={`/courses/${courseId}`} className="truncate text-muted-foreground hover:text-foreground">
            {course?.name ?? `Course ${courseId}`}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="truncate text-muted-foreground">{lesson.title}</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">Edit Lesson</span>
        </div>
        <Button size="sm" onClick={handleSave} disabled={savingLesson}>
          <Save className="w-4 h-4" />
          {savingLesson ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="grid min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(0,1fr)_304px]">
        <main className="min-w-0 border-r">
          <div className="border-b px-8 py-5">
            <Link href={`/courses/${courseId}`} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Quay lại khóa học
            </Link>
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="flex items-start justify-between gap-4 pt-1">
                <div>
                  <Label>Include in Preview</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nếu bật, lesson này có thể truy cập trước khi học viên enroll.
                  </p>
                </div>
                <Switch checked={includeInPreview} onCheckedChange={setIncludeInPreview} />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="lesson-slug" />
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Input
                  type="number"
                  min={0}
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  placeholder="Minutes"
                />
              </div>
            </div>
          </div>

          <div className="border-b px-8 py-4">
            <div className="mb-2 flex items-center justify-between">
              <Label>Instructor Notes</Label>
              <Badge variant="outline" className="font-normal">Private</Badge>
            </div>
            <Textarea
              value={instructorNotes}
              onChange={(event) => setInstructorNotes(event.target.value)}
              rows={3}
              placeholder="Ghi chú riêng cho giảng viên..."
            />
          </div>

          <div className="px-8 py-4">
            <Label>Content</Label>
          </div>
          <div className="min-h-[640px]">
            <LessonNotionEditor
              key={`${lessonId}-${notionContentBlock?.id ?? "new"}`}
              initialContent={getBlockContent(notionContentBlock?.data)}
              placeholder="Viết nội dung lesson, gõ / để thêm block..."
              onChange={setContentJson}
            />
          </div>
        </main>

        <aside className="hidden bg-muted/20 p-5 lg:block">
          <div className="sticky top-14 space-y-5 text-sm">
            <div>
              <h3 className="font-semibold">What are Instructor Notes?</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Instructor Notes là ghi chú riêng cho người dạy. Học viên không thấy phần này trong nội dung bài học.
              </p>
            </div>
            <Separator />
            <HelpItem
              title="How to add a Quiz?"
              text="Trong editor, gõ / để mở menu block. Chọn loại nội dung phù hợp hoặc chèn link tới quiz/assignment đã tạo."
            />
            <HelpItem
              title="How to upload content?"
              text="Dùng block Image/Upload trong menu slash của Tiptap. File sẽ được upload qua cấu hình upload hiện có của template."
            />
            <HelpItem
              title="How to add a YouTube Video?"
              text="Dán URL YouTube trực tiếp vào editor hoặc dùng block embed nếu template hỗ trợ."
            />
            <Card className="rounded-lg shadow-none">
              <CardContent className="flex gap-2 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Nội dung editor được lưu vào lesson block riêng và cập nhật khi bấm Save.</span>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}

function HelpItem({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h4 className="font-medium">{title}</h4>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
