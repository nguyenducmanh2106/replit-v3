import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db, usersTable, systemSettingsTable, auditLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  ListSystemUsersQueryParams,
  UpdateSystemUserBody,
  UpdateSystemUserParams,
  UpsertSystemSettingBody,
  GetAuditLogQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const dbUser = req.dbUser;
  if (!dbUser) { res.status(401).json({ error: "Unauthorized" }); return false; }
  if (dbUser.role !== "system_admin") { res.status(403).json({ error: "Forbidden: System admin only" }); return false; }
  return true;
}

router.get("/system/users", requireAuth, async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const qp = ListSystemUsersQueryParams.safeParse(req.query);
  const role = qp.success ? qp.data.role : undefined;
  const search = qp.success ? qp.data.search : undefined;

  let users = await db.select().from(usersTable).orderBy(usersTable.createdAt);

  if (role) users = users.filter(u => u.role === role);
  if (search) {
    const s = search.toLowerCase();
    users = users.filter(u => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
  }

  res.json(users.map(u => ({
    id: u.id,
    clerkId: u.clerkId,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: u.avatarUrl ?? null,
    organization: u.organization ?? null,
    createdAt: u.createdAt.toISOString(),
  })));
});

router.patch("/system/users/:id", requireAuth, async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const dbUser = req.dbUser!;

  const params = UpdateSystemUserParams.safeParse({ id: parseInt(String(req.params.id), 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const userId = params.data.id;

  const parsed = UpdateSystemUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.role != null) updates.role = parsed.data.role;
  if (parsed.data.organization != null) updates.organization = parsed.data.organization;

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));

  await db.insert(auditLogsTable).values({
    userId: dbUser.id,
    action: "update_user",
    entity: "user",
    entityId: userId,
    detail: `Updated user ${user.email}: ${JSON.stringify(parsed.data)}`,
  });

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  res.json({
    id: updated!.id,
    clerkId: updated!.clerkId,
    email: updated!.email,
    name: updated!.name,
    role: updated!.role,
    avatarUrl: updated!.avatarUrl ?? null,
    organization: updated!.organization ?? null,
    createdAt: updated!.createdAt.toISOString(),
  });
});

router.get("/system/settings", requireAuth, async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const settings = await db.select().from(systemSettingsTable).orderBy(systemSettingsTable.key);
  res.json(settings.map(s => ({
    id: s.id,
    key: s.key,
    value: s.value,
    description: s.description ?? null,
    updatedAt: s.updatedAt.toISOString(),
  })));
});

router.post("/system/settings", requireAuth, async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const dbUser = req.dbUser!;

  const parsed = UpsertSystemSettingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, parsed.data.key));
  let setting;

  if (existing.length > 0) {
    await db.update(systemSettingsTable).set({
      value: parsed.data.value,
      description: parsed.data.description ?? existing[0]!.description,
    }).where(eq(systemSettingsTable.key, parsed.data.key));
    const [updated] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, parsed.data.key));
    setting = updated;
  } else {
    const [created] = await db.insert(systemSettingsTable).values({
      key: parsed.data.key,
      value: parsed.data.value,
      description: parsed.data.description ?? null,
    }).returning();
    setting = created;
  }

  await db.insert(auditLogsTable).values({
    userId: dbUser.id,
    action: "update_setting",
    entity: "system_setting",
    entityId: setting!.id,
    detail: `Set ${parsed.data.key} = ${parsed.data.value}`,
  });

  res.json({
    id: setting!.id,
    key: setting!.key,
    value: setting!.value,
    description: setting!.description ?? null,
    updatedAt: setting!.updatedAt.toISOString(),
  });
});

router.get("/system/audit-log", requireAuth, async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const qp = GetAuditLogQueryParams.safeParse(req.query);
  const limit = (qp.success ? qp.data.limit : undefined) ?? 50;
  const offset = (qp.success ? qp.data.offset : undefined) ?? 0;

  const logs = await db
    .select({
      id: auditLogsTable.id,
      userId: auditLogsTable.userId,
      userName: usersTable.name,
      action: auditLogsTable.action,
      entity: auditLogsTable.entity,
      entityId: auditLogsTable.entityId,
      detail: auditLogsTable.detail,
      createdAt: auditLogsTable.createdAt,
    })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(logs.map(l => ({
    id: l.id,
    userId: l.userId ?? null,
    userName: l.userName ?? null,
    action: l.action,
    entity: l.entity ?? null,
    entityId: l.entityId ?? null,
    detail: l.detail ?? null,
    createdAt: l.createdAt.toISOString(),
  })));
});

export default router;
