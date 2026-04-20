import { createFileRoute } from "@tanstack/react-router";
import QuestionsPage from "@/pages/questions";

export const Route = createFileRoute("/_auth/questions")({
  component: QuestionsPage,
});
