import { useEffect, useRef, useState } from "react";

interface MermaidBlockProps {
  code: string;
  dark: boolean;
}

let renderSeq = 0;

/**
 * Renders a ```mermaid fence as an SVG diagram. The mermaid library (MIT)
 * is lazy-loaded on first use. While typing produces transiently invalid
 * diagrams, the last successful render stays visible with a small error
 * note instead of flashing away.
 */
export function MermaidBlock({ code, dark }: MermaidBlockProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: dark ? "dark" : "default",
        });
        const id = `mermaid-render-${++renderSeq}`;
        const result = await mermaid.render(id, code);
        if (!alive) return;
        setSvg(result.svg);
        setError(null);
      } catch (err) {
        // mermaid.render can leave a stray error element behind; drop it.
        document.querySelector("#dmermaid-render-" + renderSeq)?.remove();
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, dark]);

  if (!svg && !error) {
    return <div className="mermaid-loading">図を描画中…</div>;
  }
  return (
    <div ref={containerRef} className="mermaid-block">
      {svg && <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />}
      {error && (
        <div className="mermaid-error" title={error}>
          ⚠ Mermaid の構文エラー{svg ? "（最後に成功した図を表示中）" : `: ${error}`}
        </div>
      )}
    </div>
  );
}
