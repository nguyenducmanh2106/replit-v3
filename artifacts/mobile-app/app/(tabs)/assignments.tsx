import { Feather } from "@expo/vector-icons";
import { useListAssignments } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Assignment = {
  id: number;
  title: string;
  status: string;
  dueAt?: string | null;
  courseId?: number | null;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "Nháp", color: "#9B59B6" },
  published: { label: "Đang mở", color: "#1D9E75" },
  closed: { label: "Đã đóng", color: "#888" },
};

function AssignmentCard({ item }: { item: Assignment }) {
  const colors = useColors();
  const status = STATUS_MAP[item.status] ?? { label: item.status, color: colors.mutedForeground };

  return (
    <Pressable
      style={[card.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/assignment/${item.id}`)}
    >
      <View style={card.top}>
        <View style={[card.statusDot, { backgroundColor: status.color }]} />
        <Text style={[card.statusLabel, { color: status.color }]}>{status.label}</Text>
      </View>
      <Text style={[card.title, { color: colors.foreground }]} numberOfLines={2}>
        {item.title}
      </Text>
      {item.dueAt && (
        <View style={card.row}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[card.due, { color: colors.mutedForeground }]}>
            {new Date(item.dueAt).toLocaleDateString("vi-VN")}
          </Text>
        </View>
      )}
      <View style={[card.footer, { borderTopColor: colors.border }]}>
        <Text style={[card.takeBtn, { color: colors.primary }]}>Làm bài</Text>
        <Feather name="arrow-right" size={14} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const card = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  due: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 4,
    marginTop: 4,
  },
  takeBtn: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});

export default function AssignmentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isRefetching } = useListAssignments({ status: "published" });

  const filtered = data?.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const s = styles(colors);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <Text style={s.title}>Bài tập</Text>
      </View>
      <View style={s.searchWrap}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={s.searchInput}
          placeholder="Tìm bài tập..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <AssignmentCard item={item as Assignment} />}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: bottomPad + 80,
            paddingTop: 8,
          }}
          refreshing={isRefetching}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={s.emptyText}>
                {search ? "Không tìm thấy bài tập" : "Chưa có bài tập nào"}
              </Text>
            </View>
          }
        />
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
    header: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      paddingTop: 8,
    },
    title: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 20,
      marginBottom: 12,
      paddingHorizontal: 14,
      height: 44,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    emptyState: {
      alignItems: "center",
      paddingTop: 60,
      gap: 10,
    },
    emptyText: {
      fontSize: 15,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
  });
