/**
 * Where the family is signed in. Anyone can remove a lost or stolen phone:
 * it is signed out and wiped the next time it connects.
 */
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, EmptyState, Row, Screen, Section } from '@/components/Layout';
import { Sheet } from '@/components/Sheet';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { T } from '@/components/Text';
import { useAccount } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { listDevices, removeDevice } from '@/sync/actions';
import { space } from '@/theme/tokens';

type Device = Awaited<ReturnType<typeof listDevices>>[number];

function seen(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'Active today';
  if (days === 1) return 'Last seen yesterday';
  return `Last seen ${days} days ago`;
}

export default function Devices() {
  const account = useAccount();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string>();
  const [removing, setRemoving] = useState<Device>();

  const load = useCallback(() => {
    listDevices().then(setDevices).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  if (!account) return <Redirect href="/" />;
  const active = (devices ?? []).filter((d) => !d.revoked_at);
  const mine = active.filter((d) => d.user_id === account.id);
  const family = active.filter((d) => d.user_id !== account.id);

  const list = (rows: Device[], title: string) =>
    rows.length ? (
      <Section title={title}>
        <Card padded={false}>
          {rows.map((d, i) => (
            <Row
              key={d.id}
              title={d.thisDevice ? `${d.name} (this one)` : d.name}
              subtitle={`${d.user_id === account.id ? '' : `${d.owner} · `}${seen(d.last_seen_at)}`}
              icon={/Mac|Windows|computer/.test(d.name) ? 'Laptop' : 'Smartphone'}
              tint="inland"
              divider={i > 0}
              chevron={false}
              right={d.thisDevice ? undefined : <Button label="Remove" size="md" variant="secondary" full={false} onPress={() => setRemoving(d)} testID={`remove-${d.id}`} />}
            />
          ))}
        </Card>
      </Section>
    ) : null;

  return (
    <Screen title="Devices" subtitle="Where your family is signed in" testID="devices">
      {error ? <T variant="smallStrong" color="sindoor">{error}</T> : null}
      {devices === null && !error ? <T variant="body" color="ink2">Loading…</T> : null}
      {devices && active.length === 0 ? <EmptyState icon="Smartphone" title="No devices yet" line="Devices appear here once they sync." /> : null}
      {list(mine, 'Yours')}
      {list(family, 'Your family’s')}
      <T variant="small" color="ink3" style={styles.note}>
        A removed device is signed out and its Almari data is wiped the next time it connects. Without the PIN or fingerprint, a thief sees only locked data.
      </T>
      <Sheet visible={!!removing} onClose={() => setRemoving(undefined)} title={`Remove ${removing?.name ?? ''}?`} subtitle={removing ? `${removing.owner === 'You' ? 'Your' : `${removing.owner}’s`} device will be signed out and wiped when it next connects.` : undefined}>
        <View style={styles.sheet}>
          <SlideToConfirm
            label="Slide to remove"
            tone="sindoor"
            testID="slide-remove-device"
            onConfirm={async () => {
              const d = removing;
              setRemoving(undefined);
              if (!d) return;
              const r = await removeDevice(d.id);
              toast(r.ok ? `${d.name} removed` : r.error, { tone: r.ok ? 'success' : 'warn' });
              load();
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: space.lg },
  sheet: { paddingBottom: space.md },
});
