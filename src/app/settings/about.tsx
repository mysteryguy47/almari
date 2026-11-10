import { StyleSheet, View } from 'react-native';

import { AlmariArt } from '@/components/Art';
import { Stamp } from '@/components/Bits';
import { Card, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { space } from '@/theme/tokens';

const LOCKED = [
  'Every paper, number, password and file is encrypted on your device before it is saved or sent, with keys that never leave your family’s devices (libsodium: XChaCha20-Poly1305 and X25519).',
  'Our server in Mumbai stores only locked boxes, plus what it needs to route them: emails, who is in which family, sizes and times.',
  'Shared items open for everyone in the family; Only me items open only for you. Making an item private seals it for you alone.',
  'A new phone is let in by your other device or a family member, after both screens show the same six symbols, or by your printed Recovery Kit.',
  'On this device, everything Almari saves is encrypted with a key the browser keeps and never lets out.',
];

const LIMITS = [
  'If you lose every device, have no Recovery Kit and nobody in your family can approve you, your Only me items cannot be recovered. That is the price of “even we cannot read it”.',
  'Encryption protects the family from outsiders, not from choices inside it: a member can forward what is shared with them.',
  'Making an item private later removes it from others’ phones at their next sync, but cannot recall a copy already shared.',
  'Phone notifications, the Android app, Hindi and an independent security audit are still to come.',
];

export default function About() {
  return (
    <Screen title="About Almari" testID="about">
      <View style={styles.hero}>
        <AlmariArt size={72} />
        <T variant="title">Almari</T>
        <T variant="small" color="ink2">Ghar ke saare kaagaz, ek jagah.</T>
        <Stamp text="Beta · 2026" />
      </View>
      <Section title="How your papers are locked">
        <Card style={styles.list}>{LOCKED.map((w) => <T key={w} variant="small">• {w}</T>)}</Card>
      </Section>
      <Section title="Honest limits">
        <Card style={styles.list}>{LIMITS.map((w) => <T key={w} variant="small" color="ink2">• {w}</T>)}</Card>
      </Section>
      <Section title="Fine print">
        <Card style={styles.list}>
          <T variant="small" color="ink2">Almari is not affiliated with the Government of India, UIDAI, or any bank. Copies kept here are for convenience and are not legally valid IDs; DigiLocker and mParivahan hold the official digital versions.</T>
          <T variant="small" color="ink2">The e-Aadhaar password hint uses the widely published pattern and may not match every name.</T>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, marginBottom: space.xl },
  list: { gap: space.sm },
});
