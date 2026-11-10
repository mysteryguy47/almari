/** Pieces the sign-in screens share. */
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { signInWithGoogle } from '@/sync/account';
import { cloudConfigured } from '@/sync/runtime';
import { space } from '@/theme/tokens';

import { Button } from './Button';
import { Card } from './Layout';
import { T } from './Text';

export function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        label="Continue with Google"
        variant="secondary"
        icon="Globe"
        loading={busy}
        testID="google"
        onPress={async () => {
          setBusy(true);
          setError(await signInWithGoogle());
          setBusy(false);
        }}
      />
      {error ? <T variant="smallStrong" color="sindoor" style={styles.error}>{error}</T> : null}
    </>
  );
}

/** Shown instead of a form when this build has no server address (a developer setting). */
export function NotConnected() {
  if (cloudConfigured()) return null;
  return (
    <Card style={styles.card}>
      <T variant="bodyStrong">Not connected to the server</T>
      <T variant="small" color="ink2">This copy of Almari was built without its server address, so accounts cannot be used. The sample family still works.</T>
    </Card>
  );
}

export function timeOf(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

const styles = StyleSheet.create({
  error: { marginTop: space.sm },
  card: { gap: space.sm, marginBottom: space.lg },
});
