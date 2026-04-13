import { useState } from "react";
import { useLocation } from "wouter";
import { useListQuestions, useDeleteQuestion, getListQuestionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Library, Pencil, Trash2, CheckCircle2, Volume2, Search, Filter,
  Sparkles, BookMarked, Layers, ToggleLeft, AlignLeft, MousePointerClick,
  Shuffle, MoveVertical, BookOpen, Headphones, Video, FileText,
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

export default function QuestionsPage() {
  const [, navigate] = useLocation();
  const [skillFilter, setSkillFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const queryClient = useQueryClient();

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

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <Button onClick={() => navigate("/questions/new")} className="bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-lg">
              <Plus className="w-4 h-4 mr-1.5" />
              Tạo câu hỏi mới
            </Button>
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

      {/* Filters */}
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

      {/* Question List */}
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
            {search ? "Thử tìm với từ khóa khác" : "Nhấn \"Tạo câu hỏi mới\" để bắt đầu"}
          </p>
          {!search && (
            <Button className="mt-4" onClick={() => navigate("/questions/new")}>
              <Sparkles className="w-4 h-4 mr-2" />
              Tạo câu hỏi đầu tiên
            </Button>
          )}
        </div>
      )}

      {/* Delete Confirm Dialog */}
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
    </div>
  );
}
