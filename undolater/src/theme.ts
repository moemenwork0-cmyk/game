import { useColorScheme } from 'react-native';

const light = {
  bg: '#F7F7F5',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFEC',
  raised: '#FFFFFF',
  border: '#E7E7E3',
  text: '#0E0E12',
  muted: '#83838C',
  faint: '#B4B4BB',
  accent: '#5B4CFF',
  accentSoft: '#ECEAFF',
  onAccent: '#FFFFFF',
  danger: '#F0443A',
  dangerSoft: '#FDECEB',
  success: '#12A150',
  successSoft: '#E5F6EC',
  ink: '#0E0E12',
  onInk: '#FFFFFF',
  onInkAccent: '#A99FFF',
  scrim: 'rgba(10,10,14,0.35)',
};

export type Palette = typeof light;

const dark: Palette = {
  bg: '#0B0B0E',
  surface: '#16161B',
  surfaceAlt: '#1F1F26',
  raised: '#30303A',
  border: '#25252D',
  text: '#F4F4F6',
  muted: '#8D8D98',
  faint: '#55555F',
  accent: '#8C80FF',
  accentSoft: '#25224A',
  onAccent: '#0B0B0E',
  danger: '#FF6B61',
  dangerSoft: '#3A1A19',
  success: '#3DD68C',
  successSoft: '#123222',
  ink: '#F4F4F6',
  onInk: '#0B0B0E',
  onInkAccent: '#4B3CEF',
  scrim: 'rgba(0,0,0,0.55)',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };
