import { useEffect, useState } from "react";
import { useParams, Link } from "@/lib/routing";
import { placementApi, type PlacementTest, type PlacementTestQuestion } from "@/lib/placement-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Send, Copy, Link as LinkIcon, Plus, Trash2, ChevronUp, ChevronDown,
  Settings, ListOrdered, BookOpen, Pencil, Headphones, Video, Image as ImageIcon,
  Download, Eye, ArrowRight, RefreshCw,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateQuestionDialog, type QuestionData } from "@/components/create-question-dialog";
import {
  QuestionEditDialog, TYPE_LABELS, SKILL_LABELS,
  type EditDraft,
} from "@/components/question-edit-dialog";

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-green-100 text-green-700", A2: "bg-green-200 text-green-800",
  B1: "bg-blue-100 text-blue-700", B2: "bg-blue-200 text-blue-800",
  C1: "bg-purple-100 text-purple-700", C2: "bg-purple-200 text-purple-800",
};

export default function PlacementTestBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const testId = Number(id);
  const { toast } = useToast();

  const [test, setTest] = useState<(PlacementTest & { questions: PlacementTestQuestion[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [timeLimit, setTimeLimit] = useState<string>("");
  const [passScore, setPassScore] = useState<string>("");
  const [showScore, setShowScore] = useState(false);
  const [allowRetake, setAllowRetake] = useState(false);
  const [notifyTeacher, setNotifyTeacher] = useState(true);

  const [createQOpen, setCreateQOpen] = useState(false);
  const [creatingQ, setCreatingQ] = useState(false);
  const [editingQ, setEditingQ] = useState<PlacementTestQuestion | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const t = await placementApi.get(testId);
      setTest(t);
      setTitle(t.title);
      setDescription(t.description ?? "");
      setInstructions(t.instructions ?? "");
      setTimeLimit(t.timeLimitMinutes != null ? String(t.timeLimitMinutes) : "");
      setPassScore(t.passScore != null ? String(t.passScore) : "");
      setShowScore(t.showScoreImmediately);
      setAllowRetake(t.allowRetake);
      setNotifyTeacher(t.notifyTeacherEmail);
    } catch (e: any) {
      toast({ title: "Không tải được bài test", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }
  useEffect(() => { if (testId) load(); }, [testId]);

  async function handleSave() {
    setSaving(true);
    try {
      await placementApi.update(testId, {
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        timeLimitMinutes: timeLimit.trim() ? Number(timeLimit) : null,
        passScore: passScore.trim() ? Number(passScore) : null,
        showScoreImmediately: showScore,
        allowRetake,
        notifyTeacherEmail: notifyTeacher,
      });
      toast({ title: "Đã lưu cấu hình" });
      load();
    } catch (e: any) {
      toast({ title: "Không lưu được", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handlePublish() {
    if (!test) return;
    if ((test.questions?.length ?? 0) === 0) { toast({ title: "Cần thêm ít nhất 1 câu hỏi", variant: "destructive" }); return; }
    try {
      const res = await placementApi.publish(testId);
      toast({ title: "Đã xuất bản", description: `Link: ${res.publicUrl}` });
      load();
    } catch (e: any) {
      toast({ title: "Không xuất bản được", description: e.message, variant: "destructive" });
    }
  }

  function copyLink() {
    if (!test) return;
    const url = `${window.location.origin}/test/${test.linkSlug}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: "Đã sao chép link", description: url }));
  }

  async function handleCreateQuestion(data: QuestionData) {
    setCreatingQ(true);
    try {
      const optionsParsed = data.options ? safeParse(data.options) : null;
      await placementApi.addQuestion(testId, {
        type: data.type,
        content: data.content,
        options: optionsParsed,
        correctAnswer: data.correctAnswer,
        points: data.points,
        sourceType: "custom",
        skill: data.skill,
        level: data.level,
        audioUrl: data.audioUrl,
        videoUrl: data.videoUrl,
        imageUrl: data.imageUrl,
        passage: data.passage,
        explanation: data.explanation,
        metadata: data.metadata,
      });
      toast({ title: "Đã thêm câu hỏi" });
      setCreateQOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Không thêm được", description: e.message, variant: "destructive" });
    } finally { setCreatingQ(false); }
  }

  async function handleSaveEdit(patch: Partial<EditDraft>) {
    if (!editingQ) return;
    setSavingEdit(true);
    try {
      const apiPatch: Partial<PlacementTestQuestion> = {
        ...patch,
        options: typeof patch.options === "string" ? safeParse(patch.options) : patch.options,
      } as any;
      await placementApi.updateQuestion(editingQ.id, apiPatch);
      toast({ title: "Đã lưu thay đổi" });
      setEditingQ(null);
      load();
    } catch (e: any) {
      toast({ title: "Không lưu được", description: e.message, variant: "destructive" });
    } finally { setSavingEdit(false); }
  }

  async function handleDeleteQ(qid: number) {
    if (!confirm("Xoá câu hỏi này?")) return;
    try {
      await placementApi.deleteQuestion(qid);
      toast({ title: "Đã xoá" });
      load();
    } catch (e: any) { toast({ title: "Không xoá được", description: e.message, variant: "destructive" }); }
  }

  async function handleMove(idx: number, dir: -1 | 1) {
    if (!test) return;
    const qs = [...test.questions];
    const target = idx + dir;
    if (target < 0 || target >= qs.length) return;
    [qs[idx], qs[target]] = [qs[target]!, qs[idx]!];
    try {
      await placementApi.reorder(testId, qs.map(q => q.id));
      load();
    } catch (e: any) { toast({ title: "Không đổi thứ tự được", description: e.message, variant: "destructive" }); }
  }

  if (loading || !test) {
    return <div className="space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64" /></div>;
  }

  const publicUrl = `${window.location.origin}/test/${test.linkSlug}`;

  // Normalize options to string for QuestionEditDialog (it accepts string or object)
  function toEditQ(q: PlacementTestQuestion): any {
    return {
      ...q,
      options: typeof q.options === "string" ? q.options : q.options != null ? JSON.stringify(q.options) : null,
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/placement-tests"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Danh sách</Button></Link>
          <div>
            <h1 className="text-xl font-bold">{title || "Bài test mới"}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={test.status === "active" ? "default" : test.status === "closed" ? "secondary" : "outline"}>
                {test.status === "active" ? "Đang mở" : test.status === "closed" ? "Đã đóng" : "Nháp"}
              </Badge>
              <span className="text-xs text-muted-foreground">{test.questions.length} câu · {test.maxScore} điểm</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/placement-tests/${testId}/submissions`}><Button variant="outline">Xem bài nộp</Button></Link>
          {test.status === "active" ? (
            <Button variant="outline" onClick={copyLink}><Copy className="w-4 h-4 mr-1" /> Sao chép link</Button>
          ) : (
            <Button onClick={handlePublish}><Send className="w-4 h-4 mr-1" /> Xuất bản & lấy link</Button>
          )}
        </div>
      </div>

      {test.status === "active" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm">
              <LinkIcon className="w-4 h-4 text-green-700 flex-shrink-0" />
              <span className="font-medium text-green-900">Link công khai:</span>
              <code className="flex-1 truncate bg-white px-2 py-1 rounded text-xs">{publicUrl}</code>
              <Button size="sm" variant="ghost" onClick={copyLink}><Copy className="w-3.5 h-3.5" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions"><ListOrdered className="w-4 h-4 mr-1" /> Câu hỏi ({test.questions.length})</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" /> Cấu hình</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-3 mt-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBankOpen(true)}><BookOpen className="w-4 h-4 mr-1" /> Từ ngân hàng câu hỏi</Button>
            <Button variant="outline" onClick={() => setQuizOpen(true)}><Download className="w-4 h-4 mr-1" /> Nhập từ Quiz</Button>
            <Button onClick={() => setCreateQOpen(true)}><Plus className="w-4 h-4 mr-1" /> Thêm câu hỏi mới</Button>
          </div>
          {test.questions.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Chưa có câu hỏi. Thêm câu đầu tiên để bắt đầu.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {test.questions.map((q, idx) => (
                <PlacementQuestionCard
                  key={q.id} q={q} idx={idx}
                  isFirst={idx === 0}
                  isLast={idx === test.questions.length - 1}
                  onMoveUp={() => handleMove(idx, -1)}
                  onMoveDown={() => handleMove(idx, 1)}
                  onEdit={() => setEditingQ(q)}
                  onDelete={() => handleDeleteQ(q.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Thông tin cơ bản</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Tiêu đề *</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div><Label>Mô tả</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
              <div><Label>Hướng dẫn làm bài</Label><Textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={4} placeholder="Hướng dẫn hiển thị cho học sinh trước khi bắt đầu..." /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Cấu hình bài test</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Thời gian làm bài (phút)</Label><Input type="number" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} placeholder="Không giới hạn" /></div>
                <div><Label>Điểm đạt</Label><Input type="number" value={passScore} onChange={e => setPassScore(e.target.value)} placeholder="Không bắt buộc" /></div>
              </div>
              <div className="flex items-center justify-between py-2 border-t"><div><Label>Hiện điểm tự động ngay sau khi nộp</Label><p className="text-xs text-muted-foreground">Chỉ hiện điểm phần trắc nghiệm; phần tự luận vẫn chờ giáo viên chấm</p></div><Switch checked={showScore} onCheckedChange={setShowScore} /></div>
              <div className="flex items-center justify-between py-2 border-t"><div><Label>Cho phép làm lại</Label><p className="text-xs text-muted-foreground">Cùng một email có thể nộp nhiều lần</p></div><Switch checked={allowRetake} onCheckedChange={setAllowRetake} /></div>
              <div className="flex items-center justify-between py-2 border-t"><div><Label>Gửi email thông báo cho giáo viên khi có bài nộp</Label></div><Switch checked={notifyTeacher} onCheckedChange={setNotifyTeacher} /></div>
            </CardContent>
          </Card>

          <div className="flex justify-end"><Button onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-1" /> {saving ? "Đang lưu..." : "Lưu cấu hình"}</Button></div>
        </TabsContent>
      </Tabs>

      <CreateQuestionDialog
        open={createQOpen}
        onClose={() => setCreateQOpen(false)}
        onSave={handleCreateQuestion}
        saving={creatingQ}
      />

      <QuestionEditDialog
        q={editingQ ? toEditQ(editingQ) : null}
        open={!!editingQ}
        onClose={() => setEditingQ(null)}
        onSave={handleSaveEdit}
        saving={savingEdit}
      />

      <BankImportDialog open={bankOpen} onOpenChange={setBankOpen} testId={testId} onImported={load} />
      <QuizImportDialog open={quizOpen} onOpenChange={setQuizOpen} testId={testId} onImported={load} />
    </div>
  );
}

function PlacementQuestionCard({ q, idx, isFirst, isLast, onMoveUp, onMoveDown, onEdit, onDelete }: {
  q: PlacementTestQuestion; idx: number;
  isFirst: boolean; isLast: boolean;
  onMoveUp: () => void; onMoveDown: () => void;
  onEdit: () => void; onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="flex flex-col gap-0.5 pt-0.5">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={isFirst} onClick={onMoveUp}><ChevronUp className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={isLast} onClick={onMoveDown}><ChevronDown className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold mt-0.5">{idx + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge variant="outline" className="text-xs">{TYPE_LABELS[q.type] ?? q.type}</Badge>
              {q.skill && <Badge variant="outline" className="text-xs">{SKILL_LABELS[q.skill] ?? q.skill}</Badge>}
              {q.level && <Badge className={`text-xs border-0 ${LEVEL_COLORS[q.level] ?? "bg-gray-100 text-gray-600"}`}>{q.level}</Badge>}
              <span className="text-xs text-muted-foreground font-medium">{q.points} điểm</span>
              {q.sourceType === "bank" && <Badge variant="outline" className="text-xs">Từ ngân hàng</Badge>}
              {q.sourceType === "quiz" && <Badge variant="outline" className="text-xs">Từ quiz</Badge>}
            </div>

            {q.imageUrl && (
              <div className="mb-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 max-w-xs">
                <img src={q.imageUrl} alt="" className="w-full h-auto object-contain max-h-32" />
              </div>
            )}
            {q.audioUrl && (
              <div className="mb-2 flex items-center gap-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                <Headphones className="w-3.5 h-3.5" /><span className="truncate">{q.audioUrl}</span>
              </div>
            )}
            {q.videoUrl && (
              <div className="mb-2 flex items-center gap-2 px-2 py-1 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700">
                <Video className="w-3.5 h-3.5" /><span className="truncate">{q.videoUrl}</span>
              </div>
            )}
            {q.passage && (
              <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 line-clamp-3">
                {q.passage}
              </div>
            )}

            <p className="text-sm font-medium line-clamp-2">{q.content}</p>

            <PlacementOptionsPreview type={q.type} options={q.options} correctAnswer={q.correctAnswer} />
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlacementOptionsPreview({ type, options, correctAnswer }: { type: string; options: unknown; correctAnswer: string | null }) {
  if (type === "mcq" || type === "true_false") {
    const opts = parseOpts<string[]>(options, []);
    if (!Array.isArray(opts) || opts.length === 0) return null;
    const corrects = (correctAnswer ?? "").split(",").map(s => s.trim());
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {opts.slice(0, 6).map((o, i) => (
          <span key={i} className={`text-xs px-2 py-0.5 rounded ${corrects.includes(o) ? "bg-green-100 text-green-800 border border-green-300" : "bg-gray-100 text-gray-600"}`}>{o}</span>
        ))}
      </div>
    );
  }
  if (type === "fill_blank") {
    const arr = parseOpts<string[]>(correctAnswer, []);
    const items = Array.isArray(arr) ? arr : (correctAnswer ? [correctAnswer] : []);
    if (items.length === 0) return null;
    return <div className="mt-2 text-xs text-gray-500">Đáp án: <span className="text-green-700 font-medium">{items.join(" · ")}</span></div>;
  }
  if (type === "matching") {
    const pairs = parseOpts<Array<{ left: string; right: string }>>(options, []);
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    return <div className="mt-2 text-xs text-gray-500">{pairs.length} cặp ghép</div>;
  }
  if (type === "reading" || type === "listening") {
    const subs = parseOpts<unknown[]>(options, []);
    if (!Array.isArray(subs) || subs.length === 0) return null;
    return <div className="mt-2 text-xs text-gray-500">{subs.length} câu thành phần</div>;
  }
  return null;
}

function parseOpts<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
}

function safeParse(s: string | null): unknown {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return s; }
}

function BankImportDialog({ open, onOpenChange, testId, onImported }: { open: boolean; onOpenChange: (o: boolean) => void; testId: number; onImported: () => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id: number; content: string; type: string; points: number }>>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/questions?search=${encodeURIComponent(search)}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setItems(Array.isArray(data) ? data : data.items ?? []); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, search]);

  function toggle(id: number) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const res = await placementApi.bulkImport(testId, [...selected]);
      toast({ title: `Đã thêm ${res.imported} câu hỏi` });
      setSelected(new Set()); onOpenChange(false);
      onImported();
    } catch (e: any) {
      toast({ title: "Không thêm được", description: e.message, variant: "destructive" });
    } finally { setImporting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Chọn câu hỏi từ ngân hàng</DialogTitle></DialogHeader>
        <Input placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="max-h-96 overflow-y-auto space-y-1">
          {loading ? <p className="text-center py-6 text-sm text-muted-foreground">Đang tải...</p> :
            items.length === 0 ? <p className="text-center py-6 text-sm text-muted-foreground">Không tìm thấy câu hỏi</p> :
            items.map(q => (
              <label key={q.id} className={`flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 ${selected.has(q.id) ? "bg-blue-50 border-blue-300" : ""}`}>
                <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[q.type] ?? q.type}</Badge>
                    <Badge variant="secondary" className="text-xs">{q.points} điểm</Badge>
                  </div>
                  <p className="text-sm line-clamp-2">{q.content}</p>
                </div>
              </label>
            ))}
        </div>
        <DialogFooter>
          <span className="text-sm text-muted-foreground mr-auto">Đã chọn {selected.size} câu</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button onClick={handleImport} disabled={selected.size === 0 || importing}>{importing ? "Đang thêm..." : `Thêm ${selected.size} câu`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuizImportDialog({ open, onOpenChange, testId, onImported }: { open: boolean; onOpenChange: (o: boolean) => void; testId: number; onImported: () => void }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof placementApi.listQuizTemplates>>>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewQs, setPreviewQs] = useState<Awaited<ReturnType<typeof placementApi.getQuizTemplateQuestions>>>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingList(true);
    placementApi.listQuizTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoadingList(false));
  }, [open]);

  function reset() { setPreviewId(null); setPreviewQs([]); setSelectedIds([]); }

  async function handlePreview(tid: number) {
    setPreviewId(tid);
    setLoadingPreview(true);
    setSelectedIds([]);
    setPreviewQs([]);
    try {
      const data = await placementApi.getQuizTemplateQuestions(tid);
      setPreviewQs(data);
      setSelectedIds(data.map(q => q.id));
    } catch {
      toast({ title: "Lỗi", description: "Không thể tải câu hỏi", variant: "destructive" });
      setPreviewId(null);
    } finally { setLoadingPreview(false); }
  }

  async function handleImportAll(tid: number) {
    setImporting(true);
    try {
      const r = await placementApi.importFromQuiz(testId, tid);
      toast({ title: "Nhập thành công", description: `Đã nhập ${r.imported} câu hỏi từ bộ quiz` });
      onImported(); onOpenChange(false); reset();
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    } finally { setImporting(false); }
  }

  async function handleImportSelected() {
    if (!previewId || selectedIds.length === 0) return;
    setImporting(true);
    try {
      const r = await placementApi.importFromQuiz(testId, previewId, selectedIds);
      toast({ title: "Nhập thành công", description: `Đã nhập ${r.imported} câu hỏi` });
      onImported(); onOpenChange(false); reset();
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    } finally { setImporting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onOpenChange(false); reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {previewId ? (
              <button className="flex items-center gap-2 text-left" onClick={reset}>
                <ArrowRight className="w-4 h-4 rotate-180" /> Chọn câu hỏi để nhập
              </button>
            ) : "Nhập câu hỏi từ bộ Quiz"}
          </DialogTitle>
        </DialogHeader>

        {!previewId ? (
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {loadingList ? (
              <p className="text-center text-muted-foreground py-8">Đang tải...</p>
            ) : templates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Chưa có bộ quiz nào. <Link href="/quiz-templates" className="text-primary underline">Tạo bộ quiz mới</Link>
              </p>
            ) : (
              templates.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.questionCount} câu
                      {t.skill ? ` · ${SKILL_LABELS[t.skill] ?? t.skill}` : ""}
                      {t.level ? ` · ${t.level}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handlePreview(t.id)}>
                      <Eye className="w-4 h-4 mr-1" />Xem trước
                    </Button>
                    <Button size="sm" onClick={() => handleImportAll(t.id)} disabled={importing}>
                      {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Nhập tất cả"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <span>Đã chọn {selectedIds.length}/{previewQs.length} câu</span>
              <div className="flex gap-2">
                <button className="text-primary text-xs hover:underline" onClick={() => setSelectedIds(previewQs.map(q => q.id))}>Chọn tất cả</button>
                <button className="text-xs hover:underline" onClick={() => setSelectedIds([])}>Bỏ chọn</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {loadingPreview ? (
                <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
              ) : previewQs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Bộ quiz chưa có câu hỏi</div>
              ) : (
                previewQs.map(q => {
                  const checked = selectedIds.includes(q.id);
                  return (
                    <label key={q.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedIds(prev => prev.includes(q.id) ? prev.filter(x => x !== q.id) : [...prev, q.id])}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          <Badge variant="outline" className="text-xs">{TYPE_LABELS[q.type] ?? q.type}</Badge>
                          {q.level && <Badge variant="outline" className="text-xs">{q.level}</Badge>}
                          <span className="text-xs text-muted-foreground">{q.points} điểm</span>
                        </div>
                        <p className="text-sm text-gray-900 line-clamp-2">{q.content}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </>
        )}

        <DialogFooter>
          {previewId && (
            <Button onClick={handleImportSelected} disabled={importing || selectedIds.length === 0}>
              {importing ? "Đang nhập..." : `Nhập ${selectedIds.length} câu hỏi`}
            </Button>
          )}
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
