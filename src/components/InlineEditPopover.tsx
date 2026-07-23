import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { FormatToolbar } from "./FormatToolbar";
import { MarkdownEditor } from "./MarkdownEditor";

interface InlineEditPopoverProps {
  /** Viewport coordinates of the clicked preview block (popover anchors below). */
  anchor: { top: number; left: number };
  startLine: number;
  endLine: number;
  initialText: string;
  dark: boolean;
  onApply: (text: string) => void;
  onClose: () => void;
}

/**
 * Tooltip-style source editor for preview-only mode, scoped to exactly the
 * clicked block's source lines. Hosts a real CodeMirror instance plus the
 * format toolbar (minus whole-document format), so every editing command
 * and configured shortcut behaves the same as in edit mode.
 * Ctrl+Enter / Ctrl+S applies, Esc closes.
 */
export function InlineEditPopover({
  anchor,
  startLine,
  endLine,
  initialText,
  dark,
  onApply,
  onClose,
}: InlineEditPopoverProps) {
  const [text, setText] = useState(initialText);
  const textRef = useRef(text);
  textRef.current = text;
  const [view, setView] = useState<EditorView | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    view?.focus();
  }, [view]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const width = Math.min(780, window.innerWidth - 32);
  const left = Math.min(Math.max(16, anchor.left), window.innerWidth - width - 16);
  const top = Math.max(16, Math.min(anchor.top + 8, window.innerHeight - 320));

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
          onApply(textRef.current);
        }
      }}
    >
      <div className="inline-edit-header">
        ソース編集（{startLine === endLine ? `${startLine}行` : `${startLine}〜${endLine}行`}）
      </div>
      <FormatToolbar view={view} disabled={false} showFormatDoc={false} />
      <div className="inline-edit-editor">
        <MarkdownEditor
          initialDoc={initialText}
          dark={dark}
          onChange={setText}
          // Ctrl+S inside the popover applies the block edit (the document
          // save shortcut is suppressed while the popover is open).
          onSave={() => onApply(textRef.current)}
          onViewReady={setView}
        />
      </div>
      <div className="inline-edit-actions">
        <span className="inline-edit-hint">Ctrl+Enter / Ctrl+S 適用・Esc 閉じる</span>
        <button className="ghost-button" onClick={onClose}>
          キャンセル
        </button>
        <button className="save-button" onClick={() => onApply(textRef.current)}>
          適用
        </button>
      </div>
    </div>
  );
}
