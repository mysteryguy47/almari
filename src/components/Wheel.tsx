/**
 * Wheel pickers, like the iPhone's: scroll or tap to choose, the middle row
 * is the choice, rows above and below tilt away and fade. Used for task due
 * dates and times, and the family's year of establishment. Each column is an
 * "adjustable" control for screen readers (swipe up or down to change).
 */
import { useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { daysInMonth } from '@/domain/dates';
import { haptic } from '@/lib/device';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { T } from './Text';

const ITEM = 44;
const VISIBLE = 5;
const PAD = ITEM * Math.floor(VISIBLE / 2);

export interface WheelItem<V> {
  value: V;
  label: string;
}

function WheelRow({ index, label, y, onPress, testID }: { index: number; label: string; y: SharedValue<number>; onPress: () => void; testID?: string }) {
  const style = useAnimatedStyle(() => {
    const d = (index * ITEM - y.get()) / ITEM;
    const a = Math.min(Math.abs(d), 3);
    return {
      opacity: interpolate(a, [0, 1, 2, 3], [1, 0.55, 0.28, 0.12]),
      transform: [{ perspective: 500 }, { rotateX: `${Math.max(-60, Math.min(60, -d * 20))}deg` }, { scale: interpolate(a, [0, 2], [1, 0.9]) }],
    };
  });
  return (
    <Pressable onPress={onPress} style={styles.row} testID={testID} accessible={false}>
      <Animated.View style={style}>
        <T variant="heading" align="center" numberOfLines={1}>{label}</T>
      </Animated.View>
    </Pressable>
  );
}

export function WheelColumn<V extends string | number>({
  items, value, onChange, width, label, testID,
}: { items: WheelItem<V>[]; value: V; onChange: (v: V) => void; width: number; label: string; testID?: string }) {
  const ref = useAnimatedRef<Animated.ScrollView>();
  const index = Math.max(0, items.findIndex((i) => i.value === value));
  const y = useSharedValue(index * ITEM);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ items, value, onChange });
  useEffect(() => {
    latest.current = { items, value, onChange };
  });

  // Start at the value (the web ignores contentOffset), then follow it when it changes from
  // outside: a quick chip, or a shorter month clamping the day.
  const placed = useRef(false);
  const place = () => {
    placed.current = true;
    ref.current?.scrollTo({ y: index * ITEM, animated: false });
    y.set(index * ITEM);
  };
  useEffect(() => {
    if (placed.current && Math.round(y.get() / ITEM) !== index) ref.current?.scrollTo({ y: index * ITEM, animated: true });
  }, [index, ref, y]);

  const settle = (offset: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const { items: list, value: current, onChange: change } = latest.current;
      const i = Math.max(0, Math.min(list.length - 1, Math.round(offset / ITEM)));
      ref.current?.scrollTo({ y: i * ITEM, animated: true });
      if (list[i] && list[i].value !== current) {
        haptic.tap();
        change(list[i].value);
      }
    }, Platform.OS === 'web' ? 140 : 60);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.set(e.contentOffset.y);
      scheduleOnRN(settle, e.contentOffset.y);
    },
  });

  const step = (by: number) => {
    const i = Math.max(0, Math.min(items.length - 1, index + by));
    if (i !== index) onChange(items[i].value);
  };

  return (
    <View
      style={{ width, height: ITEM * VISIBLE }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[index]?.label }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      testID={testID}
    >
      <Animated.ScrollView
        ref={ref}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * ITEM }}
        onLayout={() => {
          if (!placed.current) requestAnimationFrame(place);
        }}
        contentContainerStyle={{ paddingVertical: PAD }}
      >
        {items.map((item, i) => (
          <WheelRow
            key={String(item.value)}
            index={i}
            label={item.label}
            y={y}
            testID={testID ? `${testID}-${item.value}` : undefined}
            onPress={() => {
              ref.current?.scrollTo({ y: i * ITEM, animated: true });
              if (item.value !== value) onChange(item.value);
            }}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

/** The frame behind a set of wheels: a band marks the chosen row. */
export function WheelFrame({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.frame, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      <View pointerEvents="none" style={[styles.band, { backgroundColor: palette.surfaceAlt }]} />
      <View style={styles.columns}>{children}</View>
    </View>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** A date as day, month and year wheels. Value is "YYYY-MM-DD". */
export function DateWheel({ value, onChange, fromYear, toYear, testID }: { value: string; onChange: (v: string) => void; fromYear: number; toYear: number; testID?: string }) {
  const [y, m, d] = value.split('-').map(Number);
  const days = useMemo(() => Array.from({ length: daysInMonth(y, m) }, (_, i) => ({ value: i + 1, label: String(i + 1) })), [y, m]);
  const months = useMemo(() => MONTHS.map((label, i) => ({ value: i + 1, label })), []);
  const years = useMemo(() => Array.from({ length: toYear - fromYear + 1 }, (_, i) => ({ value: fromYear + i, label: String(fromYear + i) })), [fromYear, toYear]);
  const set = (ny: number, nm: number, nd: number) => onChange(`${ny}-${pad2(nm)}-${pad2(Math.min(nd, daysInMonth(ny, nm)))}`);
  return (
    <>
      <WheelColumn items={days} value={Math.min(d, days.length)} onChange={(v) => set(y, m, v)} width={56} label="Day" testID={testID && `${testID}-day`} />
      <WheelColumn items={months} value={m} onChange={(v) => set(y, v, d)} width={70} label="Month" testID={testID && `${testID}-month`} />
      <WheelColumn items={years} value={y} onChange={(v) => set(v, m, d)} width={78} label="Year" testID={testID && `${testID}-year`} />
    </>
  );
}

/** A time as hour, minute (every 5) and am/pm wheels. Value is "HH:mm", 24-hour. */
export function TimeWheel({ value, onChange, testID }: { value: string; onChange: (v: string) => void; testID?: string }) {
  const [h24, min] = value.split(':').map(Number);
  const ampm = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) })), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: pad2(i * 5) })), []);
  const halves = useMemo(() => [{ value: 'am', label: 'am' }, { value: 'pm', label: 'pm' }], []);
  const set = (h: number, mm: number, half: string) => {
    const hh = (h % 12) + (half === 'pm' ? 12 : 0);
    onChange(`${pad2(hh)}:${pad2(mm)}`);
  };
  return (
    <>
      <WheelColumn items={hours} value={h12} onChange={(v) => set(v, min - (min % 5), ampm)} width={52} label="Hour" testID={testID && `${testID}-hour`} />
      <WheelColumn items={minutes} value={min - (min % 5)} onChange={(v) => set(h12, v, ampm)} width={52} label="Minute" testID={testID && `${testID}-minute`} />
      <WheelColumn items={halves} value={ampm} onChange={(v) => set(h12, min - (min % 5), v)} width={56} label="Morning or evening" testID={testID && `${testID}-ampm`} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { height: ITEM, justifyContent: 'center' },
  frame: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, paddingHorizontal: space.sm, overflow: 'hidden', alignSelf: 'stretch' },
  band: { position: 'absolute', left: space.sm, right: space.sm, top: PAD, height: ITEM, borderRadius: radius.sm },
  columns: { flexDirection: 'row', justifyContent: 'center', gap: space.xs },
});
