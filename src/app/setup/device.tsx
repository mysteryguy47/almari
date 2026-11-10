/**
 * This device is signed in but cannot open anything yet: the keys live on the
 * person's other devices. Ask to be let in (own device or family), use the
 * Recovery Kit, or, only when nobody could help, start fresh.
 */
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Screen } from '@/components/Layout';
import { Symbols } from '@/components/Symbols';
import { T } from '@/components/Text';
import { initCrypto } from '@/lib/crypto';
import { useApp } from '@/store/app-store';
import { useDeviceReady } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { nextRoute, signOutAndForget, useDeviceSetup } from '@/sync/account';
import { beginApproval, pollApproval, startFreshAccount } from '@/sync/actions';
import { api } from '@/sync/runtime';
import { checkDevice, pendingPublicKey, type DeviceState } from '@/sync/vault';
import { space } from '@/theme/tokens';

export default function DeviceSetup() {
  const cloud = useApp((s) => s.cloud);
  const deviceId = useApp((s) => s.device.deviceId);
  const ready = useDeviceReady();
  const pending = cloud?.pendingApproval;
  const [state, setState] = useState<DeviceState | null>(useDeviceSetup.get());
  const [busy, setBusy] = useState(false);
  const [confirmFresh, setConfirmFresh] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!cloud || state) return;
    initCrypto()
      .then(() => checkDevice(api(), cloud.userId, deviceId, cloud.keyring))
      .then(setState)
      .catch((e) => setError((e as Error).message));
  }, [cloud, deviceId, state]);

  useEffect(() => {
    if (!pending) return;
    let alive = true;
    const tick = async () => {
      try {
        const result = await pollApproval();
        if (!alive || !result) return;
        if (result.status === 'ready') {
          toast(result.byFamily ? 'You are in. Your Only me items open with your Recovery Kit.' : 'You are in. Welcome back.', { tone: 'success' });
          router.replace(nextRoute());
        } else if (result.status === 'declined') {
          toast('The request was declined.', { tone: 'warn' });
        } else if (result.status === 'expired') {
          toast('The request expired. Ask again.', { tone: 'info' });
        }
      } catch {
        // offline: keep waiting
      }
    };
    const timer = setInterval(tick, 3000);
    void tick();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pending]);

  if (!cloud) return <Redirect href="/welcome" />;
  if (ready) return <Redirect href={nextRoute()} />;

  const ask = async () => {
    setBusy(true);
    const result = await beginApproval();
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  if (pending) {
    return (
      <Screen title="Waiting for approval" back={false} testID="device-waiting">
        <T variant="body" color="ink2" style={styles.lead}>
          Open Almari on your other device, or ask someone in your family to open it on theirs. A request appears there. Approve it if it shows these same six symbols.
        </T>
        <Symbols publicKey={pendingPublicKey(pending)} testID="waiting-symbols" />
        <View style={styles.actions}>
          <Button label="Use my Recovery Kit instead" variant="secondary" icon="QrCode" onPress={() => router.push('/setup/kit')} testID="use-kit" />
          <Button
            label="Cancel the request"
            variant="ghost"
            onPress={() =>
              useApp.setState((d) => {
                if (d.cloud) d.cloud.pendingApproval = undefined;
              })
            }
          />
        </View>
      </Screen>
    );
  }

  const s = state?.status === 'needs-approval' ? state : null;
  return (
    <Screen title="Set up this device" back={false} testID="device-setup">
      <T variant="body" color="ink2" style={styles.lead}>
        Your family’s papers are locked with keys that live on your devices, never on our server. This device needs letting in.
      </T>
      {error ? <T variant="smallStrong" color="sindoor" style={styles.lead}>{error}</T> : null}
      {!s ? <T variant="small" color="ink3">Checking…</T> : null}
      {s && (s.ownDevices.length > 0 || s.familyCanHelp) ? (
        <Card style={styles.card}>
          <T variant="heading">Ask to be let in</T>
          <T variant="small" color="ink2">
            {s.ownDevices.length ? `Approve from ${s.ownDevices.map((d) => d.name).join(', ')}` : ''}
            {s.ownDevices.length && s.familyCanHelp ? ', or ' : ''}
            {s.familyCanHelp ? `${s.ownDevices.length ? 'anyone' : 'Anyone'} in your family can approve from their phone.` : '.'}
          </T>
          <Button label="Ask now" icon="Smartphone" onPress={ask} loading={busy} testID="ask-approval" />
        </Card>
      ) : null}
      {s?.hasKit ? (
        <Card style={styles.card}>
          <T variant="heading">Use your Recovery Kit</T>
          <T variant="small" color="ink2">The printed page with 24 words and a QR code, kept in the almari.</T>
          <Button label="Use the kit" variant="secondary" icon="QrCode" onPress={() => router.push('/setup/kit')} testID="use-kit" />
        </Card>
      ) : null}
      {s && !s.familyCanHelp ? (
        <Card style={styles.card}>
          <T variant="heading">Start fresh</T>
          <T variant="small" color="ink2">
            {s.ownDevices.length || s.hasKit
              ? 'Only if you cannot use the options above. '
              : 'No other device, Recovery Kit or family member can let you in. '}
            Starting fresh makes new keys. Papers saved before cannot be opened again, by anyone. That is the price of “even we cannot read it”.
          </T>
          {confirmFresh ? (
            <Button
              label="Yes, start fresh"
              variant="danger"
              loading={busy}
              testID="start-fresh-confirm"
              onPress={async () => {
                setBusy(true);
                const result = await startFreshAccount();
                setBusy(false);
                if (!result.ok) return setError(result.error);
                router.replace(nextRoute());
              }}
            />
          ) : (
            <Button label="Start fresh" variant="secondary" onPress={() => setConfirmFresh(true)} testID="start-fresh" />
          )}
        </Card>
      ) : null}
      <T variant="smallStrong" color="accent" align="center" onPress={() => void signOutAndForget().then(() => router.replace('/welcome'))} accessibilityRole="link">
        Sign out
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: space.lg },
  card: { gap: space.sm, marginBottom: space.lg },
  actions: { gap: space.md, marginTop: space.xxl },
});
