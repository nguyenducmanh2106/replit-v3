CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TYPE "node_type" AS ENUM ('folder', 'file');
--> statement-breakpoint
CREATE TYPE "permission_role" AS ENUM ('viewer', 'editor');
--> statement-breakpoint
CREATE TABLE "nodes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parent_id" uuid,
  "owner_id" integer NOT NULL,
  "type" "node_type" NOT NULL,
  "name" varchar(255) NOT NULL,
  "storage_key" text,
  "mime_type" varchar(127),
  "size_bytes" bigint,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "nodes_parent_not_self_chk" CHECK ("nodes"."parent_id" IS NULL OR "nodes"."parent_id" <> "nodes"."id")
);
--> statement-breakpoint
CREATE TABLE "node_permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "node_id" uuid NOT NULL,
  "grantee_id" integer NOT NULL,
  "role" "permission_role" NOT NULL,
  "inherited" boolean DEFAULT false NOT NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "node_id" uuid NOT NULL,
  "token" varchar(64) NOT NULL,
  "role" "permission_role" NOT NULL,
  "expires_at" timestamp with time zone,
  "created_by" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_parent_id_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "node_permissions" ADD CONSTRAINT "node_permissions_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "node_permissions" ADD CONSTRAINT "node_permissions_grantee_id_users_id_fk" FOREIGN KEY ("grantee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "nodes_parent_name_owner_uidx" ON "nodes" USING btree ("parent_id", "name", "owner_id");
--> statement-breakpoint
CREATE INDEX "nodes_owner_idx" ON "nodes" USING btree ("owner_id");
--> statement-breakpoint
CREATE INDEX "nodes_parent_idx" ON "nodes" USING btree ("parent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "node_permissions_node_grantee_uidx" ON "node_permissions" USING btree ("node_id", "grantee_id");
--> statement-breakpoint
CREATE INDEX "node_permissions_grantee_idx" ON "node_permissions" USING btree ("grantee_id");
--> statement-breakpoint
CREATE INDEX "node_permissions_node_idx" ON "node_permissions" USING btree ("node_id");
--> statement-breakpoint
CREATE INDEX "share_links_node_idx" ON "share_links" USING btree ("node_id");
--> statement-breakpoint
CREATE INDEX "share_links_token_idx" ON "share_links" USING btree ("token");
