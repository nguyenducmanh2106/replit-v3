import { useGetDepartmentReport, useGetCompetencyMatrix } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { format, parseISO } from "date-fns";

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge className="bg-green-100 text-green-700 border-0">{score.toFixed(0)}%</Badge>;
  if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-700 border-0">{score.toFixed(0)}%</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-0">{score.toFixed(0)}%</Badge>;
}

function LevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    A1: "bg-gray-100 text-gray-700", A2: "bg-blue-100 text-blue-700",
    B1: "bg-indigo-100 text-indigo-700", B2: "bg-purple-100 text-purple-700",
    C1: "bg-orange-100 text-orange-700", C2: "bg-red-100 text-red-700",
  };
  return <Badge className={`${colors[level] ?? "bg-gray-100 text-gray-700"} border-0`}>{level}</Badge>;
}

export default function EnterprisePage() {
  const { data: report, isLoading: loadingReport } = useGetDepartmentReport();
  const { data: matrix, isLoading: loadingMatrix } = useGetCompetencyMatrix();

  const deptChartData = report?.departments.map((d) => ({
    name: d.department.length > 12 ? d.department.slice(0, 12) + "…" : d.department,
    fullName: d.department,
    "Hoàn thành": d.completionRate,
    "Điểm TB": d.averageScore,
    "Tổng NV": d.totalMembers,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Doanh nghiệp & HR</h1>
        <p className="text-muted-foreground mt-1">Báo cáo đào tạo, đánh giá năng lực theo phòng ban</p>
      </div>

      {loadingReport ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="text-2xl font-bold text-gray-900">{report.totalEmployees}</p>
                <p className="text-xs text-muted-foreground mt-1">Tổng nhân viên</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="text-2xl font-bold text-primary">{report.overallCompletionRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">Tỷ lệ hoàn thành</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="text-2xl font-bold text-green-600">{report.overallAverageScore.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">Điểm trung bình</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="text-2xl font-bold text-amber-600">{report.departments.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Phòng ban</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="departments">
            <TabsList>
              <TabsTrigger value="departments">Theo phòng ban</TabsTrigger>
              <TabsTrigger value="top">Top học viên</TabsTrigger>
              <TabsTrigger value="competency">Ma trận năng lực</TabsTrigger>
            </TabsList>

            <TabsContent value="departments" className="mt-4 space-y-4">
              {deptChartData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Tỷ lệ hoàn thành & Điểm TB theo phòng ban</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={deptChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
                        />
                        <Bar dataKey="Hoàn thành" fill="#378ADD" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Điểm TB" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-3 pr-4 font-semibold text-gray-700">Phòng ban</th>
                      <th className="py-3 pr-4 font-semibold text-gray-700">Nhân viên</th>
                      <th className="py-3 pr-4 font-semibold text-gray-700">Đang học</th>
                      <th className="py-3 pr-4 font-semibold text-gray-700">Hoàn thành</th>
                      <th className="py-3 pr-4 font-semibold text-gray-700">Điểm TB</th>
                      <th className="py-3 pr-4 font-semibold text-gray-700">Bài nộp</th>
                      <th className="py-3 font-semibold text-gray-700">Chứng chỉ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.departments.map((dept) => (
                      <tr key={dept.department} className="border-b hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-800">{dept.department}</td>
                        <td className="py-3 pr-4 text-gray-600">{dept.totalMembers}</td>
                        <td className="py-3 pr-4 text-gray-600">{dept.activeLearners}</td>
                        <td className="py-3 pr-4"><ScoreBadge score={dept.completionRate} /></td>
                        <td className="py-3 pr-4"><ScoreBadge score={dept.averageScore} /></td>
                        <td className="py-3 pr-4 text-gray-600">{dept.totalSubmissions}</td>
                        <td className="py-3">
                          <Badge className="bg-purple-100 text-purple-700 border-0">{dept.certifiedCount}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="top" className="mt-4">
              <div className="space-y-2">
                {report.topPerformers.map((p) => (
                  <div key={p.userId} className="flex items-center gap-4 p-3 rounded-xl border bg-white">
                    <span className="text-xl">{p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `#${p.rank}`}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{p.userName}</p>
                      <p className="text-xs text-muted-foreground">{p.submissionCount} bài · {p.badgeCount} huy hiệu</p>
                    </div>
                    <ScoreBadge score={p.averageScore} />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="competency" className="mt-4">
              {loadingMatrix ? (
                <Skeleton className="h-48 rounded-xl" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-3 pr-4 font-semibold text-gray-700">Nhân viên</th>
                        <th className="py-3 pr-4 font-semibold text-gray-700">Phòng ban</th>
                        <th className="py-3 pr-4 font-semibold text-gray-700">Reading</th>
                        <th className="py-3 pr-4 font-semibold text-gray-700">Writing</th>
                        <th className="py-3 pr-4 font-semibold text-gray-700">Listening</th>
                        <th className="py-3 pr-4 font-semibold text-gray-700">Speaking</th>
                        <th className="py-3 font-semibold text-gray-700">Cấp độ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(matrix ?? []).map((entry) => (
                        <tr key={entry.userId} className="border-b hover:bg-gray-50">
                          <td className="py-3 pr-4 font-medium text-gray-800">{entry.userName}</td>
                          <td className="py-3 pr-4 text-gray-500 text-xs">{entry.department ?? "—"}</td>
                          <td className="py-3 pr-4"><ScoreBadge score={entry.reading} /></td>
                          <td className="py-3 pr-4"><ScoreBadge score={entry.writing} /></td>
                          <td className="py-3 pr-4"><ScoreBadge score={entry.listening} /></td>
                          <td className="py-3 pr-4"><ScoreBadge score={entry.speaking} /></td>
                          <td className="py-3"><LevelBadge level={entry.overallLevel} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(!matrix || matrix.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu năng lực</p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <p className="text-center text-muted-foreground py-8">Không thể tải báo cáo doanh nghiệp</p>
      )}
    </div>
  );
}
