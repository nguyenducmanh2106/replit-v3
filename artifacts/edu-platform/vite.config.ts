import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

const rawPort = process.env.PORT ?? 3000;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const apiPort = process.env.API_PORT ? parseInt(process.env.API_PORT) : 8080;

export default defineConfig({
  base: basePath,
  plugins: [
    TanStackRouterVite({
      routesDirectory: path.resolve(import.meta.dirname, "app/routes"),
      generatedRouteTree: path.resolve(import.meta.dirname, "app/routeTree.gen.ts"),
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    {
      name: "recharts-full-reload",
      handleHotUpdate({ file, server }) {
        if (file.includes("reports.tsx") || file.includes("dashboard.tsx")) {
          server.hot.send({ type: "full-reload" });
          return [];
        }
      },
    },
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
        cookieDomainRewrite: "",
        headers: process.env.REPLIT_DOMAINS
          ? { "x-forwarded-proto": "https" }
          : {},
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
