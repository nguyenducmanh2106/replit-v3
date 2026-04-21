import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

interface MarkdownViewProps {
  source: string;
  className?: string;
  compact?: boolean;
}

export function MarkdownView({ source, className, compact = false }: MarkdownViewProps) {
  if (!source || !source.trim()) {
    return null;
  }
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2",
        "prose-pre:bg-muted prose-pre:text-foreground prose-code:text-foreground",
        compact && "prose-p:my-1 prose-headings:my-1",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
