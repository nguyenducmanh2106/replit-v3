import { createFileRoute } from "@tanstack/react-router";
import LmsPage from "@/pages/lms";

export const Route = createFileRoute("/_auth/lms")({
  component: LmsPage,
});
