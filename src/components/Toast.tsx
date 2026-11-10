import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUi } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { MAX_WIDTH, radius, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { T } from './Text';

/** One toast at a time, above the tab bar; Undo where it helps. */
export function ToastHost() {
  const toastState = useUi((s) => s.toast);
  const hide = useUi((s) => s.hideToast);
  const { palette, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toastState) return;
    const timer = setTimeout(() => hide(toastState.id), toastState.action ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [toastState, hide]);

  if (!toastState) return null;
  const bg = scheme === 'dark' ? palette.surfaceAlt : palette.ink;
  const fg = scheme === 'dark' ? palette.ink : palette.surface;
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 96 }]}>
      <Animated.View
        key={toastState.id}
        entering={FadeInDown.springify().damping(18)}
        exiting={FadeOutDown.duration(160)}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: bg }]}
      >
        <Icon
          name={toastState.tone === 'warn' ? 'TriangleExclamationPoint' : toastState.tone === 'success' ? 'CircleCheck' : 'Info'}
          size={20}
          rawColor={toastState.tone === 'warn' ? palette.haldi : fg}
        />
        <T variant="smallStrong" style={[styles.text, { color: fg }]}>{toastState.text}</T>
        {toastState.action ? (
          <Pressable
            onPress={() => {
              toastState.action?.onPress();
              hide(toastState.id);
            }}
            accessibilityRole="button"
            hitSlop={10}
          >
            <T variant="smallStrong" style={{ color: scheme === 'dark' ? palette.accent : palette.brass }}>{toastState.action.label}</T>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.xl },
  toast: {
    width: '100%', maxWidth: MAX_WIDTH, flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, minHeight: 52,
  },
  text: { flex: 1 },
});
