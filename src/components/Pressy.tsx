import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/device';

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

export interface PressyProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Layout for the touch area itself: percentage widths, flex. */
  outerStyle?: StyleProp<ViewStyle>;
  /** How far it sinks when pressed (1 = not at all). */
  scaleTo?: number;
  hapticOnPress?: boolean;
}

/** A pressable that sinks a little under the finger and springs back. */
export function Pressy({ children, style, outerStyle, scaleTo = 0.97, hapticOnPress = false, onPressIn, onPressOut, onPress, disabled, ...rest }: PressyProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      {...rest}
      style={outerStyle}
      disabled={disabled}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, SPRING));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, SPRING));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticOnPress) haptic.press();
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, animated, disabled ? { opacity: 0.45 } : null]}>{children}</Animated.View>
    </Pressable>
  );
}
