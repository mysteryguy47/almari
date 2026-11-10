import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { OrDivider, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { checkEmail, checkNewPassword, checkPersonName } from '@/domain/validation';
import { afterAuth } from '@/lib/after-auth';
import { useApp } from '@/store/app-store';
import { space } from '@/theme/tokens';

export default function SignUp() {
  const signUp = useApp((s) => s.signUpWithEmail);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const checks = { name: checkPersonName(name), email: checkEmail(email, true), password: checkNewPassword(password) };
  const valid = Object.values(checks).every((c) => c.level !== 'error');

  const submit = async () => {
    setTried(true);
    setError(undefined);
    if (!valid) return;
    setBusy(true);
    const result = await signUp(name, email, password);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    afterAuth();
  };

  return (
    <Screen title="Create your account" testID="sign-up">
      <Button label="Continue with Google" variant="secondary" icon="Globe" onPress={() => router.push('/auth/google')} testID="google" />
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
  footer: { marginTop: space.xl },
});
