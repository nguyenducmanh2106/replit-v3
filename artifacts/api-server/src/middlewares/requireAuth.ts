import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      dbUser?: typeof usersTable.$inferSelect;
      userId?: string;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = clerkId;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
    if (user) {
      req.dbUser = user;
    }
  } catch (err) {
    logger.error({ err, clerkId }, "DB user lookup failed in requireAuth");
    res.status(500).json({ error: "Internal server error during authentication" });
    return;
  }
  next();
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (clerkId) {
    req.userId = clerkId;
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
      if (user) req.dbUser = user;
    } catch (err) {
      logger.error({ err, clerkId }, "DB user lookup failed in optionalAuth");
    }
  }
  next();
};
