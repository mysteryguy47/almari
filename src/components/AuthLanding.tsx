/**
 * Where links from emails and from Google land: finishes the sign-in, then
 * moves on, or explains plainly what went wrong.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { checkNewPassword } from '@/domain/validation';
import { afterSignIn, finishRedirect, nextRoute, setNewPassword } from '@/sync/account';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

import { Button } from './Button';
import { TextField } from './Fields';
import { Card, Screen } from './Layout';
import { T } from './Text';

type Phase = { kind: 'working' } | { kind: 'error'; message: string; confirmed?: boolean } | { kind: 'new-password' };

export function AuthLanding({ reset = false }: { reset?: boolean }) {
  const params = useLocalSearchParams<{ code?: string; token_hash?: string; type?: string; error_description?: string }>();
  const { palette } = useTheme();
  const [phase, setPhase] = useState<Phase>({ kind: 'working' });
  const started = useRef(false);

  useEffect(() => {
    // A link works once: never finish it twice.
    if (started.current) return;
    started.current = true;
    (async () => {
      const result = await finishRedirect(params);
      if (result.status === 'error') return setPhase({ kind: 'error', message: result.message, confirmed: result.confirmed });
      if (reset || result.recovery) return setPhase({ kind: 'new-password' });
      await afterSignIn();
      router.replace(nextRoute());
    })().catch((e) => setPhase({ kind: 'error', message: (e as Error).message }));
  }, [params, reset]);

  if (phase.kind === 'new-password') return <NewPassword />;
  return (
    <Screen back={false} testID="auth-landing">
      <View style={styles.center}>
        {phase.kind === 'working' ? (
          <>
            <ActivityIndicator color={palette.accent} />
            <T variant="body" color="ink2" align="center">Signing you in…</T>
          </>
        ) : (
          <Card style={styles.card}>
            <T variant="heading">{phase.confirmed ? 'Your email is confirmed' : 'This link did not work'}</T>
            <T variant="body" color="ink2">{phase.message}</T>
            <Button label="Sign in" onPress={() => router.replace('/auth/sign-in')} testID="landing-sign-in" />
            {reset ? <Button label="Send a new reset link" variant="secondary" onPress={() => router.replace('/auth/forgot')} /> : null}
          </Card>
        )}
      </View>
    </Screen>
  );
}

function NewPassword() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const save = async () => {
    const check = checkNewPassword(password);
    if (check.level === 'error') return setError(check.message);
    setBusy(true);
    const problem = await setNewPassword(password);
    if (problem) {
      setBusy(false);
      return setError(problem);
    }
    await afterSignIn();
    router.replace(nextRoute());
  };
  return (
    <Screen title="Choose a new password" back={false} testID="new-password-screen">
      <T variant="body" color="ink2" style={styles.lead}>This also lifts any pause after wrong passwords.</T>
      <TextField label="New password" value={password} onChangeText={setPassword} secure autoComplete="new-password" helper="At least 8 characters" onSubmitEditing={save} testID="new-password" />
      {error ? <T variant="smallStrong" color="sindoor" style={styles.lead}>{error}</T> : null}
      <Button label="Save new password" onPress={save} loading={busy} testID="save-password" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingTop: 96, alignItems: 'center', gap: space.lg },
  card: { gap: space.md, alignSelf: 'stretch' },
  lead: { marginBottom: space.lg },
});
