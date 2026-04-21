import { useEffect, useState } from "react";
import { useParams, Link } from "@/lib/routing";
import { placementApi, type PlacementSubmission } from "@/lib/placement-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, CheckCircle, Clock, Mail } from "lucide-react";

export default function PlacementSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const testId = Number(id);
  const { toast } = useToast();
  const [items, setItems] = useState<PlacementSubmission[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "graded">("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try { setItems(await placementApi.listSubmissions(testId)); }
    catch (e: any) { toast({ title: "Không tải được", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (testId) load(); }, [testId]);

  const filtered = (items ?? []).filter(s =>
    (filter === "all" || s.gradingStatus === filter) &&
    (search === "" || s.studentName.toLowerCase().includes(search.toLowerCase()) || s.studentEmail.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/placement-tests/${testId}`}><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Quay lại</Button></Link>
        <h1 className="text-xl font-bold">Danh sách bài nộp</h1>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input placeholder="Tìm theo tên hoặc email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Tất cả ({items?.length ?? 0})</Button>
          <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>Chờ chấm ({items?.filter(s => s.gradingStatus === "pending").length ?? 0})</Button>
          <Button size="sm" variant={filter === "graded" ? "default" : "outline"} onClick={() => setFilter("graded")}>Đã chấm ({items?.filter(s => s.gradingStatus === "graded").length ?? 0})</Button>
        </div>
      </div>

      {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div> :
      filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Chưa có bài nộp nào</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Link key={s.id} href={`/placement-tests/submissions/${s.id}`}>
              <Card className="hover:border-primary/40 cursor-pointer transition-all">
                <CardContent className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{s.studentName}</span>
                      <Badge variant={s.gradingStatus === "graded" ? "default" : "secondary"}>
                        {s.gradingStatus === "graded" ? <><CheckCircle className="w-3 h-3 mr-1" /> Đã chấm</> : <><Clock className="w-3 h-3 mr-1" /> Chờ chấm</>}
                      </Badge>
                      {s.resultSentAt && <Badge variant="outline" className="text-green-700"><Mail className="w-3 h-3 mr-1" /> Đã gửi KQ</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.studentEmail} · Nộp {s.submittedAt ? new Date(s.submittedAt).toLocaleString("vi-VN") : "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{s.totalScore ?? s.autoScore ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">điểm</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
