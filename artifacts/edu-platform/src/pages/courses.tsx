import { useState } from "react";
import { useListCourses, useCreateCourse, getListCoursesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Users, Plus } from "lucide-react";
import { useForm } from "react-hook-form";

type CreateCourseForm = { name: string; description: string; level: string };

const LEVELS = ["A1","A2","B1","B2","C1","C2"];

export default function CoursesPage() {
  const { data: courses, isLoading } = useListCourses();
  const { mutate: createCourse, isPending } = useCreateCourse();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<CreateCourseForm>({ defaultValues: { level: "B1" } });

  function onSubmit(values: CreateCourseForm) {
    createCourse(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
          setOpen(false);
          reset();
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Khóa học</h1>
          <p className="text-muted-foreground mt-1">Quản lý các khóa học và lớp học</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Tạo khóa học
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : courses && courses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`}>
              <Card className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <Badge
                      className={course.status === "active"
                        ? "bg-green-100 text-success border-0"
                        : "bg-gray-100 text-gray-500 border-0"}
                    >
                      {course.status === "active" ? "Đang hoạt động" : "Lưu trữ"}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-3 leading-snug">{course.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {course.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{course.studentCount} học sinh</span>
                    </div>
                    {course.level && (
                      <Badge variant="outline" className="text-xs">{course.level}</Badge>
                    )}
                  </div>
                  {course.teacherName && (
                    <p className="text-xs text-muted-foreground mt-2">GV: {course.teacherName}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700">Chưa có khóa học nào</h3>
          <p className="text-sm text-muted-foreground mt-1">Nhấn "Tạo khóa học" để bắt đầu</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo khóa học mới</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Tên khóa học *</label>
              <Input {...register("name", { required: true })} placeholder="VD: Tiếng Anh B2 — Lớp 12A" className="mt-1" />
              {errors.name && <p className="text-xs text-destructive mt-1">Vui lòng nhập tên khóa học</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Mô tả</label>
              <Input {...register("description")} placeholder="Mô tả ngắn về khóa học" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Cấp độ</label>
              <Select defaultValue="B1" onValueChange={(v) => setValue("level", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Đang tạo..." : "Tạo khóa học"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
