import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import AssignmentTakePage from "@/pages/assignment-take";
import { useEffect } from "react";

export const Route = createFileRoute("/assignments/$id/take")({
  component: AssignmentTakeRoute,
});

function AssignmentTakeRoute() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !session) {
      navigate({ to: "/sign-in" });
    }
  }, [session, isPending, navigate]);

  if (isPending || !session) return null;

  return <AssignmentTakePage />;
}
