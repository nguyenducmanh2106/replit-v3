import { createFileRoute } from "@tanstack/react-router";
import CoursesPage from "@/pages/courses";

export const Route = createFileRoute("/_auth/courses")({
  component: CoursesPage,
});
