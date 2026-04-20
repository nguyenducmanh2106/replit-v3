import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (!token) {
      setError("Link không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if ((result as any).error) {
        setError((result as any).error.message ?? "Đặt lại mật khẩu thất bại.");
      } else {
        setSuccess(true);
        setTimeout(() => navigate({ to: "/sign-in" }), 2000);
      }
    } catch {
      setError("Đặt lại mật khẩu thất bại. Link có thể đã hết hạn.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-red-600">Link không hợp lệ. Vui lòng yêu cầu đặt lại mật khẩu mới.</p>
          </CardContent>
          <CardFooter>
            <Link to="/forgot-password" className="w-full">
              <Button variant="outline" className="w-full">Quên mật khẩu</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold">E</span>
            </div>
            <span className="text-xl font-bold">EduPlatform</span>
          </div>
          <CardTitle className="text-2xl">Đặt lại mật khẩu</CardTitle>
          <CardDescription>Tạo mật khẩu mới cho tài khoản của bạn</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {success && (
              <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md">
                Đặt lại mật khẩu thành công! Đang chuyển hướng...
              </div>
            )}
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu mới</Label>
              <Input
                id="password"
                type="password"
                placeholder="Tối thiểu 8 ký tự"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Xác nhận mật khẩu</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Nhập lại mật khẩu"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading || success}>
              {loading ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
