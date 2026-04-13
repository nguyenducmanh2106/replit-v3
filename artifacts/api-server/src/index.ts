import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "./lib/seed";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function runStartupMigrations() {
  try {
    await db.execute(sql`ALTER TABLE assignment_questions DROP CONSTRAINT IF EXISTS assignment_questions_question_id_questions_id_fk`);
    await db.execute(sql`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS auto_grade BOOLEAN NOT NULL DEFAULT false`);
    logger.info("Startup migrations completed");
  } catch (e) {
    logger.warn({ err: e }, "Startup migration warning (non-fatal)");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  runStartupMigrations().catch(e => logger.error({ err: e }, "Startup migration failed"));
  if (process.env["NODE_ENV"] !== "production") {
    seedIfEmpty().catch(e => logger.error({ err: e }, "Seed failed"));
  }
});
