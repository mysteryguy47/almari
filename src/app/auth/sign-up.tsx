import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GoogleButton, NotConnected } from '@/components/AuthBits';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { Card, OrDivider, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { checkEmail, checkNewPassword, checkPersonName } from '@/domain/validation';
import { nextRoute, resendConfirmation, signUp } from '@/sync/account';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();

  const checks = { name: checkPersonName(name), email: checkEmail(email, true), password: checkNewPassword(password) };
  const valid = Object.values(checks).every((c) => c.level !== 'error');

  const submit = async () => {
    setTried(true);
    setError(undefined);
    if (!valid) return;
    setBusy(true);
    try {
      const result = await signUp(name, email, password);
      if (result.status === 'error') return setError(result.message);
      if (result.status === 'check-email') return setSentTo(email.trim().toLowerCase());
      router.replace(nextRoute());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <Screen title="Check your email" testID="check-email">
        <Card style={styles.card}>
          <T variant="body">We sent a link to <T variant="bodyStrong">{sentTo}</T>.</T>
          <T variant="small" color="ink2">Open it on this device to finish. It can take a minute; check Spam or Promotions too.</T>
          <T variant="small" color="ink2">If this email already has an account, sign in instead.</T>
        </Card>
        <Button
          label="Send the link again"
          variant="secondary"
          testID="resend"
          onPress={async () => {
            const problem = await resendConfirmation(sentTo);
            toast(problem ?? 'Sent again', { tone: problem ? 'warn' : 'success' });
          }}
        />
        <View style={styles.footer}>
          <T variant="smallStrong" color="accent" align="center" onPress={() => setSentTo(undefined)}>Use a different email</T>
          <T variant="smallStrong" color="accent" align="center" onPress={() => router.replace('/auth/sign-in')}>Sign in</T>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Create your account" testID="sign-up">
      <NotConnected />
      <GoogleButton />
      <OrDivider />
      <TextField label="Your name" value={name} onChangeText={setName} autoComplete="name" check={checks.name} showCheck={tried} testID="name" />
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" check={checks.email} showCheck={tried} testID="email" />
      <TextField label="Password" value={password} onChangeText={setPassword} secure autoComplete="new-password" check={checks.password} showCheck={tried || password.length > 0} helper="At least 8 characters" testID="password" />
      {error ? <T variant="smallStrong" color="sindoor" style={styles.error}>{error}</T> : null}
      <Button label="Create account" onPress={submit} loading={busy} testID="create-account" />
      <View style={styles.footer}>
        <T variant="small" color="ink2" align="center">
          Already have an account?{' '}
          <T variant="smallStrong" color="accent" onPress={() => router.replace('/auth/sign-in')}>Sign in</T>
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { marginBottom: space.md },
  footer: { marginTop: space.xl, gap: space.lg },
  card: { gap: space.sm, marginBottom: space.lg },
});
