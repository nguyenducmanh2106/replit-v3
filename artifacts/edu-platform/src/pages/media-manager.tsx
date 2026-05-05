import { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  mediaApi,
  type MediaNode,
  type MediaPermission,
  type MediaUserSearchResult,
  type NodeListItem,
  type PermissionRole,
} from "@/lib/media-api";
import {
  ChevronLeft,
  Copy,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Folder,
  FolderPlus,
  Share2,
  Upload,
} from "lucide-react";

type FilePreview =
  | { type: "image"; name: string; url: string }
  | { type: "pdf"; name: string; url: string }
  | { type: "text"; name: string; content: string }
  | { type: "document"; name: string; officeViewerUrl: string };

type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
};

type Breadcrumb = {
  id: string;
  name: string;
  type: "folder" | "file";
};

type MediaManagerPageProps = {
  currentNodeId: "root" | string;
  navigateToNode: (nodeId: "root" | string) => void;
};

const MEDIA_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

async function uploadFileWithProgress(url: string, file: File, onProgress: (value: number) => void): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = evt => {
      if (!evt.lengthComputable) return;
      onProgress(Math.round((evt.loaded / evt.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.send(file);
  });
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  if (isToday(date)) return `Today, ${format(date, "HH:mm")}`;
  return format(date, "dd/MM/yyyy HH:mm");
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(1)} MiB`;
  return `${(mib / 1024).toFixed(1)} GiB`;
}

function getFileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

function isPdfFile(node: MediaNode): boolean {
  return node.mimeType === "application/pdf" || getFileExtension(node.name) === "pdf";
}

function isImageFile(node: MediaNode): boolean {
  const extension = getFileExtension(node.name);
  return node.mimeType?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension);
}

function isTextFile(node: MediaNode): boolean {
  const extension = getFileExtension(node.name);
  return node.mimeType?.startsWith("text/") || ["txt", "md", "csv", "json", "log"].includes(extension);
}

function renderNodeIcon(node: MediaNode) {
  if (node.type === "folder") {
    return <Folder className="h-4 w-4 shrink-0 text-[#6b7280]" />;
  }

  const extension = getFileExtension(node.name);
  if (isImageFile(node)) {
    return <FileImage className="h-4 w-4 shrink-0 text-[#7c3aed]" />;
  }
  if (isPdfFile(node)) {
    return <FileText className="h-4 w-4 shrink-0 text-[#dc2626]" />;
  }
  if (["doc", "docx"].includes(extension) || node.mimeType?.includes("wordprocessingml")) {
    return <FileType className="h-4 w-4 shrink-0 text-[#2563eb]" />;
  }
  if (["xls", "xlsx", "csv"].includes(extension) || node.mimeType?.includes("spreadsheetml") || node.mimeType === "text/csv") {
    return <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#16a34a]" />;
  }
  if (isTextFile(node)) {
    return <FileText className="h-4 w-4 shrink-0 text-[#4b5563]" />;
  }
  return <FileIcon className="h-4 w-4 shrink-0 text-[#6b7280]" />;
}

export default function MediaManagerPage({ currentNodeId, navigateToNode }: MediaManagerPageProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<NodeListItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [listFolderId, setListFolderId] = useState<"root" | string>("root");
  const [activeNode, setActiveNode] = useState<MediaNode | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shareTarget, setShareTarget] = useState<MediaNode | null>(null);
  const [sharePermissions, setSharePermissions] = useState<MediaPermission[]>([]);
  const [shareUsers, setShareUsers] = useState<MediaUserSearchResult[]>([]);
  const [shareUserQuery, setShareUserQuery] = useState("");
  const [shareRole, setShareRole] = useState<PermissionRole>("viewer");
  const [shareLinkRole, setShareLinkRole] = useState<PermissionRole>("viewer");
  const [shareLinkUrl, setShareLinkUrl] = useState("");
  const [isShareLoading, setIsShareLoading] = useState(false);

  const canUploadHere = listFolderId !== "root";
  const isViewingFile = activeNode?.type === "file";

  async function openPreview(node: MediaNode) {
    try {
      if (isImageFile(node)) {
        setFilePreview({ type: "image", name: node.name, url: mediaApi.getContentUrl(node.id) });
        return;
      }
      if (isPdfFile(node)) {
        setFilePreview({ type: "pdf", name: node.name, url: mediaApi.getContentUrl(node.id) });
        return;
      }
      if (isTextFile(node)) {
        const content = await mediaApi.getTextContent(node.id);
        setFilePreview({ type: "text", name: node.name, content });
        return;
      }
      const data = await mediaApi.getDownloadUrl(node.id);
      setFilePreview({
        type: "document",
        name: node.name,
        officeViewerUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.downloadUrl)}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to open preview",
        variant: "destructive",
      });
    }
  }

  async function reload() {
    setIsLoading(true);
    setSelectedIds(new Set());

    try {
      if (currentNodeId === "root") {
        const list = await mediaApi.listChildren("root");
        setItems(list.items);
        setActiveNode(null);
        setListFolderId("root");
        setBreadcrumbs([]);
        return;
      }

      const detail = await mediaApi.getNode(currentNodeId);
      const current = detail.node;
      setActiveNode(current);

      const chain = detail.ancestors.map(item => ({ id: item.id, name: item.name, type: item.type }));
      setBreadcrumbs(chain);

      const folderIdForList: "root" | string = current.type === "folder"
        ? current.id
        : (current.parentId ?? "root");

      setListFolderId(folderIdForList);
      const list = await mediaApi.listChildren(folderIdForList);
      setItems(list.items);

      if (current.type === "file") {
        await openPreview(current);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load folder",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId]);

  const breadcrumbView = useMemo(() => {
    const base = [{ id: "root", name: "media" }];
    for (const item of breadcrumbs) {
      base.push({ id: item.id, name: item.name });
    }
    return base;
  }, [breadcrumbs]);

  const isAllSelected = items.length > 0 && items.every(item => selectedIds.has(item.node.id));

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map(item => item.node.id)));
  }

  function toggleOne(nodeId: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(nodeId); else next.delete(nodeId);
    setSelectedIds(next);
  }

  async function handleCreateFolder() {
    const folderName = window.prompt("Create new path");
    if (!folderName || !folderName.trim()) return;

    try {
      await mediaApi.createFolder({
        name: folderName.trim(),
        parentId: listFolderId === "root" ? null : listFolderId,
      });
      await reload();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create folder",
        variant: "destructive",
      });
    }
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    if (listFolderId === "root") {
      toast({ title: "Select a folder before upload", variant: "destructive" });
      return;
    }

    const files = Array.from(fileList);
    for (const file of files) {
      const queueId = `${Date.now()}-${Math.random()}`;
      setUploadQueue(prev => [...prev, { id: queueId, name: file.name, progress: 0, status: "uploading" }]);

      try {
        if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
          throw new Error(`File exceeds maximum upload size of ${MEDIA_MAX_UPLOAD_BYTES / 1024 / 1024}MB`);
        }

        const prepared = await mediaApi.prepareUpload(listFolderId, {
          name: file.name,
          mimeType: file.type || undefined,
          sizeBytes: file.size,
        });

        await uploadFileWithProgress(prepared.uploadUrl, file, progress => {
          setUploadQueue(prev => prev.map(item => item.id === queueId ? { ...item, progress } : item));
        });

        await mediaApi.completeUpload(listFolderId, {
          draftToken: prepared.draftToken,
          sizeBytes: file.size,
          mimeType: file.type || null,
        });

        setUploadQueue(prev => prev.map(item => item.id === queueId ? { ...item, progress: 100, status: "success" } : item));
      } catch (error) {
        setUploadQueue(prev => prev.map(item => item.id === queueId
          ? { ...item, status: "error", error: error instanceof Error ? error.message : "Upload failed" }
          : item));
      }
    }

    await reload();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(node: MediaNode) {
    const confirmed = window.confirm(`Delete \"${node.name}\"?`);
    if (!confirmed) return;

    try {
      await mediaApi.deleteNode(node.id);
      if (currentNodeId === node.id) {
        navigateToNode(node.parentId ?? "root");
        return;
      }
      await reload();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      });
    }
  }

  function handleOpen(node: MediaNode) {
    if (node.type !== "folder") return;
    navigateToNode(node.id);
  }

  function handleBack() {
    if (currentNodeId === "root") return;
    if (!activeNode) {
      navigateToNode("root");
      return;
    }
    navigateToNode(activeNode.parentId ?? "root");
  }

  async function handleCopyPath() {
    await navigator.clipboard.writeText(window.location.href);
    toast({ title: "Path copied" });
  }

  async function loadSharePermissions(node: MediaNode) {
    try {
      const permissions = await mediaApi.getPermissions(node.id);
      setSharePermissions(permissions);
    } catch (error) {
      setSharePermissions([]);
      toast({
        title: "Cannot load permissions",
        description: error instanceof Error ? error.message : "Only the owner can view sharing permissions",
        variant: "destructive",
      });
    }
  }

  async function openShareDialog(node: MediaNode) {
    setShareTarget(node);
    setShareUsers([]);
    setShareUserQuery("");
    setShareLinkUrl("");
    await loadSharePermissions(node);
  }

  async function handleSearchUsers() {
    if (!shareUserQuery.trim()) return;
    setIsShareLoading(true);
    try {
      const users = await mediaApi.searchUsers(shareUserQuery.trim());
      setShareUsers(users);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to search users",
        variant: "destructive",
      });
    } finally {
      setIsShareLoading(false);
    }
  }

  async function handleGrantShare(userId: number) {
    if (!shareTarget) return;
    setIsShareLoading(true);
    try {
      await mediaApi.shareNode(shareTarget.id, userId, shareRole);
      await loadSharePermissions(shareTarget);
      toast({ title: "Permission updated" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update permission",
        variant: "destructive",
      });
    } finally {
      setIsShareLoading(false);
    }
  }

  async function handleRevokeShare(userId: number) {
    if (!shareTarget) return;
    setIsShareLoading(true);
    try {
      await mediaApi.revokeShare(shareTarget.id, userId);
      await loadSharePermissions(shareTarget);
      toast({ title: "Permission removed" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove permission",
        variant: "destructive",
      });
    } finally {
      setIsShareLoading(false);
    }
  }

  async function handleCreateShareLink() {
    if (!shareTarget) return;
    setIsShareLoading(true);
    try {
      const link = await mediaApi.createShareLink(shareTarget.id, shareLinkRole);
      setShareLinkUrl(link.url);
      await navigator.clipboard.writeText(link.url);
      toast({ title: "Share link copied" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create share link",
        variant: "destructive",
      });
    } finally {
      setIsShareLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-[#d8d8d8] bg-[#f5f5f5]">
      <div className="flex items-center gap-2 border-b border-[#d8d8d8] bg-[#efefef] px-2 py-1.5">
        <button
          type="button"
          onClick={handleBack}
          className="rounded border border-[#d0d0d0] bg-white p-1 hover:bg-[#f6f6f6] disabled:opacity-40"
          disabled={currentNodeId === "root"}
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 truncate text-sm text-[#6b7280]">
          {breadcrumbView.map((item, index) => (
            <span key={item.id}>
              <button
                type="button"
                onClick={() => navigateToNode(item.id === "root" ? "root" : item.id)}
                className="hover:text-[#111827]"
              >
                {item.name}
              </button>
              {index < breadcrumbView.length - 1 ? <span>{" / "}</span> : null}
            </span>
          ))}
        </div>

        <Button variant="outline" size="icon" onClick={handleCopyPath}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={handleCreateFolder}>
          <FolderPlus className="h-4 w-4" />
          Create new path
        </Button>
      </div>

      <div className="px-2 pb-2">
        <div className="mb-2 flex items-center justify-between">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!canUploadHere}>
            <Upload className="h-4 w-4" />
            Upload
          </Button>
          {isViewingFile ? <span className="text-xs text-[#6b7280]">Viewing file route</span> : null}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={e => handleFilesSelected(e.target.files)}
          />
        </div>

        <div className="overflow-hidden rounded border border-[#d8d8d8] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#f3f3f3]">
              <tr className="border-b border-[#e2e2e2] text-left">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={e => toggleAll(e.target.checked)}
                  />
                </th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="w-48 px-3 py-2 font-semibold">Last Modified</th>
                <th className="w-32 px-3 py-2 font-semibold">Size</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[#6b7280]">Loading...</td>
                </tr>
              ) : null}

              {!isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[#6b7280]">Empty</td>
                </tr>
              ) : null}

              {!isLoading ? items.map(item => {
                const node = item.node;
                const isActive = currentNodeId === node.id;
                const canDeleteNode = item.access.role === "owner";
                return (
                  <tr key={node.id} className={`group border-b border-[#efefef] hover:bg-[#fafafa] ${isActive ? "bg-[#f0f7ff]" : ""}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(node.id)}
                        onChange={e => toggleOne(node.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        {node.type === "folder" ? (
                          <button
                            type="button"
                            onClick={() => handleOpen(node)}
                            className="flex min-w-0 items-center gap-2 text-left hover:text-[#111827]"
                          >
                            {renderNodeIcon(node)}
                            <span className="truncate">{node.name}</span>
                            {item.shared ? <span className="rounded bg-[#eef2ff] px-1.5 py-0.5 text-xs text-[#4f46e5]">Shared</span> : null}
                          </button>
                        ) : (
                          <div className="flex min-w-0 items-center gap-2 text-left">
                            {renderNodeIcon(node)}
                            <span className="truncate">{node.name}</span>
                            {item.shared ? <span className="rounded bg-[#eef2ff] px-1.5 py-0.5 text-xs text-[#4f46e5]">Shared</span> : null}
                          </div>
                        )}
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          {node.type === "file" ? (
                            <Button variant="ghost" size="sm" onClick={() => openPreview(node)}>Preview</Button>
                          ) : null}
                          {node.type === "file" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const data = await mediaApi.getDownloadUrl(node.id);
                                window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
                              }}
                            >
                              Download
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="sm" onClick={() => openShareDialog(node)}>
                            <Share2 className="h-3.5 w-3.5" />
                            Share
                          </Button>
                          {canDeleteNode ? (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(node)}>Delete</Button>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[#4b5563]">{formatUpdatedAt(node.updatedAt)}</td>
                    <td className="px-3 py-2 text-[#4b5563]">{node.type === "folder" ? "-" : formatSize(node.sizeBytes)}</td>
                  </tr>
                );
              }) : null}
            </tbody>
          </table>
        </div>
      </div>

      {uploadQueue.length > 0 ? (
        <div className="border-t border-[#e2e2e2] bg-white px-3 py-2">
          <div className="space-y-1 text-xs">
            {uploadQueue.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <span className="truncate">{item.name}</span>
                <span>
                  {item.status === "uploading" ? `${item.progress}%` : item.status === "success" ? "Done" : item.error ?? "Failed"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={!!filePreview} onOpenChange={open => { if (!open) setFilePreview(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{filePreview?.name}</DialogTitle>
          </DialogHeader>
          {filePreview?.type === "image" ? (
            <img src={filePreview.url} alt={filePreview.name} className="max-h-[70vh] w-full rounded object-contain" />
          ) : null}
          {filePreview?.type === "pdf" ? (
            <iframe
              src={filePreview.url}
              title={filePreview.name}
              className="h-[75vh] w-full rounded border"
            />
          ) : null}
          {filePreview?.type === "text" ? (
            <pre className="max-h-[75vh] overflow-auto rounded border bg-[#fafafa] p-3 text-sm leading-6 text-[#111827]">
              {filePreview.content}
            </pre>
          ) : null}
          {filePreview?.type === "document" ? (
            <iframe
              src={filePreview.officeViewerUrl}
              title={filePreview.name}
              className="h-[70vh] w-full rounded border"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareTarget} onOpenChange={open => { if (!open) setShareTarget(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Share {shareTarget?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded border border-[#e5e7eb] p-3">
              <div className="mb-2 text-sm font-semibold text-[#111827]">People with access</div>
              {sharePermissions.length === 0 ? (
                <div className="text-sm text-[#6b7280]">No direct permissions yet.</div>
              ) : (
                <div className="space-y-2">
                  {sharePermissions.map(permission => (
                    <div key={permission.id} className="flex items-center justify-between gap-3 rounded bg-[#f9fafb] px-2 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[#111827]">{permission.granteeName || permission.granteeEmail}</div>
                        <div className="truncate text-xs text-[#6b7280]">{permission.granteeEmail}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-[#d1d5db] px-2 py-1 text-xs capitalize text-[#374151]">{permission.role}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleRevokeShare(permission.granteeId)} disabled={isShareLoading}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded border border-[#e5e7eb] p-3">
              <div className="mb-2 text-sm font-semibold text-[#111827]">Add people</div>
              <div className="flex gap-2">
                <input
                  value={shareUserQuery}
                  onChange={e => setShareUserQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void handleSearchUsers(); }}
                  placeholder="Search by name or email"
                  className="min-w-0 flex-1 rounded border border-[#d1d5db] px-3 py-2 text-sm"
                />
                <select
                  value={shareRole}
                  onChange={e => setShareRole(e.target.value as PermissionRole)}
                  className="rounded border border-[#d1d5db] px-2 py-2 text-sm"
                >
                  <option value="viewer">View</option>
                  <option value="editor">Edit</option>
                </select>
                <Button variant="outline" onClick={handleSearchUsers} disabled={isShareLoading}>Search</Button>
              </div>
              {shareUsers.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {shareUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between gap-3 rounded bg-[#f9fafb] px-2 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[#111827]">{user.name || user.email}</div>
                        <div className="truncate text-xs text-[#6b7280]">{user.email}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleGrantShare(user.id)} disabled={isShareLoading}>
                        Grant {shareRole === "viewer" ? "view" : "edit"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded border border-[#e5e7eb] p-3">
              <div className="mb-2 text-sm font-semibold text-[#111827]">Share link</div>
              <div className="flex gap-2">
                <select
                  value={shareLinkRole}
                  onChange={e => setShareLinkRole(e.target.value as PermissionRole)}
                  className="rounded border border-[#d1d5db] px-2 py-2 text-sm"
                >
                  <option value="viewer">View link</option>
                  <option value="editor">Edit link</option>
                </select>
                <Button variant="outline" onClick={handleCreateShareLink} disabled={isShareLoading}>
                  Create link
                </Button>
              </div>
              {shareLinkUrl ? (
                <input
                  readOnly
                  value={shareLinkUrl}
                  className="mt-2 w-full rounded border border-[#d1d5db] px-3 py-2 text-sm text-[#374151]"
                />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
