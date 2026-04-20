import { createFileRoute } from "@tanstack/react-router";
import QuizTemplatesPage from "@/pages/quiz-templates";

export const Route = createFileRoute("/_auth/quiz-templates/")({
  component: QuizTemplatesPage,
});
