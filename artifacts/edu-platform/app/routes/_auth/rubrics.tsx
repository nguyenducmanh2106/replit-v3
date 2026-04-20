import { createFileRoute } from "@tanstack/react-router";
import RubricsPage from "@/pages/rubrics";

export const Route = createFileRoute("/_auth/rubrics")({
  component: RubricsPage,
});
