import { useState } from "react";
import { useListFraudEvents, useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-yellow-100 text-yellow-700",
  medium: "bg-orange-100 text-orange-700",
  high: "bg-red-100 text-red-700",
};

const SEVERITY_LABELS: Record<string, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  tab_switch: "Chuyển tab",
  copy_paste: "Copy-Paste",
  rapid_completion: "Làm quá nhanh",
  idle_too_long: "Không hoạt động",
  multiple_tab_switches: "Nhiều lần chuyển tab",
};

function formatDate(iso: string) {
  try { return format(parseISO(iso), "dd/MM/yyyy HH:mm"); } catch { return iso; }
}

export default function FraudPage() {
  const { data: user } = useGetMe();
  const { data: events, isLoading } = useListFraudEvents();
  const [search, setSearch] = useState("");

  const filtered = (events ?? []).filter((e) =>
    !search ||
    e.studentName.toLowerCase().includes(search.toLowerCase()) ||
    e.assignmentTitle.toLowerCase().includes(search.toLowerCase())
  );

  const highCount = (events ?? []).filter(e => e.severity === "high").length;
  const medCount = (events ?? []).filter(e => e.severity === "medium").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Phát hiện gian lận</h1>
        <p className="text-muted-foreground mt-1">Giám sát và phát hiện hành vi bất thường trong các bài thi</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="pt-5">
            <p className="text-2xl font-bold text-gray-900">{events?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Tổng sự kiện</p>
          </CardContent>
        </Card>
        <Card className="text-center border-red-100">
          <CardContent className="pt-5">
            <p className="text-2xl font-bold text-red-600">{highCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Mức độ cao</p>
          </CardContent>
        </Card>
        <Card className="text-center border-orange-100">
          <CardContent className="pt-5">
            <p className="text-2xl font-bold text-orange-600">{medCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Trung bình</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Danh sách sự kiện</CardTitle>
            <Input
              placeholder="Tìm học viên hoặc bài thi…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-4xl mb-3">🛡️</p>
              <p className="font-medium">Không có sự kiện gian lận</p>
              <p className="text-sm mt-1">Hệ thống sẽ ghi nhận khi phát hiện hành vi bất thường</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 p-3 rounded-xl border bg-white"
                >
                  <div className="w-8 text-center text-xl">
                    {event.severity === "high" ? "🚨" : event.severity === "medium" ? "⚠️" : "ℹ️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{event.studentName}</p>
                      <Badge className={`${SEVERITY_COLORS[event.severity] ?? "bg-gray-100 text-gray-700"} border-0 text-xs`}>
                        {SEVERITY_LABELS[event.severity] ?? event.severity}
                      </Badge>
                      <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                        {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {event.assignmentTitle}
                      {event.details && ` · ${event.details}`}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(event.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="pt-4">
          <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Các loại sự kiện được giám sát</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-blue-800">
            <div>• <strong>Chuyển tab:</strong> Học viên rời khỏi trang thi</div>
            <div>• <strong>Copy-Paste:</strong> Phát hiện dán văn bản từ bên ngoài</div>
            <div>• <strong>Làm quá nhanh:</strong> Hoàn thành bài trong thời gian không hợp lý</div>
            <div>• <strong>Không hoạt động:</strong> Ngừng làm bài quá lâu</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
