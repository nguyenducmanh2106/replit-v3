import { useState } from "react";
import { useLocation } from "wouter";
import { useUpdateMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ROLES = [
  {
    value: "teacher",
    label: "Giáo viên",
    description: "Tạo bài thi, quản lý lớp học và theo dõi kết quả học sinh",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    value: "student",
    label: "Học sinh",
    description: "Tham gia các khóa học, làm bài kiểm tra và xem kết quả",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    value: "center_admin",
    label: "Quản lý Trung tâm",
    description: "Quản lý trung tâm ngoại ngữ, giáo viên và học viên",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    value: "school_admin",
    label: "Quản lý Trường học",
    description: "Quản lý trường K-12, giáo viên, học sinh và chương trình học",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    ),
  },
  {
    value: "enterprise_admin",
    label: "Doanh nghiệp",
    description: "Quản lý đào tạo nhân viên và chương trình học tại doanh nghiệp",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function OnboardingPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { mutate: updateMe, isPending } = useUpdateMe();

  function handleContinue() {
    if (!selected) return;
    updateMe(
      { data: { role: selected } },
      { onSuccess: () => navigate("/dashboard") }
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-6">
            <span className="text-white font-extrabold text-2xl">E</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Chào mừng đến EduPlatform</h1>
          <p className="mt-3 text-lg text-gray-500">Bạn sử dụng nền tảng với tư cách nào?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {ROLES.map((role) => (
            <button
              key={role.value}
              onClick={() => setSelected(role.value)}
              className={cn(
                "group relative text-left p-6 rounded-2xl border-2 transition-all duration-150 focus:outline-none",
                selected === role.value
                  ? "border-primary bg-blue-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-primary/40 hover:shadow-sm"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
                selected === role.value ? "bg-primary text-white" : "bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-primary"
              )}>
                {role.icon}
              </div>
              <h3 className={cn(
                "font-semibold text-base mb-1",
                selected === role.value ? "text-primary" : "text-gray-900"
              )}>
                {role.label}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{role.description}</p>
              {selected === role.value && (
                <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            disabled={!selected || isPending}
            onClick={handleContinue}
            className="px-12 h-12 text-base font-semibold"
          >
            {isPending ? "Đang lưu..." : "Tiếp tục"}
          </Button>
        </div>
      </div>
    </div>
  );
}
