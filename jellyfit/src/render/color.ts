export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToCss([r, g, b]: RGB, a = 1): string {
  return a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export const lighten = (c: RGB, p: number): RGB => mix(c, [255, 255, 255], p);
export const darken = (c: RGB, p: number): RGB => mix(c, [0, 0, 0], p);

/** Desaturates toward the colour's own luminance, then dims. */
export function desaturate(c: RGB, amount: number, dim = 0.25): RGB {
  const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const g: RGB = [l * 0.62 + 46, l * 0.58 + 40, l * 0.7 + 84];
  return darken(mix(c, g, amount), dim);
}
