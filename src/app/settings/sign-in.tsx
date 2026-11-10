import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/Fields';
import { Card, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { checkNewPassword } from '@/domain/validation';
import { useApp } from '@/store/app-store';
import { useAccount } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

/** Ways into this account. A Google user can add an email and password: two keys, one account. */
export default function SignInSettings() {
  const account = useAccount();
  const setPassword = useApp((s) => s.setPassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string>();
  if (!account) return <Redirect href="/" />;
  const hasPassword = !!account.passwordHash;
  const check = checkNewPassword(next);

  const save = async () => {
    setTried(true);
    setError(undefined);
    if (check.level === 'error') return;
    const result = await setPassword(next, hasPassword ? current : undefined);
    if (!result.ok) return setError(result.error);
    setCurrent('');
    setNext('');
    setTried(false);
    toast(hasPassword ? 'Password changed' : `Done. You can now also sign in with ${account.email} and this password.`, { tone: 'success' });
  };

  return (
    <Screen title="Sign-in" subtitle={account.email} testID="sign-in-settings">
      <Card style={styles.methods}>
        <Method on={account.google} label="Google" detail={account.google ? `Signs in as ${account.email}` : 'Not linked'} />
        <Method on={hasPassword} label="Email and password" detail={hasPassword ? account.email : 'Not set up'} />
      </Card>
      <Section title={hasPassword ? 'Change your password' : 'Add an email and password'}>
        {!hasPassword ? (
          <T variant="small" color="ink2">Optional. Useful on a phone without your Google account. Your email stays {account.email}.</T>
        ) : null}
        {hasPassword ? <TextField label="Current password" value={current} onChangeText={setCurrent} secure testID="current-password" /> : null}
        <TextField label={hasPassword ? 'New password' : 'Password'} value={next} onChangeText={setNext} secure check={check} showCheck={tried || next.length > 0} helper="At least 8 characters" testID="new-password" />
        {error ? <T variant="smallStrong" color="sindoor">{error}</T> : null}
        <Button label={hasPassword ? 'Change password' : 'Add password'} onPress={save} testID="save-password" />
      </Section>
      <T variant="small" color="ink3">Forgot it later? Use Forgot password on the sign-in screen. Five wrong tries pause password sign-in for 30 minutes.</T>
    </Screen>
  );
}

function Method({ on, label, detail }: { on: boolean; label: string; detail: string }) {
  return (
    <View style={styles.method}>
      <Icon name={on ? 'CircleCheck' : 'X'} size={22} color={on ? 'accent' : 'ink3'} />
      <View style={styles.flex}>
        <T variant="bodyStrong">{label}</T>
        <T variant="small" color="ink2">{detail}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  methods: { gap: space.md, marginBottom: space.xxl },
  method: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
