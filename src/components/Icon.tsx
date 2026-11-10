import type { IconName } from '@/domain/icons';
import { useTheme } from '@/theme/ThemeProvider';
import type { Palette } from '@/theme/tokens';

import { ICONS } from './icon-map';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: keyof Palette;
  /** A raw colour, when the palette key is not enough (tints). */
  rawColor?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color = 'ink', rawColor, strokeWidth = 1.8 }: IconProps) {
  const { palette } = useTheme();
  const Component = ICONS[name];
  return <Component size={size} color={rawColor ?? palette[color]} strokeWidth={strokeWidth} />;
}
