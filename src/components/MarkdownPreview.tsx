import { useEffect, useState, type HTMLAttributes, type ImgHTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { rehypeSourceLine } from "../lib/rehypeSourceLine";
import { MermaidBlock } from "./MermaidBlock";

export type ImageResolver = (src: string) => Promise<string | null>;

interface MarkdownPreviewProps {
  content: string;
  /** Dark theme flag (mermaid diagrams follow the app theme). */
  dark?: boolean;
  /** Resolves relative `images/...` refs to displayable (blob) URLs. */
  resolveImage?: ImageResolver;
}

/** Absolute / data / blob URLs render as-is; only relative paths need resolving. */
function isRelativeSrc(src: string): boolean {
  return !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(src);
}

/**
 * Renders Markdown text as HTML preview (GitHub-flavored).
 * Each element carries a `data-line` attribute (source line) used by
 * the split view's scroll synchronization.
 */
export function MarkdownPreview({ content, dark = false, resolveImage }: MarkdownPreviewProps) {
  return (
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // mermaid fences skip highlighting so their raw source reaches the
        // code component below for diagram rendering.
        rehypePlugins={[rehypeSourceLine, [rehypeHighlight, { plainText: ["mermaid"] }]]}
        components={{
          img: (props) => <DriveImage {...props} resolveImage={resolveImage} />,
          code: (props) => <CodeOrMermaid {...props} dark={dark} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

function CodeOrMermaid({
  className,
  children,
  dark,
  ...rest
}: HTMLAttributes<HTMLElement> & { dark: boolean }) {
  if (/\blanguage-mermaid\b/.test(className ?? "")) {
    return <MermaidBlock code={String(children).trim()} dark={dark} />;
  }
  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
}

function DriveImage({
  src,
  alt,
  resolveImage,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { resolveImage?: ImageResolver }) {
  const relative = typeof src === "string" && src.length > 0 && isRelativeSrc(src);
  const [resolved, setResolved] = useState<string | null>(relative ? null : (src ?? null));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!relative || typeof src !== "string") return;
    if (!resolveImage) {
      setFailed(true);
      return;
    }
    let alive = true;
    setFailed(false);
    setResolved(null);
    resolveImage(src)
      .then((url) => {
        if (!alive) return;
        if (url) setResolved(url);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [relative, src, resolveImage]);

  if (relative && failed) {
    return (
      <span className="img-fallback" title={typeof src === "string" ? src : undefined}>
        🖼 {alt || (typeof src === "string" ? src : "画像")}（このアプリでは表示できません）
      </span>
    );
  }
  if (relative && !resolved) {
    return <span className="img-fallback">🖼 画像を読み込み中…</span>;
  }
  return <img src={resolved ?? undefined} alt={alt} {...rest} />;
}
