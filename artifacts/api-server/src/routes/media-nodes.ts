import { createHmac, randomBytes, randomUUID } from "crypto";
import { Router, type IRouter } from "express";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import {
  db,
  nodePermissionsTable,
  nodesTable,
  shareLinksTable,
  usersTable,
  type PermissionRole,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { MediaS3DeleteError, MediaS3Service } from "../lib/mediaS3";

type AccessSource = "owner" | "direct" | "inherited";
type EffectiveAccess = {
  role: "owner" | PermissionRole;
  source: AccessSource;
};

const router: IRouter = Router();
let mediaS3: MediaS3Service | null = null;

function getMediaS3(): MediaS3Service {
  if (!mediaS3) {
    mediaS3 = new MediaS3Service();
  }
  return mediaS3;
}

function parseNodeId(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? value : null;
}

function firstParam(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function isPermissionRole(value: unknown): value is PermissionRole {
  return value === "viewer" || value === "editor";
}

function toNodeResponse(node: typeof nodesTable.$inferSelect): Record<string, unknown> {
  return {
    id: node.id,
    parentId: node.parentId,
    ownerId: node.ownerId,
    type: node.type,
    name: node.name,
    storageKey: node.storageKey ?? null,
    mimeType: node.mimeType ?? null,
    sizeBytes: node.sizeBytes ?? null,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}

function buildToken(length = 21): string {
  const raw = randomBytes(32).toString("base64url");
  return raw.slice(0, length);
}

type UploadDraftPayload = {
  nodeId: string;
  folderId: string;
  ownerId: number;
  name: string;
  mimeType: string | null;
  storageKey: string;
  exp: number;
};

function getUploadDraftSecret(): string {
  return process.env["MEDIA_UPLOAD_DRAFT_SECRET"] ?? process.env["S3_SECRET_KEY"] ?? "dev-upload-secret";
}

function signUploadDraft(payload: UploadDraftPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getUploadDraftSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyUploadDraft(token: string): UploadDraftPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getUploadDraftSecret()).update(body).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as UploadDraftPayload;
    if (!payload || typeof payload !== "object") return null;
    if (payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function splitFilename(input: string): { base: string; ext: string } {
  const trimmed = input.trim();
  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return { base: trimmed, ext: "" };
  }
  return {
    base: trimmed.slice(0, dotIndex),
    ext: trimmed.slice(dotIndex),
  };
}

async function generateUniqueName(ownerId: number, parentId: string | null, proposedName: string): Promise<string> {
  const safeName = proposedName.trim();
  if (!safeName) {
    throw new Error("EMPTY_NAME");
  }

  const parentFilter = parentId == null ? isNull(nodesTable.parentId) : eq(nodesTable.parentId, parentId);

  const [existing] = await db
    .select({ id: nodesTable.id })
    .from(nodesTable)
    .where(and(eq(nodesTable.ownerId, ownerId), parentFilter, eq(nodesTable.name, safeName)))
    .limit(1);
  if (!existing) return safeName;

  const { base, ext } = splitFilename(safeName);
  for (let i = 1; i <= 500; i += 1) {
    const candidate = `${base} (${i})${ext}`;
    const [dupe] = await db
      .select({ id: nodesTable.id })
      .from(nodesTable)
      .where(and(eq(nodesTable.ownerId, ownerId), parentFilter, eq(nodesTable.name, candidate)))
      .limit(1);
    if (!dupe) return candidate;
  }

  throw new Error("NAME_COLLISION_LIMIT");
}

async function getNodeById(nodeId: string): Promise<typeof nodesTable.$inferSelect | null> {
  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, nodeId)).limit(1);
  return node ?? null;
}

async function resolveUserAccess(userId: number, node: typeof nodesTable.$inferSelect): Promise<EffectiveAccess | null> {
  if (node.ownerId === userId) {
    return { role: "owner", source: "owner" };
  }

  const result = await db.execute(sql<{ role: PermissionRole; depth: number }>`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id, 0::int AS depth
      FROM nodes
      WHERE id = ${node.id}
      UNION ALL
      SELECT n.id, n.parent_id, a.depth + 1
      FROM nodes n
      JOIN ancestors a ON n.id = a.parent_id
      WHERE a.depth < 64
    )
    SELECT p.role AS role, a.depth AS depth
    FROM node_permissions p
    JOIN ancestors a ON a.id = p.node_id
    WHERE p.grantee_id = ${userId}
    ORDER BY a.depth ASC
    LIMIT 1
  `);

  const best = result.rows[0];
  if (!best) return null;
  if (!isPermissionRole(best.role)) return null;
  return {
    role: best.role,
    source: best.depth === 0 ? "direct" : "inherited",
  };
}

async function assertNodeAccess(
  nodeId: string,
  userId: number,
  required: "view" | "edit",
): Promise<{ node: typeof nodesTable.$inferSelect; access: EffectiveAccess } | null> {
  const node = await getNodeById(nodeId);
  if (!node) return null;

  const access = await resolveUserAccess(userId, node);
  if (!access) return null;

  if (required === "edit" && access.role === "viewer") return null;
  return { node, access };
}

router.get("/nodes/users/search", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const qRaw = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : "";
  if (q.length < 2) {
    res.json([]);
    return;
  }

  const users = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
    .from(usersTable)
    .where(and(ilike(usersTable.email, `%${q}%`), sql`${usersTable.id} <> ${dbUser.id}`))
    .limit(10);

  res.json(users);
});

router.get("/nodes/:id", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const nodeId = parseNodeId(firstParam(req.params.id));
  if (!nodeId) {
    res.status(400).json({ error: "Invalid node id" });
    return;
  }

  const accessCtx = await assertNodeAccess(nodeId, dbUser.id, "view");
  if (!accessCtx) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  const ancestorsResult = await db.execute(sql<{
    id: string;
    parentId: string | null;
    name: string;
    type: "folder" | "file";
    depth: number;
  }>`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id AS "parentId", name, type, 0::int AS depth
      FROM nodes
      WHERE id = ${nodeId}
      UNION ALL
      SELECT n.id, n.parent_id AS "parentId", n.name, n.type, a.depth + 1
      FROM nodes n
      JOIN ancestors a ON n.id = a."parentId"
      WHERE a.depth < 64
    )
    SELECT id, "parentId", name, type, depth
    FROM ancestors
    ORDER BY depth DESC
  `);

  res.json({
    node: toNodeResponse(accessCtx.node),
    access: accessCtx.access,
    ancestors: ancestorsResult.rows,
  });
});

router.get("/nodes/:id/children", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rawId = firstParam(req.params.id);

  if (rawId === "root") {
    const ownRoots = await db
      .select()
      .from(nodesTable)
      .where(and(eq(nodesTable.ownerId, dbUser.id), isNull(nodesTable.parentId)))
      .orderBy(asc(nodesTable.type), asc(nodesTable.name));

    const sharedRoots = await db
      .select({
        id: nodesTable.id,
        parentId: nodesTable.parentId,
        ownerId: nodesTable.ownerId,
        type: nodesTable.type,
        name: nodesTable.name,
        storageKey: nodesTable.storageKey,
        mimeType: nodesTable.mimeType,
        sizeBytes: nodesTable.sizeBytes,
        createdAt: nodesTable.createdAt,
        updatedAt: nodesTable.updatedAt,
      })
      .from(nodesTable)
      .innerJoin(nodePermissionsTable, eq(nodePermissionsTable.nodeId, nodesTable.id))
      .where(and(eq(nodePermissionsTable.granteeId, dbUser.id), isNull(nodesTable.parentId), sql`${nodesTable.ownerId} <> ${dbUser.id}`))
      .orderBy(asc(nodesTable.type), asc(nodesTable.name));

    const mergedById = new Map<string, { node: Record<string, unknown>; shared: boolean }>();
    for (const node of ownRoots) {
      mergedById.set(node.id, { node: toNodeResponse(node), shared: false });
    }
    for (const node of sharedRoots) {
      mergedById.set(node.id, { node: toNodeResponse(node), shared: true });
    }

    res.json({
      parentId: null,
      items: [...mergedById.values()],
    });
    return;
  }

  const nodeId = parseNodeId(rawId);
  if (!nodeId) {
    res.status(400).json({ error: "Invalid node id" });
    return;
  }

  const accessCtx = await assertNodeAccess(nodeId, dbUser.id, "view");
  if (!accessCtx) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  if (accessCtx.node.type !== "folder") {
    res.status(400).json({ error: "Target node is not a folder" });
    return;
  }

  const children = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.parentId, nodeId))
    .orderBy(asc(nodesTable.type), asc(nodesTable.name));

  if (children.length === 0) {
    res.json({ parentId: nodeId, items: [] });
    return;
  }

  const childIds = children.map((child: typeof nodesTable.$inferSelect) => child.id);
  const [permissionCounts, shareLinkCounts] = await Promise.all([
    db.select({ nodeId: nodePermissionsTable.nodeId, count: sql<number>`count(*)::int` })
      .from(nodePermissionsTable)
      .where(inArray(nodePermissionsTable.nodeId, childIds))
      .groupBy(nodePermissionsTable.nodeId),
    db.select({ nodeId: shareLinksTable.nodeId, count: sql<number>`count(*)::int` })
      .from(shareLinksTable)
      .where(inArray(shareLinksTable.nodeId, childIds))
      .groupBy(shareLinksTable.nodeId),
  ]);

  const permissionCountMap = new Map<string, number>(
    permissionCounts.map((item: { nodeId: string; count: number | string | null }) => [item.nodeId, Number(item.count ?? 0)]),
  );
  const shareLinkCountMap = new Map<string, number>(
    shareLinkCounts.map((item: { nodeId: string; count: number | string | null }) => [item.nodeId, Number(item.count ?? 0)]),
  );

  res.json({
    parentId: nodeId,
    items: children.map((node: typeof nodesTable.$inferSelect) => ({
      node: toNodeResponse(node),
      shared: (permissionCountMap.get(node.id) ?? 0) > 0 || (shareLinkCountMap.get(node.id) ?? 0) > 0,
    })),
  });
});

router.post("/nodes", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const parentId = req.body?.parentId == null ? null : parseNodeId(String(req.body.parentId));

  if (!rawName) {
    res.status(400).json({ error: "Folder name is required" });
    return;
  }
  if (req.body?.parentId != null && !parentId) {
    res.status(400).json({ error: "Invalid parent id" });
    return;
  }

  let ownerId = dbUser.id;
  if (parentId) {
    const parentAccess = await assertNodeAccess(parentId, dbUser.id, "edit");
    if (!parentAccess) {
      res.status(403).json({ error: "No permission to create inside this folder" });
      return;
    }
    if (parentAccess.node.type !== "folder") {
      res.status(400).json({ error: "Parent node must be a folder" });
      return;
    }
    ownerId = parentAccess.node.ownerId;
  }

  try {
    const name = await generateUniqueName(ownerId, parentId, rawName);
    const [folder] = await db.insert(nodesTable).values({
      parentId,
      ownerId,
      type: "folder",
      name,
    }).returning();

    res.status(201).json({ node: toNodeResponse(folder!) });
  } catch (error) {
    if (error instanceof Error && error.message === "EMPTY_NAME") {
      res.status(400).json({ error: "Folder name is required" });
      return;
    }
    req.log.error({ err: error }, "Failed to create folder");
    res.status(500).json({ error: "Failed to create folder" });
  }
});

router.post("/nodes/:id/upload", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const folderId = parseNodeId(firstParam(req.params.id));
  if (!folderId) {
    res.status(400).json({ error: "Invalid folder id" });
    return;
  }

  const folderAccess = await assertNodeAccess(folderId, dbUser.id, "edit");
  if (!folderAccess) {
    res.status(403).json({ error: "No permission to upload into this folder" });
    return;
  }
  if (folderAccess.node.type !== "folder") {
    res.status(400).json({ error: "Upload target must be a folder" });
    return;
  }

  const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType.trim() : undefined;

  if (!rawName) {
    res.status(400).json({ error: "File name is required" });
    return;
  }

  try {
    const name = await generateUniqueName(folderAccess.node.ownerId, folderId, rawName);
    const nodeId = randomUUID();
    const storageKey = getMediaS3().getStorageKey(folderAccess.node.ownerId, nodeId, name);
    const uploadUrl = await getMediaS3().createUploadUrl(storageKey, mimeType);
    const draftToken = signUploadDraft({
      nodeId,
      folderId,
      ownerId: folderAccess.node.ownerId,
      name,
      mimeType: mimeType ?? null,
      storageKey,
      exp: Date.now() + (15 * 60 * 1000),
    });

    res.status(200).json({
      draftToken,
      proposedNodeId: nodeId,
      name,
      uploadUrl,
      expiresInSeconds: 900,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to prepare upload");
    res.status(500).json({ error: "Failed to prepare upload" });
  }
});

router.post("/nodes/:id/upload/complete", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const folderId = parseNodeId(firstParam(req.params.id));
  if (!folderId) {
    res.status(400).json({ error: "Invalid folder id" });
    return;
  }

  const folderAccess = await assertNodeAccess(folderId, dbUser.id, "edit");
  if (!folderAccess || folderAccess.node.type !== "folder") {
    res.status(403).json({ error: "No permission to finalize upload in this folder" });
    return;
  }

  const draftToken = typeof req.body?.draftToken === "string" ? req.body.draftToken : "";
  if (!draftToken) {
    res.status(400).json({ error: "Missing draftToken" });
    return;
  }

  const draft = verifyUploadDraft(draftToken);
  if (!draft) {
    res.status(400).json({ error: "Invalid or expired draftToken" });
    return;
  }

  if (draft.folderId !== folderId || draft.ownerId !== folderAccess.node.ownerId) {
    res.status(403).json({ error: "Draft does not belong to this folder" });
    return;
  }

  const exists = await getMediaS3().objectExists(draft.storageKey);
  if (!exists) {
    res.status(400).json({ error: "Upload not found on storage. Database record was not created." });
    return;
  }

  const sizeValueRaw = req.body?.sizeBytes;
  const sizeBytes = sizeValueRaw == null ? null : Number(sizeValueRaw);
  if (sizeBytes != null && (!Number.isFinite(sizeBytes) || sizeBytes < 0)) {
    res.status(400).json({ error: "Invalid sizeBytes" });
    return;
  }
  const mimeType = req.body?.mimeType == null ? draft.mimeType : String(req.body.mimeType);

  try {
    const safeName = await generateUniqueName(draft.ownerId, draft.folderId, draft.name);
    const [created] = await db.insert(nodesTable).values({
      id: draft.nodeId,
      parentId: draft.folderId,
      ownerId: draft.ownerId,
      type: "file",
      name: safeName,
      storageKey: draft.storageKey,
      mimeType: mimeType ?? null,
      sizeBytes: sizeBytes == null ? null : Math.floor(sizeBytes),
    }).returning();

    res.status(201).json({ node: toNodeResponse(created!) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to finalize upload");
    res.status(500).json({ error: "Failed to finalize upload" });
  }
});

router.patch("/nodes/:id", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const nodeId = parseNodeId(firstParam(req.params.id));
  if (!nodeId) {
    res.status(400).json({ error: "Invalid node id" });
    return;
  }

  const accessCtx = await assertNodeAccess(nodeId, dbUser.id, "edit");
  if (!accessCtx) {
    res.status(403).json({ error: "No permission to modify node" });
    return;
  }

  const nextName = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
  const nextParentRaw = req.body?.parentId;
  const nextParent = nextParentRaw === undefined
    ? undefined
    : nextParentRaw === null
      ? null
      : parseNodeId(String(nextParentRaw));

  if (nextParentRaw !== undefined && nextParentRaw !== null && !nextParent) {
    res.status(400).json({ error: "Invalid parent id" });
    return;
  }

  const updates: Partial<typeof nodesTable.$inferInsert> = {};

  let effectiveParentId = accessCtx.node.parentId;

  if (nextParent !== undefined) {
    if (nextParent === nodeId) {
      res.status(400).json({ error: "Node cannot be its own parent" });
      return;
    }

    if (nextParent !== null) {
      const targetParentAccess = await assertNodeAccess(nextParent, dbUser.id, "edit");
      if (!targetParentAccess || targetParentAccess.node.type !== "folder") {
        res.status(403).json({ error: "No permission to move into target folder" });
        return;
      }
      if (targetParentAccess.node.ownerId !== accessCtx.node.ownerId) {
        res.status(400).json({ error: "Cross-owner move is not supported" });
        return;
      }

      if (accessCtx.node.type === "folder") {
        const cycleCheck = await db.execute(sql<{ id: string }>`
          WITH RECURSIVE descendants AS (
            SELECT id, parent_id
            FROM nodes
            WHERE id = ${accessCtx.node.id}
            UNION ALL
            SELECT n.id, n.parent_id
            FROM nodes n
            JOIN descendants d ON n.parent_id = d.id
          )
          SELECT id FROM descendants WHERE id = ${nextParent} LIMIT 1
        `);
        if (cycleCheck.rows.length > 0) {
          res.status(400).json({ error: "Cannot move folder into its own descendant" });
          return;
        }
      }
    }

    updates.parentId = nextParent;
    effectiveParentId = nextParent;
  }

  if (nextName !== undefined) {
    if (!nextName) {
      res.status(400).json({ error: "Name cannot be empty" });
      return;
    }
    updates.name = await generateUniqueName(accessCtx.node.ownerId, effectiveParentId, nextName);
  }

  if (req.body?.sizeBytes !== undefined) {
    const sizeValue = Number(req.body.sizeBytes);
    if (!Number.isFinite(sizeValue) || sizeValue < 0) {
      res.status(400).json({ error: "Invalid sizeBytes" });
      return;
    }
    updates.sizeBytes = Math.floor(sizeValue);
  }

  if (req.body?.mimeType !== undefined) {
    updates.mimeType = req.body.mimeType == null ? null : String(req.body.mimeType);
  }

  if (Object.keys(updates).length === 0) {
    res.json({ node: toNodeResponse(accessCtx.node) });
    return;
  }

  const [updated] = await db.update(nodesTable)
    .set(updates)
    .where(eq(nodesTable.id, nodeId))
    .returning();

  res.json({ node: toNodeResponse(updated!) });
});

router.delete("/nodes/:id", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const nodeId = parseNodeId(firstParam(req.params.id));
  if (!nodeId) {
    res.status(400).json({ error: "Invalid node id" });
    return;
  }

  const accessCtx = await assertNodeAccess(nodeId, dbUser.id, "edit");
  if (!accessCtx) {
    res.status(403).json({ error: "No permission to delete node" });
    return;
  }

  const descendants = await db.execute(sql<{ storage_key: string | null }>`
    WITH RECURSIVE descendants AS (
      SELECT id, parent_id, storage_key
      FROM nodes
      WHERE id = ${nodeId}
      UNION ALL
      SELECT n.id, n.parent_id, n.storage_key
      FROM nodes n
      JOIN descendants d ON n.parent_id = d.id
    )
    SELECT storage_key
    FROM descendants
    WHERE storage_key IS NOT NULL
  `);

  const storageKeys = descendants.rows
    .map((row: { storage_key: string | null }) => row.storage_key)
    .filter((value: string | null): value is string => Boolean(value));

  if (storageKeys.length > 0) {
    try {
      await getMediaS3().deleteObjects(storageKeys);
    } catch (error) {
      req.log.error({ err: error, nodeId, storageKeys }, "Failed to delete objects from S3; skip DB delete");
      if (error instanceof MediaS3DeleteError) {
        res.status(502).json({ error: "Failed to delete file(s) from S3. Database record was kept." });
        return;
      }
      res.status(500).json({ error: "Unexpected error while deleting file(s) from S3. Database record was kept." });
      return;
    }
  }

  await db.delete(nodesTable).where(eq(nodesTable.id, nodeId));
  res.sendStatus(204);
});

router.get("/nodes/:id/download", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const nodeId = parseNodeId(firstParam(req.params.id));
  if (!nodeId) {
    res.status(400).json({ error: "Invalid node id" });
    return;
  }

  const accessCtx = await assertNodeAccess(nodeId, dbUser.id, "view");
  if (!accessCtx) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  if (accessCtx.node.type !== "file" || !accessCtx.node.storageKey) {
    res.status(400).json({ error: "Node is not a downloadable file" });
    return;
  }

  const downloadUrl = await getMediaS3().createDownloadUrl(accessCtx.node.storageKey);
  res.json({ downloadUrl, expiresInSeconds: 900 });
});

router.post("/nodes/:id/share", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const nodeId = parseNodeId(firstParam(req.params.id));
  if (!nodeId) {
    res.status(400).json({ error: "Invalid node id" });
    return;
  }

  const node = await getNodeById(nodeId);
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  if (node.ownerId !== dbUser.id) {
    res.status(403).json({ error: "Only owner can grant permissions" });
    return;
  }

  const granteeId = Number(req.body?.granteeId);
  if (!Number.isFinite(granteeId)) {
    res.status(400).json({ error: "Invalid granteeId" });
    return;
  }
  const role = req.body?.role;
  if (!isPermissionRole(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  if (granteeId === dbUser.id) {
    res.status(400).json({ error: "Owner already has full access" });
    return;
  }

  const [grantee] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, granteeId)).limit(1);
  if (!grantee) {
    res.status(404).json({ error: "Grantee user not found" });
    return;
  }

  const [permission] = await db.insert(nodePermissionsTable)
    .values({
      nodeId,
      granteeId,
      role,
      inherited: false,
    })
    .onConflictDoUpdate({
      target: [nodePermissionsTable.nodeId, nodePermissionsTable.granteeId],
      set: {
        role,
        inherited: false,
      },
    })
    .returning();

  res.status(201).json({ permission });
});

router.delete("/nodes/:id/share/:uid", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const nodeId = parseNodeId(firstParam(req.params.id));
  const targetUserId = Number(req.params.uid);
  if (!nodeId || !Number.isFinite(targetUserId)) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const node = await getNodeById(nodeId);
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  if (node.ownerId !== dbUser.id) {
    res.status(403).json({ error: "Only owner can revoke permissions" });
    return;
  }

  await db.delete(nodePermissionsTable)
    .where(and(eq(nodePermissionsTable.nodeId, nodeId), eq(nodePermissionsTable.granteeId, targetUserId)));

  res.sendStatus(204);
});

router.get("/nodes/:id/permissions", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const nodeId = parseNodeId(firstParam(req.params.id));
  if (!nodeId) {
    res.status(400).json({ error: "Invalid node id" });
    return;
  }

  const node = await getNodeById(nodeId);
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  if (node.ownerId !== dbUser.id) {
    res.status(403).json({ error: "Only owner can view permission list" });
    return;
  }

  const permissions = await db
    .select({
      id: nodePermissionsTable.id,
      nodeId: nodePermissionsTable.nodeId,
      granteeId: nodePermissionsTable.granteeId,
      role: nodePermissionsTable.role,
      inherited: nodePermissionsTable.inherited,
      grantedAt: nodePermissionsTable.grantedAt,
      granteeEmail: usersTable.email,
      granteeName: usersTable.name,
    })
    .from(nodePermissionsTable)
    .innerJoin(usersTable, eq(usersTable.id, nodePermissionsTable.granteeId))
    .where(eq(nodePermissionsTable.nodeId, nodeId))
    .orderBy(asc(nodePermissionsTable.grantedAt));

  res.json(permissions.map((permission: {
    id: string;
    nodeId: string;
    granteeId: number;
    role: PermissionRole;
    inherited: boolean;
    grantedAt: Date;
    granteeEmail: string;
    granteeName: string;
  }) => ({
    ...permission,
    grantedAt: permission.grantedAt.toISOString(),
  })));
});

router.post("/nodes/:id/links", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const nodeId = parseNodeId(firstParam(req.params.id));
  if (!nodeId) {
    res.status(400).json({ error: "Invalid node id" });
    return;
  }

  const access = await assertNodeAccess(nodeId, dbUser.id, "edit");
  if (!access) {
    res.status(403).json({ error: "No permission to create share link" });
    return;
  }

  const role = req.body?.role;
  if (!isPermissionRole(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  let expiresAt: Date | null = null;
  if (req.body?.expiresAt != null) {
    const parsed = new Date(String(req.body.expiresAt));
    if (Number.isNaN(parsed.getTime())) {
      res.status(400).json({ error: "Invalid expiresAt" });
      return;
    }
    expiresAt = parsed;
  }

  const token = buildToken(21);
  const [link] = await db.insert(shareLinksTable).values({
    nodeId,
    token,
    role,
    expiresAt,
    createdBy: dbUser.id,
  }).returning();

  const origin = `${req.protocol}://${req.get("host")}`;

  res.status(201).json({
    id: link!.id,
    token: link!.token,
    role: link!.role,
    expiresAt: link!.expiresAt ? link!.expiresAt.toISOString() : null,
    createdAt: link!.createdAt.toISOString(),
    url: `${origin}/api/share/${link!.token}`,
  });
});

router.get("/share/:token", async (req, res): Promise<void> => {
  const token = typeof req.params.token === "string" ? req.params.token.trim() : "";
  if (!token) {
    res.status(400).json({ error: "Invalid token" });
    return;
  }

  const [record] = await db
    .select({
      id: shareLinksTable.id,
      token: shareLinksTable.token,
      role: shareLinksTable.role,
      expiresAt: shareLinksTable.expiresAt,
      nodeId: shareLinksTable.nodeId,
      nodeType: nodesTable.type,
      nodeName: nodesTable.name,
      storageKey: nodesTable.storageKey,
      parentId: nodesTable.parentId,
      ownerId: nodesTable.ownerId,
    })
    .from(shareLinksTable)
    .innerJoin(nodesTable, eq(nodesTable.id, shareLinksTable.nodeId))
    .where(eq(shareLinksTable.token, token))
    .limit(1);

  if (!record) {
    res.status(404).json({ error: "Share link not found" });
    return;
  }

  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    res.status(410).json({ error: "Share link expired" });
    return;
  }

  if (record.nodeType === "file") {
    if (!record.storageKey) {
      res.status(404).json({ error: "Shared file is missing storage key" });
      return;
    }
    const downloadUrl = await getMediaS3().createDownloadUrl(record.storageKey);
    res.json({
      type: "file",
      token: record.token,
      role: record.role,
      node: {
        id: record.nodeId,
        name: record.nodeName,
        ownerId: record.ownerId,
        parentId: record.parentId,
      },
      downloadUrl,
      expiresInSeconds: 900,
    });
    return;
  }

  const children = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.parentId, record.nodeId))
    .orderBy(asc(nodesTable.type), asc(nodesTable.name));

  res.json({
    type: "folder",
    token: record.token,
    role: record.role,
    node: {
      id: record.nodeId,
      name: record.nodeName,
      ownerId: record.ownerId,
      parentId: record.parentId,
    },
    children: children.map(toNodeResponse),
  });
});

export default router;
