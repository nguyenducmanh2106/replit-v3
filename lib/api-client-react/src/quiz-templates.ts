import { useQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export type QuizTemplateListItem = {
  id: number;
  title: string;
  description?: string | null;
  teacherId: number;
  questionCount: number;
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
};

export type QuizTemplateQuestion = {
  id: number;
  type: string;
  skill: string;
  level: string;
  content: string;
  options?: string | null;
  correctAnswer?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  imageUrl?: string | null;
  passage?: string | null;
  explanation?: string | null;
  metadata?: string | null;
  points: number;
  orderIndex: number;
};

export type QuizTemplateDetail = {
  id: number;
  title: string;
  description?: string | null;
  teacherId: number;
  createdAt: string;
  updatedAt: string;
  questions: QuizTemplateQuestion[];
};

export const getListQuizTemplatesQueryKey = () => ["listQuizTemplates"] as const;

export const listQuizTemplates = async (options?: RequestInit): Promise<QuizTemplateListItem[]> => {
  return customFetch<QuizTemplateListItem[]>("/api/quiz-templates", options);
};

export function useListQuizTemplates<TData = QuizTemplateListItem[], TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<QuizTemplateListItem[], TError, TData> },
) {
  return useQuery<QuizTemplateListItem[], TError, TData>({
    queryKey: getListQuizTemplatesQueryKey(),
    queryFn: () => listQuizTemplates(),
    ...options?.query,
  });
}

export const getQuizTemplateQueryKey = (id: number) => ["quizTemplate", id] as const;

export const getQuizTemplate = async (id: number, options?: RequestInit): Promise<QuizTemplateDetail> => {
  return customFetch<QuizTemplateDetail>(`/api/quiz-templates/${id}`, options);
};

export function useGetQuizTemplate<TData = QuizTemplateDetail, TError = ErrorType<unknown>>(
  id: number,
  options?: { query?: UseQueryOptions<QuizTemplateDetail, TError, TData> },
) {
  return useQuery<QuizTemplateDetail, TError, TData>({
    queryKey: getQuizTemplateQueryKey(id),
    queryFn: () => getQuizTemplate(id),
    enabled: id > 0,
    ...options?.query,
  });
}

export function useCreateQuizTemplate<TError = ErrorType<unknown>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<QuizTemplateListItem, TError, { data: { title: string; description?: string } }, TContext> },
) {
  return useMutation<QuizTemplateListItem, TError, { data: { title: string; description?: string } }, TContext>({
    mutationKey: ["createQuizTemplate"],
    mutationFn: ({ data }) => customFetch<QuizTemplateListItem>("/api/quiz-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    ...options?.mutation,
  });
}

export function useUpdateQuizTemplate<TError = ErrorType<unknown>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<any, TError, { id: number; data: { title?: string; description?: string } }, TContext> },
) {
  return useMutation<any, TError, { id: number; data: { title?: string; description?: string } }, TContext>({
    mutationKey: ["updateQuizTemplate"],
    mutationFn: ({ id, data }) => customFetch(`/api/quiz-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    ...options?.mutation,
  });
}

export function useDeleteQuizTemplate<TError = ErrorType<unknown>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<void, TError, { id: number }, TContext> },
) {
  return useMutation<void, TError, { id: number }, TContext>({
    mutationKey: ["deleteQuizTemplate"],
    mutationFn: ({ id }) => customFetch(`/api/quiz-templates/${id}`, { method: "DELETE" }),
    ...options?.mutation,
  });
}

export function useImportQuestionsToTemplate<TError = ErrorType<unknown>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<{ imported: number }, TError, { id: number; data: { questionIds: number[] } }, TContext> },
) {
  return useMutation<{ imported: number }, TError, { id: number; data: { questionIds: number[] } }, TContext>({
    mutationKey: ["importQuestionsToTemplate"],
    mutationFn: ({ id, data }) => customFetch<{ imported: number }>(`/api/quiz-templates/${id}/import-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    ...options?.mutation,
  });
}

export function useUpdateQuizTemplateQuestion<TError = ErrorType<unknown>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<QuizTemplateQuestion, TError, { templateId: number; questionId: number; data: Partial<QuizTemplateQuestion> }, TContext> },
) {
  return useMutation<QuizTemplateQuestion, TError, { templateId: number; questionId: number; data: Partial<QuizTemplateQuestion> }, TContext>({
    mutationKey: ["updateQuizTemplateQuestion"],
    mutationFn: ({ templateId, questionId, data }) => customFetch<QuizTemplateQuestion>(`/api/quiz-templates/${templateId}/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    ...options?.mutation,
  });
}

export function useDeleteQuizTemplateQuestion<TError = ErrorType<unknown>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<void, TError, { templateId: number; questionId: number }, TContext> },
) {
  return useMutation<void, TError, { templateId: number; questionId: number }, TContext>({
    mutationKey: ["deleteQuizTemplateQuestion"],
    mutationFn: ({ templateId, questionId }) => customFetch(`/api/quiz-templates/${templateId}/questions/${questionId}`, { method: "DELETE" }),
    ...options?.mutation,
  });
}

export function useImportFromTemplate<TError = ErrorType<unknown>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<{ imported: number }, TError, { assignmentId: number; data: { templateId: number } }, TContext> },
) {
  return useMutation<{ imported: number }, TError, { assignmentId: number; data: { templateId: number } }, TContext>({
    mutationKey: ["importFromTemplate"],
    mutationFn: ({ assignmentId, data }) => customFetch<{ imported: number }>(`/api/assignments/${assignmentId}/import-from-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    ...options?.mutation,
  });
}

export function useUpdateAssignmentQuestion<TError = ErrorType<unknown>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<unknown, TError, { assignmentId: number; questionId: number; data: Record<string, unknown> }, TContext> },
) {
  return useMutation<unknown, TError, { assignmentId: number; questionId: number; data: Record<string, unknown> }, TContext>({
    mutationKey: ["updateAssignmentQuestion"],
    mutationFn: ({ assignmentId, questionId, data }) => customFetch(`/api/assignments/${assignmentId}/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    ...options?.mutation,
  });
}
