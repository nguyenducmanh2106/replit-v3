import { StartClient } from "@tanstack/react-start";
import { hydrateRoot } from "react-dom/client";
import { createRouter } from "./router";

const router = createRouter();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element in index.html");
}

hydrateRoot(rootElement, <StartClient router={router} />);
