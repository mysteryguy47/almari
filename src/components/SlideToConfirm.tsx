import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/lib/device';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { Icon } from './Icon';
import { T } from './Text';

const KNOB = 52;
const PAD = 4;
const SPRING = { damping: 20, stiffness: 260 };

/**
 * Slide to confirm a big action (delete, leave, change privacy). Hard to do by
 * accident, satisfying to do on purpose. Screen readers get it as a button.
 */
export function SlideToConfirm({ label, onConfirm, tone = 'accent', testID }: { label: string; onConfirm: () => void; tone?: 'accent' | 'sindoor'; testID?: string }) {
  const { palette } = useTheme();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const max = Math.max(0, width - KNOB - PAD * 2);
  const color = palette[tone];

  const confirm = () => {
    haptic.success();
    onConfirm();
  };

  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      x.set(Math.min(max, Math.max(0, e.translationX)));
    },
    onDeactivate: () => {
      'worklet';
      if (max > 0 && x.get() > max * 0.85) {
        x.set(withSpring(max, SPRING));
        scheduleOnRN(confirm);
      } else {
        x.set(withSpring(0, SPRING));
      }
    },
  });

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: max > 0 ? interpolate(x.get(), [0, max * 0.6], [1, 0]) : 1 }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.get() + KNOB + PAD }));

  return (
    <View
      testID={testID}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Slide right to confirm, or double-tap"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && confirm()}
      style={[styles.track, { backgroundColor: palette.surfaceAlt, borderColor: palette.line }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: tone === 'accent' ? palette.accentSoft : palette.sindoorSoft }, fillStyle]} />
      <Animated.View style={[styles.labelWrap, labelStyle]} pointerEvents="none">
        <T variant="bodyStrong" color="ink2">{label}</T>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.knob, { backgroundColor: color }, knobStyle]}>
          <Icon name="ChevronRight" size={26} color={tone === 'accent' ? 'onAccent' : 'surface'} strokeWidth={2.4} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: KNOB + PAD * 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  labelWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingLeft: KNOB },
  knob: { position: 'absolute', left: PAD, width: KNOB, height: KNOB, borderRadius: KNOB / 2, alignItems: 'center', justifyContent: 'center' },
});
