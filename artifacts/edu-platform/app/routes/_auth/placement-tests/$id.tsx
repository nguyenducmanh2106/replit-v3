import { createFileRoute } from "@tanstack/react-router";
import PlacementTestBuilderPage from "@/pages/placement-test-builder";

export const Route = createFileRoute("/_auth/placement-tests/$id")({
  component: PlacementTestBuilderPage,
});
