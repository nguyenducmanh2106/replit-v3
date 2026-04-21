import { createFileRoute } from "@tanstack/react-router";
import PlacementSubmissionsPage from "@/pages/placement-submissions";

export const Route = createFileRoute("/_auth/placement-tests/$id_/submissions")({
  component: PlacementSubmissionsPage,
});
