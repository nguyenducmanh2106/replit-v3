import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetCourse, useGetCourseMembers, useListAssignments,
  useGetCourseSchedule, useCreateScheduleEvent, useDeleteScheduleEvent,
  useGetCourseDocuments, useCreateCourseDocument, useDeleteCourseDocument,
  useImportCourseMembers, useGetMe, useRequestUploadUrl,
  useCreateAssignment,
  getGetCourseQueryKey, getListAssignmentsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import { Users, PenSquare, Calendar, Plus, Trash2, FileText, Upload, Clock, Play, RefreshCw, Ban, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy"); } catch { return iso; }
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM HH:mm"); } catch { return iso; }
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  lesson: "Buổi học",
  exam: "Kiểm tra",
  holiday: "Nghỉ lễ",
  other: "Khác",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  lesson: "bg-blue-100 text-blue-700",
  exam: "bg-red-100 text-red-700",
  holiday: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-600",
};

function ScheduleTab({ courseId, canManage }: { courseId: number; canManage: boolean }) {
  const { data: events, isLoading } = useGetCourseSchedule(courseId);
  const { mutateAsync: createEvent } = useCreateScheduleEvent();
  const { mutateAsync: deleteEvent } = useDeleteScheduleEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "lesson",
    startAt: "",
    endAt: "",
    location: "",
    notes: "",
  });

  async function handleCreate() {
    if (!form.title || !form.startAt || !form.endAt) {
      toast({ title: "Vui lòng điền đầy đủ thông tin", variant: "destructive" });
      return;
    }
    try {
      await createEvent({ id: courseId, data: {
        title: form.title,
        type: form.type,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        location: form.location || undefined,
        notes: form.notes || undefined,
      }});
      await queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/schedule`] });
      toast({ title: "Đã thêm lịch" });
      setShowAdd(false);
      setForm({ title: "", type: "lesson", startAt: "", endAt: "", location: "", notes: "" });
    } catch {
      toast({ title: "Lỗi", description: "Không thể thêm lịch", variant: "destructive" });
    }
  }

  async function handleDelete(eventId: number) {
    try {
      await deleteEvent({ id: courseId, eventId });
      await queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/schedule`] });
      toast({ title: "Đã xoá" });
    } catch {
      toast({ title: "Lỗi", variant: "destructive" });
    }
  }

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Thêm lịch
          </Button>
        </div>
      )}

      {(events ?? []).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>Chưa có lịch học nào</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(events ?? []).map(e => (
            <div key={e.id} className="flex items-center justify-between px-4 py-3 border rounded-lg bg-white hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Badge className={`text-xs border-0 ${EVENT_TYPE_COLORS[e.type] ?? "bg-gray-100"}`}>
                    {EVENT_TYPE_LABELS[e.type] ?? e.type}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">{e.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(e.startAt)} – {formatDateTime(e.endAt)}
                    </span>
                    {e.location && <span>📍 {e.location}</span>}
                  </div>
                  {e.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{e.notes}</p>}
                </div>
              </div>
              {canManage && (
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={() => handleDelete(e.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Thêm lịch học/thi</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tiêu đề</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Buổi học Unit 3" />
            </div>
            <div className="space-y-1.5">
              <Label>Loại</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bắt đầu</Label>
                <Input type="datetime-local" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Kết thúc</Label>
                <Input type="datetime-local" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Địa điểm (tuỳ chọn)</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="VD: Phòng 301" />
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú (tuỳ chọn)</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Huỷ</Button>
            <Button onClick={handleCreate}>Thêm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentsTab({ courseId, canManage }: { courseId: number; canManage: boolean }) {
  const { data: docs, isLoading } = useGetCourseDocuments(courseId);
  const { mutateAsync: createDoc } = useCreateCourseDocument();
  const { mutateAsync: deleteDoc } = useDeleteCourseDocument();
  const { mutateAsync: requestUploadUrl } = useRequestUploadUrl();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleAddDoc() {
    if (!docName.trim()) {
      toast({ title: "Vui lòng điền tên tài liệu", variant: "destructive" });
      return;
    }

    let finalUrl = docUrl;
    let finalObjectPath: string | undefined;
    let finalSize: number | undefined;
    let finalMimeType: string | undefined;

    if (uploadMode === "file") {
      if (!selectedFile) {
        toast({ title: "Vui lòng chọn file để tải lên", variant: "destructive" });
        return;
      }
      setUploading(true);
      try {
        const { uploadURL, objectPath } = await requestUploadUrl({
          data: { name: selectedFile.name, size: selectedFile.size, contentType: selectedFile.type },
        });
        await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });
        finalObjectPath = objectPath;
        finalUrl = `/api/storage${objectPath}`;
        finalSize = selectedFile.size;
        finalMimeType = selectedFile.type;
      } catch {
        toast({ title: "Tải file thất bại", variant: "destructive" });
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    } else {
      if (!docUrl.trim()) {
        toast({ title: "Vui lòng nhập URL tài liệu", variant: "destructive" });
        return;
      }
      try { new URL(docUrl); } catch {
        toast({ title: "URL không hợp lệ", variant: "destructive" });
        return;
      }
    }

    try {
      await createDoc({ id: courseId, data: { name: docName, url: finalUrl, objectPath: finalObjectPath, size: finalSize, mimeType: finalMimeType } });
      await queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/documents`] });
      toast({ title: "Đã thêm tài liệu" });
      setShowAdd(false);
      setDocName(""); setDocUrl(""); setSelectedFile(null); setUploadMode("file");
    } catch {
      toast({ title: "Lỗi", variant: "destructive" });
    }
  }

  async function handleDelete(docId: number) {
    try {
      await deleteDoc({ id: courseId, docId });
      await queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/documents`] });
      toast({ title: "Đã xoá tài liệu" });
    } catch {
      toast({ title: "Lỗi", variant: "destructive" });
    }
  }

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Thêm tài liệu
          </Button>
        </div>
      )}

      {(docs ?? []).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>Chưa có tài liệu nào</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(docs ?? []).map(d => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3 border rounded-lg bg-white hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline text-blue-600">
                    {d.name}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {d.uploaderName} · {formatDate(d.createdAt)}
                    {d.size ? ` · ${(d.size / 1024).toFixed(0)} KB` : ""}
                  </p>
                </div>
              </div>
              {canManage && (
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={() => handleDelete(d.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Thêm tài liệu khoá học</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tên tài liệu</Label>
              <Input value={docName} onChange={e => setDocName(e.target.value)} placeholder="VD: Slide Unit 1" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={uploadMode === "file" ? "default" : "outline"} onClick={() => setUploadMode("file")}>
                <Upload className="w-3 h-3 mr-1" />Tải file lên
              </Button>
              <Button size="sm" variant={uploadMode === "url" ? "default" : "outline"} onClick={() => setUploadMode("url")}>
                Dán URL
              </Button>
            </div>
            {uploadMode === "file" ? (
              <div className="space-y-1.5">
                <Label>Chọn file</Label>
                <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
                {selectedFile && <p className="text-xs text-muted-foreground">{selectedFile.name} · {(selectedFile.size / 1024).toFixed(0)} KB</p>}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Đường link (URL)</Label>
                <Input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Huỷ</Button>
            <Button onClick={handleAddDoc} disabled={uploading}>
              {uploading ? "Đang tải..." : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImportTab({ courseId }: { courseId: number }) {
  const { mutateAsync: importMembers } = useImportCourseMembers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [csvData, setCsvData] = useState("");
  const [defaultRole, setDefaultRole] = useState("student");
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const SAMPLE_CSV = `email,name,role
student1@example.com,Nguyen Van A,student
student2@example.com,Tran Thi B,student
teacher@example.com,Le Van C,teacher`;

  async function handleImport() {
    if (!csvData.trim()) {
      toast({ title: "Vui lòng nhập dữ liệu CSV", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await importMembers({ id: courseId, data: { csvData, role: defaultRole } });
      setResult(res);
      await queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/members`] });
      toast({ title: `Nhập thành công ${res.imported} thành viên` });
    } catch {
      toast({ title: "Lỗi", description: "Không thể nhập dữ liệu", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700 font-medium mb-1">Hướng dẫn nhập CSV</p>
        <p className="text-xs text-blue-600">File CSV cần có cột: email, name (tuỳ chọn), role (tuỳ chọn). Người dùng phải đã có tài khoản trong hệ thống.</p>
        <button
          className="text-xs text-blue-700 underline mt-1"
          onClick={() => setCsvData(SAMPLE_CSV)}
        >
          Dùng mẫu CSV
        </button>
      </div>

      <div className="space-y-1.5">
        <Label>Vai trò mặc định</Label>
        <Select value={defaultRole} onValueChange={setDefaultRole}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Học sinh</SelectItem>
            <SelectItem value="teacher">Giáo viên</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Dữ liệu CSV</Label>
        <Textarea
          value={csvData}
          onChange={e => setCsvData(e.target.value)}
          placeholder={SAMPLE_CSV}
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      <Button onClick={handleImport} disabled={loading}>
        <Upload className="w-4 h-4 mr-2" />
        {loading ? "Đang nhập..." : "Nhập danh sách"}
      </Button>

      {result && (
        <div className={`p-4 rounded-lg border ${result.errors.length > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
          <p className="text-sm font-medium">Kết quả nhập:</p>
          <p className="text-sm mt-1">✅ Đã nhập: <strong>{result.imported}</strong> · ⏭️ Bỏ qua: <strong>{result.skipped}</strong></p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-amber-700">Lỗi:</p>
              <ul className="text-xs text-amber-600 mt-1 space-y-0.5">
                {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssignmentsTab({ courseId, canManage, assignments, loading }: { courseId: number; canManage: boolean; assignments: any[]; loading: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutateAsync: createAssignment, isPending } = useCreateAssignment();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", timeLimitMinutes: 60 });
  const [retakeWarning, setRetakeWarning] = useState<{ id: number; title: string; myAttemptCount: number; maxAttempts: number } | null>(null);
  const [, navigate] = useLocation();

  async function handleCreate() {
    if (!form.title) {
      toast({ title: "Vui lòng nhập tiêu đề", variant: "destructive" });
      return;
    }
    try {
      await createAssignment({
        data: {
          title: form.title,
          description: form.description || undefined,
          courseId,
          timeLimitMinutes: form.timeLimitMinutes,
          status: "draft",
        },
      });
      queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey({ courseId }) });
      queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
      setShowCreate(false);
      setForm({ title: "", description: "", timeLimitMinutes: 60 });
      toast({ title: "Đã tạo bài tập" });
    } catch (err: any) {
      toast({ title: err?.message || "Lỗi tạo bài tập", variant: "destructive" });
    }
  }

  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Tạo bài tập
          </Button>
        </div>
      )}

      {assignments.length > 0 ? (
        <div className="space-y-3">
          {assignments.map((a) => {
            const cardContent = (
              <Card className={canManage ? "cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all" : ""}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                        <PenSquare className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{a.title}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {a.dueDate && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              Hạn: {formatDate(a.dueDate)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{a.questionCount} câu — {a.totalPoints} điểm</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canManage ? (
                        <Badge className={
                          a.status === "published" ? "bg-green-100 text-green-700 border-0" :
                          a.status === "closed" ? "bg-gray-100 text-gray-500 border-0" :
                          "bg-amber-100 text-amber-700 border-0"
                        }>
                          {a.status === "published" ? "Đã công bố" : a.status === "closed" ? "Đã đóng" : "Nháp"}
                        </Badge>
                      ) : (() => {
                        const myAttempts = a.myAttemptCount ?? 0;
                        const maxAtt = a.maxAttempts ?? 0;
                        const exceeded = maxAtt > 0 && myAttempts >= maxAtt;
                        const isRetake = myAttempts > 0 && !exceeded;
                        if (exceeded) {
                          return (
                            <Badge className="bg-red-100 text-red-600 border-0 flex items-center gap-1">
                              <Ban className="w-3 h-3" />Đã hết lượt
                            </Badge>
                          );
                        }
                        return isRetake ? (
                          <Button size="sm" variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setRetakeWarning({ id: a.id, title: a.title, myAttemptCount: myAttempts, maxAttempts: maxAtt }); }}>
                            <RefreshCw className="w-3.5 h-3.5 mr-1" />Làm lại
                          </Button>
                        ) : (
                          <Link href={`/assignments/${a.id}/take`}>
                            <Button size="sm" onClick={(e) => e.stopPropagation()}>
                              <Play className="w-3.5 h-3.5 mr-1" />Làm bài
                            </Button>
                          </Link>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
            return canManage ? (
              <Link key={a.id} href={`/assignments/${a.id}`}>{cardContent}</Link>
            ) : (
              <div key={a.id}>{cardContent}</div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>Chưa có bài tập nào</p>
          {canManage && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Tạo bài tập đầu tiên
            </Button>
          )}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo bài tập cho khóa học</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium">Tiêu đề *</Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Kiểm tra giữa kỳ" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">Mô tả</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn" className="mt-1" rows={2} />
            </div>
            <div>
              <Label className="text-sm font-medium">Thời gian (phút)</Label>
              <Input type="number" min={1} value={form.timeLimitMinutes} onChange={(e) => setForm(f => ({ ...f, timeLimitMinutes: Number(e.target.value) }))} className="mt-1 w-28" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Hủy</Button>
            <Button onClick={handleCreate} disabled={isPending}>{isPending ? "Đang tạo..." : "Tạo bài tập"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!retakeWarning} onOpenChange={(v) => { if (!v) setRetakeWarning(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Xác nhận làm lại bài tập
            </DialogTitle>
          </DialogHeader>
          {retakeWarning && (
            <div className="space-y-3 pt-2">
              <p className="font-medium text-gray-900">{retakeWarning.title}</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-sm text-amber-800">
                  Đây là lần làm thứ <span className="font-bold">{retakeWarning.myAttemptCount + 1}</span> trên giới hạn <span className="font-bold">{retakeWarning.maxAttempts}</span> lần cho phép.
                </p>
                <p className="text-sm text-amber-800">
                  Làm lại sẽ xoá kết quả của bài nộp cũ và ghi nhận kết quả mới nhất.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Còn lại: {retakeWarning.maxAttempts - retakeWarning.myAttemptCount} lượt</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetakeWarning(null)}>Hủy</Button>
            <Button variant="destructive" onClick={() => {
              if (retakeWarning) navigate(`/assignments/${retakeWarning.id}/take`);
              setRetakeWarning(null);
            }}>Xác nhận làm lại</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const { data: me } = useGetMe();
  const { data: course, isLoading: loadingCourse } = useGetCourse(courseId, { query: { enabled: !!courseId, queryKey: getGetCourseQueryKey(courseId) } });
  const { data: members, isLoading: loadingMembers } = useGetCourseMembers(courseId, { query: { enabled: !!courseId, queryKey: [`/api/courses/${courseId}/members`] as const } });
  const { data: assignments, isLoading: loadingAssignments } = useListAssignments({ courseId });

  const ADMIN_ROLES = ["system_admin", "center_admin", "school_admin", "enterprise_admin"];
  const isAdmin = !!(me?.role && ADMIN_ROLES.includes(me.role));
  const isTeacher = me?.role === "teacher";
  const canManage = !!(isAdmin || (isTeacher && course?.teacherId === me?.id));

  if (loadingCourse) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!course) {
    return <div className="text-center py-20 text-muted-foreground">Không tìm thấy khóa học</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
          <Badge className={course.status === "active" ? "bg-green-100 text-success border-0" : "bg-gray-100 text-gray-500 border-0"}>
            {course.status === "active" ? "Đang hoạt động" : "Lưu trữ"}
          </Badge>
        </div>
        {course.description && <p className="text-muted-foreground mt-1">{course.description}</p>}
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          {course.level && <span>Cấp độ: <span className="font-medium text-gray-700">{course.level}</span></span>}
          {course.teacherName && <span>Giáo viên: <span className="font-medium text-gray-700">{course.teacherName}</span></span>}
          <span className="flex items-center gap-1"><Users className="w-4 h-4" />{course.studentCount} học sinh</span>
        </div>
      </div>

      <Tabs defaultValue={canManage ? "members" : "assignments"}>
        <TabsList>
          <TabsTrigger value="members">Thành viên ({members?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="assignments">Bài tập ({assignments?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="schedule">Lịch học</TabsTrigger>
          <TabsTrigger value="documents">Tài liệu</TabsTrigger>
          {canManage && <TabsTrigger value="import">Nhập danh sách</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="mt-4">
          {loadingMembers ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : members && members.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <p className="font-medium text-sm">{m.userName}</p>
                        <p className="text-xs text-muted-foreground">{m.userEmail}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {m.role === "teacher" ? "Giáo viên" : "Học sinh"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 text-muted-foreground">Chưa có thành viên nào</div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <AssignmentsTab courseId={courseId} canManage={canManage} assignments={assignments ?? []} loading={loadingAssignments} />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <ScheduleTab courseId={courseId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab courseId={courseId} canManage={canManage} />
        </TabsContent>

        {canManage && (
          <TabsContent value="import" className="mt-4">
            <ImportTab courseId={courseId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
