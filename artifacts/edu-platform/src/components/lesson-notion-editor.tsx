import type { JSONContent } from "@tiptap/react";
import { NotionEditor } from "./tiptap-templates/notion-like/notion-like-editor";

type LessonNotionEditorProps = {
  initialContent?: unknown;
  placeholder?: string;
  onChange: (content: unknown) => void;
};

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function parseInitialContent(content: unknown): JSONContent {
  if (!content || typeof content !== "object") {
    return EMPTY_DOC;
  }
  return content as JSONContent;
}

export function LessonNotionEditor({
  initialContent,
  placeholder = "Start writing...",
  onChange,
}: LessonNotionEditorProps) {
  const handleChange = (json: JSONContent) => {
    onChange(json);
  };

  return (
    <NotionEditor
      room="my-document-room"
      placeholder={placeholder}
      initialContent={parseInitialContent(initialContent)}
      onChange={handleChange}
    />
  );
}
