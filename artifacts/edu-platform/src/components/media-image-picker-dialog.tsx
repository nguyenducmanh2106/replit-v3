import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { mediaApi, type MediaNode, type NodeListItem } from "@/lib/media-api";
import { ChevronLeft, FileImage, Folder, ImageOff } from "lucide-react";

type MediaImagePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (node: MediaNode) => void;
};

type Breadcrumb = {
  id: string;
  name: string;
};

function getFileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

function isImageFile(node: MediaNode): boolean {
  const extension = getFileExtension(node.name);
  return node.mimeType?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension);
}

export function MediaImagePickerDialog({ open, onOpenChange, onSelect }: MediaImagePickerDialogProps) {
  const { toast } = useToast();
  const [folderId, setFolderId] = useState<"root" | string>("root");
  const [items, setItems] = useState<NodeListItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const visibleItems = useMemo(
    () => items.filter(({ node }) => node.type === "folder" || isImageFile(node)),
    [items],
  );

  useEffect(() => {
    if (!open) return;

    async function load() {
      setIsLoading(true);
      try {
        if (folderId === "root") {
          const list = await mediaApi.listChildren("root");
          setItems(list.items);
          setBreadcrumbs([]);
          return;
        }

        const [detail, list] = await Promise.all([
          mediaApi.getNode(folderId),
          mediaApi.listChildren(folderId),
        ]);

        setItems(list.items);
        setBreadcrumbs(detail.ancestors.map((item) => ({ id: item.id, name: item.name })));
      } catch (error) {
        toast({
          title: "Không thể tải Media Manager",
          description: error instanceof Error ? error.message : "Vui lòng thử lại.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [folderId, open, toast]);

  function handleBack() {
    if (breadcrumbs.length <= 1) {
      setFolderId("root");
      return;
    }

    setFolderId(breadcrumbs[breadcrumbs.length - 2].id);
  }

  function handleSelect(node: MediaNode) {
    onSelect(node);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Thêm ảnh từ Media Manager</DialogTitle>
        </DialogHeader>

        <div className="flex h-12 items-center gap-2 border-b px-5 text-sm">
          <Button type="button" variant="ghost" size="sm" onClick={handleBack} disabled={folderId === "root"}>
            <ChevronLeft className="h-4 w-4" />
            Quay lại
          </Button>
          <div className="min-w-0 flex-1 truncate text-muted-foreground">
            <button type="button" className="hover:text-foreground" onClick={() => setFolderId("root")}>
              media
            </button>
            {breadcrumbs.map((item) => (
              <span key={item.id}>
                <span className="px-1">/</span>
                <button type="button" className="hover:text-foreground" onClick={() => setFolderId(item.id)}>
                  {item.name}
                </button>
              </span>
            ))}
          </div>
        </div>

        <ScrollArea className="h-[460px]">
          <div className="p-5">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-32 rounded-md" />
                ))}
              </div>
            ) : visibleItems.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleItems.map(({ node }) => {
                  const isFolder = node.type === "folder";
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className="group overflow-hidden rounded-md border bg-background text-left transition-colors hover:border-primary"
                      onClick={() => (isFolder ? setFolderId(node.id) : handleSelect(node))}
                    >
                      <div className="flex h-24 items-center justify-center bg-muted/40">
                        {isFolder ? (
                          <Folder className="h-8 w-8 text-muted-foreground" />
                        ) : (
                          <img
                            src={mediaApi.getContentUrl(node.id)}
                            alt={node.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2">
                        {isFolder ? (
                          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileImage className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate text-sm font-medium">{node.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-60 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <ImageOff className="h-8 w-8" />
                <p>Không có ảnh trong thư mục này.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
