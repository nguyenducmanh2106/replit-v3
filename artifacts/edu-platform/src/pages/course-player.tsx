import { useState, useMemo } from "react";
import { useParams, Link } from "@/lib/routing";
import {
  useGetCourseCurriculum,
  useGetLesson,
  useMarkLessonComplete,
  getGetCourseCurriculumQueryKey,
  getGetLessonQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, ArrowLeft, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function youtubeEmbed(url: string): string {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("v") || u.pathname.split("/").pop();
    return `https://www.youtube.com/embed/${id}`;
  } catch { return url; }
}

export default function CoursePlayerPage() {
  const { id: idRaw } = useParams<{ id: string }>();
  const courseId = parseInt(idRaw, 10);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: curriculum, isLoading: loadingCur } = useGetCourseCurriculum(courseId);

  const flatLessons = useMemo(() => {
    return (curriculum?.chapters ?? []).flatMap((c) => c.lessons.map((l) => ({ ...l, chapterTitle: c.title })));
  }, [curriculum]);

  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const lessonId = activeLessonId ?? flatLessons[0]?.id ?? null;

  const { data: lesson, isLoading: loadingLesson } = useGetLesson(lessonId ?? 0, { query: { enabled: !!lessonId } });
  const { mutateAsync: markComplete, isPending: marking } = useMarkLessonComplete();

  const currentIdx = flatLessons.findIndex((l) => l.id === lessonId);
  const prev = currentIdx > 0 ? flatLessons[currentIdx - 1] : null;
  const next = currentIdx >= 0 && currentIdx < flatLessons.length - 1 ? flatLessons[currentIdx + 1] : null;

  async function handleComplete() {
    if (!lessonId) return;
    try {
      const res = await markComplete({ lessonId });
      qc.invalidateQueries({ queryKey: getGetCourseCurriculumQueryKey(courseId) });
      qc.invalidateQueries({ queryKey: getGetLessonQueryKey(lessonId) });
      if (res.certificateIssued && res.certificateNo) {
        toast({ title: "🎉 Hoàn thành khóa học!", description: `Chứng chỉ #${res.certificateNo} đã được cấp` });
      } else {
        toast({ title: "Đã đánh dấu hoàn thành", description: `Tiến độ: ${res.progressPercent}%` });
      }
      if (next) setActiveLessonId(next.id);
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    }
  }

  if (loadingCur) return <Skeleton className="h-screen" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-100px)]">
      {/* Sidebar - lesson tree */}
      <Card className="overflow-y-auto">
        <CardContent className="p-3 space-y-3">
          <Link href={`/courses/${courseId}`}>
            <Button variant="ghost" size="sm" className="w-full justify-start"><ArrowLeft className="w-4 h-4 mr-2" />Quay lại</Button>
          </Link>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-medium">
              <span>Tiến độ</span>
              <span>{curriculum?.progressPercent ?? 0}%</span>
            </div>
            <Progress value={curriculum?.progressPercent ?? 0} />
            <p className="text-xs text-muted-foreground">{curriculum?.completedLessons ?? 0} / {curriculum?.totalLessons ?? 0} bài</p>
          </div>
          <div className="space-y-3 pt-2">
            {curriculum?.chapters.map((chapter) => (
              <div key={chapter.id}>
                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-1">{chapter.title}</h4>
                <div className="space-y-0.5">
                  {chapter.lessons.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setActiveLessonId(l.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-left hover:bg-gray-100 ${l.id === lessonId ? "bg-primary/10 font-medium" : ""}`}
                    >
                      {l.completed ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <Circle className="w-4 h-4 text-gray-300 shrink-0" />}
                      <span className="truncate">{l.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main lesson view */}
      <Card className="overflow-y-auto">
        <CardContent className="p-6 space-y-4">
          {loadingLesson || !lesson ? (
            <Skeleton className="h-96" />
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  {lesson.chapterTitle && <p className="text-xs text-muted-foreground uppercase">{lesson.chapterTitle}</p>}
                  <h1 className="text-2xl font-bold">{lesson.title}</h1>
                </div>
                {lesson.completed && (
                  <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <CheckCircle2 className="w-5 h-5" />Đã hoàn thành
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {(lesson.blocks ?? []).map((block: any) => <LessonBlockView key={block.id} block={block} />)}
                {(!lesson.blocks || lesson.blocks.length === 0) && (
                  <p className="text-muted-foreground italic">Bài học chưa có nội dung.</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-6 border-t">
                <Button variant="outline" disabled={!prev} onClick={() => prev && setActiveLessonId(prev.id)}>
                  <ChevronLeft className="w-4 h-4 mr-1" />Bài trước
                </Button>
                {!lesson.completed ? (
                  <Button onClick={handleComplete} disabled={marking}>
                    <CheckCircle2 className="w-4 h-4 mr-1" />Đánh dấu hoàn thành
                  </Button>
                ) : (curriculum?.progressPercent === 100 ? (
                  <Link href="/certificates"><Button variant="default"><Award className="w-4 h-4 mr-1" />Xem chứng chỉ</Button></Link>
                ) : <span />)}
                <Button variant="outline" disabled={!next} onClick={() => next && setActiveLessonId(next.id)}>
                  Bài sau<ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LessonBlockView({ block }: { block: any }) {
  const data = block.data ?? {};
  switch (block.type) {
    case "heading":
      return <h2 className="text-xl font-bold mt-4">{data.text}</h2>;
    case "text":
      return <div className="prose prose-sm max-w-none whitespace-pre-wrap">{data.content}</div>;
    case "youtube":
      return (
        <div className="aspect-video">
          <iframe src={youtubeEmbed(data.url)} className="w-full h-full rounded-md" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      );
    case "upload":
      const isImg = (data.mimeType ?? "").startsWith("image/");
      const isVid = (data.mimeType ?? "").startsWith("video/");
      if (isImg) return <img src={data.url} alt={data.filename} className="max-w-full rounded-md" />;
      if (isVid) return <video src={data.url} controls className="max-w-full rounded-md" />;
      return <a href={data.url} target="_blank" rel="noreferrer" className="text-primary underline">📄 {data.filename || "Tải về"}</a>;
    case "quiz":
      return (
        <Card><CardContent className="p-4 space-y-2">
          <p className="font-medium">Trắc nghiệm</p>
          <p className="text-sm text-muted-foreground">{(data.questions ?? []).length} câu hỏi</p>
        </CardContent></Card>
      );
    case "assignment":
      return (
        <Card><CardContent className="p-4">
          <p className="font-medium mb-1">Bài tập</p>
          <p className="text-sm whitespace-pre-wrap">{data.description}</p>
          {data.dueDate && <p className="text-xs text-muted-foreground mt-2">Hạn nộp: {data.dueDate}</p>}
        </CardContent></Card>
      );
    default:
      return null;
  }
}
