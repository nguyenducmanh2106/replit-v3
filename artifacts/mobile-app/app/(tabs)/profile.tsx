import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const ROLE_LABELS: Record<string, string> = {
  student: "Học viên",
  teacher: "Giáo viên",
  center_admin: "Quản trị trung tâm",
  school_admin: "Quản trị trường",
  system_admin: "Quản trị hệ thống",
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const s = styles(colors);

  if (!user) {
    return (
      <View style={[s.container, { paddingTop: topPad }]}>
        <View style={s.loginPrompt}>
          <Feather name="user" size={48} color={colors.mutedForeground} />
          <Text style={s.loginTitle}>Chưa đăng nhập</Text>
          <Pressable style={s.loginBtn} onPress={() => router.push("/login")}>
            <Text style={s.loginBtnText}>Đăng nhập ngay</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[s.container]}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: bottomPad + 80 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.pageTitle}>Hồ sơ</Text>

      <View style={[s.avatarSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.avatar, { backgroundColor: colors.primary }]}>
          <Text style={s.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={s.userInfo}>
          <Text style={[s.userName, { color: colors.foreground }]}>{user.name}</Text>
          <Text style={[s.userEmail, { color: colors.mutedForeground }]}>{user.email}</Text>
          <View style={[s.roleBadge, { backgroundColor: colors.primary + "15" }]}>
            <Text style={[s.roleText, { color: colors.primary }]}>
              {ROLE_LABELS[user.role] ?? user.role}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>TÀI KHOẢN</Text>
      <View style={[s.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem icon="mail" label="Email" value={user.email} colors={colors} />
        <MenuDivider colors={colors} />
        <MenuItem icon="shield" label="Vai trò" value={ROLE_LABELS[user.role] ?? user.role} colors={colors} />
        <MenuDivider colors={colors} />
        <MenuItem icon="hash" label="ID người dùng" value={String(user.id)} colors={colors} />
      </View>

      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>ỨNG DỤNG</Text>
      <View style={[s.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable style={s.menuItem} onPress={() => router.push("/(tabs)")}>
          <Feather name="home" size={18} color={colors.mutedForeground} />
          <Text style={[s.menuLabel, { color: colors.foreground }]}>Trang chủ</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>
        <MenuDivider colors={colors} />
        <Pressable style={s.menuItem} onPress={() => router.push("/(tabs)/assignments")}>
          <Feather name="file-text" size={18} color={colors.mutedForeground} />
          <Text style={[s.menuLabel, { color: colors.foreground }]}>Bài tập của tôi</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>
        <MenuDivider colors={colors} />
        <Pressable style={s.menuItem} onPress={() => router.push("/(tabs)/gamification")}>
          <Feather name="award" size={18} color={colors.mutedForeground} />
          <Text style={[s.menuLabel, { color: colors.foreground }]}>Thành tích</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <Pressable
        style={[s.logoutBtn, { borderColor: colors.destructive + "40" }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[s.logoutText, { color: colors.destructive }]}>Đăng xuất</Text>
      </Pressable>

      <Text style={[s.version, { color: colors.mutedForeground }]}>EduPlatform v1.0.0</Text>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  label,
  value,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={menuItemStyles.wrap}>
      <Feather name={icon as any} size={18} color={colors.mutedForeground} />
      <Text style={[menuItemStyles.label, { color: colors.foreground }]}>{label}</Text>
      <Text style={[menuItemStyles.value, { color: colors.mutedForeground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function MenuDivider({ colors }: { colors: ReturnType<typeof useColors> }) {
  return <View style={[menuItemStyles.divider, { backgroundColor: colors.border }]} />;
}

const menuItemStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  value: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    maxWidth: "45%",
    textAlign: "right" as const,
  },
  divider: {
    height: 1,
    marginLeft: 46,
  },
});

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loginPrompt: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loginTitle: {
      fontSize: 18,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
    },
    loginBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    loginBtnText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    pageTitle: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    avatarSection: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 20,
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      gap: 16,
      marginBottom: 20,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: "#FFF",
    },
    userInfo: {
      flex: 1,
      gap: 4,
    },
    userName: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
    },
    userEmail: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    roleBadge: {
      alignSelf: "flex-start",
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginTop: 4,
    },
    roleText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 1,
      textTransform: "uppercase" as const,
      paddingHorizontal: 20,
      marginBottom: 8,
      marginTop: 4,
    },
    menuCard: {
      marginHorizontal: 20,
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
      marginBottom: 20,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 13,
      gap: 12,
    },
    menuLabel: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_500Medium",
    },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 20,
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 14,
      gap: 8,
      marginBottom: 16,
    },
    logoutText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    version: {
      textAlign: "center" as const,
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      marginBottom: 8,
    },
  });
