import { useState } from "react";
import { useGetLmsStatus, useSyncLms } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Provider = "moodle" | "google_classroom";

function StatusBadge({ connected }: { connected: boolean }) {
  return connected
    ? <Badge className="bg-green-100 text-green-700 border-0">Đã kết nối</Badge>
    : <Badge className="bg-gray-100 text-gray-600 border-0">Chưa cấu hình</Badge>;
}

function ProviderCard({
  name,
  icon,
  provider,
  status,
  lastSync,
  onSync,
  isSyncing,
}: {
  name: string;
  icon: string;
  provider: Provider;
  status: { connected: boolean; lastSync?: string | null };
  lastSync: string | null;
  onSync: (provider: Provider) => void;
  isSyncing: boolean;
}) {
  return (
    <Card className={`border-2 transition-all ${status.connected ? "border-green-100" : "border-gray-100"}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900">{name}</h3>
              <StatusBadge connected={status.connected} />
            </div>
          </div>
        </div>

        {status.lastSync && (
          <p className="text-xs text-muted-foreground mb-3">
            Đồng bộ lần cuối: {new Date(status.lastSync).toLocaleString("vi-VN")}
          </p>
        )}

        {!status.connected && (
          <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-xs text-amber-700">
              {provider === "moodle"
                ? "Cần cấu hình MOODLE_URL và MOODLE_TOKEN trong biến môi trường để kết nối."
                : "Cần cấu hình Google Classroom OAuth (GOOGLE_CLASSROOM_CLIENT_ID) để kết nối."}
            </p>
          </div>
        )}

        <Button
          onClick={() => onSync(provider)}
          disabled={isSyncing}
          variant={status.connected ? "default" : "outline"}
          className="w-full"
          size="sm"
        >
          {isSyncing ? "Đang đồng bộ…" : "🔄 Đồng bộ ngay"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function LmsPage() {
  const { data: status, isLoading, refetch } = useGetLmsStatus();
  const { mutateAsync: syncLms } = useSyncLms();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState<Provider | null>(null);

  const handleSync = async (provider: Provider) => {
    setSyncing(provider);
    try {
      const result = await syncLms({ data: { provider } });
      toast({
        title: result.status === "success" ? "Đồng bộ thành công" : "Đồng bộ một phần",
        description: `${result.coursesSynced} khoá học, ${result.studentsSynced} học viên, ${result.gradesSynced} điểm số đã đồng bộ.`,
      });
      if (result.errors.length > 0) {
        toast({
          title: "Lưu ý",
          description: result.errors.join("; "),
          variant: "destructive",
        });
      }
      refetch();
    } catch {
      toast({
        title: "Lỗi đồng bộ",
        description: "Không thể kết nối với hệ thống LMS. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tích hợp LMS</h1>
        <p className="text-muted-foreground mt-1">Kết nối và đồng bộ với Moodle & Google Classroom</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : status ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ProviderCard
            name="Moodle LMS"
            icon="🎓"
            provider="moodle"
            status={status.moodle}
            lastSync={status.moodle.lastSync ?? null}
            onSync={handleSync}
            isSyncing={syncing === "moodle"}
          />
          <ProviderCard
            name="Google Classroom"
            icon="📚"
            provider="google_classroom"
            status={status.googleClassroom}
            lastSync={status.googleClassroom.lastSync ?? null}
            onSync={handleSync}
            isSyncing={syncing === "google_classroom"}
          />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hướng dẫn tích hợp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h4 className="font-semibold text-blue-900 mb-2">🎓 Moodle</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Vào Admin → Plugins → Web services → Manage tokens</li>
              <li>Tạo token và cài vào biến môi trường MOODLE_TOKEN</li>
              <li>Thêm URL Moodle của bạn vào MOODLE_URL</li>
            </ul>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-100">
            <h4 className="font-semibold text-green-900 mb-2">📚 Google Classroom</h4>
            <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
              <li>Tạo OAuth credentials tại Google Cloud Console</li>
              <li>Bật Classroom API và cài GOOGLE_CLASSROOM_CLIENT_ID</li>
              <li>Thêm redirect URI vào cấu hình OAuth</li>
            </ul>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
            <h4 className="font-semibold text-purple-900 mb-2">🔄 Đồng bộ dữ liệu</h4>
            <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
              <li>Khoá học và học viên sẽ được đồng bộ hai chiều</li>
              <li>Điểm số từ EduPlatform được đẩy lên LMS tự động</li>
              <li>Lịch học và deadline từ LMS sẽ hiển thị trong Dashboard</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
