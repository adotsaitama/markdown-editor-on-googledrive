import { Fragment } from "react";
import { undo, redo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import {
  insertHorizontalRule,
  insertLink,
  setHeading,
  toggleInlineMark,
  toggleLinePrefix,
  toggleOrderedList,
  toggleTaskList,
} from "../lib/markdownCommands";
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
  IconUndo,
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
    { label: "インラインコード", icon: <IconCode />, action: (v) => toggleInlineMark(v, "`") },
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
  // insert
  [
    { label: "リンク (Ctrl+K)", icon: <IconLink />, action: (v) => insertLink(v) },
    { label: "罫線", icon: <IconMinus />, action: (v) => insertHorizontalRule(v) },
  ],
];

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
    </div>
  );
}
