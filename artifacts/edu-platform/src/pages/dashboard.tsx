import { useGetDashboardSummary, useGetDashboardActivity, useGetDashboardUpcoming, useGetWeeklyStats, useGetSkillProgress } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Users, BookOpen, PenSquare, FileCheck, Clock, TrendingUp, Star, GraduationCap, Building2, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number | string; icon: LucideIcon; color: string }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string) {
  try { return format(parseISO(iso), "dd/MM HH:mm"); } catch { return iso; }
}

function formatDue(iso: string | null | undefined) {
  if (!iso) return "Không hạn";
  try { return format(parseISO(iso), "dd/MM/yyyy"); } catch { return iso; }
}

function StudentDashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: upcoming, isLoading: loadingUpcoming } = useGetDashboardUpcoming();
  const { data: weeklyStats, isLoading: loadingWeekly } = useGetWeeklyStats();
  const { data: skillProgress } = useGetSkillProgress();

  const radarData = skillProgress ? [
    { skill: "Reading", value: skillProgress.reading },
    { skill: "Writing", value: skillProgress.writing },
    { skill: "Listening", value: skillProgress.listening },
    { skill: "Speaking", value: skillProgress.speaking },
  ] : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trang học sinh</h1>
        <p className="text-muted-foreground mt-1">Theo dõi tiến độ học tập và bài tập của bạn</p>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Bài đã nộp" value={summary?.totalSubmissions ?? 0} icon={FileCheck} color="bg-blue-100 text-primary" />
          <StatCard title="Khóa học" value={summary?.totalCourses ?? 0} icon={BookOpen} color="bg-green-100 text-success" />
          <StatCard title="Tỷ lệ hoàn thành" value={`${(summary?.completionRate ?? 0).toFixed(0)}%`} icon={TrendingUp} color="bg-purple-100 text-purple-600" />
          <StatCard title="Điểm trung bình" value={(summary?.averageScore ?? 0).toFixed(1)} icon={Star} color="bg-amber-100 text-warning" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Hoạt động theo tuần</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingWeekly ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyStats ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="submissions" name="Bài nộp" fill="#378ADD" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="averageScore" name="Điểm TB" fill="#1D9E75" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Kỹ năng ngôn ngữ</CardTitle>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name="Kỹ năng" dataKey="value" stroke="#378ADD" fill="#378ADD" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Bài tập sắp đến hạn</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUpcoming ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : upcoming && Array.isArray(upcoming) && upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((assignment) => (
                <Link key={assignment.id} href={`/assignments/${assignment.id}`}>
                  <div className="flex items-start justify-between p-3 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-blue-50/30 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-sm font-medium text-gray-900 truncate">{assignment.title}</p>
                      {assignment.courseName && <p className="text-xs text-muted-foreground truncate">{assignment.courseName}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">Hạn: {formatDue(assignment.dueDate)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {assignment.submitted ? (
                        <Badge className="bg-green-100 text-success border-0 text-xs">Đã nộp</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-warning border-0 text-xs">Chưa nộp</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{assignment.totalPoints} điểm</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Không có bài tập sắp hạn</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeacherDashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: loadingActivity } = useGetDashboardActivity();
  const { data: upcoming, isLoading: loadingUpcoming } = useGetDashboardUpcoming();
  const { data: weeklyStats, isLoading: loadingWeekly } = useGetWeeklyStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trang giáo viên</h1>
        <p className="text-muted-foreground mt-1">Quản lý lớp học, bài tập và theo dõi kết quả học sinh</p>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Tổng học sinh" value={summary?.totalStudents ?? 0} icon={Users} color="bg-blue-100 text-primary" />
          <StatCard title="Khóa học" value={summary?.totalCourses ?? 0} icon={BookOpen} color="bg-green-100 text-success" />
          <StatCard title="Bài tập" value={summary?.totalAssignments ?? 0} icon={PenSquare} color="bg-purple-100 text-purple-600" />
          <StatCard title="Chờ chấm điểm" value={summary?.pendingGrading ?? 0} icon={Clock} color="bg-amber-100 text-warning" />
        </div>
      )}

      {!loadingSummary && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tổng bài nộp</p>
                  <p className="text-2xl font-bold">{summary.totalSubmissions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tỷ lệ hoàn thành</p>
                  <p className="text-2xl font-bold">{summary.completionRate.toFixed(0)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Star className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Điểm trung bình lớp</p>
                  <p className="text-2xl font-bold">{summary.averageScore.toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Thống kê lớp theo tuần</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingWeekly ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyStats ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
                  <Bar dataKey="submissions" name="Bài nộp" fill="#378ADD" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="averageScore" name="Điểm TB" fill="#1D9E75" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Thao tác nhanh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/assignments">
              <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-primary/40 hover:bg-blue-50 transition-colors text-left">
                <PenSquare className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary">Tạo bài tập mới</p>
                  <p className="text-xs text-muted-foreground">Soạn đề, thêm câu hỏi, xuất bản</p>
                </div>
              </button>
            </Link>
            <Link href="/questions">
              <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-success/40 hover:bg-green-50 transition-colors text-left">
                <BookOpen className="w-4 h-4 text-success flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-success">Ngân hàng câu hỏi</p>
                  <p className="text-xs text-muted-foreground">Thêm & quản lý câu hỏi</p>
                </div>
              </button>
            </Link>
            <Link href="/submissions">
              <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-warning/40 hover:bg-amber-50 transition-colors text-left">
                <Clock className="w-4 h-4 text-warning flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-warning">Chờ chấm điểm ({summary?.pendingGrading ?? 0})</p>
                  <p className="text-xs text-muted-foreground">Bài nộp cần chấm thủ công</p>
                </div>
              </button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Hoạt động gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-3">
                {activity.map((item) => (
                  <div key={item.id} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileCheck className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(item.timestamp)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Chưa có hoạt động nào</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Bài tập sắp đến hạn</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUpcoming ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : upcoming && Array.isArray(upcoming) && upcoming.length > 0 ? (
              <div className="space-y-3">
                {upcoming.map((assignment) => (
                  <Link key={assignment.id} href={`/assignments/${assignment.id}`}>
                    <div className="flex items-start justify-between p-3 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-blue-50/30 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-sm font-medium text-gray-900 truncate">{assignment.title}</p>
                        {assignment.courseName && <p className="text-xs text-muted-foreground truncate">{assignment.courseName}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">Hạn: {formatDue(assignment.dueDate)}</p>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{assignment.totalPoints} điểm</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Không có bài tập sắp hạn</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminDashboard({ role }: { role: string }) {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: loadingActivity } = useGetDashboardActivity();
  const { data: weeklyStats, isLoading: loadingWeekly } = useGetWeeklyStats();

  const roleLabel = role === "system_admin"
    ? "Quản trị hệ thống"
    : role === "center_admin"
    ? "Quản lý trung tâm"
    : role === "school_admin"
    ? "Quản lý trường"
    : role === "enterprise_admin"
    ? "Quản lý doanh nghiệp"
    : "Quản trị";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{roleLabel}</h1>
        <p className="text-muted-foreground mt-1">Tổng quan hoạt động toàn hệ thống</p>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Tổng người dùng" value={summary?.totalStudents ?? 0} icon={Users} color="bg-blue-100 text-primary" />
          <StatCard title="Khóa học" value={summary?.totalCourses ?? 0} icon={BookOpen} color="bg-green-100 text-success" />
          <StatCard title="Bài tập" value={summary?.totalAssignments ?? 0} icon={PenSquare} color="bg-purple-100 text-purple-600" />
          <StatCard title="Tổng bài nộp" value={summary?.totalSubmissions ?? 0} icon={FileCheck} color="bg-amber-100 text-warning" />
        </div>
      )}

      {!loadingSummary && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Học sinh</p>
                  <p className="text-2xl font-bold">{summary.totalStudents}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tỷ lệ hoàn thành</p>
                  <p className="text-2xl font-bold">{summary.completionRate.toFixed(0)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chờ chấm điểm</p>
                  <p className="text-2xl font-bold">{summary.pendingGrading}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Thống kê theo tuần</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingWeekly ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyStats ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
                  <Bar dataKey="submissions" name="Bài nộp" fill="#378ADD" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="averageScore" name="Điểm TB" fill="#1D9E75" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Hoạt động gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-3">
                {activity.map((item) => (
                  <div key={item.id} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileCheck className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(item.timestamp)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Chưa có hoạt động nào</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: summary } = useGetDashboardSummary();
  const role = summary?.role ?? "student";

  if (role === "student") {
    return <StudentDashboard />;
  }

  if (role === "teacher") {
    return <TeacherDashboard />;
  }

  return <AdminDashboard role={role} />;
}
