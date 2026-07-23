import type { CommandId } from "./editorCommands";

/**
 * Shortcut config: command id -> CodeMirror key notation ("Mod-b" etc.).
 * Defaults follow conventions Markdown-editor users already know
 * (Typora / Obsidian / VS Code / Google Docs).
 *
 * User overrides are read from localStorage (SHORTCUT_STORAGE_KEY) and merged
 * over the defaults — the groundwork for a future customization UI. The
 * editor keymap, toolbar tooltips and help modal all derive from this map.
 */
export const DEFAULT_SHORTCUTS: Record<CommandId, string> = {
  save: "Mod-s",
  undo: "Mod-z",
  redo: "Mod-y",
  bold: "Mod-b", // universal
  italic: "Mod-i", // universal
  strikethrough: "Mod-Shift-x", // Obsidian / Slack
  code: "Mod-e", // Typora (inline code)
  heading1: "Mod-1", // Typora / Obsidian
  heading2: "Mod-2",
  heading3: "Mod-3",
  bulletList: "Mod-Shift-8", // Google Docs / VS Code
  orderedList: "Mod-Shift-7", // Google Docs
  taskList: "Mod-Shift-9", // Google Docs (checklist)
  quote: "Mod-Shift-q", // Typora
  link: "Mod-k", // universal
  table: "Mod-Alt-t", // Typora's Ctrl+T is reserved by browsers; Alt variant
  horizontalRule: "Mod-Alt-h",
  formatDoc: "Shift-Alt-f", // VS Code (format document)
};

export const SHORTCUT_STORAGE_KEY = "shortcut-overrides";

/** Effective shortcuts: defaults merged with any stored user overrides. */
export function getShortcuts(): Record<CommandId, string> {
  try {
    const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (!raw) return DEFAULT_SHORTCUTS;
    const overrides = JSON.parse(raw) as Partial<Record<CommandId, string>>;
    return { ...DEFAULT_SHORTCUTS, ...overrides };
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

const IS_MAC = /Mac|iP(hone|ad|od)/.test(navigator.platform);

/** "Mod-Shift-8" -> "Ctrl+Shift+8" (or "⌘⇧8" on macOS) for display. */
export function formatShortcut(key: string): string {
  const parts = key.split("-").map((part) => {
    switch (part) {
      case "Mod":
        return IS_MAC ? "⌘" : "Ctrl";
      case "Alt":
        return IS_MAC ? "⌥" : "Alt";
      case "Shift":
        return IS_MAC ? "⇧" : "Shift";
      default:
        return part.length === 1 ? part.toUpperCase() : part;
    }
  });
  return parts.join(IS_MAC ? "" : "+");
}
