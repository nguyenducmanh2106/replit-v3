import { useParams, Link, useLocation } from "@/lib/routing";
import { useGetPublicCourseBySlug, useEnrollInCourse, getGetPublicCourseBySlugQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CourseLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: session } = authClient.useSession();

  const { data: course, isLoading } = useGetPublicCourseBySlug(slug);
  const { mutateAsync: enroll, isPending: enrolling } = useEnrollInCourse();

  if (isLoading) return <div className="max-w-4xl mx-auto p-8"><Skeleton className="h-96" /></div>;
  if (!course) return <div className="max-w-4xl mx-auto p-8 text-center">Không tìm thấy khóa học</div>;

  async function handleEnroll() {
    if (!session) {
      navigate(`/sign-in?next=/catalog/${slug}`);
      return;
    }
    try {
      await enroll({ id: course.id });
      qc.invalidateQueries({ queryKey: getGetPublicCourseBySlugQueryKey(slug) });
      toast({ title: "Đăng ký thành công!", description: "Bắt đầu học ngay" });
      navigate(`/courses/${course.id}/learn`);
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/catalog">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Catalog</Button>
          </Link>
          {!session && (
            <div className="flex gap-2">
              <Link href="/sign-in"><Button variant="outline" size="sm">Đăng nhập</Button></Link>
              <Link href="/sign-up"><Button size="sm">Đăng ký</Button></Link>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start gap-2 flex-wrap">
          {course.level && <Badge variant="secondary">{course.level}</Badge>}
          {course.category && <Badge variant="outline">{course.category}</Badge>}
        </div>
        <h1 className="text-4xl font-bold">{course.name}</h1>
        {course.shortDescription && <p className="text-lg text-muted-foreground">{course.shortDescription}</p>}

        {course.coverImage && <img src={course.coverImage} alt={course.name} className="w-full h-64 object-cover rounded-lg" />}

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{course.totalLessons} bài học</span>
          <span className="flex items-center gap-1"><Users className="w-4 h-4" />{course.studentCount} học viên</span>
          {course.teacherName && <span>Giảng viên: <strong>{course.teacherName}</strong></span>}
        </div>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            {course.isEnrolled ? (
              <>
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle2 className="w-5 h-5" />Bạn đã đăng ký
                </div>
                <Link href={`/courses/${course.id}/learn`}><Button>Vào học</Button></Link>
              </>
            ) : (
              <>
                <div>
                  <p className="font-medium">Đăng ký miễn phí</p>
                  <p className="text-sm text-muted-foreground">Bắt đầu học ngay sau khi đăng ký</p>
                </div>
                <Button onClick={handleEnroll} disabled={enrolling}>
                  {enrolling ? "Đang xử lý..." : "Đăng ký học"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {course.description && (
          <Card>
            <CardHeader><CardTitle>Giới thiệu</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap">{course.description}</p></CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Nội dung khóa học</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {course.chapters.map((ch, i) => (
              <div key={ch.id}>
                <h3 className="font-medium mb-2">Chương {i + 1}: {ch.title} <span className="text-sm text-muted-foreground font-normal">({ch.lessonCount} bài)</span></h3>
                <ul className="space-y-1 pl-4">
                  {ch.previewLessons.map((l) => (
                    <li key={l.id} className="text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />{l.title}
                    </li>
                  ))}
                  {ch.previewLessons.length < ch.lessonCount && (
                    <li className="text-sm flex items-center gap-2 text-muted-foreground">
                      <Lock className="w-3 h-3" />còn {ch.lessonCount - ch.previewLessons.length} bài (mở khóa khi đăng ký)
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
