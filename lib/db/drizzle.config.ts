import { defineConfig } from "drizzle-kit";
import path from "path";
import { config } from "dotenv";

// Load .env from the monorepo root (../../ relative to lib/db)
// Silent if the file doesn't exist (e.g. on Replit where env vars come from the platform)
config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Copy .env.example to .env and fill in the value.");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
