import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { getCommand, type CommandId } from "../lib/editorCommands";
import { insertTable } from "../lib/markdownCommands";
import { formatShortcut, getShortcuts } from "../lib/shortcutConfig";
import {
  IconBold,
  IconCheckSquare,
  IconCode,
  IconItalic,
  IconLink,
  IconListOl,
  IconListUl,
  IconMinus,
  IconQuote,
  IconRedo,
  IconStrikethrough,
  IconTable,
  IconUndo,
  IconWand,
} from "./icons";

interface FormatToolbarProps {
  view: EditorView | null;
  /** Disabled entirely while the editor pane is hidden (preview mode). */
  disabled: boolean;
  /** Hide the whole-document Prettier button (e.g. in the inline editor). */
  showFormatDoc?: boolean;
}

interface ToolbarItem {
  id: CommandId;
  /** Icon element, or short text (e.g. "H1") rendered as a text button. */
  icon: JSX.Element | string;
}

/** Toolbar layout: which commands appear, grouped (à la Joplin / Inkdrop). */
const LAYOUT: ToolbarItem[][] = [
  [
    { id: "undo", icon: <IconUndo /> },
    { id: "redo", icon: <IconRedo /> },
  ],
  [
    { id: "bold", icon: <IconBold /> },
    { id: "italic", icon: <IconItalic /> },
    { id: "strikethrough", icon: <IconStrikethrough /> },
    { id: "code", icon: <IconCode /> },
  ],
  [
    { id: "heading1", icon: "H1" },
    { id: "heading2", icon: "H2" },
    { id: "heading3", icon: "H3" },
  ],
  [
    { id: "bulletList", icon: <IconListUl /> },
    { id: "orderedList", icon: <IconListOl /> },
    { id: "taskList", icon: <IconCheckSquare /> },
    { id: "quote", icon: <IconQuote /> },
  ],
  [
    { id: "link", icon: <IconLink /> },
    { id: "horizontalRule", icon: <IconMinus /> },
  ],
];

const NOOP_CTX = { save: () => {} };

export function FormatToolbar({ view, disabled, showFormatDoc = true }: FormatToolbarProps) {
  const off = disabled || !view;
  const shortcuts = useMemo(() => getShortcuts(), []);

  const tooltip = (id: CommandId) => {
    const cmd = getCommand(id);
    const key = shortcuts[id];
    let text = cmd.label;
    if (key) text += `（${formatShortcut(key)}）`;
    if (cmd.hint) text += ` — ${cmd.hint}`;
    return text;
  };

  const renderButton = ({ id, icon }: ToolbarItem) => (
    <button
      key={id}
      type="button"
      className={typeof icon === "string" ? "icon-button text-button" : "icon-button"}
      title={tooltip(id)}
      aria-label={getCommand(id).label}
      disabled={off}
      onClick={() => view && getCommand(id).run(view, NOOP_CTX)}
    >
      {icon}
    </button>
  );

  return (
    <div className="format-toolbar" role="toolbar" aria-label="書式">
      {LAYOUT.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <span className="toolbar-sep" />}
          {group.map(renderButton)}
        </Fragment>
      ))}
      <TablePicker view={view} disabled={off} tooltip={tooltip("table")} />
      {showFormatDoc && (
        <>
          <span className="toolbar-sep" />
          {renderButton({ id: "formatDoc", icon: <IconWand /> })}
        </>
      )}
    </div>
  );
}

const PICKER_COLS = 6;
const PICKER_ROWS = 5;

/** Table button with an Excel-style size picker (cols × body rows). */
function TablePicker({
  view,
  disabled,
  tooltip,
}: {
  view: EditorView | null;
  disabled: boolean;
  tooltip: string;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<[number, number]>([1, 1]); // [rows, cols]
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const [hr, hc] = hover;

  return (
    <div className="table-picker-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-button"
        title={tooltip}
        aria-label="テーブルを挿入"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <IconTable />
      </button>
      {open && (
        <div className="table-picker">
          <div
            className="table-picker-grid"
            style={{ gridTemplateColumns: `repeat(${PICKER_COLS}, 1fr)` }}
          >
            {Array.from({ length: PICKER_ROWS * PICKER_COLS }, (_, i) => {
              const r = Math.floor(i / PICKER_COLS) + 1;
              const c = (i % PICKER_COLS) + 1;
              const active = r <= hr && c <= hc;
              return (
                <button
                  key={i}
                  type="button"
                  className={active ? "picker-cell active" : "picker-cell"}
                  aria-label={`${c} 列 × ${r} 行`}
                  onMouseEnter={() => setHover([r, c])}
                  onFocus={() => setHover([r, c])}
                  onClick={() => {
                    if (view) insertTable(view, r, c);
                    setOpen(false);
                  }}
                />
              );
            })}
          </div>
          <div className="table-picker-size">
            {hc} 列 × {hr} 行（+ヘッダ）
          </div>
        </div>
      )}
    </div>
  );
}
