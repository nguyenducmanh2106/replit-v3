import { Emoji, gitHubEmojis } from "@tiptap/extension-emoji";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Mention } from "@tiptap/extension-mention";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Typography } from "@tiptap/extension-typography";
import { UniqueID } from "@tiptap/extension-unique-id";
import { Placeholder, Selection } from "@tiptap/extensions";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useEffect } from "react";

import { Indent } from "@/components/tiptap-extension/indent-extension";
import { ListNormalizationExtension } from "@/components/tiptap-extension/list-normalization-extension";
import { NodeAlignment } from "@/components/tiptap-extension/node-alignment-extension";
import { NodeBackground } from "@/components/tiptap-extension/node-background-extension";
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension";
import { Image } from "@/components/tiptap-node/image-node/image-node-extension";
import { TableKit } from "@/components/tiptap-node/table-node/extensions/table-node-extension";
import { EmojiDropdownMenu } from "@/components/tiptap-ui/emoji-dropdown-menu";
import { MentionDropdownMenu } from "@/components/tiptap-ui/mention-dropdown-menu";
import { SlashDropdownMenu } from "@/components/tiptap-ui/slash-dropdown-menu";
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils";

import "@/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@/components/tiptap-node/code-block-node/code-block-node.scss";
import "@/components/tiptap-node/heading-node/heading-node.scss";
import "@/components/tiptap-node/image-node/image-node.scss";
import "@/components/tiptap-node/list-node/list-node.scss";
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss";
import "@/components/tiptap-node/table-node/styles/prosemirror-table.scss";
import "@/components/tiptap-node/table-node/styles/table-node.scss";
import "@/components/tiptap-templates/notion-like/notion-like-editor.scss";
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

function getEditorContent(content: unknown): JSONContent {
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
  const editor = useEditor({
    immediatelyRender: false,
    content: getEditorContent(initialContent),
    editorProps: {
      attributes: {
        class: "notion-like-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        dropcursor: {
          width: 2,
        },
        link: { openOnClick: false },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder,
        emptyNodeClass: "is-empty with-slash",
      }),
      Mention,
      Emoji.configure({
        emojis: gitHubEmojis.filter(
          (emoji) => !emoji.name.includes("regional"),
        ),
        forceFallbackImages: true,
      }),
      TableKit.configure({
        table: {
          resizable: true,
          cellMinWidth: 120,
        },
      }),
      NodeBackground.configure({
        types: [
          "paragraph",
          "heading",
          "blockquote",
          "taskList",
          "bulletList",
          "orderedList",
          "tableCell",
          "tableHeader",
        ],
      }),
      NodeAlignment,
      TextStyle,
      Superscript,
      Subscript,
      Indent,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Selection,
      Image,
      ListNormalizationExtension,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
      UniqueID.configure({
        types: [
          "table",
          "paragraph",
          "bulletList",
          "orderedList",
          "taskList",
          "heading",
          "blockquote",
          "codeBlock",
        ],
      }),
      Typography,
    ],
    onUpdate({ editor }) {
      onChange(editor.getJSON());
    },
  });

  useEffect(() => {
    if (!editor) return;

    editor.commands.setContent(getEditorContent(initialContent), {
      emitUpdate: false,
    });
    onChange(editor.getJSON());
  }, [editor, initialContent, onChange]);

  if (!editor) {
    return null;
  }

  return (
    <div className="notion-like-editor-wrapper">
      {/* <EditorContent
        editor={editor}
        role="presentation"
        className="notion-like-editor-content"
      >
        <EmojiDropdownMenu editor={editor} />
        <MentionDropdownMenu editor={editor} />
        <SlashDropdownMenu editor={editor} />
      </EditorContent> */}

      <NotionEditor room="my-document-room" placeholder="Start writing..." />
    </div>
  );
}
