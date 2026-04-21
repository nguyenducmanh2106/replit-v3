import { useEffect, useState } from "react";
import { Link, useLocation } from "@/lib/routing";
import { placementApi, type PlacementTestListItem } from "@/lib/placement-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, ClipboardList, Link as LinkIcon, Copy, Clock, Users, Edit, Trash2 } from "lucide-react";

export default function PlacementTestsPage() {
  const [items, setItems] = useState<PlacementTestListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  async function load() {
    setLoading(true);
    try {
      const data = await placementApi.list();
      setItems(data);
    } catch (e: any) {
      toast({ title: "Không tải được danh sách", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!title.trim()) { toast({ title: "Vui lòng nhập tiêu đề", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const created = await placementApi.create({ title: title.trim(), description: description.trim() || undefined });
      setOpen(false); setTitle(""); setDescription("");
      toast({ title: "Đã tạo bài test", description: "Bạn có thể thêm câu hỏi và xuất bản." });
      navigate(`/placement-tests/${created.id}`);
    } catch (e: any) {
      toast({ title: "Không tạo được", description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: number, title: string) {
    if (!confirm(`Xoá bài test "${title}"? Tất cả bài nộp cũng sẽ bị xoá.`)) return;
    try {
      await placementApi.remove(id);
      toast({ title: "Đã xoá bài test" });
      load();
    } catch (e: any) {
      toast({ title: "Không xoá được", description: e.message, variant: "destructive" });
    }
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/test/${slug}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: "Đã sao chép link", description: url }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="w-6 h-6" /> Bài kiểm tra đánh giá đầu vào</h1>
          <p className="text-sm text-muted-foreground mt-1">Tạo bài test độc lập, chia sẻ qua link — không cần tài khoản học sinh</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Tạo bài test mới</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : items && items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{t.title}</CardTitle>
                  <Badge variant={t.status === "active" ? "default" : t.status === "closed" ? "secondary" : "outline"} className="flex-shrink-0">
                    {t.status === "active" ? "Đang mở" : t.status === "closed" ? "Đã đóng" : "Nháp"}
                  </Badge>
                </div>
                {t.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {t.submissionCount} bài nộp</span>
                  {t.pendingCount > 0 && <span className="text-orange-600 font-medium">{t.pendingCount} chờ chấm</span>}
                  {t.timeLimitMinutes && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {t.timeLimitMinutes}p</span>}
                </div>
                {t.status === "active" && (
                  <div className="flex items-center gap-1 p-2 bg-gray-50 rounded text-xs">
                    <LinkIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <code className="flex-1 truncate text-gray-700">/test/{t.linkSlug}</code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyLink(t.linkSlug)}><Copy className="w-3 h-3" /></Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Link href={`/placement-tests/${t.id}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full"><Edit className="w-3.5 h-3.5 mr-1" /> Sửa</Button>
                  </Link>
                  <Link href={`/placement-tests/${t.id}/submissions`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full">Bài nộp</Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id, t.title)} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="py-12 text-center">
          <ClipboardList className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-muted-foreground">Chưa có bài test nào. Tạo bài đầu tiên để bắt đầu.</p>
        </CardContent></Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tạo bài test mới</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tiêu đề *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Kiểm tra trình độ tiếng Anh đầu vào" />
            </div>
            <div>
              <Label>Mô tả ngắn</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Mô tả mục đích bài test..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
            <Button onClick={handleCreate} disabled={submitting}>{submitting ? "Đang tạo..." : "Tạo bài test"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
