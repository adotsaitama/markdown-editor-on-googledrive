import { useEffect } from "react";
import type { EditorView } from "@codemirror/view";

interface LineAnchor {
  line: number;
  top: number;
}

/** Collect `[data-line]` anchors in the preview, with tops relative to the scroll container. */
function collectAnchors(container: HTMLElement): LineAnchor[] {
  const containerTop = container.getBoundingClientRect().top - container.scrollTop;
  const anchors: LineAnchor[] = [];
  for (const el of container.querySelectorAll<HTMLElement>("[data-line]")) {
    const line = Number(el.dataset.line);
    if (!Number.isFinite(line)) continue;
    anchors.push({ line, top: el.getBoundingClientRect().top - containerTop });
  }
  anchors.sort((a, b) => a.line - b.line);
  return anchors;
}

/** Find the pair of anchors bracketing `value` under the given key, for interpolation. */
function bracket(
  anchors: LineAnchor[],
  key: "line" | "top",
  value: number,
): [LineAnchor, LineAnchor | null] {
  let prev = anchors[0];
  for (const a of anchors) {
    if (a[key] <= value) prev = a;
    else return [prev, a];
  }
  return [prev, null];
}

/**
 * Bidirectional editor <-> preview scroll sync based on Markdown source lines.
 *
 * - Editor -> preview: the editor's top visible line (fractional, via
 *   lineBlockAtHeight) is mapped between the two nearest `data-line` anchors.
 * - Preview -> editor: inverse interpolation from scroll offset to a source line,
 *   then scrolled to via the editor's line block geometry.
 * - Only the pane the user last pointed at / wheeled over drives the sync,
 *   which also prevents programmatic-scroll feedback loops.
 */
export function useScrollSync(
  view: EditorView | null,
  previewEl: HTMLElement | null,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || !view || !previewEl) return;

    const scroller = view.scrollDOM;
    let active: "editor" | "preview" | null = null;
    let raf = 0;

    const activateEditor = () => (active = "editor");
    const activatePreview = () => (active = "preview");

    const syncPreviewFromEditor = () => {
      const top = scroller.scrollTop;
      const block = view.lineBlockAtHeight(top);
      const lineNo = view.state.doc.lineAt(block.from).number;
      const frac = block.height > 0 ? Math.min(1, (top - block.top) / block.height) : 0;
      const targetLine = lineNo + frac;

      const anchors = collectAnchors(previewEl);
      if (anchors.length === 0) return;
      const [prev, next] = bracket(anchors, "line", targetLine);
      let dest: number;
      if (next && next.line > prev.line) {
        const t = (targetLine - prev.line) / (next.line - prev.line);
        dest = prev.top + (next.top - prev.top) * t;
      } else {
        dest = prev.top;
      }
      previewEl.scrollTop = dest;
    };

    const syncEditorFromPreview = () => {
      const anchors = collectAnchors(previewEl);
      if (anchors.length === 0) return;
      const top = previewEl.scrollTop;
      const [prev, next] = bracket(anchors, "top", top);
      let targetLine: number;
      if (next && next.top > prev.top) {
        const t = (top - prev.top) / (next.top - prev.top);
        targetLine = prev.line + (next.line - prev.line) * t;
      } else {
        targetLine = prev.line;
      }

      const doc = view.state.doc;
      const lineNo = Math.min(doc.lines, Math.max(1, Math.floor(targetLine)));
      const block = view.lineBlockAt(doc.line(lineNo).from);
      scroller.scrollTop = block.top + (targetLine - lineNo) * block.height;
    };

    const onScroll = (source: "editor" | "preview") => () => {
      if (active !== source) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(
        source === "editor" ? syncPreviewFromEditor : syncEditorFromPreview,
      );
    };
    const onEditorScroll = onScroll("editor");
    const onPreviewScroll = onScroll("preview");

    scroller.addEventListener("scroll", onEditorScroll, { passive: true });
    previewEl.addEventListener("scroll", onPreviewScroll, { passive: true });
    for (const ev of ["pointerenter", "wheel", "touchstart"] as const) {
      scroller.addEventListener(ev, activateEditor, { passive: true });
      previewEl.addEventListener(ev, activatePreview, { passive: true });
    }

    return () => {
      cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", onEditorScroll);
      previewEl.removeEventListener("scroll", onPreviewScroll);
      for (const ev of ["pointerenter", "wheel", "touchstart"] as const) {
        scroller.removeEventListener(ev, activateEditor);
        previewEl.removeEventListener(ev, activatePreview);
      }
    };
  }, [view, previewEl, enabled]);
}
