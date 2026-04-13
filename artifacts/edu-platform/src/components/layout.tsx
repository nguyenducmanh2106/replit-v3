import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@/components/ui/sidebar";
import { LayoutDashboard, BookOpen, Library, PenSquare, FileCheck, UserCircle, LogOut, BarChart2, Target, Settings, Trophy, Building2, Link2, ShieldAlert, FolderOpen } from "lucide-react";
import { useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { data: user } = useGetMe();

  const isTeacherOrAdmin = user?.role && ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"].includes(user.role);
  const isSystemAdmin = user?.role === "system_admin";
  const isEnterpriseOrAdmin = user?.role && ["center_admin", "school_admin", "system_admin", "enterprise_admin"].includes(user.role);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gray-50">
        <Sidebar className="border-r border-gray-200">
          <SidebarHeader className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-bold text-primary">EduPlatform</h2>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/dashboard"}>
                      <Link href="/dashboard" className="flex items-center gap-3">
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Tổng quan</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/courses")}>
                      <Link href="/courses" className="flex items-center gap-3">
                        <BookOpen className="h-4 w-4" />
                        <span>Khoá học</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isTeacherOrAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/questions")}>
                        <Link href="/questions" className="flex items-center gap-3">
                          <Library className="h-4 w-4" />
                          <span>Ngân hàng câu hỏi</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isTeacherOrAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/quiz-templates")}>
                        <Link href="/quiz-templates" className="flex items-center gap-3">
                          <FolderOpen className="h-4 w-4" />
                          <span>Kho Quiz nguồn</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/assignments")}>
                      <Link href="/assignments" className="flex items-center gap-3">
                        <PenSquare className="h-4 w-4" />
                        <span>Bài tập</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/submissions")}>
                      <Link href="/submissions" className="flex items-center gap-3">
                        <FileCheck className="h-4 w-4" />
                        <span>Bài nộp</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/reports")}>
                      <Link href="/reports" className="flex items-center gap-3">
                        <BarChart2 className="h-4 w-4" />
                        <span>Báo cáo</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isTeacherOrAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/rubrics")}>
                        <Link href="/rubrics" className="flex items-center gap-3">
                          <Target className="h-4 w-4" />
                          <span>Rubric</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isSystemAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/system")}>
                        <Link href="/system" className="flex items-center gap-3">
                          <Settings className="h-4 w-4" />
                          <span>Cài đặt hệ thống</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/profile"}>
                      <Link href="/profile" className="flex items-center gap-3">
                        <UserCircle className="h-4 w-4" />
                        <span>Hồ sơ</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Tính năng mới</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/gamification"}>
                      <Link href="/gamification" className="flex items-center gap-3">
                        <Trophy className="h-4 w-4" />
                        <span>Gamification</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isTeacherOrAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/fraud")}>
                        <Link href="/fraud" className="flex items-center gap-3">
                          <ShieldAlert className="h-4 w-4" />
                          <span>Phát hiện gian lận</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isEnterpriseOrAdmin && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/enterprise"}>
                          <Link href="/enterprise" className="flex items-center gap-3">
                            <Building2 className="h-4 w-4" />
                            <span>Enterprise HR</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/lms"}>
                          <Link href="/lms" className="flex items-center gap-3">
                            <Link2 className="h-4 w-4" />
                            <span>LMS Integration</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <div className="mt-auto p-4 border-t border-gray-200">
            {user && (
              <div className="px-2 py-2 mb-2">
                <p className="text-xs font-medium text-gray-700 truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            )}
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        </Sidebar>
        <main className="flex-1 overflow-y-auto bg-gray-50/50">
          <div className="container mx-auto p-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
