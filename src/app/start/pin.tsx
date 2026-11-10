import * as LocalAuthentication from 'expo-local-authentication';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ToggleRow } from '@/components/Fields';
import { Screen } from '@/components/Layout';
import { PinPad } from '@/components/PinPad';
import { T } from '@/components/Text';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast, useUi } from '@/store/ui-store';
import { space } from '@/theme/tokens';

const WEAK = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '1212']);

/** Set the app PIN (and the fingerprint on Android). Opens the app daily without internet or OTP. */
export default function SetPin() {
  const ctx = useCtx();
  const setPin = useApp((s) => s.setPin);
  const setBiometrics = useApp((s) => s.setBiometrics);
  const biometrics = useApp((s) => s.device.biometrics);
  const [first, setFirst] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [done, setDone] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()])
      .then(([hw, enrolled]) => setBioAvailable(hw && enrolled))
      .catch(() => setBioAvailable(false));
  }, []);

  if (!ctx) return <Redirect href="/" />;

  const submit = async (pin: string) => {
    if (!first) {
      if (WEAK.has(pin)) {
        setMessage('Too easy to guess. Try a less obvious PIN.');
        return false;
      }
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
    useUi.getState().unlock();
    setDone(true);
    return true;
  };

  const finish = () => {
    toast(`Welcome to ${ctx.family.name}. Start with your Aadhaar.`, { tone: 'success' });
    router.replace('/');
  };

  return (
    <Screen title={done ? 'All set' : first ? 'Enter it once more' : 'Set your app PIN'} back={false} testID="start-pin">
      {!done ? (
        <View style={styles.wrap}>
          <T variant="body" color="ink2" align="center" style={styles.lead}>
            4 digits to open {ctx.family.name} every day. No internet, no OTP. Five wrong tries and the app asks you to sign in again; nothing is ever deleted.
          </T>
          <PinPad key={first ? 'confirm' : 'first'} testID="set-pin" onSubmit={submit} message={message} />
        </View>
      ) : (
        <View style={styles.wrap}>
          <T variant="body" color="ink2" style={styles.lead}>Your PIN is set.</T>
          {bioAvailable ? (
            <ToggleRow
              title="Unlock with fingerprint"
              subtitle="Quicker than the PIN. The PIN always works too."
              value={biometrics}
              onValueChange={setBiometrics}
              testID="biometric-toggle"
            />
          ) : null}
          <View style={styles.gap} />
          <Button label={`Open ${ctx.family.name}`} onPress={finish} testID="open-family" />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingTop: space.md },
  lead: { marginBottom: space.md },
  gap: { height: space.lg },
});
