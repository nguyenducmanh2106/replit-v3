import { createFileRoute, useNavigate } from "@tanstack/react-router";
import MediaManagerPage from "@/pages/media-manager";

export const Route = createFileRoute("/_auth/media/$nodeId")({
  component: MediaNodeRoute,
});

function MediaNodeRoute() {
  const navigate = useNavigate();
  const { nodeId } = Route.useParams();
  const effectiveId = nodeId === "root" ? "root" : nodeId;

  return (
    <MediaManagerPage
      currentNodeId={effectiveId}
      navigateToNode={(nextId) => {
        if (nextId === "root") {
          navigate({ to: "/media" });
          return;
        }
        navigate({ to: "/media/$nodeId", params: { nodeId: nextId } });
      }}
    />
  );
}
