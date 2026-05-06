import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor, type Editor, type JSONContent } from "@tiptap/react"
import type { Doc as YDoc } from "yjs"
import type { TiptapCollabProvider } from "@tiptap-pro/provider"
import { createPortal } from "react-dom"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Mention } from "@tiptap/extension-mention"
import { TaskList, TaskItem } from "@tiptap/extension-list"
import { Color, TextStyle } from "@tiptap/extension-text-style"
import { Placeholder, Selection } from "@tiptap/extensions"
import { Collaboration, isChangeOrigin } from "@tiptap/extension-collaboration"
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Superscript } from "@tiptap/extension-superscript"
import { Subscript } from "@tiptap/extension-subscript"
import { TextAlign } from "@tiptap/extension-text-align"
import { Mathematics } from "@tiptap/extension-mathematics"
import { Ai } from "@tiptap-pro/extension-ai"
import { UniqueID } from "@tiptap/extension-unique-id"
import { Emoji, gitHubEmojis } from "@tiptap/extension-emoji"
import {
  getHierarchicalIndexes,
  TableOfContents,
} from "@tiptap/extension-table-of-contents"

// --- Hooks ---
import { useUiEditorState } from "@/hooks/use-ui-editor-state"
import { useScrollToHash } from "@/components/tiptap-ui/copy-anchor-link-button/use-scroll-to-hash"

// --- Custom Extensions ---
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { UiState } from "@/components/tiptap-extension/ui-state-extension"
import { Image } from "@/components/tiptap-node/image-node/image-node-extension"
import { NodeBackground } from "@/components/tiptap-extension/node-background-extension"
import { NodeAlignment } from "@/components/tiptap-extension/node-alignment-extension"
import { TocNode } from "@/components/tiptap-node/toc-node/extensions/toc-node-extension"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"

// --- Table Node ---
import { TableKit } from "@/components/tiptap-node/table-node/extensions/table-node-extension"
import { TableHandleExtension } from "@/components/tiptap-node/table-node/extensions/table-handle"
import { TableHandle } from "@/components/tiptap-node/table-node/ui/table-handle/table-handle"
import { TableSelectionOverlay } from "@/components/tiptap-node/table-node/ui/table-selection-overlay"
import { TableCellHandleMenu } from "@/components/tiptap-node/table-node/ui/table-cell-handle-menu"
import { TableExtendRowColumnButtons } from "@/components/tiptap-node/table-node/ui/table-extend-row-column-button"
import "@/components/tiptap-node/table-node/styles/prosemirror-table.scss"
import "@/components/tiptap-node/table-node/styles/table-node.scss"

import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { EmojiDropdownMenu } from "@/components/tiptap-ui/emoji-dropdown-menu"
import { MentionDropdownMenu } from "@/components/tiptap-ui/mention-dropdown-menu"
import { SlashDropdownMenu } from "@/components/tiptap-ui/slash-dropdown-menu"
import type { SlashMenuConfig } from "@/components/tiptap-ui/slash-dropdown-menu/use-slash-dropdown-menu"
import { DragContextMenu } from "@/components/tiptap-ui/drag-context-menu"
import { AiMenu } from "@/components/tiptap-ui/ai-menu"

// --- Contexts ---
import { UserProvider, useUser } from "@/contexts/user-context"
import { CollabProvider, useCollab } from "@/contexts/collab-context"
import { AiProvider, useAi } from "@/contexts/ai-context"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"
import { TIPTAP_AI_APP_ID } from "@/lib/tiptap-collab-utils"
import { mediaApi, type MediaNode } from "@/lib/media-api"

// --- Styles ---
import "@/components/tiptap-templates/notion-like/notion-like-editor.scss"

// --- Content ---
import { NotionEditorHeader } from "@/components/tiptap-templates/notion-like/notion-like-editor-header"
import { MobileToolbar } from "@/components/tiptap-templates/notion-like/notion-like-editor-mobile-toolbar"
import { NotionToolbarFloating } from "@/components/tiptap-templates/notion-like/notion-like-editor-toolbar-floating"
import { SetupErrorMessage } from "@/components/tiptap-templates/notion-like/setup-error-message"
import { TocSidebar } from "@/components/tiptap-node/toc-node"
import {
  TocProvider,
  useToc,
} from "@/components/tiptap-node/toc-node/context/toc-context"
import { ListNormalizationExtension } from "@/components/tiptap-extension/list-normalization-extension"
import { Indent } from "@/components/tiptap-extension/indent-extension"
import { ImagePlusIcon } from "@/components/tiptap-icons/image-plus-icon"
import { MediaImagePickerDialog } from "@/components/media-image-picker-dialog"

export interface NotionEditorProps {
  room: string
  placeholder?: string
  initialContent?: JSONContent
  onChange?: (content: JSONContent) => void
  enableMediaImagePicker?: boolean
}

export interface EditorProviderProps {
  provider: TiptapCollabProvider
  ydoc: YDoc
  placeholder?: string
  aiToken: string | null
  initialContent?: JSONContent
  onChange?: (content: JSONContent) => void
  enableMediaImagePicker?: boolean
}

/**
 * Loading spinner component shown while connecting to the notion server
 */
export function LoadingSpinner({ text = "Connecting..." }: { text?: string }) {
  return (
    <div className="spinner-container">
      <div className="spinner-content">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div className="spinner-loading-text">{text}</div>
      </div>
    </div>
  )
}

/**
 * EditorContent component that renders the actual editor
 */
export function EditorContentArea({ slashMenuConfig }: { slashMenuConfig?: SlashMenuConfig }) {
  const { editor } = useContext(EditorContext)!
  const {
    aiGenerationIsLoading,
    aiGenerationIsSelection,
    aiGenerationHasMessage,
    isDragging,
  } = useUiEditorState(editor)

  // Selection based effect to handle AI generation acceptance
  useEffect(() => {
    if (!editor) return

    if (
      !aiGenerationIsLoading &&
      aiGenerationIsSelection &&
      aiGenerationHasMessage
    ) {
      editor.chain().focus().aiAccept().run()
      editor.commands.resetUiState()
    }
  }, [
    aiGenerationHasMessage,
    aiGenerationIsLoading,
    aiGenerationIsSelection,
    editor,
  ])

  useScrollToHash()

  if (!editor) {
    return null
  }

  return (
    <EditorContent
      editor={editor}
      role="presentation"
      className="notion-like-editor-content"
      style={{
        cursor: isDragging ? "grabbing" : "auto",
      }}
    >
      <DragContextMenu />
      {/* <AiMenu /> */}
      <EmojiDropdownMenu />
      <MentionDropdownMenu />
      <SlashDropdownMenu config={slashMenuConfig} />
      <NotionToolbarFloating />
      {createPortal(<MobileToolbar />, document.body)}
    </EditorContent>
  )
}

/**
 * Component that creates and provides the editor instance
 */
export function EditorProvider(props: EditorProviderProps) {
  const { provider, ydoc, placeholder = "Start writing...", aiToken, initialContent, onChange, enableMediaImagePicker } = props

  const { user } = useUser()
  const { setTocContent } = useToc()
  const [isMediaImagePickerOpen, setIsMediaImagePickerOpen] = useState(false)
  const mediaImageEditorRef = useRef<Editor | null>(null)

  const slashMenuConfig = useMemo<SlashMenuConfig | undefined>(() => {
    if (!enableMediaImagePicker) return undefined

    return {
      customItems: [
        {
          title: "Thêm ảnh",
          subtext: "Chọn ảnh từ Media Manager",
          keywords: ["image", "media", "media manager", "anh", "them anh"],
          badge: ImagePlusIcon,
          group: "Upload",
          onSelect: ({ editor }) => {
            mediaImageEditorRef.current = editor
            setIsMediaImagePickerOpen(true)
          },
        },
      ],
    }
  }, [enableMediaImagePicker])

  function handleSelectMediaImage(node: MediaNode) {
    const editor = mediaImageEditorRef.current
    if (!editor) return

    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: {
          src: mediaApi.getContentUrl(node.id),
          alt: node.name,
          title: node.name,
        },
      })
      .run()
  }

  const editor = useEditor({
    immediatelyRender: false,
    content: initialContent,
    editorProps: {
      attributes: {
        class: "notion-like-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        undoRedo: false,
        horizontalRule: false,
        dropcursor: {
          width: 2,
        },
        link: { openOnClick: false },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({
        provider,
        user: { id: user.id, name: user.name, color: user.color },
      }),
      Placeholder.configure({
        placeholder,
        emptyNodeClass: "is-empty with-slash",
      }),
      Mention,
      Emoji.configure({
        emojis: gitHubEmojis.filter(
          (emoji) => !emoji.name.includes("regional")
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
          "tocNode",
        ],
      }),
      NodeAlignment,
      TextStyle,
      Mathematics,
      Superscript,
      Subscript,
      Indent,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Selection,
      Image,
      TableOfContents.configure({
        getIndex: getHierarchicalIndexes,
        onUpdate(content) {
          setTocContent(content)
        },
      }),
      TableHandleExtension,
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
          "tocNode",
        ],
        filterTransaction: (transaction) => !isChangeOrigin(transaction),
      }),
      Typography,
      UiState,
      TocNode.configure({
        topOffset: 48,
      }),
      Ai.configure({
        appId: TIPTAP_AI_APP_ID,
        token: aiToken || undefined,
        autocompletion: false,
        showDecorations: true,
        hideDecorationsOnStreamEnd: false,
        onLoading: (context) => {
          context.editor.commands.aiGenerationSetIsLoading(true)
          context.editor.commands.aiGenerationHasMessage(false)
        },
        onChunk: (context) => {
          context.editor.commands.aiGenerationSetIsLoading(true)
          context.editor.commands.aiGenerationHasMessage(true)
        },
        onSuccess: (context) => {
          const hasMessage = !!context.response
          context.editor.commands.aiGenerationSetIsLoading(false)
          context.editor.commands.aiGenerationHasMessage(hasMessage)
        },
      }),
    ],
    onUpdate({ editor }) {
      if (onChange) {
        onChange(editor.getJSON())
      }
    },
  })

  // Insert initial content into YDoc once when doc is empty and provider is ready
  const initialContentSet = useRef(false)
  useEffect(() => {
    if (!editor || !provider || initialContentSet.current) return
    const isEmpty = ydoc.getXmlFragment("default").length === 0
    if (isEmpty) {
      const defaultDoc: JSONContent = { type: "doc", content: [{ type: "paragraph" }] }
      editor.commands.setContent(initialContent ?? defaultDoc, { emitUpdate: false })
      initialContentSet.current = true
    }
  }, [editor, provider, ydoc, initialContent])

  if (!editor) {
    return <LoadingSpinner />
  }

  return (
    <div className="notion-like-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        <NotionEditorHeader />
        <div className="notion-like-editor-layout">
          <EditorContentArea slashMenuConfig={slashMenuConfig} />
          <TocSidebar topOffset={48} />
        </div>

        <TableExtendRowColumnButtons />
        <TableHandle />
        <TableSelectionOverlay
          showResizeHandles={true}
          cellMenu={(props) => (
            <TableCellHandleMenu
              editor={props.editor}
              onMouseDown={(e) => props.onResizeStart?.("br")(e)}
            />
          )}
        />
      </EditorContext.Provider>

      {enableMediaImagePicker && (
        <MediaImagePickerDialog
          open={isMediaImagePickerOpen}
          onOpenChange={setIsMediaImagePickerOpen}
          onSelect={handleSelectMediaImage}
        />
      )}
    </div>
  )
}

/**
 * Full editor with all necessary providers, ready to use with just a room ID
 */
export function NotionEditor({
  room,
  placeholder = "Start writing...",
  initialContent,
  onChange,
  enableMediaImagePicker,
}: NotionEditorProps) {
  return (
    <UserProvider>
      <CollabProvider room={room}>
        <AiProvider>
          <TocProvider>
            <NotionEditorContent
              placeholder={placeholder}
              initialContent={initialContent}
              onChange={onChange}
              enableMediaImagePicker={enableMediaImagePicker}
            />
          </TocProvider>
        </AiProvider>
      </CollabProvider>
    </UserProvider>
  )
}

/**
 * Internal component that handles the editor loading state
 */
export function NotionEditorContent({
  placeholder,
  initialContent,
  onChange,
  enableMediaImagePicker,
}: {
  placeholder?: string
  initialContent?: JSONContent
  onChange?: (content: JSONContent) => void
  enableMediaImagePicker?: boolean
}) {
  const { provider, ydoc, setupError: collabSetupError } = useCollab()
  const { aiToken, setupError: aiSetupError } = useAi()

  // Show setup error if either collab or AI setup failed
  if (collabSetupError || aiSetupError) {
    return (
      <SetupErrorMessage
        aiSetupError={aiSetupError}
        collabSetupError={collabSetupError}
      />
    )
  }

  if (!provider || !aiToken) {
    return <LoadingSpinner />
  }

  return (
    <EditorProvider
      provider={provider}
      ydoc={ydoc}
      placeholder={placeholder}
      aiToken={aiToken}
      initialContent={initialContent}
      onChange={onChange}
      enableMediaImagePicker={enableMediaImagePicker}
    />
  )
}
