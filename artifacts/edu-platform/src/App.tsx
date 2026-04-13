import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClientProvider, useQueryClient, QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import LandingPage from "./pages/landing";
import OnboardingPage from "./pages/onboarding";
import DashboardPage from "./pages/dashboard";
import CoursesPage from "./pages/courses";
import CourseDetailPage from "./pages/course-detail";
import QuestionsPage from "./pages/questions";
import QuestionFormPage from "./pages/question-form";
import AssignmentsPage from "./pages/assignments";
import AssignmentDetailPage from "./pages/assignment-detail";
import AssignmentTakePage from "./pages/assignment-take";
import SubmissionsPage from "./pages/submissions";
import SubmissionDetailPage from "./pages/submission-detail";
import ReportsPage from "./pages/reports";
import RubricsPage from "./pages/rubrics";
import SystemSettingsPage from "./pages/system-settings";
import ProfilePage from "./pages/profile";
import GamificationPage from "./pages/gamification";
import EnterprisePage from "./pages/enterprise";
import LmsPage from "./pages/lms";
import FraudPage from "./pages/fraud";
import QuizTemplatesPage from "./pages/quiz-templates";
import QuizTemplateDetailPage from "./pages/quiz-template-detail";
import NotFound from "./pages/not-found";
import { AppLayout } from "./components/layout";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) queryClient.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}

function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <AppLayout>
          <Component />
        </AppLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function TakeAssignmentRoute({ component: Component }: { component: ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingPage} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/courses" component={() => <ProtectedRoute component={CoursesPage} />} />
      <Route path="/courses/:id" component={() => <ProtectedRoute component={CourseDetailPage} />} />
      <Route path="/questions" component={() => <ProtectedRoute component={QuestionsPage} />} />
      <Route path="/questions/new" component={() => <ProtectedRoute component={QuestionFormPage} />} />
      <Route path="/questions/:id/edit" component={() => <ProtectedRoute component={QuestionFormPage} />} />
      <Route path="/assignments" component={() => <ProtectedRoute component={AssignmentsPage} />} />
      <Route path="/assignments/:id" component={() => <ProtectedRoute component={AssignmentDetailPage} />} />
      <Route path="/assignments/:id/take" component={() => <TakeAssignmentRoute component={AssignmentTakePage} />} />
      <Route path="/submissions" component={() => <ProtectedRoute component={SubmissionsPage} />} />
      <Route path="/submissions/:id" component={() => <ProtectedRoute component={SubmissionDetailPage} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} />} />
      <Route path="/rubrics" component={() => <ProtectedRoute component={RubricsPage} />} />
      <Route path="/system" component={() => <ProtectedRoute component={SystemSettingsPage} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
      <Route path="/gamification" component={() => <ProtectedRoute component={GamificationPage} />} />
      <Route path="/enterprise" component={() => <ProtectedRoute component={EnterprisePage} />} />
      <Route path="/lms" component={() => <ProtectedRoute component={LmsPage} />} />
      <Route path="/fraud" component={() => <ProtectedRoute component={FraudPage} />} />
      <Route path="/quiz-templates" component={() => <ProtectedRoute component={QuizTemplatesPage} />} />
      <Route path="/quiz-templates/:id" component={() => <ProtectedRoute component={QuizTemplateDetailPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <ClerkQueryClientCacheInvalidator />
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
