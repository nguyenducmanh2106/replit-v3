import { createFileRoute } from "@tanstack/react-router";
import SubmissionDetailPage from "@/pages/submission-detail";

export const Route = createFileRoute("/_auth/submissions/$id")({
  component: SubmissionDetailPage,
});
