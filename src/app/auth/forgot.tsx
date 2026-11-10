import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { Card, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { checkEmail, checkNewPassword } from '@/domain/validation';
import { useApp } from '@/store/app-store';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

export default function Forgot() {
  const params = useLocalSearchParams<{ email?: string }>();
  const resetPassword = useApp((s) => s.resetPassword);
  const [email, setEmail] = useState(params.email ?? '');
  const [sent, setSent] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();

  const send = () => {
    if (checkEmail(email, true).level === 'error') return setError('Please enter a valid email');
    setError(undefined);
    setSent(true);
  };

  const reset = async () => {
    const check = checkNewPassword(password);
    if (check.level === 'error') return setError(check.message);
    const result = await resetPassword(email, password);
    if (!result.ok) return setError(result.error);
    toast('Password changed. Sign in with the new one.', { tone: 'success' });
    router.replace('/auth/sign-in');
  };

  return (
    <Screen title="Reset your password" testID="forgot">
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="forgot-email" />
      {!sent ? (
        <>
          {error ? <T variant="smallStrong" color="sindoor" style={styles.gap}>{error}</T> : null}
          <Button label="Send reset link" onPress={send} testID="send-reset" />
        </>
      ) : (
        <>
          {/* Same words whether or not the account exists, so nobody can probe for accounts. */}
          <T variant="body" color="ink2" style={styles.gap}>If an account uses this email, a reset link is on its way. It works once, for 30 minutes.</T>
          <Card style={styles.card}>
            <Stamp text="Prototype" tone="stamp" />
            <T variant="small" color="ink2">There is no email server yet, so here is what the link opens:</T>
            <TextField label="New password" value={password} onChangeText={setPassword} secure helper="At least 8 characters" testID="new-password" />
            {error ? <T variant="smallStrong" color="sindoor">{error}</T> : null}
            <Button label="Save new password" onPress={reset} testID="save-password" />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { marginBottom: space.lg },
  card: { gap: space.sm },
});
