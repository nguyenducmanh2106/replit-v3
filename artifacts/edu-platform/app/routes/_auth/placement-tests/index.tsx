import { createFileRoute } from "@tanstack/react-router";
import PlacementTestsPage from "@/pages/placement-tests";

export const Route = createFileRoute("/_auth/placement-tests/")({
  component: PlacementTestsPage,
});
