import { createFileRoute } from "@tanstack/react-router";
import CourseLandingPage from "@/pages/course-landing";

export const Route = createFileRoute("/catalog/$slug")({
  component: CourseLandingPage,
});
