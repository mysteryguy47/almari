import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GoogleButton, NotConnected, timeOf } from '@/components/AuthBits';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { Card, OrDivider, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { checkEmail } from '@/domain/validation';
import { useApp } from '@/store/app-store';
import { toast } from '@/store/ui-store';
import { nextRoute, resendConfirmation, signIn, signOutAndForget } from '@/sync/account';
import { space } from '@/theme/tokens';

export default function SignIn() {
  const cloud = useApp((s) => s.cloud);
  const lockedOut = useApp((s) => !!s.device.lockedOut);
  const again = !!cloud && lockedOut;
  const [email, setEmail] = useState(again ? cloud.email : '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; reset?: boolean; resend?: boolean }>();

  const submit = async () => {
    if (checkEmail(email, true).level === 'error') return setMessage({ text: 'Please enter the email you signed up with' });
    if (!password) return setMessage({ text: 'Please enter your password' });
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await signIn(email, password);
      switch (result.status) {
        case 'ok':
          return router.replace(nextRoute());
        case 'unconfirmed':
          return setMessage({ text: 'Confirm your email first: open the link we sent when you signed up.', resend: true });
        case 'wrong':
          return setMessage({
            text: result.attemptsLeft === 1
              ? 'Wrong email or password. One more wrong try pauses password sign-in for 30 minutes.'
              : `Wrong email or password. ${result.attemptsLeft} tries left. If you signed up with Google, use Continue with Google.`,
            reset: true,
          });
        case 'paused':
          return setMessage({ text: `Five wrong tries, so password sign-in is paused until ${timeOf(result.until)}. Reset your password to unlock it now.`, reset: true });
        case 'error':
          return setMessage({ text: result.message });
      }
    } catch (e) {
      setMessage({ text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={again ? 'Sign in again' : 'Welcome back'} subtitle={again ? 'Five wrong PINs. Nothing was deleted.' : undefined} back={!again} testID="sign-in">
      <NotConnected />
      {again ? (
        <Card style={styles.card}>
          <T variant="small" color="ink2">Sign in as {cloud.email} to unlock Almari on this device.</T>
        </Card>
      ) : null}
      {!again || cloud?.google ? (
        <>
          <GoogleButton />
          {!again || cloud?.hasPassword ? <OrDivider /> : null}
        </>
      ) : null}
      {!again || cloud?.hasPassword ? (
        <>
          <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="email" />
          <TextField label="Password" value={password} onChangeText={setPassword} secure autoComplete="current-password" onSubmitEditing={submit} testID="password" />
          {message ? (
            <View style={styles.message}>
              <T variant="smallStrong" color="sindoor" accessibilityLiveRegion="polite">{message.text}</T>
              {message.resend ? (
                <T variant="smallStrong" color="accent" onPress={async () => toast((await resendConfirmation(email)) ?? 'Sent again', { tone: 'info' })}>Send the link again</T>
              ) : null}
            </View>
          ) : null}
          <Button label="Sign in" onPress={submit} loading={busy} testID="sign-in-button" />
        </>
      ) : null}
      <View style={styles.links}>
        <T variant="smallStrong" color="accent" onPress={() => router.push({ pathname: '/auth/forgot', params: { email } })} accessibilityRole="link">
          Forgot password?
        </T>
        {again ? (
          <T variant="smallStrong" color="accent" onPress={() => void signOutAndForget().then(() => router.replace('/welcome'))} accessibilityRole="link">
            Use another account
          </T>
        ) : (
          <T variant="smallStrong" color="accent" onPress={() => router.replace('/auth/sign-up')} accessibilityRole="link">
            Create an account
          </T>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: { marginBottom: space.md, gap: space.sm },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xl },
  card: { marginBottom: space.lg },
});
