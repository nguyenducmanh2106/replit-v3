// Lightweight fetch wrapper for placement test endpoints.
// Uses same-origin cookies (vite proxies /api to api-server).

async function req<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch { /* noop */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ===== Types =====
export type PlacementTest = {
  id: number;
  title: string;
  description: string | null;
  instructions: string | null;
  status: "draft" | "active" | "closed";
  timeLimitMinutes: number | null;
  maxScore: number;
  passScore: number | null;
  showScoreImmediately: boolean;
  allowRetake: boolean;
  linkSlug: string;
  linkActive: boolean;
  linkExpiresAt: string | null;
  notifyTeacherEmail: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PlacementTestListItem = PlacementTest & {
  submissionCount: number;
  pendingCount: number;
};

export type PlacementTestQuestion = {
  id: number;
  testId: number;
  orderIndex: number;
  sourceType: "quiz" | "bank" | "custom";
  sourceId: number | null;
  type: string;
  content: string;
  options: unknown;
  correctAnswer: string | null;
  points: number;
};

export type PlacementSubmission = {
  id: number;
  testId: number;
  studentName: string;
  studentEmail: string;
  startedAt: string;
  submittedAt: string | null;
  autoScore: number | null;
  manualScore: number | null;
  totalScore: number | null;
  gradingStatus: "pending" | "graded";
  teacherComment: string | null;
  gradedAt: string | null;
  gradedBy: number | null;
  resultSentAt: string | null;
  createdAt: string;
};

export type PlacementAnswer = {
  id: number;
  submissionId: number;
  questionId: number;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  autoScore: number | null;
  manualScore: number | null;
  teacherComment: string | null;
  answeredAt: string;
};

// ===== Teacher API =====
export const placementApi = {
  list: () => req<PlacementTestListItem[]>("/placement-tests"),
  get: (id: number) => req<PlacementTest & { questions: PlacementTestQuestion[] }>(`/placement-tests/${id}`),
  create: (data: { title: string; description?: string; instructions?: string; timeLimitMinutes?: number | null; passScore?: number | null; showScoreImmediately?: boolean; allowRetake?: boolean; notifyTeacherEmail?: boolean }) =>
    req<PlacementTest>("/placement-tests", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, patch: Partial<PlacementTest>) =>
    req<PlacementTest>(`/placement-tests/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: number) => req<void>(`/placement-tests/${id}`, { method: "DELETE" }),
  publish: (id: number) => req<PlacementTest & { publicUrl: string }>(`/placement-tests/${id}/publish`, { method: "POST" }),

  addQuestion: (testId: number, q: { type: string; content: string; options?: unknown; correctAnswer?: string | null; points?: number; sourceType?: string; sourceId?: number | null }) =>
    req<PlacementTestQuestion>(`/placement-tests/${testId}/questions`, { method: "POST", body: JSON.stringify(q) }),
  bulkImport: (testId: number, questionIds: number[]) =>
    req<{ imported: number; questions: PlacementTestQuestion[] }>(`/placement-tests/${testId}/questions/bulk-import`, { method: "POST", body: JSON.stringify({ questionIds }) }),
  updateQuestion: (qid: number, patch: Partial<PlacementTestQuestion>) =>
    req<PlacementTestQuestion>(`/placement-test-questions/${qid}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteQuestion: (qid: number) => req<void>(`/placement-test-questions/${qid}`, { method: "DELETE" }),
  reorder: (testId: number, questionIds: number[]) =>
    req<{ ok: true }>(`/placement-tests/${testId}/questions/reorder`, { method: "POST", body: JSON.stringify({ questionIds }) }),

  listSubmissions: (testId: number) => req<PlacementSubmission[]>(`/placement-tests/${testId}/submissions`),
  getSubmission: (sid: number) => req<{ submission: PlacementSubmission; test: PlacementTest; questions: PlacementTestQuestion[]; answers: PlacementAnswer[] }>(`/placement-submissions/${sid}`),
  gradeSubmission: (sid: number, data: { teacherComment?: string | null; answerGrades?: Array<{ answerId: number; manualScore?: number | null; teacherComment?: string | null }> }) =>
    req<PlacementSubmission>(`/placement-submissions/${sid}/grade`, { method: "PATCH", body: JSON.stringify(data) }),
  sendResult: (sid: number) => req<PlacementSubmission>(`/placement-submissions/${sid}/send-result`, { method: "POST" }),
};

// ===== Public (student) API =====
export const placementPublicApi = {
  getBySlug: (slug: string) => req<{
    id: number; title: string; description: string | null; instructions: string | null;
    timeLimitMinutes: number | null; maxScore: number; passScore: number | null;
    questionCount: number;
    questions: Array<Pick<PlacementTestQuestion, "id" | "orderIndex" | "type" | "content" | "options" | "points">>;
  }>(`/public/placement-tests/${slug}`),
  start: (slug: string, studentName: string, studentEmail: string) =>
    req<{ submissionId: number; token: string }>(`/public/placement-tests/${slug}/start`, {
      method: "POST", body: JSON.stringify({ studentName, studentEmail }),
    }),
  submit: (sid: number, token: string, answers: Array<{ questionId: number; answer: string | null }>) =>
    req<{ submissionId: number; submittedAt: string; autoScore: number; maxScore: number; showScore: boolean; gradingStatus: string }>(`/public/placement-submissions/${sid}/submit`, {
      method: "POST", body: JSON.stringify({ token, answers }),
    }),
};
