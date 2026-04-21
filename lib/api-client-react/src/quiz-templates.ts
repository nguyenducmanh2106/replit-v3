import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

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
