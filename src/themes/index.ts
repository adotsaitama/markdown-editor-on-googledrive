import { blueTopazTheme } from "./blueTopaz";
import { defaultTheme } from "./defaultTheme";

/**
 * Theme system: each theme provides light/dark token sets that are applied
 * as CSS variables on <html>. Porting another Obsidian theme = extracting
 * its .theme-light / .theme-dark values into a new AppTheme file and
 * registering it here.
 */
export interface ThemeTokens {
  bg: string;
  bgSecondary: string;
  fg: string;
  muted: string;
  border: string;
  accent: string;
  accentFg: string;
  errorBg: string;
  errorBorder: string;
  errorFg: string;
  h1: string;
  h2: string;
  h3: string;
  h4: string;
  h5: string;
  h6: string;
  codeBg: string;
  codeFg: string;
  inlineCodeFg: string;
  blockquoteBg: string;
  selection: string;
}

export interface AppTheme {
  id: string;
  name: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}

export const THEMES: AppTheme[] = [blueTopazTheme, defaultTheme];

export const DEFAULT_THEME_ID = blueTopazTheme.id;

/** token key -> CSS variable name */
const VAR_MAP: Record<keyof ThemeTokens, string> = {
  bg: "--bg",
  bgSecondary: "--bg-secondary",
  fg: "--fg",
  muted: "--muted",
  border: "--border",
  accent: "--accent",
  accentFg: "--accent-fg",
  errorBg: "--error-bg",
  errorBorder: "--error-border",
  errorFg: "--error-fg",
  h1: "--h1-color",
  h2: "--h2-color",
  h3: "--h3-color",
  h4: "--h4-color",
  h5: "--h5-color",
  h6: "--h6-color",
  codeBg: "--code-bg",
  codeFg: "--code-fg",
  inlineCodeFg: "--inline-code-fg",
  blockquoteBg: "--blockquote-bg",
  selection: "--selection",
};

export function applyTheme(themeId: string, mode: "light" | "dark"): void {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const tokens = theme[mode];
  const style = document.documentElement.style;
  for (const [key, cssVar] of Object.entries(VAR_MAP) as [keyof ThemeTokens, string][]) {
    style.setProperty(cssVar, tokens[key]);
  }
}
