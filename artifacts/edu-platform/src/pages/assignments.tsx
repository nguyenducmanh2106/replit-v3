import { useState } from "react";
import { useListAssignments, useCreateAssignment, useListCourses, getListAssignmentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, PenSquare, Calendar, Clock, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { format, parseISO } from "date-fns";

type CreateAssignmentForm = { title: string; description: string; timeLimitMinutes: number; courseId: string; maxAttempts: number; allowReview: boolean };

function formatDate(iso: string | null | undefined) {
  if (!iso) return "Không hạn";
  try { return format(parseISO(iso), "dd/MM/yyyy"); } catch { return iso; }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") return <Badge className="bg-green-100 text-green-700 border-0">Đã công bố</Badge>;
  if (status === "closed") return <Badge className="bg-gray-100 text-gray-500 border-0">Đã đóng</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-0">Nháp</Badge>;
}

export default function AssignmentsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const params = statusFilter !== "all" ? { status: statusFilter } : {};
  const { data: assignments, isLoading } = useListAssignments(params);
  const { data: courses } = useListCourses();
  const { mutate: createAssignment, isPending } = useCreateAssignment();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CreateAssignmentForm>({
    defaultValues: { timeLimitMinutes: 60, courseId: "", maxAttempts: 1, allowReview: false },
  });

  function onSubmit(values: CreateAssignmentForm) {
    createAssignment(
      {
        data: {
          title: values.title,
          description: values.description,
          timeLimitMinutes: Number(values.timeLimitMinutes),
          maxAttempts: Number(values.maxAttempts),
          allowReview: values.allowReview,
          status: "draft",
          ...(values.courseId && values.courseId !== "none" ? { courseId: Number(values.courseId) } : {}),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
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
          <h1 className="text-2xl font-bold text-gray-900">Bài tập & Đề thi</h1>
          <p className="text-muted-foreground mt-1">Tạo và quản lý các bài kiểm tra</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Tạo bài tập
        </Button>
      </div>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả trạng thái</SelectItem>
          <SelectItem value="draft">Nháp</SelectItem>
          <SelectItem value="published">Đã công bố</SelectItem>
          <SelectItem value="closed">Đã đóng</SelectItem>
        </SelectContent>
      </Select>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : assignments && assignments.length > 0 ? (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Link key={a.id} href={`/assignments/${a.id}`}>
              <Card className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <PenSquare className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{a.title}</p>
                        {a.courseName && <p className="text-sm text-muted-foreground">{a.courseName}</p>}
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          {a.dueDate && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(a.dueDate)}
                            </span>
                          )}
                          {a.timeLimitMinutes && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3.5 h-3.5" />
                              {a.timeLimitMinutes} phút
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            {a.submissionCount} bài nộp
                          </span>
                          <span className="text-xs text-muted-foreground">{a.questionCount} câu — {a.totalPoints} điểm</span>
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <PenSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700">Chưa có bài tập nào</h3>
          <p className="text-sm text-muted-foreground mt-1">Nhấn "Tạo bài tập" để bắt đầu</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo bài tập mới</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Tiêu đề *</label>
              <Input {...register("title", { required: true })} placeholder="VD: Kiểm tra giữa kỳ — Tiếng Anh B2" className="mt-1" />
              {errors.title && <p className="text-xs text-destructive mt-1">Vui lòng nhập tiêu đề</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Mô tả</label>
              <Input {...register("description")} placeholder="Mô tả ngắn về bài tập" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Khóa học</label>
              <Select value={watch("courseId") || "none"} onValueChange={(v) => setValue("courseId", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn khóa học (tuỳ chọn)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không gắn khóa học</SelectItem>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Thời gian (phút)</label>
                <Input {...register("timeLimitMinutes", { valueAsNumber: true })} type="number" min={1} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Số lần nộp tối đa</label>
                <Input {...register("maxAttempts", { valueAsNumber: true })} type="number" min={1} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="allowReview" {...register("allowReview")} className="rounded" />
              <label htmlFor="allowReview" className="text-sm font-medium text-gray-700">Cho phép học sinh xem lại bài làm</label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Đang tạo..." : "Tạo bài tập"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
