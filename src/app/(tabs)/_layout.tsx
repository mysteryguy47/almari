import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AddSheet } from '@/components/AddSheet';
import { Icon } from '@/components/Icon';
import { Pressy } from '@/components/Pressy';
import { T } from '@/components/Text';
import type { IconName } from '@/domain/icons';
import { haptic } from '@/lib/device';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
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

/** Home, To-do, the big + in the middle, Locker, Settings. Every icon carries a label. */
function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const { palette } = useTheme();
  const setAddOpen = useUi((s) => s.setAddOpen);
  const buttons = state.routes.map((route, index) => {
    const tab = TABS[route.name];
    if (!tab) return null;
    const focused = state.index === index;
    return (
      <Pressable
        key={route.key}
        testID={`tab-${route.name}`}
        onPress={() => {
          if (!focused) {
            haptic.tap();
            navigateToTab(route.key);
          }
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
        style={styles.tab}
      >
        <Icon name={tab.icon} size={24} color={focused ? 'accent' : 'ink3'} strokeWidth={focused ? 2.2 : 1.8} />
        <T variant="smallStrong" color={focused ? 'accent' : 'ink3'} style={styles.tabLabel}>{tab.label}</T>
      </Pressable>
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
        style={[styles.add, { backgroundColor: palette.accent }]}
      >
        <Icon name="Plus" size={30} color="onAccent" strokeWidth={2.4} />
      </Pressy>
    </View>
  );
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, backgroundColor: palette.surface, borderTopColor: palette.line }]}>
      <View style={styles.inner}>{[...buttons.slice(0, 2), add, ...buttons.slice(2)]}</View>
    </View>
  );
}

export default function TabsLayout() {
  const ctx = useCtx();
  const signedIn = useApp((s) => !!s.session.accountId);
  const pinSet = useApp((s) => !!s.device.pinHash);

  if (!ctx) return <Redirect href={signedIn ? '/start/you' : '/welcome'} />;
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
  inner: { flexDirection: 'row', alignItems: 'center', height: TAB_BAR_HEIGHT, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: space.sm },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 56 },
  tabLabel: { fontSize: 12, lineHeight: 15 },
  add: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginTop: -22 },
});
