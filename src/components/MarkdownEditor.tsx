import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { changeListIndent } from "../lib/markdownCommands";
import { EDITOR_COMMANDS } from "../lib/editorCommands";
import { getShortcuts } from "../lib/shortcutConfig";

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
  /**
   * Uploads a pasted image and resolves to its relative Markdown path.
   * When set, pasting an image inserts a placeholder that is replaced by
   * `![](path)` on success (or an error note on failure).
   */
  onPasteImage?: (blob: Blob) => Promise<string>;
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
  onPasteImage,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onViewReadyRef = useRef(onViewReady);
  const onPasteImageRef = useRef(onPasteImage);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  onViewReadyRef.current = onViewReady;
  onPasteImageRef.current = onPasteImage;

  useEffect(() => {
    if (!containerRef.current) return;

    const shortcuts = getShortcuts();
    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        // Config-driven command shortcuts (shortcutConfig.ts). These must
        // precede basicSetup so they win over any default binding.
        keymap.of([
          ...EDITOR_COMMANDS.filter((c) => shortcuts[c.id]).map((c) => ({
            key: shortcuts[c.id],
            preventDefault: true,
            run: (v: EditorView) => {
              c.run(v, { save: () => onSaveRef.current() });
              return true;
            },
          })),
          // List items: Tab / Shift-Tab change nesting depth. Outside lists
          // the binding returns false and Tab keeps its default behavior.
          {
            key: "Tab",
            run: (v) => changeListIndent(v, 1),
            shift: (v) => changeListIndent(v, -1),
          },
        ]),
        basicSetup,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        // Paste an image -> upload to Drive, insert ![](images/...) when done.
        EditorView.domEventHandlers({
          paste: (event, v) => {
            const upload = onPasteImageRef.current;
            if (!upload) return false;
            const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
              i.type.startsWith("image/"),
            );
            const blob = item?.getAsFile();
            if (!blob) return false;
            event.preventDefault();

            const placeholder = `![アップロード中…](uploading-${Date.now()})`;
            const at = v.state.selection.main.head;
            v.dispatch({
              changes: { from: at, insert: placeholder },
              selection: { anchor: at + placeholder.length },
              userEvent: "input",
            });

            const replacePlaceholder = (text: string) => {
              const pos = v.state.doc.toString().indexOf(placeholder);
              if (pos < 0) return; // user removed it meanwhile
              v.dispatch({
                changes: { from: pos, to: pos + placeholder.length, insert: text },
                userEvent: "input",
              });
            };
            upload(blob)
              .then((path) => replacePlaceholder(`![](${path})`))
              .catch((err: unknown) => {
                replacePlaceholder("");
                console.error("image upload failed:", err);
                window.alert(
                  `画像のアップロードに失敗しました: ${err instanceof Error ? err.message : err}`,
                );
              });
            return true;
          },
        }),
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
