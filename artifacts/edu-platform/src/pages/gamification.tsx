import { useListBadges, useGetMyStreak, useGetLeaderboard } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function StreakCard({ streak, loading }: { streak: any; loading: boolean }) {
  if (loading) return <Skeleton className="h-32 rounded-2xl" />;

  const current = streak?.currentStreak ?? 0;
  const longest = streak?.longestStreak ?? 0;
  const todayDone = streak?.todayCompleted ?? false;

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-100">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-4xl">🔥</span>
              <div>
                <p className="text-3xl font-bold text-orange-600">{current} ngày</p>
                <p className="text-sm text-orange-500 font-medium">Streak hiện tại</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Kỷ lục dài nhất: {longest} ngày</p>
          </div>
          <div className="text-right">
            {todayDone ? (
              <Badge className="bg-green-100 text-green-700 border-0 text-sm px-3 py-1">✅ Hôm nay hoàn thành</Badge>
            ) : (
              <Badge className="bg-orange-100 text-orange-700 border-0 text-sm px-3 py-1">⏳ Hãy làm bài hôm nay!</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BadgesGrid({ badges, loading }: { badges: any[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {badges.map((badge) => (
        <div
          key={badge.key}
          className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border text-center transition-all ${
            badge.earned
              ? "bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-200 shadow-sm"
              : "bg-gray-50 border-gray-200 opacity-50"
          }`}
        >
          <span className="text-3xl">{badge.icon}</span>
          <p className="text-sm font-semibold text-gray-800">{badge.name}</p>
          <p className="text-xs text-muted-foreground leading-tight">{badge.description}</p>
          {badge.earned && (
            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Đã đạt</Badge>
          )}
        </div>
      ))}
    </div>
  );
}

function LeaderboardTable({ leaderboard, loading }: { leaderboard: any[]; loading: boolean }) {
  if (loading) return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
    </div>
  );

  if (!leaderboard || leaderboard.length === 0) {
    return <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu xếp hạng</p>;
  }

  const medalEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank.toString();
  };

  return (
    <div className="space-y-2">
      {leaderboard.map((entry) => {
        const initials = entry.userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
        return (
          <div
            key={entry.userId}
            className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
              entry.isCurrentUser
                ? "bg-blue-50 border-blue-200 ring-1 ring-blue-300"
                : "bg-white border-gray-100 hover:border-gray-200"
            }`}
          >
            <div className="w-10 text-center font-bold text-lg text-gray-500">
              {typeof entry.rank === "number" && entry.rank <= 3 ? medalEmoji(entry.rank) : `#${entry.rank}`}
            </div>
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-primary text-white text-sm font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">
                {entry.userName}
                {entry.isCurrentUser && <span className="ml-2 text-xs text-primary font-normal">(Bạn)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.submissionCount} bài · {entry.streak} ngày streak · {entry.badgeCount} huy hiệu
              </p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${entry.averageScore >= 80 ? "text-green-600" : entry.averageScore >= 60 ? "text-yellow-600" : "text-gray-600"}`}>
                {entry.averageScore.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">điểm TB</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function GamificationPage() {
  const { data: user } = useGetMe();
  const { data: badges, isLoading: loadingBadges } = useListBadges();
  const { data: streak, isLoading: loadingStreak } = useGetMyStreak();
  const { data: leaderboard, isLoading: loadingLeaderboard } = useGetLeaderboard();

  const earnedBadges = badges?.filter((b) => b.earned).length ?? 0;
  const totalBadges = badges?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gamification</h1>
        <p className="text-muted-foreground mt-1">Huy hiệu thành tích, streak học tập và bảng xếp hạng</p>
      </div>

      <StreakCard streak={streak} loading={loadingStreak} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-amber-600">{earnedBadges}</p>
            <p className="text-sm text-muted-foreground mt-1">Huy hiệu đã đạt</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-blue-600">{streak?.currentStreak ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Streak hiện tại</p>
          </CardContent>
        </Card>
        <Card className="text-center sm:block hidden">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-green-600">{streak?.longestStreak ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Streak kỷ lục</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="badges">
        <TabsList>
          <TabsTrigger value="badges">Huy hiệu ({earnedBadges}/{totalBadges})</TabsTrigger>
          <TabsTrigger value="leaderboard">Bảng xếp hạng</TabsTrigger>
        </TabsList>
        <TabsContent value="badges" className="mt-4">
          <BadgesGrid badges={badges ?? []} loading={loadingBadges} />
        </TabsContent>
        <TabsContent value="leaderboard" className="mt-4">
          <LeaderboardTable leaderboard={leaderboard ?? []} loading={loadingLeaderboard} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
