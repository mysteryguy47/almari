/**
 * Design tokens. Warm paper and ink, one accent (the grey-green of the old
 * steel almari), and five nostalgic tints: inland-letter blue for common
 * papers, lifafa khaki for personal ones, rubber-stamp violet for labels,
 * sindoor red for anything expired, haldi yellow for anything due soon.
 *
 * Every text/background pair below is checked for WCAG AA contrast in
 * src/theme/__tests__/contrast.test.ts, in both light and dark.
 */
import type { Tint } from '@/domain/templates';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  brass: string;
  brassInk: string;
  brassLine: string;
  overlay: string;
  inland: string;
  inlandSoft: string;
  lifafa: string;
  lifafaSoft: string;
  stamp: string;
  stampSoft: string;
  sindoor: string;
  sindoorSoft: string;
  haldi: string;
  haldiSoft: string;
  almari: string;
  almariSoft: string;
}

export const light: Palette = {
  bg: '#F4EFE6',
  surface: '#FFFCF6',
  surfaceAlt: '#ECE5D6',
  ink: '#1D1B16',
  ink2: '#544F46',
  ink3: '#6B6458',
  line: '#E0D7C5',
  accent: '#34574A',
  accentSoft: '#DCE6DF',
  onAccent: '#FFFCF6',
  brass: '#D2B27A',
  brassInk: '#33240F',
  brassLine: '#A9864C',
  overlay: 'rgba(29, 27, 22, 0.42)',
  inland: '#2E5381',
  inlandSoft: '#E0E8F2',
  lifafa: '#7A5622',
  lifafaSoft: '#F2E6CF',
  stamp: '#51449A',
  stampSoft: '#E8E4F5',
  sindoor: '#A2311E',
  sindoorSoft: '#F7DFD9',
  haldi: '#7A5800',
  haldiSoft: '#F8EBC8',
  almari: '#34574A',
  almariSoft: '#DCE6DF',
};

export const dark: Palette = {
  bg: '#12110E',
  surface: '#1C1A16',
  surfaceAlt: '#26231D',
  ink: '#F2EDE3',
  ink2: '#C2BAAB',
  ink3: '#A39B8B',
  line: '#322E27',
  accent: '#93BBA6',
  accentSoft: '#1F2C26',
  onAccent: '#0F1512',
  brass: '#7A5E35',
  brassInk: '#FFF6E6',
  brassLine: '#B8955C',
  overlay: 'rgba(0, 0, 0, 0.6)',
  inland: '#9DBCE4',
  inlandSoft: '#1C2633',
  lifafa: '#DDBB84',
  lifafaSoft: '#2D2518',
  stamp: '#B9ADF0',
  stampSoft: '#252038',
  sindoor: '#F2978A',
  sindoorSoft: '#3A1E19',
  haldi: '#EBC665',
  haldiSoft: '#30270F',
  almari: '#93BBA6',
  almariSoft: '#1F2C26',
};

export function tintColors(palette: Palette, tint: Tint): { fg: string; bg: string } {
  switch (tint) {
    case 'inland': return { fg: palette.inland, bg: palette.inlandSoft };
    case 'lifafa': return { fg: palette.lifafa, bg: palette.lifafaSoft };
    case 'stamp': return { fg: palette.stamp, bg: palette.stampSoft };
    case 'sindoor': return { fg: palette.sindoor, bg: palette.sindoorSoft };
    case 'haldi': return { fg: palette.haldi, bg: palette.haldiSoft };
    case 'almari': return { fg: palette.almari, bg: palette.almariSoft };
  }
}

/** Avatar tints cycle through the nostalgic set, picked from the member id. */
export const AVATAR_TINTS: Tint[] = ['inland', 'lifafa', 'stamp', 'almari', 'haldi', 'sindoor'];

export function tintForId(id: string): Tint {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 44 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

/** Phone-width content, centred, so the web app reads like the phone app on a laptop. */
export const MAX_WIDTH = 560;

/** The tab bar's height; tab screens leave this much room at the bottom. */
export const TAB_BAR_HEIGHT = 72;

export const fonts = {
  display: 'Eczar_700Bold',
  displaySemi: 'Eczar_600SemiBold',
  regular: 'AnekLatin_400Regular',
  medium: 'AnekLatin_500Medium',
  semibold: 'AnekLatin_600SemiBold',
  bold: 'AnekLatin_700Bold',
} as const;
