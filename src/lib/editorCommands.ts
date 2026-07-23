import { undo, redo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { formatDocument } from "./formatDocument";
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
} from "./markdownCommands";

/** Extra capabilities a command may need beyond the EditorView. */
export interface CommandContext {
  save: () => void;
}

export interface EditorCommand {
  id: string;
  /** Japanese label shown in tooltips and the help modal. */
  label: string;
  /** Optional usage note for tooltips / help. */
  hint?: string;
  run: (view: EditorView, ctx: CommandContext) => unknown;
}

/** Inline code for single-line selections, fenced block for multi-line. */
function smartCode(v: EditorView) {
  const { from, to } = v.state.selection.main;
  return v.state.sliceDoc(from, to).includes("\n")
    ? toggleCodeBlock(v)
    : toggleInlineMark(v, "`");
}

/**
 * Single source of truth for every editor command. The CodeMirror keymap,
 * the toolbar tooltips and the help modal are all derived from this list
 * combined with the shortcut config (shortcutConfig.ts).
 */
export const EDITOR_COMMANDS = [
  { id: "save", label: "保存", run: (_v: EditorView, ctx: CommandContext) => ctx.save() },
  { id: "undo", label: "元に戻す", run: (v: EditorView) => (undo(v), v.focus()) },
  { id: "redo", label: "やり直し", run: (v: EditorView) => (redo(v), v.focus()) },
  { id: "bold", label: "太字", run: (v: EditorView) => toggleInlineMark(v, "**") },
  { id: "italic", label: "斜体", run: (v: EditorView) => toggleInlineMark(v, "*") },
  { id: "strikethrough", label: "打ち消し線", run: (v: EditorView) => toggleInlineMark(v, "~~") },
  {
    id: "code",
    label: "コード",
    hint: "複数行選択時はコードブロック",
    run: smartCode,
  },
  { id: "heading1", label: "見出し1", run: (v: EditorView) => setHeading(v, 1) },
  { id: "heading2", label: "見出し2", run: (v: EditorView) => setHeading(v, 2) },
  { id: "heading3", label: "見出し3", run: (v: EditorView) => setHeading(v, 3) },
  { id: "bulletList", label: "箇条書き", run: (v: EditorView) => toggleLinePrefix(v, "- ") },
  { id: "orderedList", label: "番号付きリスト", run: (v: EditorView) => toggleOrderedList(v) },
  { id: "taskList", label: "チェックリスト", run: (v: EditorView) => toggleTaskList(v) },
  { id: "quote", label: "引用", run: (v: EditorView) => toggleLinePrefix(v, "> ") },
  { id: "link", label: "リンク挿入", run: (v: EditorView) => insertLink(v) },
  {
    id: "table",
    label: "テーブル挿入",
    hint: "ボタンはサイズ選択、ショートカットは3列×2行",
    run: (v: EditorView) => insertTable(v, 2, 3),
  },
  { id: "horizontalRule", label: "罫線", run: (v: EditorView) => insertHorizontalRule(v) },
  {
    id: "formatDoc",
    label: "文書全体を整形",
    hint: "Prettier",
    run: (v: EditorView) => void formatDocument(v),
  },
] as const satisfies readonly EditorCommand[];

export type CommandId = (typeof EDITOR_COMMANDS)[number]["id"];

export function getCommand(id: CommandId): EditorCommand {
  return EDITOR_COMMANDS.find((c) => c.id === id) as EditorCommand;
}
