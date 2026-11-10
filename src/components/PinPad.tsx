import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/device';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

import { Icon } from './Icon';
import { T } from './Text';

export const PIN_LENGTH = 4;

/**
 * Four dots and big keys. `onSubmit` returns true when the PIN is accepted;
 * otherwise the dots shake and clear.
 */
export function PinPad({ onSubmit, onBiometric, message, testID }: {
  onSubmit: (pin: string) => Promise<boolean> | boolean;
  onBiometric?: () => void;
  message?: string;
  testID?: string;
}) {
  const { palette } = useTheme();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const shake = useSharedValue(0);
  const dotsStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  const press = async (digit: string) => {
    if (busy || pin.length >= PIN_LENGTH) return;
    haptic.tap();
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      setBusy(true);
      const accepted = await onSubmit(next);
      setBusy(false);
      if (!accepted) {
        haptic.warn();
        shake.set(withSequence(
          withTiming(-12, { duration: 50 }), withTiming(12, { duration: 50 }), withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }), withTiming(0, { duration: 50 }),
        ));
        setPin('');
      }
    }
  };

  const key = (label: string, onPress: () => void, a11y: string, content?: ReactNode) => (
    <Pressable
      key={a11y}
      testID={testID ? `${testID}-${a11y}` : undefined}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.key, { backgroundColor: pressed ? palette.surfaceAlt : palette.surface, borderColor: palette.line }]}
    >
      {content ?? <T variant="numberLarge">{label}</T>}
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.dots, dotsStyle]} accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, { borderColor: palette.ink2, backgroundColor: i < pin.length ? palette.ink : 'transparent' }]} />
        ))}
      </Animated.View>
      <T variant="small" color={message ? 'sindoor' : 'ink2'} align="center" accessibilityLiveRegion="polite" style={styles.message}>
        {message ?? ' '}
      </T>
      <View style={styles.grid}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, () => press(d), d))}
        {onBiometric
          ? key('', onBiometric, 'Use fingerprint', <Icon name="FingerprintPattern" size={28} color="accent" />)
          : <View style={styles.keySpacer} />}
        {key('0', () => press('0'), '0')}
        {key('', () => setPin((p) => p.slice(0, -1)), 'Delete', <Icon name="ChevronLeft" size={26} color="ink2" />)}
      </View>
    </View>
  );
}

const KEY = 72;
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  dots: { flexDirection: 'row', gap: space.lg, paddingVertical: space.md },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  message: { minHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: KEY * 3 + space.lg * 2, gap: space.lg, justifyContent: 'center' },
  key: { width: KEY, height: KEY, borderRadius: KEY / 2, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  keySpacer: { width: KEY, height: KEY },
});
