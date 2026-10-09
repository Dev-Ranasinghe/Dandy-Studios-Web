/**
 * The site's accent themes. Every tinted surface reads a handful of tokens (see globals.css); a
 * theme remaps them on <html data-accent>, so the CSS follows by itself. Canvas and WebGL pieces
 * can't read CSS, so they take the same values from here through useAccent().
 *
 * Lilac is the house palette and the default; the rest are neon highlighter colours.
 *
 * Roles, darkest to lightest:
 *   night       ink tinted toward the hue (menu at night)
 *   plasma      the deepest dark ground
 *   deep        a step up from plasma (plasma field)
 *   lavender    the tint allowed on bone: text, washes, panel bases (≥ 5.5:1 on bone)
 *   lilac       the accent as text/icons on dark grounds (≥ 5:1 on ink-lavender panels);
 *               the neon itself, lifted only where the raw neon would fail that contrast
 *   pale        lilac lifted toward white (menu by day)
 *   counter     a foil that keeps the plasma from going monochrome
 *   highlight   the raw neon, for fills only: marker swipes, lit cards, swatches, cursors
 *   onHighlight text set on a highlight fill (ink, or bone for the dark violet)
 */
export type Accent = "lilac" | "green" | "cyan" | "yellow" | "red" | "pink" | "violet";

export type AccentPalette = {
  label: string;
  night: string;
  plasma: string;
  deep: string;
  lavender: string;
  lilac: string;
  pale: string;
  counter: string;
  highlight: string;
  onHighlight: string;
};

export const ACCENTS: Record<Accent, AccentPalette> = {
  lilac: {
    label: "Lilac",
    night: "#0d0a14",
    plasma: "#1c0a2e",
    deep: "#301250",
    lavender: "#4d3b78",
    lilac: "#b8a9e8",
    pale: "#dcd3f7",
    counter: "#2c5264",
    highlight: "#b8a9e8",
    onHighlight: "#0e0d0c",
  },
  green: {
    label: "Green",
    night: "#020a00",
    plasma: "#051a00",
    deep: "#0a3300",
    lavender: "#0b6e00",
    lilac: "#10ff00",
    pale: "#c9ffc2",
    counter: "#003a3a",
    highlight: "#10ff00",
    onHighlight: "#0e0d0c",
  },
  cyan: {
    label: "Cyan",
    night: "#000b0a",
    plasma: "#001f1b",
    deep: "#003a33",
    lavender: "#006b5c",
    lilac: "#00ffd9",
    pale: "#c2fff5",
    counter: "#1a1f4a",
    highlight: "#00ffd9",
    onHighlight: "#0e0d0c",
  },
  yellow: {
    label: "Yellow",
    night: "#0b0b00",
    plasma: "#1c1d00",
    deep: "#353700",
    lavender: "#5f6200",
    lilac: "#f8ff00",
    pale: "#fdffc2",
    counter: "#3a1f00",
    highlight: "#f8ff00",
    onHighlight: "#0e0d0c",
  },
  red: {
    label: "Red",
    night: "#0e0000",
    plasma: "#2a0000",
    deep: "#4d0000",
    lavender: "#b80000",
    lilac: "#ff4a4a",
    pale: "#ffd0d0",
    counter: "#3a1a00",
    highlight: "#ff0000",
    onHighlight: "#0e0d0c",
  },
  pink: {
    label: "Pink",
    night: "#0e000c",
    plasma: "#2a0027",
    deep: "#4d0047",
    lavender: "#a3008f",
    lilac: "#ff3df2",
    pale: "#ffd0fb",
    counter: "#1f0a4a",
    highlight: "#ff10f0",
    onHighlight: "#0e0d0c",
  },
  violet: {
    label: "Violet",
    night: "#07000f",
    plasma: "#14002e",
    deep: "#2a0066",
    lavender: "#7f00ff",
    lilac: "#b57aff",
    pale: "#e3d0ff",
    counter: "#002a4a",
    highlight: "#7f00ff",
    onHighlight: "#f4f3f1",
  },
};

export const ACCENT_ORDER = Object.keys(ACCENTS) as Accent[];
export const DEFAULT_ACCENT: Accent = "lilac";
export const ACCENT_KEY = "dandy-accent";
export const ACCENT_EVENT = "accentchange";

export const isAccent = (value: unknown): value is Accent => typeof value === "string" && value in ACCENTS;

/**
 * Runs in <head> before first paint, so a returning visitor never sees the default flash.
 * Kept as a string: it can't import anything.
 */
export const ACCENT_BOOT = `try{var a=localStorage.getItem("${ACCENT_KEY}");if(a!=="${DEFAULT_ACCENT}"&&${JSON.stringify(
  ACCENT_ORDER,
)}.indexOf(a)>-1)document.documentElement.dataset.accent=a}catch(e){}`;

/** "#rrggbb" → [r, g, b] in 0..255. */
export function hexToRgb255(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
