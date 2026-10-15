/**
 * Tile colours. The ramp is viridis, which stays distinct under the common forms of colour
 * blindness and keeps its order in greyscale. Each value is also printed on its tile, so colour is
 * never the only cue.
 */
const RAMP = [
  "#440154",
  "#482878",
  "#3e4989",
  "#31688e",
  "#26828e",
  "#1f9e89",
  "#35b779",
  "#6ece58",
  "#b5de2b",
  "#fde725",
] as const;

const FALLBACK = "#440154";
const DARK_TEXT = "#1a1a1a";
const LIGHT_TEXT = "#ffffff";

export interface TileColours {
  background: string;
  text: string;
}

/** Colours for a tile value: the ramp step for its power of two, with whichever text reads better on it. */
export function tileColours(value: number): TileColours {
  const step = Math.min(RAMP.length - 1, Math.max(0, Math.log2(value) - 1));
  const background = RAMP[step] ?? FALLBACK;
  const text = contrastRatio(background, DARK_TEXT) >= contrastRatio(background, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
  return { background, text };
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function relativeLuminance(hex: string): number {
  const channel = (offset: number): number => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
