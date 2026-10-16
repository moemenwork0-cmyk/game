import { useColorScheme } from 'react-native';

// Palette lifted from Manus's design tokens: warm off-white canvas, near-black ink,
// hairline borders and translucent warm-grey fills.
const light = {
  bg: '#F8F8F7',
  card: '#FFFFFF',
  menu: '#FFFFFF',
  text: '#1A1A19',
  secondary: '#5E5E5B',
  tertiary: '#858481',
  disabled: '#B9B9B7',
  border: 'rgba(0,0,0,0.06)',
  borderStrong: 'rgba(0,0,0,0.12)',
  fill: 'rgba(55,53,47,0.06)',
  fillStrong: 'rgba(55,53,47,0.1)',
  button: '#1A1A19',
  onButton: '#FFFFFF',
  success: '#25BA3B',
  successSoft: 'rgba(37,186,59,0.1)',
  danger: '#EB4D4D',
  dangerSoft: 'rgba(235,77,77,0.1)',
  blue: '#0081F2',
  blueSoft: 'rgba(0,129,242,0.08)',
  scrim: 'rgba(0,0,0,0.28)',
  shadow: '#000000',
  dark: false,
};

export type Palette = Omit<typeof light, 'dark'> & { dark: boolean };

const dark: Palette = {
  bg: '#171718',
  card: '#222223',
  menu: '#272727',
  text: '#E6E6E6',
  secondary: '#B3B3B3',
  tertiary: '#8C8C8C',
  disabled: '#595959',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.14)',
  fill: 'rgba(255,255,255,0.06)',
  fillStrong: 'rgba(255,255,255,0.1)',
  button: 'rgba(255,255,255,0.95)',
  onButton: '#141414',
  success: '#5EB92D',
  successSoft: 'rgba(94,185,45,0.14)',
  danger: '#FB494F',
  dangerSoft: 'rgba(251,73,79,0.14)',
  blue: '#1A93FE',
  blueSoft: 'rgba(26,147,254,0.12)',
  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
  dark: true,
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const fonts = {
  serif: 'LibreBaskerville_400Regular',
  serifBold: 'LibreBaskerville_700Bold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
};

/** Shared spring feel: quick, soft, no wobble. */
export const spring = { damping: 22, stiffness: 260, mass: 0.9 };
export const softSpring = { damping: 26, stiffness: 180, mass: 1 };
