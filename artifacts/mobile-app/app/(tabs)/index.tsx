import { Feather } from "@expo/vector-icons";
import {
  useGetDashboardSummary,
  useGetDashboardActivity,
  useGetDashboardUpcoming,
  useGetMyStreak,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[statStyles.iconWrap, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <Text style={[statStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
    gap: 4,
  },
  iconWrap: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: summary, isLoading: sumLoading, refetch: refetchSum } = useGetDashboardSummary();
  const { data: activity, isLoading: actLoading, refetch: refetchAct } = useGetDashboardActivity();
  const { data: upcoming, refetch: refetchUp } = useGetDashboardUpcoming();
  const { data: streak } = useGetMyStreak();

  const isLoading = sumLoading || actLoading;
  const refetch = () => { refetchSum(); refetchAct(); refetchUp(); };

  const s = styles(colors);

  if (!user) {
    return (
      <View style={[s.container, { paddingTop: topPad }]}>
        <View style={s.authWall}>
          <Feather name="lock" size={40} color={colors.mutedForeground} />
          <Text style={s.authWallText}>Vui lòng đăng nhập</Text>
          <Pressable style={s.loginBtn} onPress={() => router.push("/login")}>
            <Text style={s.loginBtnText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: bottomPad + 80 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Xin chào,</Text>
          <Text style={s.userName}>{user.name}</Text>
        </View>
        <View style={[s.avatarCircle, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[s.avatarInitial, { color: colors.primary }]}>
            {user.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      {streak && (
        <Pressable style={[s.streakBanner, { backgroundColor: colors.primary }]}>
          <View style={s.streakLeft}>
            <Feather name="zap" size={20} color="#FFF" />
            <View>
              <Text style={s.streakTitle}>{streak.currentStreak} ngày liên tiếp</Text>
              <Text style={s.streakSub}>Chuỗi học tập của bạn</Text>
            </View>
          </View>
          <Text style={s.streakMax}>Max: {streak.longestStreak}</Text>
        </Pressable>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : (
        <>
          <Text style={s.sectionTitle}>Tổng quan</Text>
          <View style={s.statsRow}>
            <StatCard
              icon="check-circle"
              label="Bài đã nộp"
              value={summary?.totalSubmissions ?? 0}
              color={colors.success}
            />
            <StatCard
              icon="star"
              label="Điểm TB"
              value={
                summary?.averageScore != null ? `${Math.round(Number(summary.averageScore))}%` : "—"
              }
              color={colors.primary}
            />
          </View>
          <View style={s.statsRow}>
            <StatCard
              icon="book-open"
              label="Khoá học"
              value={summary?.totalCourses ?? 0}
              color={colors.warning}
            />
            <StatCard
              icon="award"
              label="Hoàn thành"
              value={`${Math.round(Number(summary?.completionRate ?? 0))}%`}
              color="#9B59B6"
            />
          </View>

          {upcoming && upcoming.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Bài tập sắp hết hạn</Text>
              {upcoming.slice(0, 3).map((item) => (
                <Pressable
                  key={item.id}
                  style={[s.upcomingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/assignment/${item.id}`)}
                >
                  <View style={s.upcomingLeft}>
                    <Text style={[s.upcomingTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.dueDate && (
                      <Text style={[s.upcomingDue, { color: colors.mutedForeground }]}>
                        Hạn: {new Date(item.dueDate).toLocaleDateString("vi-VN")}
                      </Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </>
          )}

          {activity && activity.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Hoạt động gần đây</Text>
              {activity.slice(0, 5).map((item, i) => (
                <View
                  key={i}
                  style={[s.activityItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[s.activityDot, { backgroundColor: colors.primary }]} />
                  <View style={s.activityContent}>
                    <Text style={[s.activityText, { color: colors.foreground }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={[s.activityTime, { color: colors.mutedForeground }]}>
                      {new Date(item.timestamp).toLocaleString("vi-VN")}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    authWall: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    authWallText: {
      fontSize: 16,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    loginBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 24,
      paddingVertical: 12,
      marginTop: 4,
    },
    loginBtnText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    greeting: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    userName: {
      fontSize: 22,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
    },
    streakBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: 20,
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 14,
      marginBottom: 20,
    },
    streakLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    streakTitle: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: "#FFF",
    },
    streakSub: {
      fontSize: 12,
      color: "rgba(255,255,255,0.75)",
      fontFamily: "Inter_400Regular",
    },
    streakMax: {
      fontSize: 13,
      color: "rgba(255,255,255,0.9)",
      fontFamily: "Inter_500Medium",
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      paddingHorizontal: 20,
      marginBottom: 10,
      marginTop: 4,
    },
    statsRow: {
      flexDirection: "row",
      paddingHorizontal: 20,
      gap: 12,
      marginBottom: 12,
    },
    upcomingCard: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 20,
      marginBottom: 8,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    upcomingLeft: {
      flex: 1,
    },
    upcomingTitle: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
    },
    upcomingDue: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    activityItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginHorizontal: 20,
      marginBottom: 8,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    activityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 4,
    },
    activityContent: {
      flex: 1,
    },
    activityText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    activityTime: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
  });
