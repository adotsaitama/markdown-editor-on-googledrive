import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";

interface MarkdownEditorProps {
  /** Document shown when the editor mounts. Later changes do not reset the view. */
  initialDoc: string;
  /** Called with the full document text on every edit. */
  onChange: (doc: string) => void;
  /** Called on Mod-s (Ctrl/Cmd+S) inside the editor. */
  onSave: () => void;
}

/**
 * Thin React wrapper around a CodeMirror 6 EditorView.
 * The view is created once on mount; callbacks are routed through refs so
 * re-renders never tear down editor state (selection, undo history, scroll).
 */
export function MarkdownEditor({ initialDoc, onChange, onSave }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  useEffect(() => {
    if (!containerRef.current) return;

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        // Mod-s must precede basicSetup so it wins over any default binding.
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              onSaveRef.current();
              return true;
            },
          },
        ]),
        basicSetup,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
        ...(prefersDark ? [oneDark] : []),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design
  }, []);

  return <div ref={containerRef} className="editor-container" />;
}
