import { useState, useRef, useCallback, useEffect } from "react";

// ─── Design Tokens (Nature-Inspired IELTS Design System) ────────────────────
const ds = {
  // Colors
  background:       "#fbf9f4",
  surface:          "#ffffff",
  surfaceLow:       "#f5f3ee",
  surfaceContainer: "#f0eee9",
  surfaceHigh:      "#eae8e3",
  surfaceHighest:   "#e4e2dd",
  outlineVariant:   "#c2c8c0",
  outline:          "#737972",

  primary:          "#4b6451",   // sage green — main actions
  onPrimary:        "#ffffff",
  primaryContainer: "#7e9983",
  primaryFixed:     "#cdead1",
  primaryFixedDim:  "#b1ceb6",

  secondary:        "#45664b",   // forest green — deep emphasis
  onSecondary:      "#ffffff",
  secondaryContainer: "#c4e9c7",
  secondaryFixed:   "#c7ecca",

  tertiary:         "#725a38",   // wood tone — accents / links
  onTertiary:       "#ffffff",
  tertiaryContainer:"#aa8e68",
  tertiaryFixed:    "#ffddb2",

  onSurface:        "#1b1c19",   // charcoal-green
  onSurfaceVariant: "#424843",

  error:            "#ba1a1a",
  errorContainer:   "#ffdad6",

  // Shadow
  shadow: "rgba(58, 90, 64, 0.08)",
  shadowMd: "rgba(58, 90, 64, 0.12)",

  // Font
  font: "'Lexend', 'DM Sans', sans-serif",
  fontMono: "'DM Mono', 'Fira Mono', 'Courier New', monospace",

  // Radii
  radiusSm:   "0.25rem",
  radius:     "0.5rem",
  radiusMd:   "0.75rem",
  radiusLg:   "1rem",
  radiusXl:   "1.5rem",
  radiusFull: "9999px",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  id?: string;
  disabled?: boolean;
}

// ─── HTML → Markdown serializer ──────────────────────────────────────────────

function htmlToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map(htmlToMarkdown).join("");
  switch (tag) {
    case "b": case "strong": return `**${children}**`;
    case "i": case "em":     return `*${children}*`;
    case "h1": return `# ${children}\n\n`;
    case "h2": return `## ${children}\n\n`;
    case "h3": return `### ${children}\n\n`;
    case "blockquote":
      return children.split("\n").filter(l => l.trim()).map(l => `> ${l}`).join("\n") + "\n\n";
    case "code": return `\`${children}\``;
    case "a": {
      const href = el.getAttribute("href") ?? "";
      return `[${children}](${href})`;
    }
    case "ul": {
      const items = Array.from(el.querySelectorAll(":scope > li"))
        .map(li => `- ${htmlToMarkdown(li).trim()}`).join("\n");
      return `${items}\n\n`;
    }
    case "ol": {
      const items = Array.from(el.querySelectorAll(":scope > li"))
        .map((li, i) => `${i + 1}. ${htmlToMarkdown(li).trim()}`).join("\n");
      return `${items}\n\n`;
    }
    case "li":  return children;
    case "br":  return "\n";
    case "p": case "div": return children ? `${children}\n\n` : "";
    default: return children;
  }
}

function serializeToMarkdown(el: HTMLElement): string {
  const raw = Array.from(el.childNodes).map(htmlToMarkdown).join("");
  return raw.replace(/\n{3,}/g, "\n\n").trimEnd();
}

// ─── Markdown → HTML ─────────────────────────────────────────────────────────

function markdownToHtml(md: string): string {
  if (!md.trim()) return "";
  let h = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  h = h.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  h = h.replace(/^## (.+)$/gm,  "<h2>$1</h2>");
  h = h.replace(/^# (.+)$/gm,   "<h1>$1</h1>");
  h = h.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
  h = h.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  h = h.replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>");
  h = h.replace(/\*(.+?)\*/g,         "<em>$1</em>");
  h = h.replace(/`(.+?)`/g,           "<code>$1</code>");
  h = h.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/^[-*] (.+)$/gm, "<li data-ul>$1</li>");
  h = h.replace(/(<li data-ul>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  h = h.replace(/ data-ul/g, "");
  h = h.replace(/^\d+\. (.+)$/gm, "<li data-ol>$1</li>");
  h = h.replace(/(<li data-ol>[\s\S]*?<\/li>\n?)+/g, m => `<ol>${m}</ol>`);
  h = h.replace(/ data-ol/g, "");
  h = h.split(/\n{2,}/).map(block => {
    if (/^<(h[1-6]|ul|ol|blockquote|pre)/.test(block.trim())) return block;
    return `<p>${block.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");
  return h;
}

// ─── Link Dialog ─────────────────────────────────────────────────────────────

function LinkDialog({
  onConfirm, onCancel, initialText = "",
}: {
  onConfirm: (text: string, url: string) => void;
  onCancel: () => void;
  initialText?: string;
}) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState("https://");
  const urlRef = useRef<HTMLInputElement>(null);
  useEffect(() => { urlRef.current?.focus(); }, []);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    border: `1.5px solid ${ds.outlineVariant}`,
    borderRadius: ds.radius,
    fontSize: 13,
    outline: "none",
    color: ds.onSurface,
    background: ds.background,
    fontFamily: ds.font,
    transition: "border-color 0.15s",
  };

  return (
    <div style={{
      position: "absolute",
      top: "calc(100% + 6px)",
      left: 0,
      zIndex: 100,
      background: ds.surface,
      border: `1.5px solid ${ds.outlineVariant}`,
      borderRadius: ds.radiusMd,
      boxShadow: `0 6px 24px ${ds.shadowMd}`,
      padding: "14px 16px",
      minWidth: 292,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ fontSize: 11, color: ds.primary, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Chèn liên kết
      </div>
      <input
        placeholder="Tiêu đề hiển thị"
        value={text}
        onChange={e => setText(e.target.value)}
        style={inputStyle}
      />
      <input
        ref={urlRef}
        placeholder="https://..."
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onConfirm(text, url); if (e.key === "Escape") onCancel(); }}
        style={inputStyle}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 2 }}>
        <button type="button" onClick={onCancel} style={{
          padding: "5px 14px", borderRadius: ds.radiusFull,
          border: `1.5px solid ${ds.outlineVariant}`, background: "transparent",
          fontSize: 12, cursor: "pointer", color: ds.onSurfaceVariant, fontFamily: ds.font,
        }}>Huỷ</button>
        <button type="button" onClick={() => onConfirm(text, url)} style={{
          padding: "5px 14px", borderRadius: ds.radiusFull,
          border: "none", background: ds.secondary,
          color: ds.onSecondary, fontSize: 12, cursor: "pointer",
          fontWeight: 600, fontFamily: ds.font,
        }}>Chèn</button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MarkdownEditor({
  value, onChange,
  placeholder = "Bắt đầu soạn thảo...",
  rows = 12, className = "", id, disabled = false,
}: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const savedRange = useRef<Range | null>(null);

  const [showMd, setShowMd] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkInitialText, setLinkInitialText] = useState("");
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [wordCount, setWordCount] = useState({ chars: 0, words: 0 });

  const minHeight = `${rows * 1.75}rem`;

  useEffect(() => {
    const el = editorRef.current;
    if (!el || isInternalUpdate.current) return;
    const html = markdownToHtml(value);
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    isInternalUpdate.current = true;
    const md = serializeToMarkdown(el);
    onChange(md);
    setWordCount({ chars: md.length, words: md.trim() ? md.trim().split(/\s+/).length : 0 });
    requestAnimationFrame(() => { isInternalUpdate.current = false; });
  }, [onChange]);

  const updateActiveFormats = useCallback(() => {
    const f = new Set<string>();
    if (document.queryCommandState("bold"))   f.add("bold");
    if (document.queryCommandState("italic")) f.add("italic");
    setActiveFormats(f);
  }, []);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && savedRange.current) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  };

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(cmd, false, val);
    emitChange();
    updateActiveFormats();
  }, [emitChange, updateActiveFormats]);

  const applyHeading = useCallback((tag: "h1" | "h2") => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("formatBlock", false, tag);
    emitChange();
  }, [emitChange]);

  const applyBlockquote = useCallback(() => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("formatBlock", false, "blockquote");
    emitChange();
  }, [emitChange]);

  const applyCode = useCallback(() => {
    editorRef.current?.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const code = document.createElement("code");
    code.textContent = range.toString() || "code";
    range.deleteContents();
    range.insertNode(code);
    const nr = document.createRange();
    nr.setStartAfter(code); nr.collapse(true);
    sel.removeAllRanges(); sel.addRange(nr);
    emitChange();
  }, [emitChange]);

  const handleLinkConfirm = useCallback((text: string, url: string) => {
    setShowLinkDialog(false);
    editorRef.current?.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.textContent = text || url;
    range.deleteContents(); range.insertNode(a);
    const nr = document.createRange();
    nr.setStartAfter(a); nr.collapse(true);
    sel.removeAllRanges(); sel.addRange(nr);
    emitChange();
  }, [emitChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); exec("bold"); }
    if ((e.ctrlKey || e.metaKey) && e.key === "i") { e.preventDefault(); exec("italic"); }
    if (e.key === "Tab") { e.preventDefault(); document.execCommand("insertText", false, "\u00a0\u00a0"); }
  }, [exec]);

  // ── Toolbar button helper ──
  const tbProps = (action: () => void, title: string, active = false) => ({
    title,
    onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); saveSelection(); action(); },
    disabled,
    style: {
      display: "inline-flex" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      width: 30, height: 30,
      borderRadius: ds.radius,
      border: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      background: active ? ds.primaryFixed : "transparent",
      color: active ? ds.secondary : ds.onSurfaceVariant,
      transition: "background 0.15s, color 0.15s",
      padding: 0,
    },
  });

  return (
    <div
      className={`mde-root ${className}`}
      style={{
        border: `1.5px solid ${ds.outlineVariant}`,
        borderRadius: ds.radiusLg,
        overflow: "visible",
        background: disabled ? ds.surfaceContainer : ds.surface,
        boxShadow: `0 2px 12px ${ds.shadow}`,
        opacity: disabled ? 0.65 : 1,
        position: "relative",
        fontFamily: ds.font,
      }}
    >
      {/* ── Toolbar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 2,
        padding: "7px 12px",
        borderBottom: `1.5px solid ${ds.outlineVariant}`,
        background: ds.surfaceLow,
        borderRadius: `${ds.radiusLg} ${ds.radiusLg} 0 0`,
        flexWrap: "wrap" as const,
        position: "relative",
      }}>
        {/* Bold */}
        <button type="button" {...tbProps(() => exec("bold"), "Bold (Ctrl+B)", activeFormats.has("bold"))}>
          <strong style={{ fontSize: 13, fontFamily: ds.font }}>B</strong>
        </button>
        {/* Italic */}
        <button type="button" {...tbProps(() => exec("italic"), "Italic (Ctrl+I)", activeFormats.has("italic"))}>
          <em style={{ fontSize: 13 }}>I</em>
        </button>

        <Sep />

        <button type="button" {...tbProps(() => applyHeading("h1"), "Heading 1")}>
          <span style={{ fontSize: 11, fontWeight: 700 }}>H1</span>
        </button>
        <button type="button" {...tbProps(() => applyHeading("h2"), "Heading 2")}>
          <span style={{ fontSize: 11, fontWeight: 700 }}>H2</span>
        </button>

        <Sep />

        <button type="button" {...tbProps(() => exec("insertUnorderedList"), "Danh sách")}>
          <ULIcon />
        </button>
        <button type="button" {...tbProps(() => exec("insertOrderedList"), "Danh sách số")}>
          <OLIcon />
        </button>
        <button type="button" {...tbProps(applyBlockquote, "Trích dẫn")}>
          <QuoteIcon />
        </button>
        <button type="button" {...tbProps(applyCode, "Code inline")}>
          <CodeIcon />
        </button>
        <button type="button" {...tbProps(() => {
          saveSelection();
          const sel = window.getSelection();
          setLinkInitialText(sel?.toString() ?? "");
          setShowLinkDialog(true);
        }, "Chèn liên kết")}>
          <LinkIcon />
        </button>

        {/* Link dialog */}
        {showLinkDialog && (
          <LinkDialog
            initialText={linkInitialText}
            onConfirm={handleLinkConfirm}
            onCancel={() => setShowLinkDialog(false)}
          />
        )}

        {/* MD source toggle — pill button */}
        <button
          type="button"
          title="Xem mã Markdown"
          onMouseDown={e => e.preventDefault()}
          onClick={() => setShowMd(v => !v)}
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 12px",
            borderRadius: ds.radiusFull,
            border: `1.5px solid ${showMd ? ds.primary : ds.outlineVariant}`,
            background: showMd ? ds.primaryFixed : ds.surface,
            color: showMd ? ds.secondary : ds.onSurfaceVariant,
            fontSize: 11, fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.18s",
            fontFamily: ds.fontMono,
            letterSpacing: "0.04em",
          }}
        >
          <MdIcon active={showMd} />
          MD
        </button>
      </div>

      {/* ── WYSIWYG Editor ── */}
      <div
        ref={editorRef}
        id={id}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emitChange}
        onKeyDown={handleKeyDown}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        data-placeholder={placeholder}
        style={{
          minHeight,
          padding: "18px 22px",
          outline: "none",
          fontSize: 16,
          lineHeight: 1.7,
          color: ds.onSurface,
          wordBreak: "break-word",
          background: ds.surface,
          caretColor: ds.primary,
        }}
      />

      {/* ── Markdown source panel ── */}
      {showMd && (
        <div style={{ borderTop: `1.5px solid ${ds.outlineVariant}`, background: "#1b2d1e" }}>
          <div style={{
            padding: "7px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 10, color: ds.primaryFixedDim, fontFamily: ds.fontMono, fontWeight: 600, letterSpacing: "0.08em" }}>
              MARKDOWN SOURCE
            </span>
            <button type="button"
              onClick={() => navigator.clipboard?.writeText(value)}
              style={{
                background: "transparent",
                border: `1px solid rgba(177,206,182,0.25)`,
                borderRadius: ds.radiusFull,
                color: ds.primaryFixedDim,
                fontSize: 10, fontWeight: 600,
                padding: "2px 10px", cursor: "pointer",
                fontFamily: ds.font, letterSpacing: "0.03em",
                transition: "border-color 0.15s, color 0.15s",
              }}
            >
              Copy
            </button>
          </div>
          <pre style={{
            margin: 0, padding: "14px 18px",
            fontSize: 12.5, lineHeight: 1.75,
            color: ds.primaryFixed,
            fontFamily: ds.fontMono,
            overflowX: "auto", whiteSpace: "pre-wrap",
            maxHeight: 260, overflowY: "auto",
          }}>
            {value || <span style={{ color: "rgba(177,206,182,0.35)" }}>Chưa có nội dung...</span>}
          </pre>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{
        padding: "5px 16px",
        borderTop: showMd ? "none" : `1px solid ${ds.surfaceHigh}`,
        fontSize: 11, textAlign: "right",
        background: showMd ? "#161f17" : ds.surfaceLow,
        borderRadius: `0 0 ${ds.radiusLg} ${ds.radiusLg}`,
        color: showMd ? "rgba(177,206,182,0.4)" : ds.outline,
        letterSpacing: "0.01em",
        fontFamily: ds.font,
      }}>
        {wordCount.chars} ký tự · {wordCount.words} từ
      </div>

      {/* ── Scoped styles ── */}
      <style>{`
        .mde-root [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: ${ds.outlineVariant};
          pointer-events: none;
        }
        .mde-root [contenteditable] h1 {
          font-size: 1.6em; font-weight: 600; margin: 0.5em 0 0.2em;
          color: ${ds.secondary}; font-family: ${ds.font};
          border-bottom: 2px solid ${ds.primaryFixed}; padding-bottom: 0.15em;
        }
        .mde-root [contenteditable] h2 {
          font-size: 1.3em; font-weight: 500; margin: 0.45em 0 0.15em;
          color: ${ds.secondary}; font-family: ${ds.font};
        }
        .mde-root [contenteditable] h3 {
          font-size: 1.1em; font-weight: 500; margin: 0.4em 0 0.1em;
          color: ${ds.primary}; font-family: ${ds.font};
        }
        .mde-root [contenteditable] p { margin: 0.3em 0; }
        .mde-root [contenteditable] ul,
        .mde-root [contenteditable] ol { padding-left: 1.5em; margin: 0.35em 0; }
        .mde-root [contenteditable] li { margin: 0.2em 0; }
        .mde-root [contenteditable] blockquote {
          border-left: 3px solid ${ds.primaryContainer};
          margin: 0.6em 0; padding: 6px 14px;
          color: ${ds.onSurfaceVariant};
          background: ${ds.primaryFixed}33;
          border-radius: 0 ${ds.radiusSm} ${ds.radiusSm} 0;
          font-style: italic;
        }
        .mde-root [contenteditable] code {
          background: ${ds.secondaryFixed};
          padding: 1px 6px; border-radius: ${ds.radiusSm};
          font-family: ${ds.fontMono}; font-size: 0.87em;
          color: ${ds.secondary};
        }
        .mde-root [contenteditable] a {
          color: ${ds.tertiary}; text-decoration: underline; cursor: pointer;
          text-underline-offset: 2px;
        }
        .mde-root [contenteditable] strong { font-weight: 700; color: ${ds.onSurface}; }
        .mde-root [contenteditable] em { font-style: italic; color: ${ds.onSurfaceVariant}; }
        .mde-root button:hover:not(:disabled) { filter: brightness(0.96); }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Sep() {
  return <div style={{ width: 1, height: 18, background: ds.outlineVariant, margin: "0 4px" }} />;
}

function MdIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke={active ? ds.secondary : ds.outline}
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4,7 4,4 20,4 20,7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function ULIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="2" cy="4" r="1.5" /><rect x="5" y="3" width="9" height="2" rx="1" />
      <circle cx="2" cy="8" r="1.5" /><rect x="5" y="7" width="9" height="2" rx="1" />
      <circle cx="2" cy="12" r="1.5" /><rect x="5" y="11" width="9" height="2" rx="1" />
    </svg>
  );
}

function OLIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <text x="0" y="5" fontSize="5" fill="currentColor" fontWeight="700">1.</text>
      <rect x="5" y="3" width="9" height="2" rx="1" fill="currentColor" />
      <text x="0" y="9" fontSize="5" fill="currentColor" fontWeight="700">2.</text>
      <rect x="5" y="7" width="9" height="2" rx="1" fill="currentColor" />
      <text x="0" y="13" fontSize="5" fill="currentColor" fontWeight="700">3.</text>
      <rect x="5" y="11" width="9" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 3h4v5H5c0 1.1.9 2 2 2v2c-2.2 0-4-1.8-4-4V3zm6 0h4v5h-2c0 1.1.9 2 2 2v2c-2.2 0-4-1.8-4-4V3z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5,4 1,8 5,12" /><polyline points="11,4 15,8 11,12" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 9.5a4 4 0 005.66 0l2-2a4 4 0 00-5.66-5.66l-1 1" />
      <path d="M9.5 6.5a4 4 0 00-5.66 0l-2 2a4 4 0 005.66 5.66l1-1" />
    </svg>
  );
}

export default MarkdownEditor;