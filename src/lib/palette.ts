// Validated default palette from the dataviz skill (references/palette.md).
// Categorical order is a fixed CVD-safety mechanism — never reorder or cycle.

export const categorical = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

/** CSS-custom-property references (resolve through globals.css's light/dark blocks) —
 * use these for SVG fill/stroke so charts recolor automatically on theme change with
 * no React re-render needed. Use `categorical.light`/`.dark` directly only where a
 * concrete hex is required (e.g. the color-swatch picker buttons still work fine with
 * the var() form too via inline style, but tests/exports sometimes want a literal). */
export const categoricalVar = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);

export const status = {
  good: { light: "#0ca30c", dark: "#0ca30c" },
  warning: { light: "#fab219", dark: "#fab219" },
  serious: { light: "#ec835a", dark: "#ec835a" },
  critical: { light: "#d03b3b", dark: "#d03b3b" },
};

// Score-band tiers mapped onto the fixed status scale (never reused for series identity).
export const tierColor = {
  support: status.critical,
  developing: status.warning,
  strong: status.good,
};

/** CSS-var form of tierColor, for SVG fill/stroke (see categoricalVar above). Status
 * hues are mode-invariant, but routing through the var still keeps every chart color
 * consistent in how it's sourced. */
export const tierColorVar = {
  support: "var(--status-critical)",
  developing: "var(--status-warning)",
  strong: "var(--status-good)",
};

export const chrome = {
  light: {
    surface: "#fcfcfb",
    page: "#f9f9f7",
    textPrimary: "#0b0b0b",
    textSecondary: "#52514e",
    textMuted: "#898781",
    gridline: "#e1e0d9",
    baseline: "#c3c2b7",
  },
  dark: {
    surface: "#1a1a19",
    page: "#0d0d0d",
    textPrimary: "#ffffff",
    textSecondary: "#c3c2b7",
    textMuted: "#898781",
    gridline: "#2c2c2a",
    baseline: "#383835",
  },
};

export const sequentialBlue = [
  "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec",
  "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b",
];
