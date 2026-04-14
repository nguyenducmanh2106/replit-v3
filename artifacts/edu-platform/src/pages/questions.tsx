import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useListQuestions, useDeleteQuestion, getListQuestionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Library, Pencil, Trash2, CheckCircle2, Volume2, Search, Filter,
  Sparkles, BookMarked, Layers, ToggleLeft, AlignLeft, MousePointerClick,
  Shuffle, MoveVertical, BookOpen, Headphones, Video, FileText,
  Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2,
} from "lucide-react";

const SKILLS = ["reading", "writing", "listening", "speaking"] as const;
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const TYPES = [
  "mcq", "true_false", "fill_blank", "word_selection",
  "matching", "drag_drop", "sentence_reorder",
  "reading", "listening", "video_interactive", "essay",
] as const;

const SKILL_LABELS: Record<string, string> = { reading: "Đọc", writing: "Viết", listening: "Nghe", speaking: "Nói" };
const SKILL_ICONS: Record<string, string> = { reading: "📖", writing: "✍️", listening: "🎧", speaking: "🗣️" };
const TYPE_LABELS: Record<string, string> = {
  mcq: "Trắc nghiệm", true_false: "Đúng/Sai", fill_blank: "Điền chỗ trống",
  word_selection: "Chọn từ", matching: "Nối cặp", drag_drop: "Kéo thả",
  sentence_reorder: "Sắp xếp câu", reading: "Đọc hiểu", listening: "Nghe hiểu",
  video_interactive: "Video", essay: "Bài luận",
};
const TYPE_CONFIG: Record<string, { icon: React.ReactNode; gradient: string; border: string; light: string; text: string }> = {
  mcq:             { icon: <Layers className="w-4 h-4" />,             gradient: "from-blue-500 to-blue-600",     border: "border-blue-200",   light: "bg-blue-50",   text: "text-blue-700" },
  true_false:      { icon: <ToggleLeft className="w-4 h-4" />,         gradient: "from-teal-500 to-emerald-600",  border: "border-teal-200",   light: "bg-teal-50",   text: "text-teal-700" },
  fill_blank:      { icon: <AlignLeft className="w-4 h-4" />,          gradient: "from-purple-500 to-violet-600", border: "border-purple-200", light: "bg-purple-50", text: "text-purple-700" },
  word_selection:  { icon: <MousePointerClick className="w-4 h-4" />,  gradient: "from-indigo-500 to-blue-600",  border: "border-indigo-200", light: "bg-indigo-50", text: "text-indigo-700" },
  matching:        { icon: <Shuffle className="w-4 h-4" />,             gradient: "from-pink-500 to-rose-600",    border: "border-pink-200",   light: "bg-pink-50",   text: "text-pink-700" },
  drag_drop:       { icon: <MoveVertical className="w-4 h-4" />,        gradient: "from-orange-500 to-amber-600", border: "border-orange-200", light: "bg-orange-50", text: "text-orange-700" },
  sentence_reorder:{ icon: <MoveVertical className="w-4 h-4" />,        gradient: "from-cyan-500 to-sky-600",     border: "border-cyan-200",   light: "bg-cyan-50",   text: "text-cyan-700" },
  reading:         { icon: <BookOpen className="w-4 h-4" />,            gradient: "from-slate-500 to-gray-600",   border: "border-slate-200",  light: "bg-slate-50",  text: "text-slate-700" },
  listening:       { icon: <Headphones className="w-4 h-4" />,          gradient: "from-green-500 to-emerald-600",border: "border-green-200",  light: "bg-green-50",  text: "text-green-700" },
  video_interactive:{ icon: <Video className="w-4 h-4" />,              gradient: "from-red-500 to-rose-600",     border: "border-red-200",    light: "bg-red-50",    text: "text-red-700" },
  essay:           { icon: <FileText className="w-4 h-4" />,            gradient: "from-amber-500 to-yellow-600", border: "border-amber-200",  light: "bg-amber-50",  text: "text-amber-700" },
};

type ImportResult = {
  totalImported: number;
  totalSkipped: number;
  details: Array<{
    sheet: string;
    type: string;
    imported: number;
    skipped: number;
    errors: string[];
  }>;
};

export default function QuestionsPage() {
  const [, navigate] = useLocation();
  const [skillFilter, setSkillFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = {
    ...(skillFilter !== "all" ? { skill: skillFilter } : {}),
    ...(levelFilter !== "all" ? { level: levelFilter } : {}),
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
  };

  const { data: allQuestions, isLoading } = useListQuestions(params);
  const { mutate: deleteQuestion, isPending: deleting } = useDeleteQuestion();

  const questions = allQuestions?.filter(q =>
    !search || q.content.toLowerCase().includes(search.toLowerCase())
  );

  const typeCounts = (allQuestions ?? []).reduce<Record<string, number>>((acc, q) => {
    acc[q.type] = (acc[q.type] ?? 0) + 1;
    return acc;
  }, {});
  const totalCount = allQuestions?.length ?? 0;

  function handleDelete() {
    if (!deleteId) return;
    deleteQuestion({ id: deleteId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey() }); setDeleteId(null); }
    });
  }

  async function handleDownloadTemplate() {
    try {
      const res = await fetch("/api/questions/import-template", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "question_import_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Lỗi tải file mẫu", variant: "destructive" });
    }
  }

  async function handleImport() {
    if (!selectedFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/questions/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }));
        throw new Error(err.error);
      }
      const result: ImportResult = await res.json();
      setImportResult(result);
      if (result.totalImported > 0) {
        queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey() });
      }
    } catch (e: any) {
      toast({ title: e.message || "Lỗi import", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  function closeImportDialog() {
    setImportOpen(false);
    setSelectedFile(null);
    setImportResult(null);
  }

  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#378ADD] to-[#1D5FAF] p-6 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-2 right-10 w-40 h-40 rounded-full bg-white/30 blur-2xl" />
          <div className="absolute bottom-0 left-20 w-32 h-32 rounded-full bg-white/20 blur-2xl" />
        </div>
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookMarked className="w-5 h-5 text-blue-200" />
              <span className="text-blue-200 text-sm font-medium">Quản lý câu hỏi</span>
            </div>
            <h1 className="text-2xl font-bold">Ngân hàng câu hỏi</h1>
            <p className="text-blue-200 text-sm mt-1">Tạo và tái sử dụng câu hỏi cho tất cả bài thi</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <Button onClick={() => setImportOpen(true)} variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 font-semibold">
                <Upload className="w-4 h-4 mr-1.5" />
                Import Excel
              </Button>
              <Button onClick={() => navigate("/questions/new")} className="bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-lg">
                <Plus className="w-4 h-4 mr-1.5" />
                Tạo câu hỏi mới
              </Button>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold">{totalCount}</span>
              <span className="text-blue-200 text-sm ml-1">câu hỏi</span>
            </div>
          </div>
        </div>
        {totalCount > 0 && (
          <div className="relative mt-4">
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
              {TYPES.filter(t => typeCounts[t] > 0).map(t => {
                const cfg = TYPE_CONFIG[t];
                return (
                  <div key={t} className={`bg-gradient-to-r ${cfg.gradient} opacity-80 transition-all`}
                    style={{ width: `${(typeCounts[t] / totalCount) * 100}%` }}
                    title={`${TYPE_LABELS[t]}: ${typeCounts[t]}`} />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {TYPES.filter(t => typeCounts[t] > 0).map(t => (
                <span key={t} className="text-xs text-blue-100">
                  {TYPE_LABELS[t]}: <strong className="text-white">{typeCounts[t]}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Tìm kiếm câu hỏi..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Filter className="w-4 h-4 text-gray-400" />
        <Select value={skillFilter} onValueChange={setSkillFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Kỹ năng" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả kỹ năng</SelectItem>
            {SKILLS.map(s => <SelectItem key={s} value={s}>{SKILL_ICONS[s]} {SKILL_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Cấp độ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả cấp</SelectItem>
            {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Loại câu hỏi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại</SelectItem>
            {TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : questions && questions.length > 0 ? (
        <div className="space-y-3">
          {questions.map((q) => {
            const cfg = TYPE_CONFIG[q.type] ?? TYPE_CONFIG.essay;
            const options: string[] = q.options ? (() => {
              try {
                const p = JSON.parse(q.options!);
                return Array.isArray(p) ? p.filter((x: unknown) => typeof x === "string") : [];
              } catch { return []; }
            })() : [];
            const isCorrectable = ["mcq", "true_false", "word_selection"].includes(q.type);
            return (
              <Card key={q.id} className={`group hover:shadow-md transition-all border-2 ${cfg.border} hover:scale-[1.005]`}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.gradient} text-white flex items-center justify-center shadow-sm`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.light} ${cfg.text}`}>{TYPE_LABELS[q.type] ?? q.type}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{SKILL_ICONS[q.skill]} {SKILL_LABELS[q.skill] ?? q.skill}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 font-medium">{q.level}</span>
                        <span className="ml-auto text-xs font-bold text-gray-400">{q.points} điểm</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 leading-relaxed line-clamp-2">{q.content}</p>
                      {options.length > 0 && isCorrectable && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {options.slice(0, 4).map((opt: string, i: number) => (
                            <span key={i} className={`text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1 ${opt === q.correctAnswer ? "bg-green-100 text-green-700 border border-green-200" : "bg-gray-50 text-gray-500 border border-gray-100"}`}>
                              <span className="w-4 h-4 rounded flex items-center justify-center text-xs font-bold"
                                style={{ background: opt === q.correctAnswer ? "#1D9E75" : "#e5e7eb", color: opt === q.correctAnswer ? "white" : "#6b7280" }}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              {opt}
                              {opt === q.correctAnswer && <CheckCircle2 className="w-3 h-3" />}
                            </span>
                          ))}
                        </div>
                      )}
                      {q.audioUrl && (
                        <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                          <Volume2 className="w-3 h-3" /> {q.audioUrl}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => navigate(`/questions/${q.id}/edit`)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-500"
                        onClick={() => setDeleteId(q.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <Library className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="font-bold text-gray-600 text-lg">
            {search ? "Không tìm thấy câu hỏi nào" : "Chưa có câu hỏi nào"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Thử tìm với từ khóa khác" : "Nhấn \"Tạo câu hỏi mới\" hoặc \"Import Excel\" để bắt đầu"}
          </p>
          {!search && (
            <div className="flex justify-center gap-3 mt-4">
              <Button onClick={() => navigate("/questions/new")}>
                <Sparkles className="w-4 h-4 mr-2" />
                Tạo câu hỏi đầu tiên
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import từ Excel
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Xác nhận xoá câu hỏi
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Bạn có chắc muốn xoá câu hỏi này? Thao tác này không thể hoàn tác.</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Đang xoá..." : "Xoá câu hỏi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(v) => { if (!v) closeImportDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              Import câu hỏi từ Excel
            </DialogTitle>
            <DialogDescription>
              Tải lên file Excel (.xlsx) với mỗi sheet tương ứng một dạng câu hỏi
            </DialogDescription>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">Hướng dẫn</h4>
                <ul className="text-xs text-blue-700 space-y-1.5">
                  <li>Mỗi <strong>sheet</strong> tương ứng 1 dạng câu hỏi: MCQ, TRUE_FALSE, FILL_BLANK, MATCHING, SENTENCE_REORDER, ESSAY, WORD_SELECTION, DRAG_DROP, READING, LISTENING</li>
                  <li>Các cột chung: <code className="bg-blue-100 px-1 rounded">content</code>, <code className="bg-blue-100 px-1 rounded">skill</code>, <code className="bg-blue-100 px-1 rounded">level</code>, <code className="bg-blue-100 px-1 rounded">points</code>, <code className="bg-blue-100 px-1 rounded">explanation</code></li>
                  <li>Tải file mẫu để biết chính xác cấu trúc từng dạng</li>
                </ul>
                <Button size="sm" variant="outline" className="mt-3 text-blue-700 border-blue-300 hover:bg-blue-100" onClick={handleDownloadTemplate}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Tải file mẫu (.xlsx)
                </Button>
              </div>

              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${selectedFile ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files[0];
                  if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
                    setSelectedFile(file);
                  } else {
                    toast({ title: "Chỉ hỗ trợ file .xlsx", variant: "destructive" });
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                    <p className="text-sm font-semibold text-green-700">{selectedFile.name}</p>
                    <p className="text-xs text-green-600">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    <Button size="sm" variant="ghost" className="text-xs text-gray-500" onClick={e => { e.stopPropagation(); setSelectedFile(null); }}>
                      Chọn file khác
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-10 h-10 text-gray-300" />
                    <p className="text-sm font-medium text-gray-600">Kéo thả hoặc nhấn để chọn file Excel</p>
                    <p className="text-xs text-gray-400">Hỗ trợ .xlsx, .xls (tối đa 10MB)</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeImportDialog}>Hủy</Button>
                <Button onClick={handleImport} disabled={!selectedFile || importing}>
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Đang import...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-1.5" />
                      Import câu hỏi
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 ${importResult.totalImported > 0 ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                <div className="flex items-center gap-3 mb-2">
                  {importResult.totalImported > 0 ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      {importResult.totalImported > 0
                        ? `Import thành công ${importResult.totalImported} câu hỏi`
                        : "Không có câu hỏi nào được import"}
                    </p>
                    {importResult.totalSkipped > 0 && (
                      <p className="text-xs text-gray-500">{importResult.totalSkipped} dòng bị bỏ qua</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {importResult.details.map((d, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{d.sheet}</Badge>
                        {d.type !== "unknown" && (
                          <span className="text-xs text-gray-500">{TYPE_LABELS[d.type] ?? d.type}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {d.imported > 0 && (
                          <span className="text-green-600 font-medium">{d.imported} OK</span>
                        )}
                        {d.skipped > 0 && (
                          <span className="text-amber-600 font-medium">{d.skipped} lỗi</span>
                        )}
                      </div>
                    </div>
                    {d.errors.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {d.errors.map((err, ei) => (
                          <p key={ei} className="text-xs text-red-500 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            {err}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={closeImportDialog}>Đóng</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
