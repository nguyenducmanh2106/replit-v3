import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

const DEMO_USERS: Record<string, { password: string; user: AuthUser; token: string }> = {
  "student@edu.vn": {
    password: "demo123",
    token: "demo-student-token",
    user: { id: 1, name: "Nguyễn Văn An", email: "student@edu.vn", role: "student" },
  },
  "teacher@edu.vn": {
    password: "demo123",
    token: "demo-teacher-token",
    user: { id: 2, name: "Trần Thị Bình", email: "teacher@edu.vn", role: "teacher" },
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("auth_user");
        const storedToken = await AsyncStorage.getItem("auth_token");
        if (stored && storedToken) {
          const u = JSON.parse(stored) as AuthUser;
          setUser(u);
          setToken(storedToken);
          setAuthTokenGetter(() => storedToken);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const entry = DEMO_USERS[email.toLowerCase()];
    if (!entry || entry.password !== password) {
      throw new Error("Email hoặc mật khẩu không đúng");
    }
    await AsyncStorage.setItem("auth_user", JSON.stringify(entry.user));
    await AsyncStorage.setItem("auth_token", entry.token);
    setUser(entry.user);
    setToken(entry.token);
    setAuthTokenGetter(() => entry.token);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("auth_user");
    await AsyncStorage.removeItem("auth_token");
    setUser(null);
    setToken(null);
    setAuthTokenGetter(() => null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
