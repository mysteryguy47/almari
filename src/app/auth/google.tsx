import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { Card, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { checkEmail, checkPersonName } from '@/domain/validation';
import { afterAuth } from '@/lib/after-auth';
import { useApp } from '@/store/app-store';
import { space } from '@/theme/tokens';

/**
 * Prototype stand-in for Google sign-in. The MVP uses the real Google flow
 * through Supabase Auth; here the person types the name and Gmail they would
 * pick, so the rest of the journey can be tried.
 */
export default function GoogleStandIn() {
  const continueWithGoogle = useApp((s) => s.continueWithGoogle);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const checks = { name: checkPersonName(name), email: checkEmail(email, true) };

  const submit = () => {
    setTried(true);
    if (checks.name.level === 'error' || checks.email.level === 'error') return;
    continueWithGoogle(name, email);
    afterAuth();
  };

  return (
    <Screen title="Continue with Google" testID="google-standin">
      <Card style={styles.note}>
        <Stamp text="Prototype" tone="stamp" />
        <T variant="small" color="ink2">
          Real Google sign-in arrives with the server. For now, type the name and Gmail you would choose. Using the same email as an existing account signs you in to that account.
        </T>
      </Card>
      <TextField label="Name on your Google account" value={name} onChangeText={setName} check={checks.name} showCheck={tried} testID="google-name" />
      <TextField label="Gmail address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" check={checks.email} showCheck={tried} testID="google-email" />
      <View style={styles.gap} />
      <Button label="Continue" onPress={submit} testID="google-continue" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { gap: space.sm, marginBottom: space.xl },
  gap: { height: space.sm },
});
