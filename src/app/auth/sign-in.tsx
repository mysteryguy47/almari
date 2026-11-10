import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { OrDivider, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { checkEmail } from '@/domain/validation';
import { afterAuth } from '@/lib/after-auth';
import { useApp } from '@/store/app-store';
import { space } from '@/theme/tokens';

function timeOf(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export default function SignIn() {
  const signIn = useApp((s) => s.signInWithEmail);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; reset?: boolean }>();

  const submit = async () => {
    if (checkEmail(email, true).level === 'error') return setMessage({ text: 'Please enter the email you signed up with' });
    if (!password) return setMessage({ text: 'Please enter your password' });
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    switch (result.status) {
      case 'ok':
        return afterAuth();
      case 'no-account':
        return setMessage({ text: 'No account uses this email. Check for a typo, or create an account.' });
      case 'google-only':
        return setMessage({ text: 'This account signs in with Google. Use Continue with Google; you can add a password later in Settings.' });
      case 'wrong':
        return setMessage({
          text: result.attemptsLeft === 1
            ? 'Wrong password. One more wrong try pauses password sign-in for 30 minutes.'
            : `Wrong password. ${result.attemptsLeft} tries left.`,
          reset: true,
        });
      case 'paused':
        return setMessage({
          text: `Five wrong tries, so password sign-in is paused until ${timeOf(result.until)}. Reset your password to unlock it now.`,
          reset: true,
        });
    }
  };

  return (
    <Screen title="Welcome back" testID="sign-in">
      <Button label="Continue with Google" variant="secondary" icon="Globe" onPress={() => router.push('/auth/google')} testID="google" />
      <OrDivider />
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="email" />
      <TextField label="Password" value={password} onChangeText={setPassword} secure autoComplete="current-password" onSubmitEditing={submit} testID="password" />
      {message ? (
        <View style={styles.message}>
          <T variant="smallStrong" color="sindoor" accessibilityLiveRegion="polite">{message.text}</T>
        </View>
      ) : null}
      <Button label="Sign in" onPress={submit} loading={busy} testID="sign-in-button" />
      <View style={styles.links}>
        <T variant="smallStrong" color="accent" onPress={() => router.push({ pathname: '/auth/forgot', params: { email } })} accessibilityRole="link">
          Forgot password?
        </T>
        <T variant="smallStrong" color="accent" onPress={() => router.replace('/auth/sign-up')} accessibilityRole="link">
          Create an account
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: { marginBottom: space.md },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xl },
});
