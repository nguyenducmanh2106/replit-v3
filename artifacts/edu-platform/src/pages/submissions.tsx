import { useListSubmissions } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileCheck, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy HH:mm"); } catch { return iso ?? "—"; }
}

function ScoreBadge({ percentage }: { percentage?: number | null }) {
  if (percentage === null || percentage === undefined) return <Badge className="bg-amber-100 text-warning border-0">Chưa chấm</Badge>;
  if (percentage >= 80) return <Badge className="bg-green-100 text-success border-0">{percentage.toFixed(0)}%</Badge>;
  if (percentage >= 50) return <Badge className="bg-amber-100 text-warning border-0">{percentage.toFixed(0)}%</Badge>;
  return <Badge className="bg-red-100 text-red-600 border-0">{percentage.toFixed(0)}%</Badge>;
}

export default function SubmissionsPage() {
  const { data: submissions, isLoading } = useListSubmissions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bài nộp</h1>
        <p className="text-muted-foreground mt-1">Danh sách tất cả bài nộp</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : submissions && submissions.length > 0 ? (
        <div className="space-y-3">
          {submissions.map((s) => (
            <Link key={s.id} href={`/submissions/${s.id}`}>
              <Card className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <FileCheck className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{s.assignmentTitle}</p>
                        <p className="text-sm text-muted-foreground">{s.studentName}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(s.submittedAt)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {s.score !== null && s.score !== undefined ? `${s.score} / ${s.totalPoints} điểm` : `— / ${s.totalPoints} điểm`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <ScoreBadge percentage={s.percentage} />
                      <Badge variant="outline" className="text-xs">
                        {s.status === "graded" ? "Đã chấm" : "Chờ chấm"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700">Chưa có bài nộp nào</h3>
          <p className="text-sm text-muted-foreground mt-1">Các bài thi đã nộp sẽ xuất hiện ở đây</p>
        </div>
      )}
    </div>
  );
}
