import { createFileRoute } from "@tanstack/react-router";
import EnterprisePage from "@/pages/enterprise";

export const Route = createFileRoute("/_auth/enterprise")({
  component: EnterprisePage,
});
