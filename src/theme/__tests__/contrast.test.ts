import { contrastRatio } from '../contrast';
import { dark, light, type Palette } from '../tokens';

/** Every text colour on every background it is used on. AA = 4.5:1 for normal text. */
const TEXT_PAIRS: [keyof Palette, keyof Palette][] = [
  ['ink', 'bg'], ['ink', 'surface'], ['ink', 'surfaceAlt'],
  ['ink2', 'bg'], ['ink2', 'surface'], ['ink2', 'surfaceAlt'],
  ['ink3', 'bg'], ['ink3', 'surface'],
  ['accent', 'bg'], ['accent', 'surface'], ['accent', 'accentSoft'],
  ['onAccent', 'accent'],
  ['brassInk', 'brass'],
  ['inland', 'inlandSoft'], ['inland', 'surface'],
  ['lifafa', 'lifafaSoft'], ['lifafa', 'surface'],
  ['stamp', 'stampSoft'], ['stamp', 'surface'],
  ['sindoor', 'sindoorSoft'], ['sindoor', 'surface'], ['sindoor', 'bg'],
  ['haldi', 'haldiSoft'], ['haldi', 'surface'],
  ['almari', 'almariSoft'],
];

describe.each([['light', light], ['dark', dark]] as const)('%s theme', (_name, palette) => {
  it.each(TEXT_PAIRS)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(contrastRatio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('contrastRatio', () => {
  it('matches known values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });
});
