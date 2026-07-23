import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { toggleInlineMark } from "../lib/markdownCommands";

interface MarkdownEditorProps {
  /** Document shown when the editor mounts. Later changes do not reset the view. */
  initialDoc: string;
  /** Dark theme on/off (reconfigured live via a Compartment). */
  dark: boolean;
  /** Called with the full document text on every edit. */
  onChange: (doc: string) => void;
  /** Called on Mod-s (Ctrl/Cmd+S) inside the editor. */
  onSave: () => void;
  /** Receives the EditorView after mount (null on unmount); used for scroll sync. */
  onViewReady?: (view: EditorView | null) => void;
}

/**
 * Thin React wrapper around a CodeMirror 6 EditorView.
 * The view is created once on mount; callbacks are routed through refs so
 * re-renders never tear down editor state (selection, undo history, scroll).
 */
export function MarkdownEditor({
  initialDoc,
  dark,
  onChange,
  onSave,
  onViewReady,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onViewReadyRef = useRef(onViewReady);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  onViewReadyRef.current = onViewReady;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        // These must precede basicSetup so they win over any default binding.
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              onSaveRef.current();
              return true;
            },
          },
          { key: "Mod-b", run: (v) => toggleInlineMark(v, "**") },
          { key: "Mod-i", run: (v) => toggleInlineMark(v, "*") },
        ]),
        basicSetup,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
        themeCompartment.current.of(dark ? oneDark : []),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    onViewReadyRef.current?.(view);
    return () => {
      onViewReadyRef.current?.(null);
      viewRef.current = null;
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design
  }, []);

  // Live theme switching without recreating the view.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartment.current.reconfigure(dark ? oneDark : []),
    });
  }, [dark]);

  return <div ref={containerRef} className="editor-container" />;
}
