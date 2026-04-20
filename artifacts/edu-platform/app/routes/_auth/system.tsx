import { createFileRoute } from "@tanstack/react-router";
import SystemSettingsPage from "@/pages/system-settings";

export const Route = createFileRoute("/_auth/system")({
  component: SystemSettingsPage,
});
