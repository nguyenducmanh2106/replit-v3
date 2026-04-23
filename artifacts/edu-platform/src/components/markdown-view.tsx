import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
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

  // Replace __BLANK__ with inline HTML span for styling
  const processed = source.replace(/__BLANK__/g, '<span style="color: #27ae60" class="blank-token">__BLANK__</span>');

  const sanitizeSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames || []), "span"],
    attributes: {
      ...defaultSchema.attributes,
      span: [...(defaultSchema.attributes?.span || []), "style", "class"],
    },
  };

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
        rehypePlugins={[[rehypeSanitize, sanitizeSchema], rehypeRaw]}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
