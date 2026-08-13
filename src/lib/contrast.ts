// ── CONTRAST ─────────────────────────────────────────────────────────────────
// WCAG 2.1 relative luminance and contrast ratio.
//
// Here because the branding screen hands the palette to an admin, and the one
// thing an admin cannot see from a colour picker is whether the text on top of
// it will still be readable. `text-dim` alone carries ~70 small labels; a brand
// colour two shades too light does not look wrong in the picker and looks wrong
// on every page.

/** #rrggbb → [r, g, b], 0–255. Returns null for anything else. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance. The 0.03928 branch is the sRGB gamma cutoff. */
export function luminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio between two colours, 1 (identical) to 21 (black on white).
 *
 * AA wants 4.5 for body text and 3 for large text and UI boundaries. Returns
 * null when either colour is unparseable — the caller decides whether that is
 * a warning or simply nothing to say yet.
 */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;

  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const kAaNormal = 4.5;
