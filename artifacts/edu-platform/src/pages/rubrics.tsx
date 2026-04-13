import { useState } from "react";
import { useListRubrics, useCreateRubric, useDeleteRubric } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronDown, ChevronUp, Target } from "lucide-react";

const SKILL_OPTIONS = [
  { value: "writing", label: "Viết" },
  { value: "speaking", label: "Nói" },
  { value: "reading", label: "Đọc hiểu" },
  { value: "listening", label: "Nghe hiểu" },
];

const SKILL_LABELS: Record<string, string> = {
  writing: "Viết",
  speaking: "Nói",
  reading: "Đọc hiểu",
  listening: "Nghe hiểu",
};

const SKILL_COLORS: Record<string, string> = {
  writing: "bg-blue-100 text-blue-700",
  speaking: "bg-green-100 text-green-700",
  reading: "bg-purple-100 text-purple-700",
  listening: "bg-amber-100 text-amber-700",
};

interface CriterionInput {
  name: string;
  description: string;
  maxPoints: number;
}

export default function RubricsPage() {
  const { data: rubrics, isLoading } = useListRubrics();
  const { mutateAsync: createRubric } = useCreateRubric();
  const { mutateAsync: deleteRubric } = useDeleteRubric();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterSkill, setFilterSkill] = useState<string>("all");

  const [form, setForm] = useState({
    title: "",
    skill: "writing",
    description: "",
  });
  const [criteria, setCriteria] = useState<CriterionInput[]>([
    { name: "", description: "", maxPoints: 10 },
  ]);

  const filtered = filterSkill === "all" ? (rubrics ?? []) : (rubrics ?? []).filter(r => r.skill === filterSkill);

  async function handleCreate() {
    if (!form.title.trim()) { toast({ title: "Lỗi", description: "Tên rubric không được để trống", variant: "destructive" }); return; }
    const validCriteria = criteria.filter(c => c.name.trim());
    try {
      await createRubric({ data: {
        title: form.title,
        skill: form.skill,
        description: form.description || undefined,
        criteria: validCriteria.map((c, i) => ({
          name: c.name,
          description: c.description || undefined,
          maxPoints: c.maxPoints,
          orderIndex: i,
        })),
      }});
      await queryClient.invalidateQueries({ queryKey: ["/api/rubrics"] });
      toast({ title: "Đã tạo rubric" });
      setShowCreate(false);
      setForm({ title: "", skill: "writing", description: "" });
      setCriteria([{ name: "", description: "", maxPoints: 10 }]);
    } catch {
      toast({ title: "Lỗi", description: "Không thể tạo rubric", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteRubric({ id });
      await queryClient.invalidateQueries({ queryKey: ["/api/rubrics"] });
      toast({ title: "Đã xoá rubric" });
    } catch {
      toast({ title: "Lỗi", description: "Không thể xoá rubric", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bộ tiêu chí chấm (Rubric)</h1>
          <p className="text-muted-foreground mt-1">Quản lý rubric chấm điểm cho kỹ năng viết và nói</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Tạo Rubric
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant={filterSkill === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterSkill("all")}
        >
          Tất cả
        </Button>
        {SKILL_OPTIONS.map(s => (
          <Button
            key={s.value}
            variant={filterSkill === s.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterSkill(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>Chưa có rubric nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rubric => (
            <Card key={rubric.id}>
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{rubric.title}</p>
                        <Badge className={`text-xs border-0 ${SKILL_COLORS[rubric.skill] ?? "bg-gray-100 text-gray-600"}`}>
                          {SKILL_LABELS[rubric.skill] ?? rubric.skill}
                        </Badge>
                      </div>
                      {rubric.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{rubric.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rubric.criteria.length} tiêu chí · Tổng {rubric.criteria.reduce((s, c) => s + c.maxPoints, 0)} điểm
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === rubric.id ? null : rubric.id)}
                    >
                      {expandedId === rubric.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(rubric.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {expandedId === rubric.id && rubric.criteria.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
                    {rubric.criteria.map(c => (
                      <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                        </div>
                        <span className="text-sm font-semibold text-primary">{c.maxPoints} điểm</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo Rubric mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tên Rubric</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Rubric viết essay IELTS" />
            </div>
            <div className="space-y-1.5">
              <Label>Kỹ năng</Label>
              <Select value={form.skill} onValueChange={v => setForm(f => ({ ...f, skill: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mô tả (tuỳ chọn)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Tiêu chí chấm điểm</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCriteria(c => [...c, { name: "", description: "", maxPoints: 10 }])}
                >
                  <Plus className="w-3 h-3 mr-1" /> Thêm
                </Button>
              </div>
              {criteria.map((c, i) => (
                <div key={i} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Tên tiêu chí"
                      value={c.name}
                      onChange={e => {
                        const updated = [...criteria];
                        updated[i]!.name = e.target.value;
                        setCriteria(updated);
                      }}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Điểm"
                      value={c.maxPoints}
                      onChange={e => {
                        const updated = [...criteria];
                        updated[i]!.maxPoints = parseFloat(e.target.value) || 0;
                        setCriteria(updated);
                      }}
                      className="w-24"
                    />
                    {criteria.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Mô tả tiêu chí (tuỳ chọn)"
                    value={c.description}
                    onChange={e => {
                      const updated = [...criteria];
                      updated[i]!.description = e.target.value;
                      setCriteria(updated);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Huỷ</Button>
            <Button onClick={handleCreate}>Tạo Rubric</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
