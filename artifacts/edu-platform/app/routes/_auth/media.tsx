import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import MediaManagerPage from "@/pages/media-manager";

export const Route = createFileRoute("/_auth/media")({
  component: MediaRootRoute,
});

function MediaRootRoute() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const nodeId = pathname.match(/^\/media\/([^/]+)$/)?.[1];
  const decodedNodeId = nodeId ? decodeURIComponent(nodeId) : undefined;
  const currentNodeId = decodedNodeId && decodedNodeId !== "root" ? decodedNodeId : "root";

  return (
    <MediaManagerPage
      currentNodeId={currentNodeId}
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
