import { createFileRoute } from "@tanstack/react-router";
import PlacementGradePage from "@/pages/placement-grade";

export const Route = createFileRoute("/_auth/placement-tests/submissions/$sid")({
  component: PlacementGradePage,
});
