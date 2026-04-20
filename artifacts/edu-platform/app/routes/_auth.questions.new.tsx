import { createFileRoute } from "@tanstack/react-router";
import QuestionFormPage from "@/pages/question-form";

export const Route = createFileRoute("/_auth/questions/new")({
  component: QuestionFormPage,
});
