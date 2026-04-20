import { createFileRoute } from "@tanstack/react-router";
import SubmissionsPage from "@/pages/submissions";

export const Route = createFileRoute("/_auth/submissions/")({
  component: SubmissionsPage,
});
