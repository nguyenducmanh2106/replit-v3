import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateMeResponse,
  ListUsersQueryParams,
  ListUsersResponse,
  GetUserByIdParams,
  GetUserByIdResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { isTeacherOrAdmin } from "../middlewares/requireRole";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const betterAuthUserId = req.userId!;
  let [user] = await db.select().from(usersTable).where(eq(usersTable.betterAuthUserId, betterAuthUserId));

  if (!user) {
    const baUser = req.betterAuthUser!;
    [user] = await db.insert(usersTable).values({
      betterAuthUserId,
      email: baUser.email,
      name: baUser.name,
      role: "student",
    }).returning();
  }

  res.json(GetMeResponse.parse({
    id: user.id,
    betterAuthUserId: user.betterAuthUserId ?? null,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    organization: user.organization ?? null,
    createdAt: user.createdAt.toISOString(),
  }));
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const betterAuthUserId = req.userId!;
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.organization != null) updates.organization = parsed.data.organization;
  if (parsed.data.avatarUrl != null) updates.avatarUrl = parsed.data.avatarUrl;

  if (parsed.data.role != null) {
    const dbUser = req.dbUser;
    const currentRole = dbUser?.role ?? "student";
    const requestedRole = parsed.data.role;

    if (currentRole !== "student") {
      res.status(403).json({ error: "Role can only be changed by an administrator" });
      return;
    }

    if (requestedRole === "system_admin") {
      res.status(403).json({ error: "Cannot self-assign system admin role" });
      return;
    }

    updates.role = requestedRole;
  }

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.betterAuthUserId, betterAuthUserId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(UpdateMeResponse.parse({
    id: user.id,
    betterAuthUserId: user.betterAuthUserId ?? null,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    organization: user.organization ?? null,
    createdAt: user.createdAt.toISOString(),
  }));
});

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!isTeacherOrAdmin(dbUser.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = ListUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(usersTable).$dynamic();
  if (params.data.role) {
    query = query.where(eq(usersTable.role, params.data.role));
  }

  const users = await query;
  res.json(ListUsersResponse.parse(users.map(u => ({
    id: u.id,
    betterAuthUserId: u.betterAuthUserId ?? null,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: u.avatarUrl ?? null,
    organization: u.organization ?? null,
    createdAt: u.createdAt.toISOString(),
  }))));
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetUserByIdParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (!isTeacherOrAdmin(dbUser.role) && dbUser.id !== params.data.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(GetUserByIdResponse.parse({
    id: user.id,
    betterAuthUserId: user.betterAuthUserId ?? null,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    organization: user.organization ?? null,
    createdAt: user.createdAt.toISOString(),
  }));
});

export default router;
