import { createFileRoute } from "@tanstack/react-router";
import AssignmentTakePage from "@/pages/assignment-take";

export const Route = createFileRoute("/_auth/assignments/$id_/take")({
  component: AssignmentTakePage,
});
