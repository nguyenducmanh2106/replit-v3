import { ReactNode } from "react";
import { Link, useLocation } from "@/lib/routing";
import { LayoutDashboard, BookOpen, Library, PenSquare, FileCheck, UserCircle, LogOut, BarChart2, Target, Settings, Trophy, Building2, Link2, ShieldAlert, FolderOpen, Award, Compass, ClipboardList, HardDrive } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useGetMe } from "@workspace/api-client-react";
import { useNavigate } from "@tanstack/react-router";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const navigate = useNavigate();
  const { data: user } = useGetMe();

  const isTeacherOrAdmin = user?.role && ["teacher", "center_admin", "school_admin", "system_admin", "enterprise_admin"].includes(user.role);
  const isSystemAdmin = user?.role === "system_admin";
  const isEnterpriseOrAdmin = user?.role && ["center_admin", "school_admin", "system_admin", "enterprise_admin"].includes(user.role);

  async function handleSignOut() {
    await authClient.signOut();
    navigate({ to: "/sign-in" });
  }

  return (
    <div className="flex h-screen w-full font-['Lexend'] text-sm">
      <aside className="fixed left-0 top-0 h-full flex flex-col p-4 z-40 bg-white border-r border-[#A3B18A]/10 shadow-sm w-64">
        {/* Header - Nature-inspired branding */}
        <div className="border-b border-[#A3B18A]/10 px-2 pb-4 mb-4">
          <h1 className="text-lg font-black text-[#3A5A40] mb-0.5">IELTS Garden</h1>
          <p className="text-stone-400 text-xs">Nurturing Success</p>
        </div>

        {/* Scrollable menu area */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-6">
          {/* Main Menu */}
          <div>
            <p className="text-stone-400 text-xs font-medium uppercase tracking-wider px-2 mb-2">Menu</p>
            <nav className="flex flex-col gap-1">
              <Link
                href="/dashboard"
                className={location === "/dashboard"
                  ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                  : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                }
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/courses"
                className={location.startsWith("/courses")
                  ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                  : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                }
              >
                <BookOpen className="h-4 w-4" />
                <span>Khoá học</span>
              </Link>
              {isTeacherOrAdmin && (
                <Link
                  href="/questions"
                  className={location.startsWith("/questions")
                    ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                    : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                  }
                >
                  <Library className="h-4 w-4" />
                  <span>Ngân hàng câu hỏi</span>
                </Link>
              )}
              {isTeacherOrAdmin && (
                <Link
                  href="/quiz-templates"
                  className={location.startsWith("/quiz-templates")
                    ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                    : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                  }
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Kho Quiz nguồn</span>
                </Link>
              )}
              <Link
                href="/media"
                className={location.startsWith("/media")
                  ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                  : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                }
              >
                <HardDrive className="h-4 w-4" />
                <span>Media Manager</span>
              </Link>
              <Link
                href="/assignments"
                className={location.startsWith("/assignments")
                  ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                  : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                }
              >
                <PenSquare className="h-4 w-4" />
                <span>Bài tập</span>
              </Link>
              {isTeacherOrAdmin && (
                <Link
                  href="/placement-tests"
                  className={location.startsWith("/placement-tests")
                    ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                    : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                  }
                >
                  <ClipboardList className="h-4 w-4" />
                  <span>Bài test đầu vào</span>
                </Link>
              )}
              <Link
                href="/submissions"
                className={location.startsWith("/submissions")
                  ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                  : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                }
              >
                <FileCheck className="h-4 w-4" />
                <span>Bài nộp</span>
              </Link>
              <Link
                href="/reports"
                className={location.startsWith("/reports")
                  ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                  : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                }
              >
                <BarChart2 className="h-4 w-4" />
                <span>Báo cáo</span>
              </Link>
              {isTeacherOrAdmin && (
                <Link
                  href="/rubrics"
                  className={location.startsWith("/rubrics")
                    ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                    : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                  }
                >
                  <Target className="h-4 w-4" />
                  <span>Rubric</span>
                </Link>
              )}
              {isSystemAdmin && (
                <Link
                  href="/system"
                  className={location.startsWith("/system")
                    ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                    : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                  }
                >
                  <Settings className="h-4 w-4" />
                  <span>Cài đặt hệ thống</span>
                </Link>
              )}
              <Link
                href="/certificates"
                className={location.startsWith("/certificates")
                  ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                  : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                }
              >
                <Award className="h-4 w-4" />
                <span>Chứng chỉ</span>
              </Link>
              <Link
                href="/catalog"
                className={location.startsWith("/catalog")
                  ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                  : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                }
              >
                <Compass className="h-4 w-4" />
                <span>Khám phá khóa học</span>
              </Link>
              <Link
                href="/profile"
                className={location === "/profile"
                  ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                  : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                }
              >
                <UserCircle className="h-4 w-4" />
                <span>Hồ sơ</span>
              </Link>
            </nav>
          </div>

          {/* Features Section */}
          <div>
            <p className="text-stone-400 text-xs font-medium uppercase tracking-wider px-2 mb-2">Tính năng</p>
            <nav className="flex flex-col gap-1">
              <Link
                href="/gamification"
                className={location === "/gamification"
                  ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                  : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                }
              >
                <Trophy className="h-4 w-4" />
                <span>Gamification</span>
              </Link>
              {isTeacherOrAdmin && (
                <Link
                  href="/fraud"
                  className={location.startsWith("/fraud")
                    ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                    : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                  }
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>Phát hiện gian lận</span>
                </Link>
              )}
              {isEnterpriseOrAdmin && (
                <Link
                  href="/enterprise"
                  className={location === "/enterprise"
                    ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                    : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                  }
                >
                  <Building2 className="h-4 w-4" />
                  <span>Enterprise HR</span>
                </Link>
              )}
              {isEnterpriseOrAdmin && (
                <Link
                  href="/lms"
                  className={location === "/lms"
                    ? "flex items-center gap-3 bg-[#E9EDC9] text-[#3A5A40] rounded-lg px-4 py-3 font-semibold shadow-inner"
                    : "flex items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
                  }
                >
                  <Link2 className="h-4 w-4" />
                  <span>LMS Integration</span>
                </Link>
              )}
            </nav>
          </div>
        </div>

        {/* Footer with user info and sign out */}
        <div className="pt-4 border-t border-[#A3B18A]/10 px-2 mt-4">
          {user && (
            <div className="px-2 py-2 mb-2">
              <p className="text-sm font-semibold text-[#3A5A40] truncate">{user.name}</p>
              <p className="text-xs text-stone-400 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 text-stone-500 px-4 py-3 hover:bg-stone-50 hover:text-[#3A5A40] rounded-lg transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="ml-64 flex-1 overflow-y-auto bg-[#FAFDF6]">
        <div className="container p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
