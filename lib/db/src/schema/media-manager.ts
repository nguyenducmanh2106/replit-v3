import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const nodeTypeEnum = pgEnum("node_type", ["folder", "file"]);
export const permissionRoleEnum = pgEnum("permission_role", ["viewer", "editor"]);

export const nodesTable = pgTable(
  "nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => nodesTable.id, { onDelete: "cascade" }),
    ownerId: integer("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    type: nodeTypeEnum("type").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    storageKey: text("storage_key"),
    mimeType: varchar("mime_type", { length: 127 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("nodes_parent_name_owner_uidx").on(table.parentId, table.name, table.ownerId),
    index("nodes_owner_idx").on(table.ownerId),
    index("nodes_parent_idx").on(table.parentId),
    check("nodes_parent_not_self_chk", sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`),
  ],
);

export const nodePermissionsTable = pgTable(
  "node_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nodeId: uuid("node_id").notNull().references(() => nodesTable.id, { onDelete: "cascade" }),
    granteeId: integer("grantee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    role: permissionRoleEnum("role").notNull(),
    inherited: boolean("inherited").notNull().default(false),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex("node_permissions_node_grantee_uidx").on(table.nodeId, table.granteeId),
    index("node_permissions_grantee_idx").on(table.granteeId),
    index("node_permissions_node_idx").on(table.nodeId),
  ],
);

export const shareLinksTable = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nodeId: uuid("node_id").notNull().references(() => nodesTable.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).notNull().unique(),
    role: permissionRoleEnum("role").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: integer("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("share_links_node_idx").on(table.nodeId),
    index("share_links_token_idx").on(table.token),
  ],
);

export type Node = typeof nodesTable.$inferSelect;
export type NodePermission = typeof nodePermissionsTable.$inferSelect;
export type ShareLink = typeof shareLinksTable.$inferSelect;
export type NodeType = (typeof nodeTypeEnum.enumValues)[number];
export type PermissionRole = (typeof permissionRoleEnum.enumValues)[number];
