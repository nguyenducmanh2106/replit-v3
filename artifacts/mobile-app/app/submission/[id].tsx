import { Feather } from "@expo/vector-icons";
import { useGetSubmission } from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function SubmissionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const submissionId = Number(id);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: submission, isLoading } = useGetSubmission(submissionId);

  const s = styles(colors);

  if (isLoading) {
    return (
      <View style={[s.centered, { paddingTop: topPad }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!submission) {
    return (
      <View style={[s.centered, { paddingTop: topPad }]}>
        <Text style={{ color: colors.foreground }}>Không tìm thấy bài làm</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.primary, marginTop: 8 }}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const score = submission.score != null ? Math.round(Number(submission.score)) : null;
  const passed = score != null && score >= 50;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.replace("/(tabs)/assignments")} style={s.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Kết quả bài thi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: bottomPad + 30 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.scoreCard, { backgroundColor: passed ? colors.success : colors.destructive }]}>
          <Feather
            name={passed ? "check-circle" : "x-circle"}
            size={40}
            color="#FFF"
          />
          {score != null ? (
            <Text style={s.scoreNum}>{score}%</Text>
          ) : (
            <Text style={s.scoreNum}>—</Text>
          )}
          <Text style={s.scoreLabel}>{passed ? "Xuất sắc! Bài đạt yêu cầu" : "Bài chưa đạt"}</Text>
        </View>

        <View style={s.meta}>
          <MetaItem
            icon="calendar"
            label="Ngày nộp"
            value={new Date(submission.submittedAt).toLocaleString("vi-VN")}
            colors={colors}
          />
          <MetaItem
            icon="clock"
            label="Trạng thái"
            value={submission.status === "graded" ? "Đã chấm" : "Chờ chấm"}
            colors={colors}
          />
        </View>

        {submission.aiGrading && (
          <View style={[s.aiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.aiHeader}>
              <Feather name="cpu" size={16} color={colors.primary} />
              <Text style={[s.aiTitle, { color: colors.primary }]}>Nhận xét AI</Text>
            </View>
            <Text style={[s.aiText, { color: colors.foreground }]}>
              {(submission.aiGrading as any)?.feedback ?? ""}
            </Text>
            {(submission.aiGrading as any)?.scores && (
              <View style={s.aiScores}>
                {Object.entries((submission.aiGrading as any).scores).map(([k, v]) => (
                  <View key={k} style={[s.aiScoreItem, { backgroundColor: colors.muted }]}>
                    <Text style={[s.aiScoreKey, { color: colors.mutedForeground }]}>{k}</Text>
                    <Text style={[s.aiScoreVal, { color: colors.foreground }]}>{String(v)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {submission.answers && (submission.answers as any[]).length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Chi tiết câu trả lời</Text>
            {(submission.answers as any[]).map((ans, i) => (
              <View key={i} style={[s.answerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.answerQ, { color: colors.mutedForeground }]}>Câu {i + 1}</Text>
                <Text style={[s.answerText, { color: colors.foreground }]}>{ans.answer ?? "—"}</Text>
                {ans.isCorrect !== undefined && (
                  <View style={[s.answerResult, { backgroundColor: ans.isCorrect ? colors.success + "15" : colors.destructive + "15" }]}>
                    <Feather
                      name={ans.isCorrect ? "check" : "x"}
                      size={13}
                      color={ans.isCorrect ? colors.success : colors.destructive}
                    />
                    <Text style={[s.answerResultText, { color: ans.isCorrect ? colors.success : colors.destructive }]}>
                      {ans.isCorrect ? "Đúng" : "Sai"}
                    </Text>
                    {!ans.isCorrect && ans.correctAnswer && (
                      <Text style={[s.answerCorrect, { color: colors.mutedForeground }]}>
                        → {ans.correctAnswer}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        <Pressable
          style={[s.homeBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={s.homeBtnText}>Về trang chủ</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function MetaItem({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={metaStyles.wrap}>
      <Feather name={icon as any} size={14} color={colors.mutedForeground} />
      <Text style={[metaStyles.label, { color: colors.mutedForeground }]}>{label}:</Text>
      <Text style={[metaStyles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const metaStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  label: { fontSize: 13, fontFamily: "Inter_400Regular" },
  value: { fontSize: 13, fontFamily: "Inter_500Medium" },
});

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
    },
    backBtn: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
    headerTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" as const },
    scoreCard: {
      borderRadius: 20,
      alignItems: "center",
      padding: 32,
      gap: 10,
      marginBottom: 20,
    },
    scoreNum: { fontSize: 52, fontFamily: "Inter_700Bold", color: "#FFF" },
    scoreLabel: { fontSize: 15, color: "rgba(255,255,255,0.9)", fontFamily: "Inter_500Medium" },
    meta: { marginBottom: 16 },
    aiCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      marginBottom: 16,
    },
    aiHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    aiTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    aiText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, marginBottom: 10 },
    aiScores: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    aiScoreItem: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
    aiScoreKey: { fontSize: 11, fontFamily: "Inter_400Regular" },
    aiScoreVal: { fontSize: 15, fontFamily: "Inter_700Bold" },
    sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
    answerCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
    answerQ: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 },
    answerText: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 8 },
    answerResult: { flexDirection: "row", alignItems: "center", borderRadius: 8, padding: 8, gap: 6 },
    answerResultText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    answerCorrect: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
    homeBtn: { borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", marginTop: 16 },
    homeBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
