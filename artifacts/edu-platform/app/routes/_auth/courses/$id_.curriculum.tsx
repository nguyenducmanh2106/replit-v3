import { createFileRoute } from "@tanstack/react-router";
import CurriculumBuilderPage from "@/pages/curriculum-builder";

export const Route = createFileRoute("/_auth/courses/$id_/curriculum")({
  component: CurriculumBuilderPage,
});
