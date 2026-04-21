import { createFileRoute } from "@tanstack/react-router";
import CertificatePage from "@/pages/certificate";

export const Route = createFileRoute("/_auth/certificates/$certNo")({
  component: CertificatePage,
});
