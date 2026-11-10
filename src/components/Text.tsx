import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, type Palette } from '@/theme/tokens';

export type Variant =
  | 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'small' | 'smallStrong' | 'label' | 'number' | 'numberLarge';

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40 },
  title: { fontFamily: fonts.displaySemi, fontSize: 24, lineHeight: 31 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.9, textTransform: 'uppercase' },
  number: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 24, letterSpacing: 0.6, fontVariant: ['tabular-nums'] },
  numberLarge: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: 1, fontVariant: ['tabular-nums'] },
};

export interface TProps extends TextProps {
  variant?: Variant;
  color?: keyof Palette;
  align?: TextStyle['textAlign'];
}

/** Text in the app's type scale. Follows the phone's font size, up to double. */
export function T({ variant = 'body', color = 'ink', align, style, ...rest }: TProps) {
  const { palette } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={2}
      {...rest}
      style={[VARIANTS[variant], { color: palette[color], textAlign: align }, style]}
    />
  );
}
