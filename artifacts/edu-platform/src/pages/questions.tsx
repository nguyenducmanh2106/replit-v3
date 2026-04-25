import { useState, useRef } from "react";
import { useLocation } from "@/lib/routing";
import { useListQuestions, useDeleteQuestion, getListQuestionsQueryKey } from "@workspace/api-client-react";
import type { ListQuestions200, ListQuestions200Meta } from "@workspace/api-client-react";
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
  Plus, Library, Pencil, Trash2, CheckCircle2, Volume2, Search,
  Sparkles, BookMarked, Layers, ToggleLeft, AlignLeft, MousePointerClick,
  Shuffle, MoveVertical, BookOpen, Headphones, Video, FileText,
  Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2,
  MessageSquare, X, ChevronDown, SlidersHorizontal, ChevronLeft, ChevronRight,
  LayoutGrid, List,
} from "lucide-react";

const DEFAULT_PAGE_SIZE = 10;

const SKILLS = ["reading", "writing", "listening", "speaking"] as const;
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const TYPES = [
  "mcq", "true_false", "fill_blank", "word_selection",
  "matching", "drag_drop", "sentence_reorder",
  "reading", "listening", "video_interactive", "essay", "open_end",
] as const;

const SKILL_LABELS: Record<string, string> = { reading: "Đọc", writing: "Viết", listening: "Nghe", speaking: "Nói" };
const TYPE_LABELS: Record<string, string> = {
  mcq: "Trắc nghiệm", true_false: "Đúng/Sai", fill_blank: "Điền chỗ trống",
  word_selection: "Chọn từ", matching: "Nối cặp", drag_drop: "Kéo thả",
  sentence_reorder: "Sắp xếp câu", reading: "Đọc hiểu", listening: "Nghe hiểu",
  video_interactive: "Video", essay: "Bài luận", open_end: "Câu hỏi mở",
};
const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string; text: string; border: string; badge: string }> = {
  mcq:             { icon: <Layers className="w-3.5 h-3.5" />,           bg: "bg-sky-100",          text: "text-sky-700",          border: "border-sky-200",      badge: "bg-sky-50 text-sky-700 border-sky-200" },
  true_false:      { icon: <ToggleLeft className="w-3.5 h-3.5" />,       bg: "bg-teal-100",         text: "text-teal-700",         border: "border-teal-200",      badge: "bg-teal-50 text-teal-700 border-teal-200" },
  fill_blank:      { icon: <AlignLeft className="w-3.5 h-3.5" />,        bg: "bg-violet-100",       text: "text-violet-700",       border: "border-violet-200",    badge: "bg-violet-50 text-violet-700 border-violet-200" },
  word_selection:  { icon: <MousePointerClick className="w-3.5 h-3.5" />, bg: "bg-indigo-100",     text: "text-indigo-700",       border: "border-indigo-200",    badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  matching:        { icon: <Shuffle className="w-3.5 h-3.5" />,            bg: "bg-pink-100",         text: "text-pink-700",         border: "border-pink-200",      badge: "bg-pink-50 text-pink-700 border-pink-200" },
  drag_drop:       { icon: <MoveVertical className="w-3.5 h-3.5" />,       bg: "bg-orange-100",       text: "text-orange-700",        border: "border-orange-200",    badge: "bg-orange-50 text-orange-700 border-orange-200" },
  sentence_reorder:{ icon: <MoveVertical className="w-3.5 h-3.5" />,       bg: "bg-cyan-100",        text: "text-cyan-700",         border: "border-cyan-200",      badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  reading:         { icon: <BookOpen className="w-3.5 h-3.5" />,           bg: "bg-slate-100",       text: "text-slate-700",        border: "border-slate-200",     badge: "bg-slate-50 text-slate-700 border-slate-200" },
  listening:       { icon: <Headphones className="w-3.5 h-3.5" />,         bg: "bg-green-100",       text: "text-green-700",        border: "border-green-200",     badge: "bg-green-50 text-green-700 border-green-200" },
  video_interactive:{ icon: <Video className="w-3.5 h-3.5" />,             bg: "bg-red-100",         text: "text-red-700",          border: "border-red-200",       badge: "bg-red-50 text-red-700 border-red-200" },
  essay:           { icon: <FileText className="w-3.5 h-3.5" />,            bg: "bg-amber-100",       text: "text-amber-700",        border: "border-amber-200",     badge: "bg-amber-50 text-amber-700 border-amber-200" },
  open_end:        { icon: <MessageSquare className="w-3.5 h-3.5" />,      bg: "bg-fuchsia-100",     text: "text-fuchsia-700",      border: "border-fuchsia-200",   badge: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
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

type ViewMode = "cards" | "table";

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Build API params for pagination
  const apiParams = {
    ...(skillFilter !== "all" ? { skill: skillFilter } : {}),
    ...(levelFilter !== "all" ? { level: levelFilter } : {}),
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    page: currentPage,
    limit: DEFAULT_PAGE_SIZE,
  };

  // Fetch paginated questions from API
  const { data: apiResponse, isLoading } = useListQuestions(apiParams);

  // Extract questions and pagination metadata
  const questions: any[] = apiResponse?.data ?? [];
  const paginationMeta: ListQuestions200Meta = apiResponse?.meta ?? { total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 1 };
  const totalCount = paginationMeta.total ?? 0;
  const totalPages = paginationMeta.totalPages ?? 1;
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

  // Filter questions client-side by search
  const filteredQuestions = questions.filter((q: any) =>
    !search || q.content.toLowerCase().includes(search.toLowerCase())
  );

  // For stats, we need to fetch all questions (without pagination)
  const { data: allQuestionsResponse } = useListQuestions({
    ...(skillFilter !== "all" ? { skill: skillFilter } : {}),
    ...(levelFilter !== "all" ? { level: levelFilter } : {}),
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    page: 1,
    limit: 10000,
  });

  const typeCounts: Record<string, number> = {};
  (allQuestionsResponse?.data ?? []).forEach((q: any) => {
    typeCounts[q.type] = (typeCounts[q.type] ?? 0) + 1;
  });

  const { mutate: deleteQuestion, isPending: deleting } = useDeleteQuestion();

  const activeFiltersCount = [
    skillFilter !== "all",
    levelFilter !== "all",
    typeFilter !== "all",
  ].filter(Boolean).length;

  function clearAllFilters() {
    setSkillFilter("all");
    setLevelFilter("all");
    setTypeFilter("all");
    setCurrentPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setCurrentPage(1);
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteQuestion({ id: deleteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey() });
        setDeleteId(null);
      }
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

  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/questions/export", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "questions_export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Đã xuất file Excel thành công" });
    } catch {
      toast({ title: "Lỗi xuất file Excel", variant: "destructive" });
    } finally {
      setExporting(false);
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

  function renderPagination() {
    if (totalPages <= 1) return null;

    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) {
        pages.push(i);
      }
      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-white rounded-b-xl">
        <p className="text-sm text-stone-500">
          Hiển thị <span className="font-medium text-stone-700">{(safePage - 1) * DEFAULT_PAGE_SIZE + 1}</span>
          {" - "}
          <span className="font-medium text-stone-700">{Math.min(safePage * DEFAULT_PAGE_SIZE, totalCount)}</span>
          {" trong "}
          <span className="font-medium text-stone-700">{totalCount}</span> câu hỏi
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(safePage - 1)}
            disabled={safePage === 1}
            className="h-8 w-8 p-0 border-stone-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {pages.map((page, idx) =>
            page === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-stone-400">...</span>
            ) : (
              <Button
                key={page}
                variant={page === safePage ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(page as number)}
                className={`h-8 w-8 p-0 ${page === safePage ? "bg-[#3A5A40] hover:bg-[#344E41]" : "border-stone-200"}`}
              >
                {page}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(safePage + 1)}
            disabled={safePage === totalPages}
            className="h-8 w-8 p-0 border-stone-200"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  function renderCardView(questionsToRender: any[]) {
    return (
      <div className="space-y-2.5">
        {questionsToRender.map((q: any) => {
          const cfg = TYPE_CONFIG[q.type] ?? TYPE_CONFIG.essay;
          const options: string[] = q.options ? (() => {
            try {
              const p = JSON.parse(q.options!);
              return Array.isArray(p) ? p.filter((x: unknown) => typeof x === "string") : [];
            } catch { return []; }
          })() : [];
          const isCorrectable = ["mcq", "true_false", "word_selection"].includes(q.type);

          return (
            <Card
              key={q.id}
              className="group border border-stone-100 hover:border-stone-200 hover:shadow-sm transition-all bg-white"
            >
              <CardContent className="py-3.5 px-4">
                <div className="flex items-start gap-3.5">
                  <div className={`shrink-0 w-9 h-9 rounded-lg ${cfg.bg} ${cfg.text} flex items-center justify-center shadow-sm`}>
                    {cfg.icon}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                        {TYPE_LABELS[q.type] ?? q.type}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                        {SKILL_LABELS[q.skill] ?? q.skill}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 font-medium">
                        {q.level}
                      </span>
                      <span className="ml-auto text-[11px] font-semibold text-stone-400">
                        {q.points} điểm
                      </span>
                    </div>

                    <p className="text-sm font-medium text-stone-800 leading-relaxed line-clamp-2 pr-16 group-hover:pr-0">
                      {q.content}
                    </p>

                    {options.length > 0 && isCorrectable && (
                      <div className="flex flex-wrap gap-1.5">
                        {options.slice(0, 4).map((opt: string, i: number) => {
                          const isCorrect = opt === q.correctAnswer;
                          return (
                            <span
                              key={i}
                              className={`text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1.5 ${
                                isCorrect
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-stone-50 text-stone-500 border border-stone-100"
                              }`}
                            >
                              <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                                isCorrect ? "bg-emerald-500 text-white" : "bg-stone-200 text-stone-500"
                              }`}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className="max-w-[120px] truncate">{opt}</span>
                              {isCorrect && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {q.audioUrl && (
                      <p className="text-xs text-[#4A6C52] flex items-center gap-1 font-medium">
                        <Volume2 className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">{q.audioUrl}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-[#3A5A40]/10 hover:text-[#3A5A40]"
                      onClick={() => navigate(`/questions/${q.id}/edit`)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-500"
                      onClick={() => setDeleteId(q.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  function renderTableView(questionsToRender: any[]) {
    return (
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wide">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wide">Loại</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wide">Câu hỏi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wide">Kỹ năng</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wide">Cấp độ</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase tracking-wide">Điểm</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase tracking-wide">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {questionsToRender.map((q: any, idx: number) => {
                const cfg = TYPE_CONFIG[q.type] ?? TYPE_CONFIG.essay;
                return (
                  <tr key={q.id} className="hover:bg-stone-50/50 transition-colors group">
                    <td className="px-4 py-3 text-sm text-stone-400 font-medium">
                      {(safePage - 1) * DEFAULT_PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border ${cfg.badge}`}>
                        {cfg.icon}
                        {TYPE_LABELS[q.type] ?? q.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <p className="text-sm text-stone-800 line-clamp-2">{q.content}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-600">
                        {SKILL_LABELS[q.skill] ?? q.skill}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-600 font-medium">
                        {q.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-stone-600">{q.points}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:bg-[#3A5A40]/10 hover:text-[#3A5A40]"
                          onClick={() => navigate(`/questions/${q.id}/edit`)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-500"
                          onClick={() => setDeleteId(q.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {renderPagination()}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-[#344E41] via-[#3A5A40] to-[#4A6C52] p-6 text-white shadow-lg">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/6 blur-2xl" />
        <div className="absolute -left-4 -bottom-4 w-32 h-32 rounded-full bg-white/4 blur-2xl" />
        <div className="absolute right-1/4 bottom-0 w-24 h-24 rounded-full bg-white/3 blur-xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-sm">
                  <BookMarked className="w-4 h-4 text-emerald-200" />
                </div>
                <span className="text-emerald-200/80 text-xs font-medium tracking-wide uppercase">Quản lý câu hỏi</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Ngân hàng câu hỏi</h1>
              <p className="text-emerald-100/70 text-sm">Tạo và tái sử dụng câu hỏi cho tất cả bài thi</p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  variant="ghost"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {exporting ? "Đang xuất..." : "Export"}
                </Button>
                <Button
                  onClick={() => setImportOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Import
                </Button>
                <Button
                  onClick={() => navigate("/questions/new")}
                  size="sm"
                  className="bg-white text-[#344E41] hover:bg-emerald-50 font-semibold shadow-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Tạo câu hỏi
                </Button>
              </div>

              <div className="text-right">
                <span className="text-3xl font-bold tabular-nums">{totalCount}</span>
                <span className="text-emerald-200/70 text-sm ml-1.5">câu hỏi</span>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          {totalCount > 0 && (
            <div className="mt-5 space-y-2.5">
              <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5 bg-white/10">
                {TYPES.filter(t => typeCounts[t] > 0).map(t => {
                  const cfg = TYPE_CONFIG[t];
                  return (
                    <div
                      key={t}
                      className={`${cfg.bg} transition-all duration-300`}
                      style={{ width: `${(typeCounts[t] / totalCount) * 100}%` }}
                      title={`${TYPE_LABELS[t]}: ${typeCounts[t]}`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {TYPES.filter(t => typeCounts[t] > 0).map(t => (
                  <span key={t} className="text-xs text-emerald-100/60">
                    <span className="text-white font-medium">{typeCounts[t]}</span> {TYPE_LABELS[t]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Tìm kiếm câu hỏi..."
            className="pl-9 pr-9 bg-white border-stone-200 focus:border-[#4A6C52] focus:ring-[#4A6C52]/20"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
          />
          {search && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`gap-1.5 border-stone-200 ${filtersOpen || activeFiltersCount > 0 ? "bg-[#3A5A40]/5 border-[#4A6C52] text-[#3A5A40]" : "text-stone-500"}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Bộ lọc
          {activeFiltersCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#4A6C52] text-white text-[10px] font-bold">
              {activeFiltersCount}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </Button>

        {/* View Mode Toggle */}
        <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("cards")}
            className={`p-2 transition-colors ${viewMode === "cards" ? "bg-[#3A5A40] text-white" : "bg-white text-stone-500 hover:bg-stone-50"}`}
            title="Xem dạng cards"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 transition-colors ${viewMode === "table" ? "bg-[#3A5A40] text-white" : "bg-white text-stone-500 hover:bg-stone-50"}`}
            title="Xem dạng bảng"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {filtersOpen && (
          <div className="w-full flex flex-wrap items-center gap-2 p-3 bg-white rounded-xl border border-stone-200 shadow-sm">
            <Select value={skillFilter} onValueChange={(v) => { setSkillFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-36 h-8 text-xs border-stone-200">
                <SelectValue placeholder="Kỹ năng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả kỹ năng</SelectItem>
                {SKILLS.map(s => <SelectItem key={s} value={s}>{SKILL_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-28 h-8 text-xs border-stone-200">
                <SelectValue placeholder="Cấp độ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả cấp</SelectItem>
                {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-40 h-8 text-xs border-stone-200">
                <SelectValue placeholder="Loại câu hỏi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                {TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>

            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="ml-auto h-8 text-xs text-stone-500 hover:text-red-600"
              >
                <X className="w-3 h-3 mr-1" />
                Xóa lọc
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Question List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filteredQuestions.length > 0 ? (
        viewMode === "table" ? renderTableView(filteredQuestions) : (
          <>
            {renderCardView(filteredQuestions)}
            {totalPages > 1 && (
              <div className="flex items-center justify-center">
                {renderPagination()}
              </div>
            )}
          </>
        )
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-6 bg-white rounded-2xl border border-stone-100">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-stone-100 flex items-center justify-center">
            <Library className="w-8 h-8 text-stone-300" />
          </div>
          <h3 className="font-semibold text-stone-600 text-lg mb-1">
            {search ? "Không tìm thấy câu hỏi nào" : "Chưa có câu hỏi nào"}
          </h3>
          <p className="text-sm text-stone-400 mb-5">
            {search ? "Thử tìm với từ khóa khác" : "Nhấn \"Tạo câu hỏi\" hoặc \"Import\" để bắt đầu"}
          </p>
          {!search && (
            <div className="flex justify-center gap-3">
              <Button onClick={() => navigate("/questions/new")} className="bg-[#3A5A40] hover:bg-[#344E41]">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Tạo câu hỏi đầu tiên
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)} className="border-stone-300">
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Import từ Excel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
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

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(v) => { if (!v) closeImportDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#3A5A40]">
              <FileSpreadsheet className="w-5 h-5" />
              Import câu hỏi từ Excel
            </DialogTitle>
            <DialogDescription>
              Tải lên file Excel (.xlsx) với mỗi sheet tương ứng một dạng câu hỏi
            </DialogDescription>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4">
              <div className="bg-[#3A5A40]/5 border border-[#4A6C52]/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-[#3A5A40] mb-2">Hướng dẫn</h4>
                <ul className="text-xs text-stone-600 space-y-1.5">
                  <li>Mỗi <strong>sheet</strong> tương ứng 1 dạng câu hỏi: MCQ, TRUE_FALSE, FILL_BLANK, MATCHING, SENTENCE_REORDER, ESSAY, OPEN_END, WORD_SELECTION, DRAG_DROP, READING, LISTENING</li>
                  <li>Các cột chung: <code className="bg-white/80 px-1 rounded">content</code>, <code className="bg-white/80 px-1 rounded">skill</code>, <code className="bg-white/80 px-1 rounded">level</code>, <code className="bg-white/80 px-1 rounded">points</code>, <code className="bg-white/80 px-1 rounded">explanation</code></li>
                  <li>Tải file mẫu để biết chính xác cấu trúc từng dạng</li>
                </ul>
                <Button size="sm" variant="outline" className="mt-3 text-[#3A5A40] border-[#4A6C52]/30 hover:bg-[#3A5A40]/10" onClick={handleDownloadTemplate}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Tải file mẫu (.xlsx)
                </Button>
              </div>

              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  selectedFile
                    ? "border-emerald-300 bg-emerald-50/50"
                    : "border-stone-300 hover:border-[#4A6C52] hover:bg-[#3A5A40]/5"
                }`}
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
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-700">{selectedFile.name}</p>
                    <p className="text-xs text-emerald-600">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-stone-500"
                      onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                    >
                      Chọn file khác
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-10 h-10 text-stone-300" />
                    <p className="text-sm font-medium text-stone-600">Kéo thả hoặc nhấn để chọn file Excel</p>
                    <p className="text-xs text-stone-400">Hỗ trợ .xlsx, .xls (tối đa 10MB)</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeImportDialog} className="border-stone-300">Hủy</Button>
                <Button onClick={handleImport} disabled={!selectedFile || importing} className="bg-[#3A5A40] hover:bg-[#344E41]">
                  {importing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Đang import...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Import câu hỏi
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 ${importResult.totalImported > 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                <div className="flex items-center gap-3 mb-2">
                  {importResult.totalImported > 0 ? (
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  )}
                  <div>
                    <p className="font-semibold text-stone-900">
                      {importResult.totalImported > 0
                        ? `Import thành công ${importResult.totalImported} câu hỏi`
                        : "Không có câu hỏi nào được import"}
                    </p>
                    {importResult.totalSkipped > 0 && (
                      <p className="text-xs text-stone-500">{importResult.totalSkipped} dòng bị bỏ qua</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {importResult.details.map((d, i) => (
                  <div key={i} className="border border-stone-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{d.sheet}</Badge>
                        {d.type !== "unknown" && (
                          <span className="text-xs text-stone-500">{TYPE_LABELS[d.type] ?? d.type}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {d.imported > 0 && (
                          <span className="text-emerald-600 font-medium">{d.imported} OK</span>
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
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            {err}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={closeImportDialog} className="bg-[#3A5A40] hover:bg-[#344E41]">Đóng</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
