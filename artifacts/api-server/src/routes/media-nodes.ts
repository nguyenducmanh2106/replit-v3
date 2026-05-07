import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { Router, type IRouter, type Request } from "express";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
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
const MEDIA_MAX_UPLOAD_BYTES = Number(process.env["MEDIA_MAX_UPLOAD_BYTES"] ?? 5 * 1024 * 1024);

const ONLYOFFICE_WORD_EXTENSIONS = new Set([
  "doc", "docm", "docx", "dot", "dotm", "dotx", "epub", "fb2", "fodt", "hml", "htm", "html",
  "hwp", "hwpx", "md", "mht", "mhtml", "odt", "ott", "pages", "rtf", "stw", "sxw", "txt",
  "wps", "wpt", "xml",
]);
const ONLYOFFICE_CELL_EXTENSIONS = new Set([
  "csv", "et", "ett", "fods", "numbers", "ods", "ots", "sxc", "xls", "xlsb", "xlsm", "xlsx",
  "xlt", "xltm", "xltx",
]);
const ONLYOFFICE_SLIDE_EXTENSIONS = new Set([
  "dps", "dpt", "fodp", "key", "odg", "odp", "otp", "pot", "potm", "potx", "pps", "ppsm", "ppsx",
  "ppt", "pptm", "pptx", "sxi",
]);
const ONLYOFFICE_PDF_EXTENSIONS = new Set(["djvu", "oxps", "pdf", "xps"]);
const ONLYOFFICE_EDIT_EXTENSIONS = new Set([
  "csv", "doc", "docx", "odt", "ods", "odp", "ppt", "pptx", "rtf", "txt", "xls", "xlsx",
]);

type OnlyOfficeDocumentType = "word" | "cell" | "slide" | "pdf";
type OnlyOfficeMode = "view" | "edit";

function getMediaS3(): MediaS3Service {
  if (!mediaS3) {
    mediaS3 = new MediaS3Service();
  }
  return mediaS3;
}

function formatUploadLimit(): string {
  return `${Math.floor(MEDIA_MAX_UPLOAD_BYTES / 1024 / 1024)}MB`;
}

function inferPreviewContentType(name: string): string | null {
  const extension = name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "txt":
    case "md":
    case "log":
    case "csv":
      return "text/plain; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    default:
      return null;
  }
}

function getFileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

function looksLikeOleOfficeFile(prefix: Uint8Array | null): boolean {
  return !!prefix
    && prefix.length >= 8
    && prefix[0] === 0xd0
    && prefix[1] === 0xcf
    && prefix[2] === 0x11
    && prefix[3] === 0xe0
    && prefix[4] === 0xa1
    && prefix[5] === 0xb1
    && prefix[6] === 0x1a
    && prefix[7] === 0xe1;
}

async function getOnlyOfficeFileType(name: string, storageKey: string): Promise<string> {
  const fileType = getFileExtension(name);
  if (!["docx", "xlsx", "pptx"].includes(fileType)) return fileType;

  // const prefix = await getMediaS3().getObjectPrefix(storageKey, 8);
  // if (!looksLikeOleOfficeFile(prefix)) return fileType;

  switch (fileType) {
    case "docx":
      return "doc";
    case "xlsx":
      return "xls";
    case "pptx":
      return "ppt";
    default:
      return fileType;
  }
}

function inferOnlyOfficeContentType(name: string, mimeType: string | null): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;

  switch (getFileExtension(name)) {
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "pdf":
      return "application/pdf";
    case "csv":
      return "text/csv; charset=utf-8";
    case "txt":
    case "md":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function getOnlyOfficeDocumentType(fileType: string): OnlyOfficeDocumentType | null {
  if (ONLYOFFICE_WORD_EXTENSIONS.has(fileType)) return "word";
  if (ONLYOFFICE_CELL_EXTENSIONS.has(fileType)) return "cell";
  if (ONLYOFFICE_SLIDE_EXTENSIONS.has(fileType)) return "slide";
  if (ONLYOFFICE_PDF_EXTENSIONS.has(fileType)) return "pdf";
  return null;
}

function canEditOnlyOfficeFile(fileType: string): boolean {
  return ONLYOFFICE_EDIT_EXTENSIONS.has(fileType);
}

function getOnlyOfficeDocumentServerUrl(): string | null {
  const raw = (
    process.env["ONLYOFFICE_DOCUMENT_SERVER_URL"]
    ?? process.env["ONLYOFFICE_SERVER_URL"]
    ?? process.env["DOCUMENT_SERVER_URL"]
  )?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function getOnlyOfficePublicFileBaseUrl(): string {
  const configured = (
    process.env["ONLYOFFICE_PUBLIC_FILE_BASE_URL"]
    ?? process.env["S3_PUBLIC_BASE_URL"]
  )?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const endpoint = (process.env["S3_ENDPOINT"] ?? "").trim().replace(/\/+$/, "");
  const bucket = (process.env["S3_BUCKET"] ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!endpoint || !bucket) {
    throw new Error("Missing ONLYOFFICE_PUBLIC_FILE_BASE_URL or S3_ENDPOINT/S3_BUCKET for OnlyOffice public file URL");
  }
  return `${endpoint}/${bucket}`;
}

function encodePublicObjectPath(path: string): string {
  return path
    .split("/")
    .filter(segment => segment.length > 0)
    .map(segment => encodeURIComponent(segment))
    .join("/");
}

function createOnlyOfficePublicFileUrl(node: {
  id: string;
  name: string;
  storageKey: string | null;
  updatedAt: Date;
  sizeBytes: number | null;
}): string {
  if (!node.storageKey) {
    throw new Error("Missing storage key for OnlyOffice public file URL");
  }

  const keyMode = (process.env["ONLYOFFICE_PUBLIC_FILE_KEY_MODE"] ?? "storageKey").trim().toLowerCase();
  const objectPath = keyMode === "filename" ? node.name : node.storageKey;
  const version = createHash("md5")
    .update(`${node.id}:${node.updatedAt.getTime()}:${node.sizeBytes ?? ""}`)
    .digest("hex");

  return `${getOnlyOfficePublicFileBaseUrl()}/${encodePublicObjectPath(objectPath)}?v=${version}`;
}

function signOnlyOfficeToken(payload: unknown): string {
  const secret = process.env["ONLYOFFICE_JWT_SECRET"];
  if (!secret) return "";

  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(payload);
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

type OnlyOfficeCallbackPayload = {
  nodeId: string;
  userId: number;
  exp: number;
};

function getOnlyOfficeCallbackSecret(): string {
  return process.env["ONLYOFFICE_CALLBACK_SECRET"]
    ?? process.env["ONLYOFFICE_JWT_SECRET"]
    ?? process.env["MEDIA_UPLOAD_DRAFT_SECRET"]
    ?? process.env["S3_SECRET_KEY"]
    ?? "dev-onlyoffice-callback-secret";
}

function signOnlyOfficeCallback(payload: OnlyOfficeCallbackPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getOnlyOfficeCallbackSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyOnlyOfficeCallback(token: string): OnlyOfficeCallbackPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getOnlyOfficeCallbackSecret()).update(body).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OnlyOfficeCallbackPayload;
    if (!payload || typeof payload !== "object") return null;
    if (!parseNodeId(payload.nodeId)) return null;
    if (!Number.isFinite(payload.userId)) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function getRequestOrigin(req: Request): string {
  const configured = process.env["API_PUBLIC_URL"] ?? process.env["APP_URL"];
  if (configured) return configured.replace(/\/+$/, "");

  const forwardedProto = typeof req.headers["x-forwarded-proto"] === "string"
    ? req.headers["x-forwarded-proto"].split(",")[0]?.trim()
    : "";
  const proto = forwardedProto || req.protocol || "http";
  return `${proto}://${req.get("host") ?? ""}`;
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
    .where(and(
      or(ilike(usersTable.email, `%${q}%`), ilike(usersTable.name, `%${q}%`)),
      sql`${usersTable.id} <> ${dbUser.id}`,
    ))
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
        role: nodePermissionsTable.role,
      })
      .from(nodesTable)
      .innerJoin(nodePermissionsTable, eq(nodePermissionsTable.nodeId, nodesTable.id))
      .where(and(eq(nodePermissionsTable.granteeId, dbUser.id), isNull(nodesTable.parentId), sql`${nodesTable.ownerId} <> ${dbUser.id}`))
      .orderBy(asc(nodesTable.type), asc(nodesTable.name));

    const mergedById = new Map<string, { node: Record<string, unknown>; shared: boolean; access: EffectiveAccess }>();
    for (const node of ownRoots) {
      mergedById.set(node.id, {
        node: toNodeResponse(node),
        shared: false,
        access: { role: "owner", source: "owner" },
      });
    }
    for (const node of sharedRoots) {
      mergedById.set(node.id, {
        node: toNodeResponse(node),
        shared: true,
        access: {
          role: isPermissionRole(node.role) ? node.role : "viewer",
          source: "direct",
        },
      });
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
      access: node.ownerId === dbUser.id
        ? { role: "owner", source: "owner" }
        : accessCtx.access,
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
  const sizeBytesRaw = req.body?.sizeBytes;
  const sizeBytes = sizeBytesRaw == null ? null : Number(sizeBytesRaw);

  if (!rawName) {
    res.status(400).json({ error: "File name is required" });
    return;
  }
  if (sizeBytes != null && (!Number.isFinite(sizeBytes) || sizeBytes < 0)) {
    res.status(400).json({ error: "Invalid sizeBytes" });
    return;
  }
  if (sizeBytes != null && sizeBytes > MEDIA_MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: `File exceeds maximum upload size of ${formatUploadLimit()}` });
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

  const sizeValueRaw = req.body?.sizeBytes;
  const sizeBytes = sizeValueRaw == null ? null : Number(sizeValueRaw);
  if (sizeBytes != null && (!Number.isFinite(sizeBytes) || sizeBytes < 0)) {
    res.status(400).json({ error: "Invalid sizeBytes" });
    return;
  }
  if (sizeBytes != null && sizeBytes > MEDIA_MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: `File exceeds maximum upload size of ${formatUploadLimit()}` });
    return;
  }

  let uploadedSizeBytes = sizeBytes == null ? null : Math.floor(sizeBytes);
  try {
    const probedSizeBytes = await getMediaS3().getObjectSize(draft.storageKey);
    if (probedSizeBytes == null) {
      if (uploadedSizeBytes == null) {
        res.status(400).json({ error: "Upload not found on storage. Database record was not created." });
        return;
      }
      req.log.warn({ storageKey: draft.storageKey }, "Upload object could not be verified on storage; using client-reported size");
    } else {
      uploadedSizeBytes = probedSizeBytes;
    }
  } catch (error) {
    if (uploadedSizeBytes == null) {
      req.log.error({ err: error }, "Failed to verify upload object size");
      res.status(502).json({ error: "Failed to verify upload on storage" });
      return;
    }
    req.log.warn({ err: error }, "Failed to verify upload object size; using client-reported size");
  }
  if (uploadedSizeBytes != null && uploadedSizeBytes > MEDIA_MAX_UPLOAD_BYTES) {
    try {
      await getMediaS3().deleteObjects([draft.storageKey]);
    } catch (error) {
      req.log.warn({ err: error }, "Failed to delete oversized upload object");
    }
    res.status(413).json({ error: `File exceeds maximum upload size of ${formatUploadLimit()}` });
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
      sizeBytes: uploadedSizeBytes,
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

  const node = await getNodeById(nodeId);
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  if (node.ownerId !== dbUser.id) {
    res.status(403).json({ error: "Only owner can delete node" });
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

router.get("/nodes/:id/onlyoffice-config", requireAuth, async (req, res): Promise<void> => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const documentServerUrl = getOnlyOfficeDocumentServerUrl();
  if (!documentServerUrl) {
    res.status(503).json({
      error: "OnlyOffice document server is not configured. Set ONLYOFFICE_DOCUMENT_SERVER_URL in artifacts/api-server/.env or the process environment.",
    });
    return;
  }

  const nodeId = parseNodeId(firstParam(req.params.id));
  if (!nodeId) {
    res.status(400).json({ error: "Invalid node id" });
    return;
  }

  const requestedMode: OnlyOfficeMode = req.query.mode === "edit" ? "edit" : "view";
  const accessCtx = await assertNodeAccess(nodeId, dbUser.id, requestedMode === "edit" ? "edit" : "view");
  if (!accessCtx) {
    res.status(requestedMode === "edit" ? 403 : 404).json({
      error: requestedMode === "edit" ? "No permission to edit this file" : "Node not found",
    });
    return;
  }

  if (accessCtx.node.type !== "file" || !accessCtx.node.storageKey) {
    res.status(400).json({ error: "Node is not a previewable file" });
    return;
  }

  const fileType = await getOnlyOfficeFileType(accessCtx.node.name, accessCtx.node.storageKey);
  const documentType = getOnlyOfficeDocumentType(fileType);
  if (!fileType || !documentType) {
    res.status(400).json({ error: "File type is not supported by OnlyOffice preview" });
    return;
  }
  if (requestedMode === "edit" && !canEditOnlyOfficeFile(fileType)) {
    res.status(400).json({ error: "File type is not supported by OnlyOffice editing" });
    return;
  }

  try {
    const downloadUrl = createOnlyOfficePublicFileUrl(accessCtx.node);
    const key = `${accessCtx.node.id}-${accessCtx.node.updatedAt.getTime()}`.replace(/[^0-9a-zA-Z._=-]/g, "").slice(0, 128);
    const config = {
      documentType,
      document: {
        fileType,
        key,
        title: accessCtx.node.name,
        url: downloadUrl,
        permissions: {
          comment: requestedMode === "edit",
          download: true,
          edit: requestedMode === "edit",
          print: true,
          review: requestedMode === "edit",
        },
      },
      editorConfig: {
        callbackUrl: requestedMode === "edit"
          ? `${getRequestOrigin(req)}/api/nodes/${accessCtx.node.id}/onlyoffice-callback?token=${encodeURIComponent(signOnlyOfficeCallback({
            nodeId: accessCtx.node.id,
            userId: dbUser.id,
            exp: Date.now() + (24 * 60 * 60 * 1000),
          }))}`
          : undefined,
        // customization: {
        //   compactHeader: false,
        //   compactToolbar: false,
        //   forcesave: requestedMode === "edit",
        //   hideRightMenu: false,
        //   hideRulers: false,
        //   toolbarHideFileName: false,
        // },
        lang: "vi",
        mode: requestedMode,
        user: {
          id: String(dbUser.id),
          name: dbUser.name || dbUser.email,
        },
      },
      height: "100%",
      width: "100%",
    };
    const token = signOnlyOfficeToken(config);

    res.json({
      documentServerUrl,
      config: token ? { ...config, token } : config,
      expiresInSeconds: 0,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to build OnlyOffice preview config");
    res.status(502).json({ error: "Failed to prepare OnlyOffice preview" });
  }
});

router.post("/nodes/:id/onlyoffice-callback", async (req, res): Promise<void> => {
  const nodeId = parseNodeId(firstParam(req.params.id));
  if (!nodeId) {
    res.status(400).json({ error: 1, message: "Invalid node id" });
    return;
  }

  const token = typeof req.query.token === "string" ? req.query.token : "";
  const payload = verifyOnlyOfficeCallback(token);
  if (!payload || payload.nodeId !== nodeId) {
    res.status(403).json({ error: 1, message: "Invalid OnlyOffice callback token" });
    return;
  }

  const body = req.body as {
    status?: number;
    url?: string;
    key?: string;
    users?: string[];
    userdata?: string;
  };
  const status = Number(body?.status);

  if (status !== 2 && status !== 6) {
    res.json({ error: 0 });
    return;
  }

  try {
    const accessCtx = await assertNodeAccess(nodeId, payload.userId, "edit");
    if (!accessCtx || accessCtx.node.type !== "file" || !accessCtx.node.storageKey) {
      res.json({ error: 1, message: "No permission to edit this file" });
      return;
    }

    const fileType = getFileExtension(accessCtx.node.name);
    if (!canEditOnlyOfficeFile(fileType)) {
      res.json({ error: 1, message: "File type is not supported by OnlyOffice editing" });
      return;
    }

    if (!body.url) {
      res.json({ error: 1, message: "OnlyOffice callback did not include a file URL" });
      return;
    }

    const response = await fetch(body.url);
    if (!response.ok) {
      res.json({ error: 1, message: `OnlyOffice returned ${response.status} while downloading edited file` });
      return;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = inferOnlyOfficeContentType(accessCtx.node.name, accessCtx.node.mimeType);

    await getMediaS3().putObject(accessCtx.node.storageKey, bytes, contentType);
    await db.update(nodesTable)
      .set({
        mimeType: contentType,
        sizeBytes: bytes.byteLength,
        updatedAt: new Date(),
      })
      .where(eq(nodesTable.id, nodeId));

    req.log.info({
      nodeId,
      userId: payload.userId,
      status,
      sizeBytes: bytes.byteLength,
    }, "OnlyOffice file saved to media storage");

    res.json({ error: 0 });
  } catch (error) {
    req.log.error({ err: error, nodeId, status, key: body?.key }, "Failed to save OnlyOffice callback file");
    res.json({
      error: 1,
      message: error instanceof Error ? error.message : "Failed to save OnlyOffice callback file",
    });
  }
});

router.get("/nodes/:id/content", requireAuth, async (req, res): Promise<void> => {
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
    res.status(400).json({ error: "Node is not a previewable file" });
    return;
  }

  try {
    const object = await getMediaS3().getObjectBytes(accessCtx.node.storageKey);
    if (!object) {
      res.status(404).json({ error: "File not found on storage" });
      return;
    }

    const inferredContentType = inferPreviewContentType(accessCtx.node.name);
    const storedContentType = accessCtx.node.mimeType || object.contentType || "";
    const contentType = !storedContentType || storedContentType === "application/octet-stream"
      ? (inferredContentType || "application/octet-stream")
      : storedContentType;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(accessCtx.node.name)}"`);
    if (object.contentLength != null) {
      res.setHeader("Content-Length", String(object.contentLength));
    }
    res.send(Buffer.from(object.bytes));
  } catch (error) {
    req.log.error({ err: error }, "Failed to stream media file content");
    res.status(502).json({ error: "Failed to load file content" });
  }
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
