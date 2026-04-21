import { createFileRoute } from "@tanstack/react-router";
import PublicPlacementTestPage from "@/pages/public-placement-test";

export const Route = createFileRoute("/test/$slug")({
  component: PublicPlacementTestPage,
});
