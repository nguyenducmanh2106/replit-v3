import { type Request, type Response, type NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { logger } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      dbUser?: typeof usersTable.$inferSelect;
      userId?: string;
      betterAuthUser?: { id: string; email: string; name: string };
    }
  }
}

function buildRequestForAuth(req: Request): { headers: Headers } {
  const headers = fromNodeHeaders(req.headers);
  const proto = req.headers["x-forwarded-proto"] as string | undefined
    ?? (req.secure ? "https" : "http");
  if (!headers.has("x-forwarded-proto")) {
    headers.set("x-forwarded-proto", proto);
  }
  return { headers };
}

async function resolveSession(req: Request) {
  try {
    const ctx = buildRequestForAuth(req);
    const session = await auth.api.getSession(ctx);
    if (session?.user?.id) return session;
  } catch (err) {
    logger.warn({ err }, "auth.api.getSession threw, skipping");
  }
  return null;
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await resolveSession(req);
  if (!session?.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = session.user.id;
  req.betterAuthUser = { id: session.user.id, email: session.user.email, name: session.user.name };

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.betterAuthUserId, session.user.id));
    if (!user) {
      logger.warn({ betterAuthUserId: session.user.id }, "Authenticated session but no matching DB user");
      res.status(403).json({ error: "User account not fully set up" });
      return;
    }
    req.dbUser = user;
  } catch (err) {
    logger.error({ err, userId: session.user.id }, "DB user lookup failed in requireAuth");
    res.status(500).json({ error: "Internal server error during authentication" });
    return;
  }
  next();
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const session = await resolveSession(req);
  if (session?.user?.id) {
    req.userId = session.user.id;
    req.betterAuthUser = { id: session.user.id, email: session.user.email, name: session.user.name };
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.betterAuthUserId, session.user.id));
      if (user) req.dbUser = user;
    } catch (err) {
      logger.error({ err, userId: session.user.id }, "DB user lookup failed in optionalAuth");
    }
  }
  next();
};
