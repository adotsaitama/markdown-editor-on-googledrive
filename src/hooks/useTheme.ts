import { useCallback, useEffect, useState } from "react";
import { applyTheme, DEFAULT_THEME_ID, THEMES } from "../themes";

export type Theme = "light" | "dark";

const MODE_STORAGE_KEY = "theme";
const THEME_STORAGE_KEY = "app-theme";

/**
 * Light/dark mode + selectable color theme (themes/ registry), both
 * persisted in localStorage. The resolved mode is stamped on
 * `<html data-theme="…">` (used by mode-specific CSS like the hljs
 * palette) and the selected theme's tokens are applied as CSS variables.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [themeId, setThemeId] = useState<string>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored && THEMES.some((t) => t.id === stored) ? stored : DEFAULT_THEME_ID;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(MODE_STORAGE_KEY, theme);
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    applyTheme(themeId, theme);
  }, [theme, themeId]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle, themeId, setThemeId, themes: THEMES };
}
