import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Fields';
import { Card, Row, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import type { ThemePref } from '@/domain/types';
import { useApp } from '@/store/app-store';
import { useAccount, useCtx } from '@/store/hooks';
import { useUi } from '@/store/ui-store';
import { space, TAB_BAR_HEIGHT } from '@/theme/tokens';

export default function Settings() {
  const ctx = useCtx();
  const account = useAccount();
  const theme = useApp((s) => s.device.theme);
  const setTheme = useApp((s) => s.setTheme);
  const signOut = useApp((s) => s.signOut);
  const exitSample = useApp((s) => s.exitSample);
  if (!ctx) return null;
  const { family, viewer } = ctx;
  const sample = !!family.isSample;

  return (
    <Screen title="Settings" large back={false} bottomInset={TAB_BAR_HEIGHT} testID="settings">
      <Card style={styles.me}>
        <Avatar member={viewer} size={52} />
        <View style={styles.flex}>
          <T variant="heading">{viewer.fullName}</T>
          <T variant="small" color="ink2">{sample ? 'Sample family member' : account?.email}</T>
        </View>
      </Card>

      <Section title="Look">
        <Segmented<ThemePref>
          testID="theme"
          value={theme}
          onChange={setTheme}
          options={[{ value: 'light', label: 'Din (Day)' }, { value: 'dark', label: 'Raat (Night)' }, { value: 'system', label: 'Like phone' }]}
        />
      </Section>

      <Section title="Family">
        <Card padded={false}>
          <Row title={family.name} subtitle={`${family.members.length} members · personal papers ${family.personalSharing === 'private' ? 'private' : 'shared'}`} icon="House" tint="inland" onPress={() => router.push('/settings/family')} testID="settings-family" />
          <Row title="Your families" subtitle="Switch, or start another (up to 3)" icon="Users" tint="almari" divider onPress={() => router.push('/settings/families')} />
          <Row title="Reminders" subtitle="What you are told about, and when" icon="Bell" tint="haldi" divider onPress={() => router.push('/settings/reminders')} testID="settings-reminders" />
          <Row title="Activity" subtitle="Who added, changed or deleted what" icon="Activity" tint="stamp" divider onPress={() => router.push('/settings/activity')} />
          <Row title="Recently deleted" subtitle="Restore anything for 30 days" icon="Trash" tint="sindoor" divider onPress={() => router.push('/settings/deleted')} />
        </Card>
      </Section>

      <Section title="You and this phone">
        <Card padded={false}>
          {!sample ? <Row title="Sign-in" subtitle={account?.google ? (account.passwordHash ? 'Google and password' : 'Google. Add a password too?') : 'Email and password'} icon="Mail" tint="inland" onPress={() => router.push('/settings/sign-in')} testID="settings-sign-in" /> : null}
          {!sample ? <Row title="App lock" subtitle="PIN and fingerprint" icon="Lock" tint="stamp" divider onPress={() => router.push('/settings/lock')} /> : null}
          <Row title="About this prototype" subtitle="What works, what is coming, the fine print" icon="Info" tint="almari" divider={!sample} onPress={() => router.push('/settings/about')} />
          {!sample ? <Row title="Delete account" subtitle="In the app, any time" icon="Trash" danger divider onPress={() => router.push('/settings/account')} /> : null}
        </Card>
      </Section>

      <Button
        label={sample ? 'Leave the sample family' : 'Sign out'}
        variant="secondary"
        icon="LogOut"
        testID="sign-out"
        onPress={() => {
          if (sample) exitSample();
          else signOut();
          useUi.getState().lock();
          router.replace('/welcome');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  me: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xxl },
});
