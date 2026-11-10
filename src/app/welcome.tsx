import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AlmariArt } from '@/components/Art';
import { IconTile, Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { useUi } from '@/store/ui-store';
import { space } from '@/theme/tokens';
import type { IconName } from '@/domain/icons';
import type { Tint } from '@/domain/templates';

const PROMISES: { icon: IconName; tint: Tint; title: string; line: string }[] = [
  { icon: 'Wifi', tint: 'inland', title: 'Opens without internet', line: 'In a hospital basement or a bank queue. No OTP.' },
  { icon: 'Lock', tint: 'stamp', title: 'Locked so even we cannot read it', line: 'Aadhaar, PAN, passwords and bank details, for your eyes only.' },
  { icon: 'Bell', tint: 'haldi', title: 'Reminds before anything expires', line: 'Licence, insurance, PUC, passport. Everyone, on time.' },
];

export default function Welcome() {
  const ctx = useCtx();
  const startSample = useApp((s) => s.startSample);
  if (ctx) return <Redirect href="/" />;

  return (
    <Screen back={false} testID="welcome">
      <View style={styles.hero}>
        <AlmariArt size={110} />
        <T variant="display" align="center" style={styles.brand}>Almari</T>
        <T variant="heading" align="center">Ghar ke saare kaagaz, ek jagah.</T>
        <T variant="body" color="ink2" align="center">
          Every paper, number and password your family owns. Found in three taps, on every phone in the family.
        </T>
      </View>
      <View style={styles.promises}>
        {PROMISES.map((p) => (
          <View key={p.title} style={styles.promise}>
            <IconTile icon={p.icon} tint={p.tint} size={44} />
            <View style={styles.flex}>
              <T variant="bodyStrong">{p.title}</T>
              <T variant="small" color="ink2">{p.line}</T>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Button label="Get started" testID="get-started" onPress={() => router.push('/auth/sign-up')} />
        <Button label="I already have an account" variant="secondary" testID="have-account" onPress={() => router.push('/auth/sign-in')} />
        <Button
          label="Explore a sample family"
          variant="ghost"
          icon="Sparkles"
          testID="explore-sample"
          onPress={() => {
            startSample();
            useUi.getState().unlock();
            router.replace('/');
          }}
        />
      </View>
      <View style={styles.note}>
        <Stamp text="Beta" tone="stamp" />
        <T variant="small" color="ink2" style={styles.flex}>
          Almari is new and being tested with families. Everything is locked on your device before it is saved. Keep the paper originals safe as always.
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: space.sm, paddingTop: space.lg, marginBottom: space.xxl },
  brand: { fontSize: 44, lineHeight: 52, marginTop: space.md },
  promises: { gap: space.lg, marginBottom: space.xxl },
  promise: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  actions: { gap: space.md, marginBottom: space.xxl },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
