export type ShapeKind = 'circle' | 'triangle' | 'roundSquare' | 'diamond' | 'star';

export interface CritterColor {
  readonly name: string;
  readonly hex: string;
  readonly rgb: readonly [number, number, number];
  readonly shape: ShapeKind;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function color(name: string, hex: string, shape: ShapeKind): CritterColor {
  return { name, hex, rgb: rgb(hex), shape };
}

/** Index in this array is the critter "color id" used everywhere in gameplay code. */
export const CRITTER_COLORS: readonly CritterColor[] = [
  color('Coral', '#FF6B6B', 'circle'),
  color('Kelp', '#3DDC97', 'triangle'),
  color('Sun', '#FFD166', 'roundSquare'),
  color('Lilac', '#B388FF', 'diamond'),
  color('Sky', '#4CC9F0', 'star'),
];

export const PALETTE = {
  bgEdge: '#04131F',
  bgCenter: '#0A2C40',
  pearlHalo: 'rgba(16, 71, 94, 0.4)',
  reef: '#0D3A4A',
  reefFore: '#082636',
  uiSurface: 'rgba(15, 59, 82, 0.88)',
  uiBorder: '#2A6B85',
  uiText: '#EAF7FF',
  uiTextDim: '#9CC7D9',
  buttonPrimary: '#F4F1FF',
  buttonPrimaryText: '#0A2C40',
  focusGlow: '#B388FF',
  pearlCore: '#F4F1FF',
  pearlSheen: '#C9B8FF',
  shellSegment: '#CDE7F2',
  damageFlash: '#FF6B6B',
  ropeTooFar: '#FF4D5E',
  rarityCommon: '#9CC7D9',
  rarityRare: '#4CC9F0',
  rarityEpic: '#B388FF',
} as const;
