import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { rehypeSourceLine } from "../lib/rehypeSourceLine";

interface MarkdownPreviewProps {
  content: string;
}

/**
 * Renders Markdown text as HTML preview (GitHub-flavored).
 * Each element carries a `data-line` attribute (source line) used by
 * the split view's scroll synchronization.
 */
export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSourceLine, rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
