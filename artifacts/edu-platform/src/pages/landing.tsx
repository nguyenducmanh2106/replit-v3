import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b border-gray-100 py-4 px-6 flex justify-between items-center bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold">E</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">EduPlatform</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="font-medium text-gray-600">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="font-medium">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
            The modern classroom,<br />
            <span className="text-primary">reimagined.</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            A precise, powerful, and beautifully designed learning management system built for Vietnamese educators and students.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/sign-up">
              <Button size="lg" className="text-lg px-8 h-14 w-full sm:w-auto">Start Learning</Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="text-lg px-8 h-14 w-full sm:w-auto border-gray-200">Log In</Button>
            </Link>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left">
          <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
            <div className="w-12 h-12 rounded-lg bg-blue-100 text-primary flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Course Management</h3>
            <p className="text-gray-600">Organize courses, students, and materials with unprecedented clarity and ease.</p>
          </div>
          <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
            <div className="w-12 h-12 rounded-lg bg-green-100 text-success flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Automated Assessments</h3>
            <p className="text-gray-600">Rich question banks, customizable exams, and instant grading for objective questions.</p>
          </div>
          <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
            <div className="w-12 h-12 rounded-lg bg-amber-100 text-warning flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Actionable Insights</h3>
            <p className="text-gray-600">Detailed analytics on student performance across all core skills: reading, writing, listening, speaking.</p>
          </div>
        </div>
      </main>
    </div>
  );
}