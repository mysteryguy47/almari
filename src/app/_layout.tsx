// Must come first: fills in what Android's JavaScript engine lacks (no-op on the web).
import '@/lib/polyfills';

import { AnekLatin_400Regular, AnekLatin_500Medium, AnekLatin_600SemiBold, AnekLatin_700Bold } from '@expo-google-fonts/anek-latin';
import { Eczar_600SemiBold, Eczar_700Bold } from '@expo-google-fonts/eczar';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DeviceRequestsHost } from '@/components/DeviceRequests';
import { AppLock, BehindLock, ReauthHost } from '@/components/Security';
import { ToastHost } from '@/components/Toast';
import { useApp } from '@/store/app-store';
import { guardScreen } from '@/lib/screen-guard';
import { requestPersistentStorage } from '@/store/idb';
import { resumeSession } from '@/sync/account';
import { cloudConfigured, startCloud } from '@/sync/runtime';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AnekLatin_400Regular, AnekLatin_500Medium, AnekLatin_600SemiBold, AnekLatin_700Bold, Eczar_600SemiBold, Eczar_700Bold,
  });
  const hydrated = useApp((s) => s.hydrated);
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => undefined);
    // The web app's boot screen (public/index.html) fades out once the first screen is drawn.
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const boot = document.getElementById('boot');
      if (boot) {
        requestAnimationFrame(() => boot.classList.add('gone'));
        setTimeout(() => boot.remove(), 600);
      }
    }
  }, [ready]);

  useEffect(() => {
    // Once saved data has loaded: check the sign-in is still good, then keep the family in sync.
    if (!hydrated || !cloudConfigured()) return;
    startCloud();
    resumeSession().catch((e) => console.warn('Could not check the sign-in', e));
  }, [hydrated]);

  useEffect(() => {
    // On the web (the iPhone app), ask the browser to keep our storage.
    if (Platform.OS === 'web') requestPersistentStorage().catch(() => undefined);
    // On Android, no screenshots, recordings or previews in the recent-apps view.
    guardScreen();
  }, []);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <BehindLock>
            <ThemedStack />
          </BehindLock>
          <AppLock />
          <ReauthHost />
          <DeviceRequestsHost />
          <ToastHost />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStack() {
  const { palette, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg }, animation: 'slide_from_right' }} />
    </>
  );
}
