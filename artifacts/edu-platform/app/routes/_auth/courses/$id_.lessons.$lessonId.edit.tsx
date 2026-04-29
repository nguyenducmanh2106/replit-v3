import { createFileRoute } from "@tanstack/react-router";
import LessonEditorPage from "@/pages/lesson-editor";

export const Route = createFileRoute("/_auth/courses/$id_/lessons/$lessonId/edit")({
  component: LessonEditorPage,
});
