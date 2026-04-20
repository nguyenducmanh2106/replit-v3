import { createFileRoute } from "@tanstack/react-router";
import GamificationPage from "@/pages/gamification";

export const Route = createFileRoute("/_auth/gamification")({
  component: GamificationPage,
});
