import { useState } from "react";
import { useListQuizTemplates, useCreateQuizTemplate, useDeleteQuizTemplate, getListQuizTemplatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, FileText, Trash2, HelpCircle, Award } from "lucide-react";

export default function QuizTemplatesPage() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useListQuizTemplates();
  const { mutate: createTemplate, isPending } = useCreateQuizTemplate();
  const { mutate: deleteTemplate } = useDeleteQuizTemplate();

  function handleCreate() {
    if (!title.trim()) return;
    createTemplate(
      { data: { title: title.trim(), description: description.trim() || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListQuizTemplatesQueryKey() });
          setOpen(false);
          setTitle("");
          setDescription("");
        },
      }
    );
  }

  function handleDelete(id: number) {
    if (!confirm("Bạn có chắc muốn xoá bộ quiz này?")) return;
    deleteTemplate(
      { id },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuizTemplatesQueryKey() }) }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Kho Quiz nguồn</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý bộ sưu tập câu hỏi mẫu, dùng để gán nhanh vào bài tập</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Tạo bộ quiz mới
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20" /></CardContent></Card>
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Chưa có bộ quiz nào. Tạo bộ quiz đầu tiên!</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <Link href={`/quiz-templates/${t.id}`} className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 hover:text-primary transition-colors truncate">{t.title}</h3>
                    {t.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                  </Link>
                  <Button variant="ghost" size="icon" className="shrink-0 text-red-400 hover:text-red-600" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" />{t.questionCount} câu</span>
                  <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5" />{t.totalPoints} điểm</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tạo bộ quiz mới</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tên bộ quiz *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Quiz từ vựng B1 chương 1" />
            </div>
            <div>
              <label className="text-sm font-medium">Mô tả</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả tuỳ chọn" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
            <Button onClick={handleCreate} disabled={isPending || !title.trim()}>
              {isPending ? "Đang tạo..." : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
