import { undo, redo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import {
  setHeading,
  toggleInlineMark,
  toggleLinePrefix,
  toggleOrderedList,
} from "../lib/markdownCommands";
import {
  IconBold,
  IconCode,
  IconItalic,
  IconListOl,
  IconListUl,
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

/** Rich-text-style Markdown formatting buttons operating on the CodeMirror view. */
export function FormatToolbar({ view, disabled }: FormatToolbarProps) {
  const off = disabled || !view;

  const run = (fn: (v: EditorView) => unknown) => () => {
    if (view) fn(view);
  };

  const buttons: Array<{
    label: string;
    icon: JSX.Element;
    onClick: () => void;
  }> = [
    { label: "元に戻す (Ctrl+Z)", icon: <IconUndo />, onClick: run((v) => (undo(v), v.focus())) },
    { label: "やり直し (Ctrl+Y)", icon: <IconRedo />, onClick: run((v) => (redo(v), v.focus())) },
    { label: "太字 (Ctrl+B)", icon: <IconBold />, onClick: run((v) => toggleInlineMark(v, "**")) },
    { label: "斜体 (Ctrl+I)", icon: <IconItalic />, onClick: run((v) => toggleInlineMark(v, "*")) },
    {
      label: "打ち消し線",
      icon: <IconStrikethrough />,
      onClick: run((v) => toggleInlineMark(v, "~~")),
    },
    { label: "箇条書き", icon: <IconListUl />, onClick: run((v) => toggleLinePrefix(v, "- ")) },
    { label: "番号付きリスト", icon: <IconListOl />, onClick: run((v) => toggleOrderedList(v)) },
    { label: "コード", icon: <IconCode />, onClick: run((v) => toggleInlineMark(v, "`")) },
    { label: "引用", icon: <IconQuote />, onClick: run((v) => toggleLinePrefix(v, "> ")) },
  ];

  return (
    <div className="format-toolbar" role="toolbar" aria-label="書式">
      {buttons.slice(0, 2).map((b) => (
        <FormatButton key={b.label} {...b} disabled={off} />
      ))}
      <span className="toolbar-sep" />
      {buttons.slice(2, 5).map((b) => (
        <FormatButton key={b.label} {...b} disabled={off} />
      ))}
      <select
        className="heading-select"
        aria-label="見出しレベル"
        title="見出し"
        value=""
        disabled={off}
        onChange={(e) => {
          const level = Number(e.target.value);
          if (view && Number.isFinite(level)) setHeading(view, level);
          e.target.value = "";
        }}
      >
        <option value="" disabled>
          H
        </option>
        <option value="1">H1 見出し1</option>
        <option value="2">H2 見出し2</option>
        <option value="3">H3 見出し3</option>
        <option value="0">標準テキスト</option>
      </select>
      <span className="toolbar-sep" />
      {buttons.slice(5).map((b) => (
        <FormatButton key={b.label} {...b} disabled={off} />
      ))}
    </div>
  );
}

function FormatButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: JSX.Element;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
