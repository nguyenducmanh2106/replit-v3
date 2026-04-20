import { createFileRoute } from "@tanstack/react-router";
import AssignmentDetailPage from "@/pages/assignment-detail";

export const Route = createFileRoute("/_auth/assignments/$id")({
  component: AssignmentDetailPage,
});
