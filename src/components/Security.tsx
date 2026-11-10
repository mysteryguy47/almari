/**
 * The app lock ("Kaun hai?") and the fingerprint-or-PIN re-check used before
 * showing secrets. Five wrong PINs sign the person out; nothing is wiped.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayName } from '@/domain/access';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { LOCK_AFTER_BACKGROUND_MS, toast, useUi } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

import { PinPad } from './PinPad';
import { Sheet } from './Sheet';
import { T } from './Text';

async function biometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

async function tryBiometric(prompt: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel: 'Use PIN', disableDeviceFallback: true });
    return result.success;
  } catch {
    return false;
  }
}

function usePinCheck(onOk: () => void) {
  const verifyPin = useApp((s) => s.verifyPin);
  const [message, setMessage] = useState<string>();
  const submit = async (pin: string) => {
    const result = await verifyPin(pin);
    if (result.status === 'ok') {
      setMessage(undefined);
      onOk();
      return true;
    }
    if (result.status === 'locked-out') {
      toast('Bas! Five wrong tries. Sign in again to unlock. Nothing was deleted.', { tone: 'warn' });
      router.replace('/auth/sign-in');
      return false;
    }
    setMessage(result.attemptsLeft === 1 ? 'Wrong PIN. One try left before you must sign in again.' : `Wrong PIN. ${result.attemptsLeft} tries left.`);
    return false;
  };
  return { submit, message };
}

/** Covers the app until the PIN or fingerprint; re-locks after a minute in the background. */
export function AppLock() {
  const ctx = useCtx();
  const pinSet = useApp((s) => !!s.device.pinHash);
  const biometrics = useApp((s) => s.device.biometrics);
  const locked = useUi((s) => s.locked);
  const lock = useUi((s) => s.lock);
  const unlock = useUi((s) => s.unlock);
  const markBackground = useUi((s) => s.markBackground);
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [bioReady, setBioReady] = useState(false);
  const { submit, message } = usePinCheck(unlock);

  const active = !!ctx && pinSet && !ctx.family.isSample;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') markBackground(Date.now());
      if (state === 'active') {
        const since = useUi.getState().backgroundAt;
        if (since && Date.now() - since > LOCK_AFTER_BACKGROUND_MS) lock();
      }
    });
    return () => sub.remove();
  }, [lock, markBackground]);

  useEffect(() => {
    biometricAvailable().then((ok) => setBioReady(ok && biometrics));
  }, [biometrics]);

  useEffect(() => {
    if (active && locked && bioReady) {
      tryBiometric('Unlock your family vault').then((ok) => ok && unlock());
    }
  }, [active, locked, bioReady, unlock]);

  if (!ctx || !active || !locked) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(200)}
      style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: palette.bg, paddingTop: insets.top + space.huge, paddingBottom: insets.bottom + space.xl }]}
      accessibilityViewIsModal
      testID="app-lock"
    >
      <View style={styles.lockHead}>
        <T variant="display" align="center">Kaun hai?</T>
        <T variant="body" color="ink2" align="center">
          {ctx.family.name} is locked. Enter your PIN, {displayName(ctx.viewer)}.
        </T>
      </View>
      <PinPad
        testID="lock-pin"
        onSubmit={submit}
        message={message}
        onBiometric={bioReady ? () => tryBiometric('Unlock your family vault').then((ok) => ok && unlock()) : undefined}
      />
      <Pressable
        onPress={() => {
          useApp.getState().signOut();
          router.replace('/auth/sign-in');
        }}
        accessibilityRole="button"
        hitSlop={10}
      >
        <T variant="smallStrong" color="accent" align="center">Forgot your PIN? Sign in again</T>
      </Pressable>
    </Animated.View>
  );
}

/** Answers ensureReauth(): fingerprint first if switched on, else the PIN. */
export function ReauthHost() {
  const request = useUi((s) => s.reauth);
  const finish = useUi((s) => s.finishReauth);
  const biometrics = useApp((s) => s.device.biometrics);
  const { submit, message } = usePinCheck(() => finish(true));

  useEffect(() => {
    if (!request || !biometrics) return;
    biometricAvailable().then(async (ok) => {
      if (ok && (await tryBiometric(request.reason))) finish(true);
    });
  }, [request, biometrics, finish]);

  return (
    <Sheet visible={!!request} onClose={() => finish(false)} title="Is it you?" subtitle={request?.reason} testID="reauth-sheet">
      <PinPad testID="reauth-pin" onSubmit={submit} message={message} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  lock: { alignItems: 'center', justifyContent: 'space-between', zIndex: 100 },
  lockHead: { gap: space.sm, paddingHorizontal: space.xxl },
});
