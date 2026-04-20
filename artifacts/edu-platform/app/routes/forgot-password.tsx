import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if ((result as any).error) {
        setError((result as any).error.message ?? "Không thể gửi email. Thử lại sau.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Không thể gửi email. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white font-bold">E</span>
              </div>
              <span className="text-xl font-bold">EduPlatform</span>
            </div>
            <CardTitle className="text-2xl">Kiểm tra email</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium mb-2">Email đặt lại mật khẩu đã được gửi!</p>
              <p className="text-gray-500 text-sm">
                Chúng tôi đã gửi link đặt lại mật khẩu đến <strong>{email}</strong>.<br />
                Link có hiệu lực trong 1 giờ.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Link to="/sign-in" className="w-full">
              <Button variant="outline" className="w-full">Quay lại đăng nhập</Button>
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
          <CardTitle className="text-2xl">Quên mật khẩu</CardTitle>
          <CardDescription>Nhập email của bạn để nhận link đặt lại mật khẩu</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
            </Button>
            <Link to="/sign-in" className="text-sm text-center text-primary hover:underline">
              Quay lại đăng nhập
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
