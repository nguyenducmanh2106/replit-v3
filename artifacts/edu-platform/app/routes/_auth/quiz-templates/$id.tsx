import { createFileRoute } from "@tanstack/react-router";
import QuizTemplateDetailPage from "@/pages/quiz-template-detail";

export const Route = createFileRoute("/_auth/quiz-templates/$id")({
  component: QuizTemplateDetailPage,
});
