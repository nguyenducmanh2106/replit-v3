import { Feather } from "@expo/vector-icons";
import { useGetAssignment, useCreateSubmission } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function AssignmentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const assignmentId = Number(id);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: assignment, isLoading } = useGetAssignment(assignmentId);
  const { mutate: submit, isPending: isSubmitting } = useCreateSubmission();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [String(questionId)]: value }));
  };

  const handleSubmit = () => {
    if (!assignment?.questions) return;
    const answersArr = assignment.questions.map((q) => ({
      questionId: q.question.id,
      answer: answers[String(q.question.id)] ?? "",
    }));
    submit(
      { data: { assignmentId, answers: answersArr } },
      {
        onSuccess: (result) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSubmitted(true);
          setTimeout(() => {
            router.replace(`/submission/${result.id}`);
          }, 500);
        },
        onError: () => {
          Alert.alert("Lỗi", "Không thể nộp bài. Vui lòng thử lại.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  };

  const s = styles(colors);

  if (isLoading) {
    return (
      <View style={[s.centered, { paddingTop: topPad }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={[s.centered, { paddingTop: topPad }]}>
        <Text style={{ color: colors.foreground }}>Không tìm thấy bài tập</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.primary, marginTop: 8 }}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const questions = assignment.questions ?? [];
  const totalAnswered = questions.filter((q) => (answers[String(q.question.id)] ?? "").trim().length > 0).length;
  const progress = questions.length > 0 ? totalAnswered / questions.length : 0;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {assignment.title}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[s.progressBar, { backgroundColor: colors.muted }]}>
        <View style={[s.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
      </View>
      <Text style={[s.progressText, { color: colors.mutedForeground }]}>
        {totalAnswered}/{questions.length} câu đã trả lời
      </Text>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: bottomPad + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {questions.map((aq, idx) => {
          const q = aq.question;
          const userAnswer = answers[String(q.id)] ?? "";

          return (
            <View key={q.id} style={[s.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.questionHeader}>
                <View style={[s.questionNum, { backgroundColor: colors.primary }]}>
                  <Text style={s.questionNumText}>{idx + 1}</Text>
                </View>
                <View style={[s.questionTypeBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[s.questionTypeText, { color: colors.mutedForeground }]}>
                    {q.type === "mcq" ? "Trắc nghiệm" : q.type === "essay" ? "Bài luận" : q.type}
                  </Text>
                </View>
              </View>
              <Text style={[s.questionText, { color: colors.foreground }]}>{q.content}</Text>

              {q.type === "mcq" && q.options && (
                <View style={s.options}>
                  {(q.options as string[]).map((opt, optIdx) => (
                    <Pressable
                      key={optIdx}
                      style={[
                        s.option,
                        { borderColor: userAnswer === opt ? colors.primary : colors.border },
                        userAnswer === opt && { backgroundColor: colors.primary + "10" },
                      ]}
                      onPress={() => handleAnswer(q.id, opt)}
                    >
                      <View style={[s.optionDot, { borderColor: userAnswer === opt ? colors.primary : colors.border }]}>
                        {userAnswer === opt && <View style={[s.optionDotFill, { backgroundColor: colors.primary }]} />}
                      </View>
                      <Text style={[s.optionText, { color: colors.foreground }]}>{opt}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {q.type !== "mcq" && (
                <TextInput
                  style={[s.textInput, { borderColor: userAnswer.length > 0 ? colors.primary : colors.border, color: colors.foreground }]}
                  multiline={q.type === "essay"}
                  numberOfLines={q.type === "essay" ? 5 : 1}
                  placeholder={q.type === "essay" ? "Viết bài luận của bạn..." : "Điền câu trả lời..."}
                  placeholderTextColor={colors.mutedForeground}
                  value={userAnswer}
                  onChangeText={(v) => handleAnswer(q.id, v)}
                  textAlignVertical={q.type === "essay" ? "top" : "center"}
                />
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={[s.submitBar, { borderTopColor: colors.border, paddingBottom: bottomPad + 12, backgroundColor: colors.background }]}>
        <Pressable
          style={[s.submitBtn, { backgroundColor: submitted ? colors.success : colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={isSubmitting || submitted}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Feather name={submitted ? "check-circle" : "send"} size={18} color="#FFF" />
              <Text style={s.submitText}>{submitted ? "Đã nộp!" : "Nộp bài"}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

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
    progressBar: { height: 4, width: "100%" },
    progressFill: { height: 4 },
    progressText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" as const, marginTop: 4, marginBottom: 4 },
    questionCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14 },
    questionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    questionNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    questionNumText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFF" },
    questionTypeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    questionTypeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
    questionText: { fontSize: 15, fontFamily: "Inter_500Medium", lineHeight: 22, marginBottom: 12 },
    options: { gap: 8 },
    option: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 10, padding: 12, gap: 10 },
    optionDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
    optionDotFill: { width: 10, height: 10, borderRadius: 5 },
    optionText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
    textInput: { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 44 },
    submitBar: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12 },
    submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, height: 52, gap: 10 },
    submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  });
