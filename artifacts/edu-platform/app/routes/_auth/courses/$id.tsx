import { createFileRoute } from "@tanstack/react-router";
import CourseDetailPage from "@/pages/course-detail";

export const Route = createFileRoute("/_auth/courses/$id")({
  component: CourseDetailPage,
});
