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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Send, Copy, Link as LinkIcon, Plus, Trash2, ChevronUp, ChevronDown, Settings, ListOrdered, BookOpen,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const QUESTION_TYPES = [
  { value: "mcq", label: "Trắc nghiệm 1 đáp án" },
  { value: "true_false", label: "Đúng / Sai" },
  { value: "short_answer", label: "Tự luận ngắn" },
  { value: "long_answer", label: "Tự luận dài" },
  { value: "fill_blank", label: "Điền vào chỗ trống" },
];

type AddQForm = {
  type: string;
  content: string;
  points: number;
  options: string[];
  correctIdx: number;
  correctTF: "true" | "false";
  correctText: string;
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

  const [qOpen, setQOpen] = useState(false);
  const [qForm, setQForm] = useState<AddQForm>({
    type: "mcq", content: "", points: 1,
    options: ["", "", "", ""], correctIdx: 0,
    correctTF: "true", correctText: "",
  });
  const [qSaving, setQSaving] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

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

  function resetQForm() {
    setQForm({ type: "mcq", content: "", points: 1, options: ["", "", "", ""], correctIdx: 0, correctTF: "true", correctText: "" });
  }

  async function handleAddQuestion() {
    if (!qForm.content.trim()) { toast({ title: "Nhập nội dung câu hỏi", variant: "destructive" }); return; }

    let options: unknown = null;
    let correctAnswer: string | null = null;

    if (qForm.type === "mcq") {
      const cleanOpts = qForm.options.map(o => o.trim()).filter(o => o !== "");
      if (cleanOpts.length < 2) { toast({ title: "Cần ít nhất 2 đáp án", variant: "destructive" }); return; }
      if (qForm.correctIdx < 0 || qForm.correctIdx >= cleanOpts.length) { toast({ title: "Chọn đáp án đúng", variant: "destructive" }); return; }
      options = cleanOpts;
      correctAnswer = cleanOpts[qForm.correctIdx];
    } else if (qForm.type === "true_false") {
      options = ["Đúng", "Sai"];
      correctAnswer = qForm.correctTF === "true" ? "Đúng" : "Sai";
    } else if (qForm.type === "short_answer" || qForm.type === "fill_blank") {
      correctAnswer = qForm.correctText.trim();
      if (!correctAnswer) { toast({ title: "Nhập đáp án đúng", variant: "destructive" }); return; }
    } // long_answer: no correctAnswer

    setQSaving(true);
    try {
      await placementApi.addQuestion(testId, {
        type: qForm.type, content: qForm.content.trim(),
        options, correctAnswer, points: qForm.points || 1,
        sourceType: "custom",
      });
      toast({ title: "Đã thêm câu hỏi" });
      setQOpen(false); resetQForm();
      load();
    } catch (e: any) {
      toast({ title: "Không thêm được", description: e.message, variant: "destructive" });
    } finally { setQSaving(false); }
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
            <Button onClick={() => setQOpen(true)}><Plus className="w-4 h-4 mr-1" /> Thêm câu hỏi mới</Button>
          </div>
          {test.questions.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Chưa có câu hỏi. Thêm câu đầu tiên để bắt đầu.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {test.questions.map((q, idx) => (
                <Card key={q.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-0.5">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={idx === 0} onClick={() => handleMove(idx, -1)}><ChevronUp className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={idx === test.questions.length - 1} onClick={() => handleMove(idx, 1)}><ChevronDown className="w-3.5 h-3.5" /></Button>
                      </div>
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold">{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="text-xs">{QUESTION_TYPES.find(t => t.value === q.type)?.label ?? q.type}</Badge>
                          <Badge variant="secondary" className="text-xs">{q.points} điểm</Badge>
                          {q.sourceType === "bank" && <Badge variant="outline" className="text-xs">Từ ngân hàng</Badge>}
                        </div>
                        <p className="text-sm font-medium line-clamp-2">{q.content}</p>
                        {Array.isArray(q.options) && q.options.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(q.options as string[]).slice(0, 4).map((o, i) => (
                              <span key={i} className={`text-xs px-2 py-0.5 rounded ${o === q.correctAnswer ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{o}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDeleteQ(q.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </CardContent>
                </Card>
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

      {/* Add Question dialog */}
      <Dialog open={qOpen} onOpenChange={(o) => { setQOpen(o); if (!o) resetQForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Thêm câu hỏi mới</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Loại câu hỏi</Label>
                <Select value={qForm.type} onValueChange={v => setQForm({ ...qForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Điểm</Label><Input type="number" min={1} value={qForm.points} onChange={e => setQForm({ ...qForm, points: Number(e.target.value) || 1 })} /></div>
            </div>
            <div><Label>Nội dung câu hỏi *</Label><Textarea value={qForm.content} onChange={e => setQForm({ ...qForm, content: e.target.value })} rows={3} /></div>
            {qForm.type === "mcq" && (
              <div>
                <Label>Đáp án (tick vào đáp án đúng)</Label>
                <div className="space-y-2 mt-1">
                  {qForm.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="radio" name="correct" checked={qForm.correctIdx === i} onChange={() => setQForm({ ...qForm, correctIdx: i })} />
                      <Input value={o} onChange={e => { const a = [...qForm.options]; a[i] = e.target.value; setQForm({ ...qForm, options: a }); }} placeholder={`Đáp án ${i + 1}`} />
                      {qForm.options.length > 2 && <Button size="sm" variant="ghost" onClick={() => setQForm({ ...qForm, options: qForm.options.filter((_, j) => j !== i), correctIdx: Math.min(qForm.correctIdx, qForm.options.length - 2) })}><Trash2 className="w-3.5 h-3.5" /></Button>}
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setQForm({ ...qForm, options: [...qForm.options, ""] })}><Plus className="w-3.5 h-3.5 mr-1" /> Thêm đáp án</Button>
                </div>
              </div>
            )}
            {qForm.type === "true_false" && (
              <div>
                <Label>Đáp án đúng</Label>
                <Select value={qForm.correctTF} onValueChange={v => setQForm({ ...qForm, correctTF: v as "true" | "false" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="true">Đúng</SelectItem><SelectItem value="false">Sai</SelectItem></SelectContent>
                </Select>
              </div>
            )}
            {(qForm.type === "short_answer" || qForm.type === "fill_blank") && (
              <div><Label>Đáp án đúng (so sánh không phân biệt hoa-thường)</Label><Input value={qForm.correctText} onChange={e => setQForm({ ...qForm, correctText: e.target.value })} /></div>
            )}
            {qForm.type === "long_answer" && (
              <p className="text-sm text-muted-foreground bg-yellow-50 border border-yellow-200 rounded p-3">Câu tự luận dài sẽ được giáo viên chấm thủ công sau khi học sinh nộp.</p>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setQOpen(false)}>Huỷ</Button><Button onClick={handleAddQuestion} disabled={qSaving}>{qSaving ? "Đang thêm..." : "Thêm câu hỏi"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank import dialog */}
      <BankImportDialog open={bankOpen} onOpenChange={setBankOpen} testId={testId} onImported={load} />
    </div>
  );
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
                    <Badge variant="outline" className="text-xs">{q.type}</Badge>
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
