import { useGetMe, useListSubmissions, useGetSkillProgress, useGetDashboardUpcoming } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";

const ROLE_LABELS: Record<string, string> = {
  teacher: "Giáo viên",
  student: "Học sinh",
  center_admin: "Quản lý Trung tâm",
  school_admin: "Quản lý Trường học",
  system_admin: "Quản trị Hệ thống",
  enterprise_admin: "Doanh nghiệp",
};

function formatDate(iso: string) {
  try { return format(parseISO(iso), "dd/MM/yyyy"); } catch { return iso; }
}

export default function ProfilePage() {
  const { data: user, isLoading: loadingUser } = useGetMe();
  const { data: submissions } = useListSubmissions();
  const { data: skillProgress } = useGetSkillProgress();
  const { data: upcoming } = useGetDashboardUpcoming();

  const radarData = skillProgress ? [
    { skill: "Reading", value: skillProgress.reading },
    { skill: "Writing", value: skillProgress.writing },
    { skill: "Listening", value: skillProgress.listening },
    { skill: "Speaking", value: skillProgress.speaking },
  ] : [];

  const scoreHistory = (submissions ?? [])
    .filter((s) => s.percentage !== null && s.percentage !== undefined)
    .slice(-10)
    .map((s, i) => ({ name: `Bài ${i + 1}`, score: s.percentage ?? 0, title: s.assignmentTitle }));

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
        <p className="text-muted-foreground mt-1">Tổng hợp thành tích và kỹ năng của bạn</p>
      </div>

      {/* Profile Card */}
      {loadingUser ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : user ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              <Avatar className="w-20 h-20 text-2xl">
                <AvatarFallback className="bg-primary text-white text-2xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
                <p className="text-muted-foreground">{user.email}</p>
                <div className="flex gap-2 mt-2">
                  <Badge className="bg-blue-100 text-primary border-0">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                  {user.organization && (
                    <Badge variant="outline">{user.organization}</Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{submissions?.length ?? 0}</p>
                <p className="text-sm text-muted-foreground">Bài đã nộp</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skill Progress Radar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Kỹ năng ngôn ngữ</CardTitle>
          </CardHeader>
          <CardContent>
            {radarData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name="Kỹ năng" dataKey="value" stroke="#378ADD" fill="#378ADD" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Chưa có dữ liệu kỹ năng
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score History Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Lịch sử điểm số</CardTitle>
          </CardHeader>
          <CardContent>
            {scoreHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={scoreHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v: number) => [`${v.toFixed(1)}%`, "Điểm"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? ""}
                  />
                  <Line type="monotone" dataKey="score" name="Điểm %" stroke="#378ADD" strokeWidth={2} dot={{ fill: "#378ADD", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Chưa có lịch sử điểm số
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Bài nộp gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions && submissions.length > 0 ? (
            <div className="space-y-3">
              {submissions.slice(0, 5).map((s) => (
                <Link key={s.id} href={`/submissions/${s.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-blue-50/20 transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.assignmentTitle}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(s.submittedAt)}</p>
                    </div>
                    <div className="text-right">
                      {s.percentage !== null && s.percentage !== undefined ? (
                        <p className={`text-lg font-bold ${s.percentage >= 80 ? "text-success" : s.percentage >= 50 ? "text-warning" : "text-destructive"}`}>
                          {s.percentage.toFixed(0)}%
                        </p>
                      ) : (
                        <Badge className="bg-amber-100 text-warning border-0 text-xs">Chờ chấm</Badge>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {s.score !== null && s.score !== undefined ? `${s.score} / ${s.totalPoints}` : `— / ${s.totalPoints}`} điểm
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Chưa nộp bài thi nào</p>
          )}
        </CardContent>
      </Card>

      {/* Upcoming */}
      {upcoming && Array.isArray(upcoming) && upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Bài tập sắp tới</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcoming.map((a) => (
                <Link key={a.id} href={`/assignments/${a.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-blue-50/20 transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.title}</p>
                      {a.courseName && <p className="text-xs text-muted-foreground">{a.courseName}</p>}
                    </div>
                    {a.submitted ? (
                      <Badge className="bg-green-100 text-success border-0 text-xs">Đã nộp</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-warning border-0 text-xs">Chưa nộp</Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
