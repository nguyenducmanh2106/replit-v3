export type PermissionRole = "viewer" | "editor";
export type NodeType = "folder" | "file";

export type MediaNode = {
  id: string;
  parentId: string | null;
  ownerId: number;
  type: NodeType;
  name: string;
  storageKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
};

export type NodeListItem = {
  node: MediaNode;
  shared: boolean;
};

async function req<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json() as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // no-op
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const mediaApi = {
  listChildren: (nodeId: string | "root") => req<{ parentId: string | null; items: NodeListItem[] }>(`/nodes/${nodeId}/children`),
  getNode: (nodeId: string) => req<{
    node: MediaNode;
    access: { role: "owner" | PermissionRole; source: "owner" | "direct" | "inherited" };
    ancestors: Array<{ id: string; parentId: string | null; name: string; type: NodeType; depth: number }>;
  }>(`/nodes/${nodeId}`),
  createFolder: (data: { name: string; parentId?: string | null }) => req<{ node: MediaNode }>("/nodes", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  prepareUpload: (folderId: string, data: { name: string; mimeType?: string; sizeBytes?: number }) => req<{
    draftToken: string;
    proposedNodeId: string;
    name: string;
    uploadUrl: string;
    expiresInSeconds: number;
  }>(`/nodes/${folderId}/upload`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  completeUpload: (
    folderId: string,
    data: { draftToken: string; sizeBytes?: number; mimeType?: string | null },
  ) => req<{ node: MediaNode }>(`/nodes/${folderId}/upload/complete`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updateNode: (nodeId: string, patch: Partial<{ name: string; parentId: string | null; sizeBytes: number; mimeType: string | null }>) =>
    req<{ node: MediaNode }>(`/nodes/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteNode: (nodeId: string) => req<void>(`/nodes/${nodeId}`, { method: "DELETE" }),
  getDownloadUrl: (nodeId: string) => req<{ downloadUrl: string; expiresInSeconds: number }>(`/nodes/${nodeId}/download`),
  searchUsers: (q: string) => req<Array<{ id: number; email: string; name: string }>>(`/nodes/users/search?q=${encodeURIComponent(q)}`),
  shareNode: (nodeId: string, granteeId: number, role: PermissionRole) => req<{ permission: unknown }>(`/nodes/${nodeId}/share`, {
    method: "POST",
    body: JSON.stringify({ granteeId, role }),
  }),
  revokeShare: (nodeId: string, userId: number) => req<void>(`/nodes/${nodeId}/share/${userId}`, { method: "DELETE" }),
  getPermissions: (nodeId: string) => req<Array<{
    id: string;
    granteeId: number;
    role: PermissionRole;
    inherited: boolean;
    grantedAt: string;
    granteeEmail: string;
    granteeName: string;
  }>>(`/nodes/${nodeId}/permissions`),
  createShareLink: (nodeId: string, role: PermissionRole, expiresAt?: string | null) => req<{
    id: string;
    token: string;
    role: PermissionRole;
    expiresAt: string | null;
    createdAt: string;
    url: string;
  }>(`/nodes/${nodeId}/links`, {
    method: "POST",
    body: JSON.stringify({ role, expiresAt: expiresAt ?? null }),
  }),
};
