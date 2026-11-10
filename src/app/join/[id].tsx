/**
 * An invite link: almari.blackmonkey.in/join/<id>#<secret>. The secret after
 * the # never reaches any server; it opens the family key inside the invite.
 * Not signed in yet? The invite waits in this tab while the person signs up.
 */
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AlmariArt } from '@/components/Art';
import { Nameplate } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Card, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { useApp } from '@/store/app-store';
import { useDeviceReady } from '@/store/hooks';
import { toast, useUi } from '@/store/ui-store';
import { nextRoute, signOutAndForget } from '@/sync/account';
import { acceptInvite, readInvite } from '@/sync/actions';
import { space } from '@/theme/tokens';

function secretFromUrl(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const hash = window.location.hash.replace(/^#/, '');
  return /^[A-Za-z0-9_-]{40,}$/.test(hash) ? hash : undefined;
}

export default function Join() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cloud = useApp((s) => s.cloud);
  const ready = useDeviceReady();
  const pending = useUi((s) => s.pendingInvite);
  const setPending = useUi((s) => s.setPendingInvite);
  const [info, setInfo] = useState<{ familyName: string; invitedBy: string; email: string }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const secret = secretFromUrl() ?? (pending?.id === id ? pending.secret : undefined);

  // Keep the invite through sign-up and the Google redirect.
  useEffect(() => {
    if (id && secret && pending?.id !== id) setPending({ id, secret });
  }, [id, secret, pending, setPending]);

  useEffect(() => {
    if (!cloud || !ready || !id || !secret) return;
    readInvite(id, secret).then((r) => {
      if (r.ok) setInfo({ familyName: r.value.box.familyName, invitedBy: r.value.box.invitedBy, email: r.value.invite.email });
      else setError(r.error);
    });
  }, [cloud, ready, id, secret]);

  if (!secret) {
    return (
      <Screen title="Join a family" testID="join">
        <Card style={styles.card}>
          <T variant="body">This link is incomplete.</T>
          <T variant="small" color="ink2">Open the whole link from the message. It is long, with a # in the middle; some apps cut it.</T>
        </Card>
      </Screen>
    );
  }
  if (cloud && !ready) return <Redirect href="/setup/device" />;

  if (!cloud) {
    return (
      <Screen back={false} testID="join">
        <View style={styles.hero}>
          <AlmariArt size={96} />
          <T variant="title" align="center">You are invited to a family on Almari</T>
          <T variant="body" color="ink2" align="center">Create an account, or sign in, with the email the invite was sent to. Then you join in one tap.</T>
        </View>
        <View style={styles.actions}>
          <Button label="Create an account" onPress={() => router.push('/auth/sign-up')} testID="join-sign-up" />
          <Button label="I already have an account" variant="secondary" onPress={() => router.push('/auth/sign-in')} testID="join-sign-in" />
        </View>
      </Screen>
    );
  }

  const join = async () => {
    setBusy(true);
    const result = await acceptInvite(id, secret);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    toast(`You joined ${info?.familyName ?? 'the family'}`, { tone: 'success' });
    router.replace(nextRoute());
  };

  return (
    <Screen title="Join the family" back={false} testID="join">
      {info ? (
        <>
          <View style={styles.plate}>
            <Nameplate name={info.familyName} />
          </View>
          <T variant="body" color="ink2" align="center" style={styles.lead}>
            {info.invitedBy} invited {info.email}. You will see the family’s shared papers, and your own stay yours.
          </T>
          <Button label={`Join ${info.familyName}`} onPress={join} loading={busy} testID="join-accept" />
        </>
      ) : null}
      {error ? (
        <Card style={styles.card}>
          <T variant="smallStrong" color="sindoor">{error}</T>
          <Button
            label="Sign in with another email"
            variant="secondary"
            size="md"
            onPress={() => void signOutAndForget().then(() => router.replace('/auth/sign-in'))}
          />
        </Card>
      ) : null}
      {!info && !error ? <T variant="body" color="ink2">Opening the invite…</T> : null}
      <T
        variant="smallStrong"
        color="accent"
        align="center"
        style={styles.later}
        onPress={() => {
          setPending(undefined);
          router.replace(nextRoute());
        }}
      >
        Not now
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingTop: space.xl, marginBottom: space.xxl },
  actions: { gap: space.md },
  card: { gap: space.md, marginTop: space.lg },
  plate: { alignItems: 'center', marginVertical: space.xl },
  lead: { marginBottom: space.xl },
  later: { marginTop: space.xl },
});
