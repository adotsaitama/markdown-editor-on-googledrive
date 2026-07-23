import { useEffect, useRef, useState } from "react";

interface InlineEditPopoverProps {
  /** Viewport coordinates of the clicked preview block (popover anchors below). */
  anchor: { top: number; left: number };
  startLine: number;
  endLine: number;
  initialText: string;
  onApply: (text: string) => void;
  onClose: () => void;
}

/**
 * Tooltip-style source editor for preview-only mode: shows the Markdown
 * source lines around the clicked block for quick fixes without leaving
 * the preview. Ctrl+Enter applies, Esc closes.
 */
export function InlineEditPopover({
  anchor,
  startLine,
  endLine,
  initialText,
  onApply,
  onClose,
}: InlineEditPopoverProps) {
  const [text, setText] = useState(initialText);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const width = Math.min(680, window.innerWidth - 32);
  const left = Math.min(Math.max(16, anchor.left), window.innerWidth - width - 16);
  const top = Math.max(16, Math.min(anchor.top + 8, window.innerHeight - 280));
  const rows = Math.min(12, Math.max(4, text.split("\n").length + 1));

  return (
    <div
      className="inline-edit-popover"
      ref={rootRef}
      role="dialog"
      aria-label="ソース編集"
      style={{ top, left, width }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onApply(text);
        }
      }}
    >
      <div className="inline-edit-header">
        ソース編集（{startLine}〜{endLine}行）
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        rows={rows}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="inline-edit-actions">
        <span className="inline-edit-hint">Ctrl+Enter 適用 / Esc 閉じる</span>
        <button className="ghost-button" onClick={onClose}>
          キャンセル
        </button>
        <button className="save-button" onClick={() => onApply(text)}>
          適用
        </button>
      </div>
    </div>
  );
}
