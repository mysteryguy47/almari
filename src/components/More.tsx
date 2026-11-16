/**
 * "More details": the fields most people skip, folded away so a form shows
 * only what matters. Opens with a tap, or by itself when something inside
 * needs attention. Says how many details are already filled in.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

import { useLift } from './Layout';
import { radius, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { T } from './Text';

export interface MoreProps {
  title?: string;
  /** What is inside, in a few words: "Number, dates, where the original is". */
  summary: string;
  /** How many fields inside already have a value. */
  filled?: number;
  /** Start open (an existing item with details, or a check failing inside). */
  initiallyOpen?: boolean;
  /** Controlled open state, when the screen opens it (a chip filled a field inside). */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
  testID?: string;
}

export function More({ title = 'More details', summary, filled = 0, initiallyOpen = false, open: controlled, onToggle, children, testID }: MoreProps) {
  const { palette } = useTheme();
  const lift = useLift();
  const [own, setOwn] = useState(initiallyOpen);
  const open = controlled ?? own;
  const toggle = () => {
    setOwn(!open);
    onToggle?.(!open);
  };
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 220 }) }] }));
  return (
    <Animated.View layout={LinearTransition.duration(220)} style={[styles.box, { borderColor: palette.line, backgroundColor: palette.surface }, lift]}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}: ${summary}`}
        testID={testID}
        style={styles.head}
      >
        <View style={styles.flex}>
          <T variant="bodyStrong">{title}</T>
          <T variant="small" color="ink2" numberOfLines={open ? undefined : 1}>
            {!open && filled > 0 ? `${filled} added · ` : ''}
            {summary}
          </T>
        </View>
        <Animated.View style={chevron}>
          <Icon name="ChevronDown" size={22} color="ink2" />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={[styles.body, { borderTopColor: palette.line }]}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** A small heading inside More, to group related fields ("Net banking", "Nominee"). */
export function MoreGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <T variant="label" color="ink3">{title}</T>
      {children}
    </View>
  );
}

/** Counts the values that are filled in: strings with text, numbers, true, non-empty lists. */
export function countFilled(...values: unknown[]): number {
  return values.filter((v) => (typeof v === 'string' ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== false)).length;
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, marginBottom: space.lg, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 60 },
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  group: { gap: space.sm, marginBottom: space.sm },
});
