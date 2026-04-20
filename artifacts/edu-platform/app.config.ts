import { defineConfig } from "@tanstack/react-start/config";
import tsConfigPaths from "vite-tsconfig-paths";
import path from "path";

const port = process.env["PORT"] ? parseInt(process.env["PORT"]) : 3000;
const apiPort = process.env["API_PORT"] ? parseInt(process.env["API_PORT"]) : 3001;

export default defineConfig({
  vite: {
    plugins: [
      tsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
        "@assets": path.resolve(import.meta.dirname, "../..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    css: {
      postcss: {},
    },
  },
  server: {
    port,
    routeRules: {
      "/api/**": { proxy: `http://localhost:${apiPort}/api/**` },
    },
  },
  routers: {
    client: {
      vite: {
        plugins: [
          tsConfigPaths({
            projects: ["./tsconfig.json"],
          }),
        ],
      },
    },
  },
});
