import { useState } from "react";
import { useListSystemUsers, useUpdateSystemUser, useGetSystemSettings, useUpsertSystemSetting, useGetAuditLog } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, Settings, Users, ClipboardList, Edit2 } from "lucide-react";
import { format, parseISO } from "date-fns";

const ROLE_OPTIONS = [
  { value: "student", label: "Học sinh" },
  { value: "teacher", label: "Giáo viên" },
  { value: "center_admin", label: "Quản lý Trung tâm" },
  { value: "school_admin", label: "Quản lý Trường" },
  { value: "enterprise_admin", label: "Quản lý Doanh nghiệp" },
  { value: "system_admin", label: "Quản trị hệ thống" },
];

const ROLE_COLORS: Record<string, string> = {
  student: "bg-blue-100 text-blue-700",
  teacher: "bg-green-100 text-green-700",
  center_admin: "bg-purple-100 text-purple-700",
  school_admin: "bg-indigo-100 text-indigo-700",
  enterprise_admin: "bg-orange-100 text-orange-700",
  system_admin: "bg-red-100 text-red-700",
};

function UsersTab() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editUser, setEditUser] = useState<{ id: number; name: string; email: string; role: string; organization?: string | null } | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editName, setEditName] = useState("");
  const [editOrg, setEditOrg] = useState("");

  const { data: users, isLoading } = useListSystemUsers({ role: roleFilter === "all" ? undefined : roleFilter, search: search || undefined });
  const { mutateAsync: updateUser } = useUpdateSystemUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  async function handleSaveEdit() {
    if (!editUser) return;
    try {
      await updateUser({ id: editUser.id, data: { role: editRole, name: editName, organization: editOrg || undefined } });
      await queryClient.invalidateQueries({ queryKey: ["/api/system/users"] });
      toast({ title: "Đã cập nhật người dùng" });
      setEditUser(null);
    } catch {
      toast({ title: "Lỗi", description: "Không thể cập nhật", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tìm tên hoặc email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả vai trò</SelectItem>
            {ROLE_OPTIONS.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {(users ?? []).map(u => (
                <div key={u.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    {u.organization && <p className="text-xs text-muted-foreground">{u.organization}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs border-0 ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_OPTIONS.find(r => r.value === u.role)?.label ?? u.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditUser(u);
                        setEditRole(u.role);
                        setEditName(u.name);
                        setEditOrg(u.organization ?? "");
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(users ?? []).length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">Không tìm thấy người dùng</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa người dùng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tên</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vai trò</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tổ chức</Label>
              <Input value={editOrg} onChange={e => setEditOrg(e.target.value)} placeholder="Tuỳ chọn" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Huỷ</Button>
            <Button onClick={handleSaveEdit}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DEFAULT_SETTINGS = [
  { key: "grading_scale", label: "Thang điểm", description: "Thang điểm tối đa (VD: 100)", defaultValue: "100" },
  { key: "pass_threshold", label: "Điểm đạt", description: "Phần trăm tối thiểu để đạt", defaultValue: "50" },
  { key: "email_notifications", label: "Thông báo email", description: "Bật/tắt thông báo email (true/false)", defaultValue: "true" },
  { key: "max_submission_per_assignment", label: "Số lần nộp tối đa", description: "Số lần nộp tối đa mỗi bài", defaultValue: "1" },
  { key: "assignment_late_policy", label: "Chính sách nộp muộn", description: "none | warning | deduct", defaultValue: "warning" },
];

function SettingsTab() {
  const { data: settings, isLoading } = useGetSystemSettings();
  const { mutateAsync: upsertSetting } = useUpsertSystemSetting();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]));

  async function handleSave(key: string, description?: string) {
    try {
      await upsertSetting({ data: { key, value: editValue, description } });
      await queryClient.invalidateQueries({ queryKey: ["/api/system/settings"] });
      toast({ title: "Đã lưu cài đặt" });
      setEditingKey(null);
    } catch {
      toast({ title: "Lỗi", description: "Không thể lưu cài đặt", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      {isLoading && <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}
      <Card>
        <CardContent className="p-0 divide-y divide-gray-100">
          {DEFAULT_SETTINGS.map(s => {
            const currentValue = settingsMap[s.key] ?? s.defaultValue;
            const isEditing = editingKey === s.key;
            return (
              <div key={s.key} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-40 h-8 text-sm"
                        onKeyDown={e => { if (e.key === "Enter") handleSave(s.key, s.description); }}
                      />
                      <Button size="sm" onClick={() => handleSave(s.key, s.description)}>Lưu</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>Huỷ</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{currentValue}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditingKey(s.key); setEditValue(currentValue); }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditLogTab() {
  const { data: logs, isLoading } = useGetAuditLog({ limit: 50, offset: 0 });

  const ACTION_LABELS: Record<string, string> = {
    update_user: "Cập nhật người dùng",
    update_setting: "Cập nhật cài đặt",
    delete_course: "Xoá khoá học",
    create_course: "Tạo khoá học",
    grade_submission: "Chấm điểm",
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {(logs ?? []).map(log => (
                <div key={log.id} className="flex items-start justify-between px-5 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{ACTION_LABELS[log.action] ?? log.action}</p>
                      {log.entity && (
                        <Badge variant="outline" className="text-xs">{log.entity}</Badge>
                      )}
                    </div>
                    {log.detail && <p className="text-xs text-muted-foreground mt-0.5">{log.detail}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      bởi {log.userName ?? "Hệ thống"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(parseISO(log.createdAt), "dd/MM HH:mm")}
                  </span>
                </div>
              ))}
              {(logs ?? []).length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">Chưa có lịch sử hoạt động</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SystemSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt hệ thống</h1>
        <p className="text-muted-foreground mt-1">Quản lý người dùng, cài đặt và nhật ký hoạt động</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Người dùng
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5">
            <Settings className="w-4 h-4" /> Cài đặt
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4" /> Nhật ký
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-5"><UsersTab /></TabsContent>
        <TabsContent value="settings" className="mt-5"><SettingsTab /></TabsContent>
        <TabsContent value="audit" className="mt-5"><AuditLogTab /></TabsContent>
      </Tabs>
    </div>
  );
}
