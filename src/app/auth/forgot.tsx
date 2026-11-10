import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { Card, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { checkEmail } from '@/domain/validation';
import { sendPasswordReset } from '@/sync/account';
import { space } from '@/theme/tokens';

export default function Forgot() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>();

  const send = async () => {
    if (checkEmail(email, true).level === 'error') return setError('Please enter a valid email');
    setBusy(true);
    const problem = await sendPasswordReset(email);
    setBusy(false);
    setError(problem);
    if (!problem) setSent(true);
  };

  return (
    <Screen title="Reset your password" testID="forgot">
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="forgot-email" />
      {error ? <T variant="smallStrong" color="sindoor" style={styles.gap}>{error}</T> : null}
      {sent ? (
        <Card style={styles.card}>
          {/* Same words whether or not the account exists, so nobody can probe for accounts. */}
          <T variant="body">If an account uses this email, a reset link is on its way.</T>
          <T variant="small" color="ink2">Open it on this device. Resetting also lifts a pause after wrong passwords. Your family’s papers are not affected: they are locked with keys on your devices, not your password.</T>
          <Button label="Send again" variant="secondary" size="md" onPress={send} loading={busy} testID="send-reset" />
        </Card>
      ) : (
        <Button label="Send reset link" onPress={send} loading={busy} testID="send-reset" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { marginBottom: space.lg },
  card: { gap: space.sm },
});
