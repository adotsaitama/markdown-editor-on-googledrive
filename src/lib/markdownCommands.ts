import { EditorSelection, type Line } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/**
 * Markdown formatting commands for the toolbar / keymaps.
 * All commands dispatch a single transaction and refocus the editor.
 */

/** Toggle an inline mark (e.g. `**`, `*`, `~~`, `` ` ``) around each selection range. */
export function toggleInlineMark(view: EditorView, mark: string): boolean {
  const len = mark.length;
  const tr = view.state.changeByRange((range) => {
    const { from, to } = range;
    const doc = view.state.doc;
    const before = doc.sliceString(Math.max(0, from - len), from);
    const after = doc.sliceString(to, Math.min(doc.length, to + len));

    if (before === mark && after === mark) {
      // Unwrap: **text** -> text
      return {
        changes: [
          { from: from - len, to: from },
          { from: to, to: to + len },
        ],
        range: EditorSelection.range(from - len, to - len),
      };
    }
    const inner = doc.sliceString(from, to);
    if (inner.length >= 2 * len && inner.startsWith(mark) && inner.endsWith(mark)) {
      // Selection includes the marks themselves: strip them.
      return {
        changes: [
          { from, to: from + len },
          { from: to - len, to },
        ],
        range: EditorSelection.range(from, to - 2 * len),
      };
    }
    // Wrap (cursor lands inside the pair for empty selections).
    return {
      changes: [
        { from, insert: mark },
        { from: to, insert: mark },
      ],
      range: EditorSelection.range(from + len, to + len),
    };
  });
  view.dispatch(tr, { scrollIntoView: true, userEvent: "input" });
  view.focus();
  return true;
}

/** Distinct lines covered by the current selection, in document order. */
function selectedLines(view: EditorView): Line[] {
  const { state } = view;
  const numbers = new Set<number>();
  for (const range of state.selection.ranges) {
    let pos = range.from;
    for (;;) {
      const line = state.doc.lineAt(pos);
      numbers.add(line.number);
      if (line.to >= range.to) break;
      pos = line.to + 1;
    }
  }
  return [...numbers].sort((a, b) => a - b).map((n) => state.doc.line(n));
}

/** Toggle a fixed line prefix (e.g. `- `, `> `) on all selected lines. */
export function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const lines = selectedLines(view);
  const nonEmpty = lines.filter((l) => l.text.trim().length > 0 || lines.length === 1);
  if (nonEmpty.length === 0) return false;
  const allHave = nonEmpty.every((l) => l.text.startsWith(prefix));

  const changes = nonEmpty.map((l) =>
    allHave
      ? { from: l.from, to: l.from + prefix.length }
      : { from: l.from, insert: prefix },
  );
  view.dispatch({ changes, scrollIntoView: true, userEvent: "input" });
  view.focus();
  return true;
}

const ORDERED_RE = /^\d+\.\s/;

/** Toggle an ordered list (`1. `, `2. `, …) on all selected lines. */
export function toggleOrderedList(view: EditorView): boolean {
  const lines = selectedLines(view);
  const nonEmpty = lines.filter((l) => l.text.trim().length > 0 || lines.length === 1);
  if (nonEmpty.length === 0) return false;
  const allHave = nonEmpty.every((l) => ORDERED_RE.test(l.text));

  const changes = nonEmpty.map((l, i) => {
    if (allHave) {
      const m = ORDERED_RE.exec(l.text) as RegExpExecArray;
      return { from: l.from, to: l.from + m[0].length };
    }
    return { from: l.from, insert: `${i + 1}. ` };
  });
  view.dispatch({ changes, scrollIntoView: true, userEvent: "input" });
  view.focus();
  return true;
}

const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+\.)\s/;
const LIST_INDENT = "    ";

/**
 * Indent (dir=1) / dedent (dir=-1) selected list items by 4 spaces.
 * Returns false when the selection is not entirely list items, so Tab
 * falls through to its default behavior outside lists.
 */
export function changeListIndent(view: EditorView, dir: 1 | -1): boolean {
  const lines = selectedLines(view);
  if (!lines.every((l) => LIST_ITEM_RE.test(l.text))) return false;

  const changes = [];
  for (const l of lines) {
    if (dir === 1) {
      changes.push({ from: l.from, insert: LIST_INDENT });
    } else {
      const ws = /^[ \t]+/.exec(l.text)?.[0] ?? "";
      if (ws.length === 0) continue;
      changes.push({ from: l.from, to: l.from + Math.min(ws.length, LIST_INDENT.length) });
    }
  }
  if (changes.length > 0) {
    view.dispatch({ changes, scrollIntoView: true, userEvent: "input" });
  }
  return true;
}

const FENCE_RE = /^```/;

/**
 * Wrap the selected lines in a fenced code block, or unwrap when the
 * selection is already directly fenced. After wrapping, the cursor sits
 * right after the opening ``` so a language can be typed immediately.
 */
export function toggleCodeBlock(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  const firstLine = state.doc.lineAt(range.from);
  const lastLine = state.doc.lineAt(range.to);
  const before = firstLine.number > 1 ? state.doc.line(firstLine.number - 1) : null;
  const after = lastLine.number < state.doc.lines ? state.doc.line(lastLine.number + 1) : null;

  if (before && after && FENCE_RE.test(before.text) && FENCE_RE.test(after.text)) {
    view.dispatch({
      changes: [
        { from: before.from, to: firstLine.from },
        { from: lastLine.to, to: after.to },
      ],
      scrollIntoView: true,
      userEvent: "input",
    });
  } else {
    view.dispatch({
      changes: [
        { from: firstLine.from, insert: "```\n" },
        { from: lastLine.to, insert: "\n```" },
      ],
      selection: { anchor: firstLine.from + 3 },
      scrollIntoView: true,
      userEvent: "input",
    });
  }
  view.focus();
  return true;
}

/**
 * Insert an empty GFM table (header + separator + `rows` body rows) on a
 * new line after the current one, cursor placed in the first header cell.
 */
export function insertTable(view: EditorView, rows: number, cols: number): boolean {
  const mkRow = (fill: string) => "|" + Array(cols).fill(fill).join("|") + "|";
  const table = [mkRow("     "), mkRow(" --- "), ...Array.from({ length: rows }, () => mkRow("     "))].join("\n");

  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const prefix = line.text.trim().length > 0 ? "\n\n" : "\n";
  const insert = prefix + table + "\n";
  view.dispatch({
    changes: { from: line.to, insert },
    selection: { anchor: line.to + prefix.length + 2 },
    scrollIntoView: true,
    userEvent: "input",
  });
  view.focus();
  return true;
}

const TASK_RE = /^- \[[ xX]\]\s/;

/** Toggle a task-list checkbox (`- [ ] `) on all selected lines. */
export function toggleTaskList(view: EditorView): boolean {
  const lines = selectedLines(view);
  const nonEmpty = lines.filter((l) => l.text.trim().length > 0 || lines.length === 1);
  if (nonEmpty.length === 0) return false;
  const allHave = nonEmpty.every((l) => TASK_RE.test(l.text));

  const changes = nonEmpty.map((l) => {
    if (allHave) {
      const m = TASK_RE.exec(l.text) as RegExpExecArray;
      return { from: l.from, to: l.from + m[0].length };
    }
    // Upgrade an existing bullet instead of double-prefixing it.
    if (l.text.startsWith("- ")) {
      return { from: l.from + 2, insert: "[ ] " };
    }
    return { from: l.from, insert: "- [ ] " };
  });
  view.dispatch({ changes, scrollIntoView: true, userEvent: "input" });
  view.focus();
  return true;
}

/**
 * Wrap the selection as a Markdown link. With a selection the cursor lands in
 * the URL slot (`[text](|)`); with none it lands in the text slot (`[|]()`).
 */
export function insertLink(view: EditorView): boolean {
  const tr = view.state.changeByRange((range) => {
    const text = view.state.sliceDoc(range.from, range.to);
    const insert = `[${text}]()`;
    const cursor = text
      ? range.from + text.length + 3 // inside the parens
      : range.from + 1; // inside the brackets
    return {
      changes: [{ from: range.from, to: range.to, insert }],
      range: EditorSelection.cursor(cursor),
    };
  });
  view.dispatch(tr, { scrollIntoView: true, userEvent: "input" });
  view.focus();
  return true;
}

/** Insert a horizontal rule (`---`) on a new line after the current one. */
export function insertHorizontalRule(view: EditorView): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const insert = (line.text.trim().length > 0 ? "\n\n" : "") + "---\n";
  view.dispatch({
    changes: { from: line.to, insert },
    selection: { anchor: line.to + insert.length },
    scrollIntoView: true,
    userEvent: "input",
  });
  view.focus();
  return true;
}

const HEADING_RE = /^#{1,6}\s+/;

/**
 * Set the heading level (1-6) of all selected lines; 0 removes the heading.
 * Re-applying the same level toggles it off.
 */
export function setHeading(view: EditorView, level: number): boolean {
  const lines = selectedLines(view);
  const marker = level > 0 ? "#".repeat(level) + " " : "";
  const allAtLevel =
    level > 0 && lines.every((l) => l.text.startsWith(marker) && !l.text.startsWith(marker + "#"));

  const changes = lines.map((l) => {
    const m = HEADING_RE.exec(l.text);
    const insert = allAtLevel ? "" : marker;
    return { from: l.from, to: l.from + (m ? m[0].length : 0), insert };
  });
  view.dispatch({ changes, scrollIntoView: true, userEvent: "input" });
  view.focus();
  return true;
}
