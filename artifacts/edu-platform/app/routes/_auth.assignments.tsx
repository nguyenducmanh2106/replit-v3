import { createFileRoute } from "@tanstack/react-router";
import AssignmentsPage from "@/pages/assignments";

export const Route = createFileRoute("/_auth/assignments")({
  component: AssignmentsPage,
});
