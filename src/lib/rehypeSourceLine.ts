import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";

/**
 * Rehype plugin: copy each element's source position (start line in the
 * original Markdown) onto a `data-line` attribute. The preview pane uses
 * these as anchors for editor <-> preview scroll synchronization.
 */
export function rehypeSourceLine() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      const line = node.position?.start?.line;
      if (line !== undefined) {
        node.properties["data-line"] = line;
      }
    });
  };
}
