/**
 * Sync, in plain words: a line for Settings and the home screen, and the
 * screen shown while a just-joined family's papers arrive.
 */
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useApp } from '@/store/app-store';
import { signOutAndForget } from '@/sync/account';
import { syncNow, useSyncStatus } from '@/sync/runtime';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

import { AlmariArt } from './Art';
import { Button } from './Button';
import { Icon } from './Icon';
import { Screen } from './Layout';
import { T } from './Text';

function ago(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** How many of this family's changes are still waiting to go to the server. */
export function usePendingCount(familyId: string | undefined): number {
  return useApp((s) => (familyId ? Object.keys(s.cloud?.sync[familyId]?.outbox ?? {}).length : 0));
}

export function SyncLine({ familyId }: { familyId: string }) {
  const { state, lastSyncedAt, message } = useSyncStatus();
  const pending = usePendingCount(familyId);
  const familySynced = useApp((s) => s.cloud?.sync[familyId]?.lastSyncedAt);
  const when = familySynced ?? lastSyncedAt;
  let icon: 'Cloud' | 'CloudOff' | 'RefreshCw' = 'Cloud';
  let text: string;
  if (state === 'syncing') {
    icon = 'RefreshCw';
    text = 'Syncing…';
  } else if (state === 'offline') {
    icon = 'CloudOff';
    text = pending ? `Offline. ${pending} change${pending > 1 ? 's' : ''} saved on this device, will sync later.` : 'Offline. Everything is on this device.';
  } else if (state === 'error') {
    icon = 'CloudOff';
    text = `Not synced: ${message ?? 'the server did not answer'}. Tap to retry.`;
  } else {
    text = pending ? `${pending} change${pending > 1 ? 's' : ''} waiting to sync` : when ? `Synced ${ago(when)}, locked on the way` : 'Not synced yet';
  }
  return (
    <View style={styles.line} testID="sync-line">
      <Icon name={icon} size={16} color={state === 'error' ? 'sindoor' : 'ink3'} />
      <T variant="small" color={state === 'error' ? 'sindoor' : 'ink3'} style={styles.flex} onPress={state === 'error' || state === 'offline' ? () => void syncNow() : undefined}>
        {text}
      </T>
    </View>
  );
}

/** Shown after joining, until the first pull brings the family down. */
export function FamilyArriving() {
  const { palette } = useTheme();
  const { state, message } = useSyncStatus();
  const name = useApp((s) => (s.session.familyId ? s.families[s.session.familyId]?.name : undefined));
  return (
    <Screen back={false} testID="family-arriving">
      <View style={styles.arriving}>
        <AlmariArt size={96} />
        <T variant="title" align="center">{name ? `Opening ${name}` : 'Opening your family'}</T>
        <T variant="body" color="ink2" align="center">Bringing in the family’s papers. They travel locked and open only on this device.</T>
        {state === 'offline' || state === 'error' ? (
          <>
            <T variant="smallStrong" color="sindoor" align="center">{state === 'offline' ? 'No internet. Connect to finish.' : message}</T>
            <Button label="Try again" variant="secondary" icon="RefreshCw" onPress={() => void syncNow()} testID="arriving-retry" />
          </>
        ) : (
          <ActivityIndicator color={palette.accent} />
        )}
        <T
          variant="smallStrong"
          color="accent"
          align="center"
          onPress={() => void signOutAndForget().then(() => router.replace('/welcome'))}
          accessibilityRole="link"
        >
          Sign out
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  arriving: { alignItems: 'center', gap: space.lg, paddingTop: space.huge },
});
