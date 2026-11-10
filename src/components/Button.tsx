import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { IconName } from '@/domain/icons';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { Pressy } from './Pressy';
import { T } from './Text';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  size?: 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', icon, size = 'lg', disabled, loading, full = true, testID }: ButtonProps) {
  const { palette } = useTheme();
  const colors = {
    primary: { bg: palette.accent, fg: 'onAccent' as const, border: palette.accent },
    secondary: { bg: palette.surface, fg: 'ink' as const, border: palette.line },
    ghost: { bg: 'transparent', fg: 'accent' as const, border: 'transparent' },
    danger: { bg: palette.sindoorSoft, fg: 'sindoor' as const, border: palette.sindoorSoft },
  }[variant];
  return (
    <Pressy
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      hapticOnPress
      accessibilityLabel={label}
      style={[
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        { backgroundColor: colors.bg, borderColor: colors.border },
        full ? styles.full : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette[colors.fg]} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'lg' ? 20 : 18} color={colors.fg} /> : null}
          <T variant={size === 'lg' ? 'bodyStrong' : 'smallStrong'} color={colors.fg}>
            {label}
          </T>
        </View>
      )}
    </Pressy>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  lg: { minHeight: 54, paddingHorizontal: space.xxl },
  md: { minHeight: 44, paddingHorizontal: space.lg },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
