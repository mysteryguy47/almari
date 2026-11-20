import { Redirect, Tabs } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AddSheet } from '@/components/AddSheet';
import { FamilyArriving } from '@/components/CloudStatus';
import { Icon } from '@/components/Icon';
import { Pressy } from '@/components/Pressy';
import { T } from '@/components/Text';
import type { IconName } from '@/domain/icons';
import { haptic } from '@/lib/device';
import { useApp } from '@/store/app-store';
import { useCtx, useDeviceReady } from '@/store/hooks';
import { useUi } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { MAX_WIDTH, space, TAB_BAR_HEIGHT } from '@/theme/tokens';

/** The props the Tabs navigator hands a custom tab bar. */
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'House', label: 'Home' },
  todo: { icon: 'ListTodo', label: 'To-do' },
  locker: { icon: 'Vault', label: 'Locker' },
  settings: { icon: 'Settings', label: 'Settings' },
};

const PILL_SPRING = { damping: 20, stiffness: 260, mass: 0.7 };

/** One tab: its icon sits in a soft pill that grows in when the tab is chosen. */
function TabButton({ name, icon, label, focused, onPress }: { name: string; icon: IconName; label: string; focused: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.set(withSpring(focused ? 1 : 0, PILL_SPRING));
  }, [focused, on]);
  const pill = useAnimatedStyle(() => ({ opacity: on.get(), transform: [{ scaleX: 0.6 + on.get() * 0.4 }] }));
  return (
    <Pressable
      testID={`tab-${name}`}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tab}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pill, { backgroundColor: palette.accentSoft }, pill]} />
        {/* Above the pill: on the web a positioned sibling would otherwise paint over it. */}
        <View style={styles.above}>
          <Icon name={icon} size={22} color={focused ? 'accent' : 'ink3'} strokeWidth={focused ? 2.2 : 1.8} />
        </View>
      </View>
      <T variant="smallStrong" color={focused ? 'accent' : 'ink3'} style={styles.tabLabel}>{label}</T>
    </Pressable>
  );
}

/** Home, To-do, the big + in the middle, Locker, Settings. Every icon carries a label. */
function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const { palette, scheme } = useTheme();
  const setAddOpen = useUi((s) => s.setAddOpen);
  const buttons = state.routes.map((route, index) => {
    const tab = TABS[route.name];
    if (!tab) return null;
    const focused = state.index === index;
    return (
      <TabButton
        key={route.key}
        name={route.name}
        icon={tab.icon}
        label={tab.label}
        focused={focused}
        onPress={() => {
          if (!focused) {
            haptic.tap();
            navigateToTab(route.key);
          }
        }}
      />
    );
  });
  const add = (
    <View key="add" style={styles.tab}>
      <Pressy
        testID="tab-add"
        onPress={() => setAddOpen(true)}
        hapticOnPress
        scaleTo={0.9}
        accessibilityLabel="Add"
        style={[
          styles.add,
          { backgroundColor: palette.accent, borderColor: palette.surface },
          scheme === 'light' ? styles.addLift : styles.addLiftDark,
        ]}
      >
        <Icon name="Plus" size={28} color="onAccent" strokeWidth={2.4} />
      </Pressy>
    </View>
  );
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: insets.bottom, backgroundColor: palette.surface, borderTopColor: palette.line },
        scheme === 'light' ? styles.barLift : null,
      ]}
    >
      <View style={styles.inner}>{[...buttons.slice(0, 2), add, ...buttons.slice(2)]}</View>
    </View>
  );
}

export default function TabsLayout() {
  const ctx = useCtx();
  const cloud = useApp((s) => s.cloud);
  const sessionFamily = useApp((s) => s.session.familyId);
  const pinSet = useApp((s) => !!s.device.pinHash);
  const lockedOut = useApp((s) => !!s.device.lockedOut);
  const deviceReady = useDeviceReady();

  const noAccount = useApp((s) => !!s.device.noAccount);
  if (!ctx) {
    if (!cloud) return <Redirect href={noAccount ? '/start/you' : '/welcome'} />;
    if (lockedOut) return <Redirect href="/auth/sign-in" />;
    if (!deviceReady) return <Redirect href="/setup/device" />;
    // Just joined: the family's papers are on their way down.
    if (sessionFamily && cloud.memberships[sessionFamily]) return <FamilyArriving />;
    return <Redirect href="/start/you" />;
  }
  if (!ctx.family.isSample && lockedOut) return <Redirect href="/auth/sign-in" />;
  if (!ctx.family.isSample && !pinSet) return <Redirect href="/start/pin" />;

  return (
    <>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="todo" />
        <Tabs.Screen name="locker" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <AddSheet />
    </>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  barLift: { boxShadow: '0 -6px 24px rgba(51, 36, 15, 0.06)' },
  inner: { flexDirection: 'row', alignItems: 'center', height: TAB_BAR_HEIGHT, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: space.sm },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 56 },
  iconWrap: { width: 56, height: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 15 },
  above: { zIndex: 1 },
  tabLabel: { fontSize: 12, lineHeight: 15 },
  add: { width: 60, height: 60, borderRadius: 30, borderWidth: 4, alignItems: 'center', justifyContent: 'center', marginTop: -26 },
  addLift: { boxShadow: '0 8px 18px -6px rgba(52, 87, 74, 0.55)' },
  addLiftDark: { boxShadow: '0 8px 18px -6px rgba(0, 0, 0, 0.7)' },
});
