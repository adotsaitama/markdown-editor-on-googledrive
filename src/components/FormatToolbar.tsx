import { Fragment, useEffect, useRef, useState } from "react";
import { undo, redo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import {
  insertHorizontalRule,
  insertLink,
  insertTable,
  setHeading,
  toggleCodeBlock,
  toggleInlineMark,
  toggleLinePrefix,
  toggleOrderedList,
  toggleTaskList,
} from "../lib/markdownCommands";
import { formatDocument } from "../lib/formatDocument";
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
}

interface Item {
  label: string;
  /** Icon element, or short text (e.g. "H1") rendered as a text button. */
  icon: JSX.Element | string;
  action: (v: EditorView) => unknown;
}

/** Inline code for single-line selections, fenced block for multi-line. */
function smartCode(v: EditorView) {
  const { from, to } = v.state.selection.main;
  return v.state.sliceDoc(from, to).includes("\n")
    ? toggleCodeBlock(v)
    : toggleInlineMark(v, "`");
}

/** Grouped, rich-text-style Markdown formatting bar (à la Joplin / Inkdrop). */
const GROUPS: Item[][] = [
  // history
  [
    { label: "元に戻す (Ctrl+Z)", icon: <IconUndo />, action: (v) => (undo(v), v.focus()) },
    { label: "やり直し (Ctrl+Y)", icon: <IconRedo />, action: (v) => (redo(v), v.focus()) },
  ],
  // inline marks
  [
    { label: "太字 (Ctrl+B)", icon: <IconBold />, action: (v) => toggleInlineMark(v, "**") },
    { label: "斜体 (Ctrl+I)", icon: <IconItalic />, action: (v) => toggleInlineMark(v, "*") },
    { label: "打ち消し線", icon: <IconStrikethrough />, action: (v) => toggleInlineMark(v, "~~") },
    { label: "コード（複数行選択でコードブロック）", icon: <IconCode />, action: smartCode },
  ],
  // headings (direct buttons: one less click than a dropdown)
  [
    { label: "見出し1", icon: "H1", action: (v) => setHeading(v, 1) },
    { label: "見出し2", icon: "H2", action: (v) => setHeading(v, 2) },
    { label: "見出し3", icon: "H3", action: (v) => setHeading(v, 3) },
  ],
  // blocks / lists
  [
    { label: "箇条書き", icon: <IconListUl />, action: (v) => toggleLinePrefix(v, "- ") },
    { label: "番号付きリスト", icon: <IconListOl />, action: (v) => toggleOrderedList(v) },
    { label: "チェックリスト", icon: <IconCheckSquare />, action: (v) => toggleTaskList(v) },
    { label: "引用", icon: <IconQuote />, action: (v) => toggleLinePrefix(v, "> ") },
  ],
  // insert (the table button is rendered separately with its size picker)
  [
    { label: "リンク (Ctrl+K)", icon: <IconLink />, action: (v) => insertLink(v) },
    { label: "罫線", icon: <IconMinus />, action: (v) => insertHorizontalRule(v) },
  ],
];

/** Document-wide actions appended after the table picker. */
const TAIL_ITEMS: Item[] = [
  {
    label: "文書全体を整形 (Prettier)",
    icon: <IconWand />,
    action: (v) => void formatDocument(v),
  },
];

const PICKER_COLS = 6;
const PICKER_ROWS = 5;

export function FormatToolbar({ view, disabled }: FormatToolbarProps) {
  const off = disabled || !view;

  return (
    <div className="format-toolbar" role="toolbar" aria-label="書式">
      {GROUPS.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <span className="toolbar-sep" />}
          {group.map((item) => (
            <button
              key={item.label}
              type="button"
              className={
                typeof item.icon === "string" ? "icon-button text-button" : "icon-button"
              }
              title={item.label}
              aria-label={item.label}
              disabled={off}
              onClick={() => view && item.action(view)}
            >
              {item.icon}
            </button>
          ))}
        </Fragment>
      ))}
      <TablePicker view={view} disabled={off} />
      <span className="toolbar-sep" />
      {TAIL_ITEMS.map((item) => (
        <button
          key={item.label}
          type="button"
          className="icon-button"
          title={item.label}
          aria-label={item.label}
          disabled={off}
          onClick={() => view && item.action(view)}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}

/** Table button with an Excel-style size picker (cols × body rows). */
function TablePicker({ view, disabled }: { view: EditorView | null; disabled: boolean }) {
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
        title="テーブルを挿入"
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
