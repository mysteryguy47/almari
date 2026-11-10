import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme/ThemeProvider';
import { MAX_WIDTH, radius, space } from '@/theme/tokens';

import { T } from './Text';

const SPRING = { damping: 22, stiffness: 240, mass: 0.8 };
const OFFSCREEN = 900;

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  testID?: string;
}

/** A bottom sheet that follows the finger: drag the handle down, or tap outside, to close. */
export function Sheet({ visible, onClose, title, subtitle, children, testID }: SheetProps) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  // Mount as soon as it should show (derived state, set during render, not in an effect).
  if (visible && !mounted) setMounted(true);
  const translateY = useSharedValue(OFFSCREEN);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.set(withSpring(0, SPRING));
      backdrop.set(withTiming(1, { duration: 200 }));
    } else {
      backdrop.set(withTiming(0, { duration: 180 }));
      translateY.set(
        withTiming(OFFSCREEN, { duration: 220 }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, translateY, backdrop]);

  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      translateY.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 110 || e.velocityY > 900) scheduleOnRN(onClose);
      else translateY.set(withSpring(0, SPRING));
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.overlay }, backdropStyle]}>
          <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        </Animated.View>
        <View style={styles.anchor} pointerEvents="box-none">
          <Animated.View
            testID={testID}
            accessibilityViewIsModal
            style={[styles.sheet, { backgroundColor: palette.bg, paddingBottom: insets.bottom + space.lg }, sheetStyle]}
          >
            <GestureDetector gesture={pan}>
              <View style={styles.grab}>
                <View style={[styles.handle, { backgroundColor: palette.line }]} />
                {title ? <T variant="title" align="center">{title}</T> : null}
                {subtitle ? <T variant="body" color="ink2" align="center">{subtitle}</T> : null}
              </View>
            </GestureDetector>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bounces={false}>
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  anchor: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: MAX_WIDTH + 40, maxHeight: '88%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  grab: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.md, paddingHorizontal: space.xl, gap: 2 },
  handle: { width: 44, height: 5, borderRadius: 3, marginBottom: space.md },
  content: { paddingHorizontal: space.xl, paddingBottom: space.sm },
});
