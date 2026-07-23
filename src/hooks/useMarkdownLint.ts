import { useEffect, useState } from "react";

export interface LintIssue {
  line: number;
  rule: string;
  description: string;
  detail: string | null;
}

// MD013 (line length) is noisy for prose — especially Japanese — so it's off.
const LINT_CONFIG = { default: true, MD013: false } as const;

/**
 * Lint the document with markdownlint (MIT), debounced and lazy-loaded so
 * the library only ships to users when a document is actually open.
 * Lint failures never break the app; they just yield an empty list.
 */
export function useMarkdownLint(content: string | null): LintIssue[] {
  const [issues, setIssues] = useState<LintIssue[]>([]);

  useEffect(() => {
    if (content === null) {
      setIssues([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { lint } = await import("markdownlint/promise");
        const results = await lint({ strings: { doc: content }, config: LINT_CONFIG });
        if (cancelled) return;
        const errors = results.doc ?? [];
        setIssues(
          errors.map((e) => ({
            line: e.lineNumber,
            rule: e.ruleNames.join(" / "),
            description: e.ruleDescription,
            detail: e.errorDetail ?? null,
          })),
        );
      } catch (err) {
        console.error("markdownlint failed:", err);
        if (!cancelled) setIssues([]);
      }
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [content]);

  return issues;
}
