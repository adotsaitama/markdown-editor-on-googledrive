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
