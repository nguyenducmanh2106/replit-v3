import { createFileRoute } from "@tanstack/react-router";
import CoursePlayerPage from "@/pages/course-player";

export const Route = createFileRoute("/_auth/courses/$id_/learn")({
  component: CoursePlayerPage,
});
