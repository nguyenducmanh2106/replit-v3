import { useRef, useState, useCallback, useEffect } from "react";
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Link2, Code, Quote, Eye, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownView } from "./markdown-view";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  id?: string;
  disabled?: boolean;
}

type WrapAction = { kind: "wrap"; before: string; after: string; placeholder?: string };
type LineAction = { kind: "line"; prefix: string; placeholder?: string };
type Action = WrapAction | LineAction;

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Soạn nội dung (hỗ trợ Markdown: **đậm**, *nghiêng*, # tiêu đề, - danh sách)...",
  rows = 6,
  className,
  id,
  disabled = false,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  const apply = useCallback((action: Action) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);

    if (action.kind === "wrap") {
      const text = selected || action.placeholder || "";
      const next = `${before}${action.before}${text}${action.after}${after}`;
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        const cursorStart = before.length + action.before.length;
        ta.setSelectionRange(cursorStart, cursorStart + text.length);
      });
    } else {
      const lineStart = before.lastIndexOf("\n") + 1;
      const text = selected || action.placeholder || "";
      const newSegment = `${action.prefix}${text}`;
      const next = `${value.slice(0, lineStart)}${value.slice(lineStart, start)}${newSegment}${after}`;
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        const cursor = lineStart + (start - lineStart) + newSegment.length;
        ta.setSelectionRange(cursor, cursor);
      });
    }
  }, [value, onChange]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b") { e.preventDefault(); apply({ kind: "wrap", before: "**", after: "**", placeholder: "đậm" }); }
      else if (e.key === "i") { e.preventDefault(); apply({ kind: "wrap", before: "*", after: "*", placeholder: "nghiêng" }); }
      else if (e.key === "k") {
        e.preventDefault();
        const url = window.prompt("Nhập URL:", "https://");
        if (url) apply({ kind: "wrap", before: "[", after: `](${url})`, placeholder: "văn bản liên kết" });
      }
    }
  }, [apply]);

  useEffect(() => {
    if (tab === "edit") {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [tab]);

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <div className="flex items-center justify-between border-b px-2 py-1 gap-1">
        <div className="flex items-center gap-0.5 flex-wrap">
          <ToolbarBtn label="Đậm (Ctrl+B)" onClick={() => apply({ kind: "wrap", before: "**", after: "**", placeholder: "đậm" })} disabled={disabled || tab !== "edit"}>
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Nghiêng (Ctrl+I)" onClick={() => apply({ kind: "wrap", before: "*", after: "*", placeholder: "nghiêng" })} disabled={disabled || tab !== "edit"}>
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <Separator />
          <ToolbarBtn label="Tiêu đề lớn" onClick={() => apply({ kind: "line", prefix: "# ", placeholder: "Tiêu đề" })} disabled={disabled || tab !== "edit"}>
            <Heading1 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Tiêu đề nhỏ" onClick={() => apply({ kind: "line", prefix: "## ", placeholder: "Tiêu đề" })} disabled={disabled || tab !== "edit"}>
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <Separator />
          <ToolbarBtn label="Danh sách" onClick={() => apply({ kind: "line", prefix: "- ", placeholder: "mục" })} disabled={disabled || tab !== "edit"}>
            <List className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Danh sách đánh số" onClick={() => apply({ kind: "line", prefix: "1. ", placeholder: "mục" })} disabled={disabled || tab !== "edit"}>
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Trích dẫn" onClick={() => apply({ kind: "line", prefix: "> ", placeholder: "trích dẫn" })} disabled={disabled || tab !== "edit"}>
            <Quote className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <Separator />
          <ToolbarBtn label="Code inline" onClick={() => apply({ kind: "wrap", before: "`", after: "`", placeholder: "code" })} disabled={disabled || tab !== "edit"}>
            <Code className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            label="Liên kết (Ctrl+K)"
            onClick={() => {
              const url = window.prompt("Nhập URL:", "https://");
              if (url) apply({ kind: "wrap", before: "[", after: `](${url})`, placeholder: "văn bản liên kết" });
            }}
            disabled={disabled || tab !== "edit"}
          >
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={tab === "edit" ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setTab("edit")}
            disabled={disabled}
          >
            <Edit3 className="h-3 w-3 mr-1" /> Soạn
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "preview" ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setTab("preview")}
            disabled={disabled}
          >
            <Eye className="h-3 w-3 mr-1" /> Xem
          </Button>
        </div>
      </div>
      {tab === "edit" ? (
        <Textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className="border-0 focus-visible:ring-0 rounded-none rounded-b-md font-mono text-sm resize-y"
        />
      ) : (
        <div className="min-h-[140px] p-3">
          {value.trim() ? (
            <MarkdownView source={value} />
          ) : (
            <p className="text-sm text-muted-foreground italic">(Chưa có nội dung để xem trước)</p>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span className="mx-0.5 h-4 w-px bg-border" />;
}
