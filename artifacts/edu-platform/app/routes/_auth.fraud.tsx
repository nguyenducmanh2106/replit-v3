import { createFileRoute } from "@tanstack/react-router";
import FraudPage from "@/pages/fraud";

export const Route = createFileRoute("/_auth/fraud")({
  component: FraudPage,
});
