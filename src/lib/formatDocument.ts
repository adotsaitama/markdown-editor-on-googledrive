import type { EditorView } from "@codemirror/view";

/**
 * Format the whole document with Prettier (MIT), lazy-loaded on first use.
 * The cursor is clamped to the formatted length; the change goes through a
 * normal transaction so undo works.
 */
export async function formatDocument(view: EditorView): Promise<void> {
  const [{ format }, markdownPlugin] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/markdown"),
  ]);

  const source = view.state.doc.toString();
  const formatted = await format(source, {
    parser: "markdown",
    plugins: [markdownPlugin.default ?? markdownPlugin],
  });
  if (formatted === source) {
    view.focus();
    return;
  }

  const head = Math.min(view.state.selection.main.head, formatted.length);
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: formatted },
    selection: { anchor: head },
    scrollIntoView: true,
    userEvent: "input",
  });
  view.focus();
}
