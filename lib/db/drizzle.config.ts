const { defineConfig } = require("drizzle-kit");
const path = require("path");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Copy .env.example to .env and fill in the value.");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts").replace(/\\/g, "/"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});