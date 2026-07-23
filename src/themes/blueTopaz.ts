import type { AppTheme } from "./index";

/**
 * Blue Topaz — ported from the Obsidian theme "Blue-Topaz_Obsidian-css"
 * (MIT License, Copyright (c) 2020 whyt-byte).
 * https://github.com/whyt-byte/Blue-Topaz_Obsidian-css
 *
 * Token values are extracted from the theme's .theme-light / .theme-dark
 * variable blocks (background/text/heading/code/blockquote colors and the
 * signature blue accent).
 */
export const blueTopazTheme: AppTheme = {
  id: "blue-topaz",
  name: "Blue Topaz",
  light: {
    bg: "#ffffff",
    bgSecondary: "#fcfcfc",
    fg: "#0e0e0e",
    muted: "#7f7f7f",
    border: "#dddddd",
    accent: "hsl(209, 95%, 62%)",
    accentFg: "#ffffff",
    errorBg: "#fff5f5",
    errorBorder: "#f5c2c7",
    errorFg: "#e75545",
    h1: "hsl(216, 88%, 26%)",
    h2: "hsl(212, 100%, 33%)",
    h3: "hsl(210, 86%, 39%)",
    h4: "hsl(208, 58%, 49%)",
    h5: "hsl(209, 70%, 62%)",
    h6: "hsl(209, 65%, 72%)",
    codeBg: "#e6e6e671",
    codeFg: "#000000",
    inlineCodeFg: "#e95d00",
    blockquoteBg: "#d5d5d52c",
    selection: "#a9d1c859",
  },
  dark: {
    bg: "#202020",
    bgSecondary: "#151515",
    fg: "#c6c6c6",
    muted: "#8a8a8a",
    border: "#343434",
    accent: "hsl(209, 95%, 62%)",
    accentFg: "#e4e4e4",
    errorBg: "#2d1618",
    errorBorder: "#5c2b2f",
    errorFg: "#f16464",
    h1: "hsl(78, 62%, 47%)",
    h2: "hsl(118, 42%, 49%)",
    h3: "hsl(180, 53%, 48%)",
    h4: "hsl(216, 69%, 68%)",
    h5: "hsl(258, 79%, 77%)",
    h6: "hsl(290, 85%, 81%)",
    codeBg: "#1111118c",
    codeFg: "#d0d0d0",
    inlineCodeFg: "#d58000",
    blockquoteBg: "#9191911c",
    selection: "#3b767160",
  },
};
