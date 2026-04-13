import { Feather } from "@expo/vector-icons";
import {
  useListBadges,
  useGetLeaderboard,
  useGetMyStreak,
} from "@workspace/api-client-react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const BADGE_ICONS: Record<string, string> = {
  first_submission: "star",
  streak_3: "zap",
  streak_7: "zap",
  streak_30: "zap",
  perfect_score: "award",
  fast_learner: "trending-up",
  prolific: "book-open",
  top_10: "users",
};

type Tab = "badges" | "leaderboard" | "streak";

export default function GamificationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [tab, setTab] = useState<Tab>("badges");

  const { data: badges, isLoading: bLoading, refetch: refetchB } = useListBadges();
  const { data: leaderboard, isLoading: lLoading, refetch: refetchL } = useGetLeaderboard();
  const { data: streak, isLoading: sLoading, refetch: refetchS } = useGetMyStreak();

  const isLoading = bLoading || lLoading || sLoading;
  const refetch = () => { refetchB(); refetchL(); refetchS(); };

  const s = styles(colors);

  const renderBadge = ({ item }: { item: { key: string; name: string; description: string; earned: boolean; awardedAt?: string | null } }) => (
    <View style={[s.badgeCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: item.earned ? 1 : 0.5 }]}>
      <View style={[s.badgeIcon, { backgroundColor: (item.earned ? colors.primary : colors.mutedForeground) + "20" }]}>
        <Feather name={(BADGE_ICONS[item.key] ?? "star") as any} size={24} color={item.earned ? colors.primary : colors.mutedForeground} />
      </View>
      <Text style={[s.badgeName, { color: colors.foreground }]}>{item.name}</Text>
      <Text style={[s.badgeDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
        {item.description}
      </Text>
      {item.earned && item.awardedAt && (
        <Text style={[s.badgeDate, { color: colors.mutedForeground }]}>
          {new Date(item.awardedAt).toLocaleDateString("vi-VN")}
        </Text>
      )}
      {!item.earned && (
        <Text style={[s.badgeDate, { color: colors.mutedForeground }]}>Chưa đạt</Text>
      )}
    </View>
  );

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <Text style={s.title}>Thành tích</Text>

      <View style={[s.tabRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        {(["badges", "leaderboard", "streak"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[s.tabBtn, tab === t && { backgroundColor: colors.card }]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t === "badges" ? "Huy hiệu" : t === "leaderboard" ? "BXH" : "Chuỗi"}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : tab === "badges" ? (
        <FlatList
          data={badges ?? []}
          keyExtractor={(item, i) => String(i)}
          renderItem={renderBadge}
          numColumns={2}
          columnWrapperStyle={s.badgeRow}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad + 80, paddingTop: 12 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="award" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                Chưa có huy hiệu nào
              </Text>
              <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>
                Hoàn thành bài tập để nhận huy hiệu
              </Text>
            </View>
          }
        />
      ) : tab === "leaderboard" ? (
        <FlatList
          data={leaderboard ?? []}
          keyExtractor={(item, i) => String(i)}
          renderItem={({ item, index }) => (
            <View style={[s.rankRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.rankBadge, { backgroundColor: index < 3 ? colors.primary + "20" : colors.muted }]}>
                <Text style={[s.rankNum, { color: index < 3 ? colors.primary : colors.mutedForeground }]}>
                  {index + 1}
                </Text>
              </View>
              <View style={s.rankInfo}>
                <Text style={[s.rankName, { color: colors.foreground }]}>{(item as any).name}</Text>
                <Text style={[s.rankScore, { color: colors.mutedForeground }]}>
                  {(item as any).totalSubmissions ?? 0} bài · {Math.round(Number((item as any).avgScore ?? 0))}%
                </Text>
              </View>
              {index < 3 && (
                <Feather name="award" size={18} color={index === 0 ? "#F1C40F" : index === 1 ? "#BDC3C7" : "#CD7F32"} />
              )}
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad + 80, paddingTop: 12 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Chưa có dữ liệu</Text>
            </View>
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad + 80, paddingTop: 12 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          showsVerticalScrollIndicator={false}
        >
          {streak ? (
            <>
              <View style={[s.streakMain, { backgroundColor: colors.primary }]}>
                <Feather name="zap" size={32} color="#FFF" />
                <Text style={s.streakNum}>{streak.currentStreak}</Text>
                <Text style={s.streakLabel}>Ngày học liên tiếp</Text>
              </View>
              <View style={s.streakStats}>
                <View style={[s.streakStat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.streakStatVal, { color: colors.foreground }]}>{streak.longestStreak}</Text>
                  <Text style={[s.streakStatLbl, { color: colors.mutedForeground }]}>Kỷ lục</Text>
                </View>
                <View style={[s.streakStat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.streakStatVal, { color: colors.foreground }]}>{streak.todayCompleted ? "Xong" : "Chưa"}</Text>
                  <Text style={[s.streakStatLbl, { color: colors.mutedForeground }]}>Hôm nay</Text>
                </View>
              </View>
              <View style={[s.streakTip, { backgroundColor: colors.muted }]}>
                <Feather name="info" size={16} color={colors.mutedForeground} />
                <Text style={[s.streakTipText, { color: colors.mutedForeground }]}>
                  Nộp ít nhất 1 bài tập mỗi ngày để duy trì chuỗi học
                </Text>
              </View>
            </>
          ) : (
            <View style={s.empty}>
              <Feather name="zap" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Bắt đầu chuỗi học hôm nay!</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      paddingHorizontal: 20,
      paddingBottom: 12,
      paddingTop: 8,
    },
    tabRow: {
      flexDirection: "row",
      marginHorizontal: 20,
      borderRadius: 10,
      borderWidth: 1,
      padding: 4,
      marginBottom: 4,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: "center",
    },
    tabText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
    },
    badgeRow: {
      gap: 12,
      marginBottom: 12,
    },
    badgeCard: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      alignItems: "center",
      gap: 6,
    },
    badgeIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    badgeName: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      textAlign: "center" as const,
    },
    badgeDesc: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      textAlign: "center" as const,
    },
    badgeDate: {
      fontSize: 10,
      fontFamily: "Inter_400Regular",
    },
    rankRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      marginBottom: 8,
      gap: 12,
    },
    rankBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    rankNum: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
    rankInfo: {
      flex: 1,
    },
    rankName: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    rankScore: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
    },
    streakMain: {
      borderRadius: 20,
      alignItems: "center",
      padding: 32,
      gap: 8,
      marginBottom: 16,
    },
    streakNum: {
      fontSize: 56,
      fontFamily: "Inter_700Bold",
      color: "#FFF",
    },
    streakLabel: {
      fontSize: 15,
      color: "rgba(255,255,255,0.85)",
      fontFamily: "Inter_500Medium",
    },
    streakStats: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    streakStat: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      padding: 16,
      alignItems: "center",
      gap: 4,
    },
    streakStatVal: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
    },
    streakStatLbl: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
    },
    streakTip: {
      flexDirection: "row",
      alignItems: "flex-start",
      borderRadius: 12,
      padding: 14,
      gap: 10,
    },
    streakTipText: {
      flex: 1,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    empty: {
      alignItems: "center",
      paddingTop: 60,
      gap: 10,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
    },
    emptyHint: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      textAlign: "center" as const,
      paddingHorizontal: 30,
    },
  });
