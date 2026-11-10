import * as LocalAuthentication from 'expo-local-authentication';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { ToggleRow } from '@/components/Fields';
import { Card, Screen, Section } from '@/components/Layout';
import { PinPad } from '@/components/PinPad';
import { T } from '@/components/Text';
import { ensureReauth } from '@/lib/reauth';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

export default function LockSettings() {
  const ctx = useCtx();
  const setPin = useApp((s) => s.setPin);
  const biometrics = useApp((s) => s.device.biometrics);
  const setBiometrics = useApp((s) => s.setBiometrics);
  const [changing, setChanging] = useState(false);
  const [first, setFirst] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]).then(([a, b]) => setBioAvailable(a && b)).catch(() => undefined);
  }, []);
  if (!ctx) return <Redirect href="/" />;

  const submit = async (pin: string) => {
    if (!first) {
      setFirst(pin);
      setMessage(undefined);
      return true;
    }
    if (pin !== first) {
      setFirst(undefined);
      setMessage('The two PINs did not match. Start again.');
      return false;
    }
    await setPin(pin);
    setChanging(false);
    setFirst(undefined);
    toast('New PIN set', { tone: 'success' });
    return true;
  };

  return (
    <Screen title="App lock" testID="lock-settings">
      <Card style={styles.card}>
        <T variant="body">The app locks after a minute in the background and opens with your PIN{bioAvailable ? ' or fingerprint' : ''}. No internet or OTP needed.</T>
        <T variant="small" color="ink2">Five wrong PINs and the app asks you to sign in again. Nothing is ever wiped, so a grandchild playing with the phone cannot erase the family’s papers.</T>
      </Card>
      {bioAvailable ? (
        <Card style={styles.card}>
          <ToggleRow title="Unlock with fingerprint" value={biometrics} onValueChange={setBiometrics} />
        </Card>
      ) : Platform.OS === 'web' ? (
        <T variant="small" color="ink3" style={styles.card}>On the iPhone web app the PIN is the lock. Face ID support is being checked for the full app.</T>
      ) : null}
      <Section title="PIN">
        {changing ? (
          <>
            <T variant="body" color="ink2" align="center">{first ? 'Enter the new PIN again' : 'Enter a new 4-digit PIN'}</T>
            <PinPad key={first ? 'b' : 'a'} onSubmit={submit} message={message} testID="change-pin" />
          </>
        ) : (
          <Button label="Change PIN" icon="Lock" variant="secondary" onPress={async () => (await ensureReauth('Change your PIN')) && setChanging(true)} testID="change-pin-button" />
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, marginBottom: space.lg },
});
