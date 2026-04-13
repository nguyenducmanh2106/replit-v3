import { useState } from "react";
import { useGetMe, useGetReportsOverview, useListCourses, useGetCourseReport, getGetCourseReportQueryKey, useGetStudentReport, getGetStudentReportQueryKey, useListUsers, getListUsersQueryKey, type SkillProgress } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import { TrendingUp, Users, BookOpen, Award, BarChart2 } from "lucide-react";
import { ExportButtons } from "@/components/export-buttons";
import { ChartErrorBoundary } from "@/components/chart-error-boundary";

const SKILL_LABELS: Record<string, string> = {
  reading: "Đọc hiểu",
  writing: "Viết",
  listening: "Nghe",
  speaking: "Nói",
};

function SkillRadar({ data }: { data?: { reading?: number; writing?: number; listening?: number; speaking?: number } | null }) {
  const chartData = [
    { skill: "Đọc", value: data?.reading ?? 0 },
    { skill: "Viết", value: data?.writing ?? 0 },
    { skill: "Nghe", value: data?.listening ?? 0 },
    { skill: "Nói", value: data?.speaking ?? 0 },
  ];
  return (
    <ChartErrorBoundary>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={chartData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12 }} />
          <Radar name="Điểm" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartErrorBoundary>
  );
}

function OverviewTab() {
  const { data: overview, isLoading } = useGetReportsOverview();

  if (isLoading) return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
    </div>
  );

  if (!overview) return <div className="text-center py-10 text-muted-foreground">Không có dữ liệu</div>;

  const comparisonData = (overview.courseComparison ?? []).map(c => ({
    name: c.courseName.length > 15 ? c.courseName.slice(0, 15) + "…" : c.courseName,
    "Điểm TB": c.averageScore,
    "Tỷ lệ nộp": c.completionRate,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Khoá học</p>
                <p className="text-2xl font-bold">{overview.totalCourses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Học sinh</p>
                <p className="text-2xl font-bold">{overview.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bài nộp</p>
                <p className="text-2xl font-bold">{overview.totalSubmissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Award className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Điểm TB</p>
                <p className="text-2xl font-bold">{(overview.averageScore ?? 0).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kỹ năng trung bình</CardTitle>
          </CardHeader>
          <CardContent>
            <SkillRadar data={overview.skillAverages} />
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(Object.entries(SKILL_LABELS) as [keyof SkillProgress, string][]).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{overview.skillAverages[key]?.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">So sánh khoá học</CardTitle>
          </CardHeader>
          <CardContent>
            {comparisonData.length > 0 ? (
              <ChartErrorBoundary>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Điểm TB" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Tỷ lệ nộp" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>
      </div>

      {overview.pendingGrading > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <p className="text-sm text-amber-700">
              <span className="font-semibold">{overview.pendingGrading}</span> bài nộp đang chờ chấm điểm
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CourseReportTab() {
  const { data: courses } = useListCourses();
  const [selectedCourse, setSelectedCourse] = useState<string>("");

  const courseId = selectedCourse ? parseInt(selectedCourse, 10) : undefined;
  const { data: report, isLoading } = useGetCourseReport(courseId!, {
    query: { enabled: !!courseId, queryKey: getGetCourseReportQueryKey(courseId ?? 0) },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Chọn khoá học" />
          </SelectTrigger>
          <SelectContent>
            {(courses ?? []).map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {report && <ExportButtons data={report} filename={`course-report-${courseId}`} />}
      </div>

      {!selectedCourse && (
        <div className="text-center py-12 text-muted-foreground">Chọn khoá học để xem báo cáo</div>
      )}

      {isLoading && <Skeleton className="h-80 rounded-xl" />}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Học sinh", value: report.studentCount },
              { label: "Bài nộp", value: report.submissionCount },
              { label: "Điểm TB", value: `${(report.averageScore ?? 0).toFixed(1)}%` },
              { label: "Tỷ lệ đạt", value: `${(report.passRate ?? 0).toFixed(1)}%` },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold mt-0.5">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Phân bố điểm (Histogram)</CardTitle></CardHeader>
              <CardContent>
                <ChartErrorBoundary>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={Array.isArray(report.scoreDistribution) ? report.scoreDistribution : []} margin={{ left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Học sinh" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartErrorBoundary>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Kỹ năng trung bình</CardTitle></CardHeader>
              <CardContent>
                <SkillRadar data={report.skillAverages} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Bảng điểm học sinh</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {report.studentScores.map(s => (
                  <div key={s.studentId} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{s.studentName}</p>
                      <p className="text-xs text-muted-foreground">{s.totalSubmissions} bài nộp</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{(s.averagePercentage ?? 0).toFixed(1)}%</p>
                      <Badge className={
                        (s.averagePercentage ?? 0) >= 80 ? "bg-green-100 text-green-700 border-0 text-xs" :
                        (s.averagePercentage ?? 0) >= 50 ? "bg-amber-100 text-amber-700 border-0 text-xs" :
                        "bg-red-100 text-red-700 border-0 text-xs"
                      }>
                        {(s.averagePercentage ?? 0) >= 80 ? "Giỏi" : (s.averagePercentage ?? 0) >= 50 ? "TB" : "Chưa đạt"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StudentReportTab() {
  const { data: me } = useGetMe();
  const isStudent = me?.role === "student";
  const listUsersParams = { role: "student" as const };
  const { data: users } = useListUsers(listUsersParams, {
    query: { enabled: !isStudent && !!me, queryKey: getListUsersQueryKey(listUsersParams) },
  });
  const [selectedStudent, setSelectedStudent] = useState<string>("");

  const studentId = isStudent ? me?.id : (selectedStudent ? parseInt(selectedStudent, 10) : undefined);

  const { data: report, isLoading } = useGetStudentReport(studentId!, {
    query: { enabled: !!studentId, queryKey: getGetStudentReportQueryKey(studentId ?? 0) },
  });

  return (
    <div className="space-y-5">
      {!isStudent && (
        <div className="flex items-center gap-4">
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Chọn học sinh" />
            </SelectTrigger>
            <SelectContent>
              {(users ?? []).map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.email})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {report && <ExportButtons data={report} filename={`student-report-${studentId}`} />}
        </div>
      )}

      {!studentId && !isStudent && (
        <div className="text-center py-12 text-muted-foreground">Chọn học sinh để xem báo cáo</div>
      )}

      {isLoading && <Skeleton className="h-80 rounded-xl" />}

      {report && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{report.studentName}</h2>
              <p className="text-sm text-muted-foreground">{report.totalSubmissions} bài nộp · Điểm TB: {(report.averagePercentage ?? 0).toFixed(1)}%</p>
            </div>
            {isStudent && <ExportButtons data={report} filename={`my-report`} />}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Radar kỹ năng</CardTitle></CardHeader>
              <CardContent>
                <SkillRadar data={report.skillAverages} />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {(Object.entries(SKILL_LABELS) as [keyof SkillProgress, string][]).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold">{report.skillAverages[key]?.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Lịch sử điểm</CardTitle></CardHeader>
              <CardContent>
                {(report.scoreHistory?.length ?? 0) > 0 ? (
                  <ChartErrorBoundary>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={(report.scoreHistory ?? []).map((h, i) => ({
                        name: `#${i + 1}`,
                        "%": h.percentage ?? 0,
                      }))} margin={{ left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="%" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartErrorBoundary>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">Chưa có bài nộp nào</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Chi tiết bài nộp</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {report.scoreHistory.slice(0, 10).map((h, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{h.assignmentTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.submittedAt ? new Date(h.submittedAt).toLocaleDateString("vi-VN") : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {h.score !== null && h.score !== undefined ? `${h.score}/${h.totalPoints}` : "Chờ chấm"}
                      </p>
                      {h.percentage !== null && (
                        <p className="text-xs text-muted-foreground">{h.percentage?.toFixed(1)}%</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { data: me } = useGetMe();
  const isTeacher = me?.role && ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"].includes(me.role);
  const isStudent = me?.role === "student";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Báo cáo & Thống kê</h1>
        <p className="text-muted-foreground mt-1">Phân tích chi tiết kết quả học tập</p>
      </div>

      {isStudent ? (
        <StudentReportTab />
      ) : (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="course">Theo khoá học</TabsTrigger>
            <TabsTrigger value="student">Theo học sinh</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-5"><OverviewTab /></TabsContent>
          <TabsContent value="course" className="mt-5"><CourseReportTab /></TabsContent>
          <TabsContent value="student" className="mt-5"><StudentReportTab /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
