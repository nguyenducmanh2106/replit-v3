import { createFileRoute, useNavigate } from "@tanstack/react-router";
import MediaManagerPage from "@/pages/media-manager";

export const Route = createFileRoute("/_auth/media")({
  component: MediaRootRoute,
});

function MediaRootRoute() {
  const navigate = useNavigate();
  return (
    <MediaManagerPage
      currentNodeId="root"
      navigateToNode={(nodeId) => {
        if (nodeId === "root") {
          navigate({ to: "/media" });
          return;
        }
        navigate({ to: "/media/$nodeId", params: { nodeId } });
      }}
    />
  );
}
