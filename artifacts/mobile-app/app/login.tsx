import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("student@edu.vn");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message ?? "Đăng nhập thất bại");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[s.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
    >
      <View style={s.header}>
        <View style={s.iconWrap}>
          <Image
            source={require("../assets/images/icon.png")}
            style={s.icon}
            resizeMode="cover"
          />
        </View>
        <Text style={s.title}>EduPlatform</Text>
        <Text style={s.subtitle}>Nền tảng giáo dục thông minh</Text>
      </View>

      <View style={s.form}>
        <View style={s.inputWrap}>
          <Feather name="mail" size={18} color={colors.mutedForeground} style={s.inputIcon} />
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
        </View>
        <View style={s.inputWrap}>
          <Feather name="lock" size={18} color={colors.mutedForeground} style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Mật khẩu"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <Pressable onPress={() => setShowPassword(v => !v)} style={s.eyeBtn}>
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>

        {error && (
          <View style={s.errorBox}>
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        <Pressable
          style={[s.loginBtn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={s.loginBtnText}>Đăng nhập</Text>
          )}
        </Pressable>

        <View style={s.demoHint}>
          <Text style={s.demoHintText}>Tài khoản demo:</Text>
          <Text style={s.demoHintText}>student@edu.vn / demo123</Text>
          <Text style={s.demoHintText}>teacher@edu.vn / demo123</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
    },
    header: {
      alignItems: "center",
      marginBottom: 40,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: 20,
      overflow: "hidden",
      marginBottom: 16,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    icon: {
      width: 80,
      height: 80,
    },
    title: {
      fontSize: 28,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    form: {
      gap: 12,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      height: 52,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    eyeBtn: {
      padding: 4,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
    },
    errorText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    loginBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    loginBtnText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
    demoHint: {
      alignItems: "center",
      marginTop: 16,
      gap: 2,
    },
    demoHintText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
  });
