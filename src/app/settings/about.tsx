import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { AlmariArt } from '@/components/Art';
import { Stamp } from '@/components/Bits';
import { Card, Row, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { space } from '@/theme/tokens';

const LOCKED = [
  'Every paper, number, password and file is encrypted on your device before it is saved or sent, with keys that never leave your family’s devices (libsodium: XChaCha20-Poly1305 and X25519).',
  'Our server in Mumbai stores only locked boxes, plus what it needs to route them: emails, who is in which family, sizes and times.',
  'Shared items open for everyone in the family; Only me items open only for you. Making an item private seals it for you alone.',
  'A new phone is let in by your other device or a family member, after both screens show the same six symbols, or by your printed Recovery Kit.',
  Platform.OS === 'web'
    ? 'On this device, everything Almari saves is encrypted with a key the browser keeps and never lets out.'
    : 'On this phone, everything Almari saves is encrypted with a key held in the Android Keystore, which never lets it out. Its screens cannot be screenshotted or recorded, and stay blank in recent apps.',
];

const LIMITS = [
  'If you lose every device, have no Recovery Kit and nobody in your family can approve you, your Only me items cannot be recovered. That is the price of “even we cannot read it”.',
  'Encryption protects the family from outsiders, not from choices inside it: a member can forward what is shared with them.',
  'Making an item private later removes it from others’ phones at their next sync, but cannot recall a copy already shared.',
  'Notifications on iPhone, Hindi and an independent security audit are still to come.',
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
      <Card style={styles.links}>
        <Row title="Privacy policy" icon="ShieldCheck" onPress={() => router.push('/privacy')} divider testID="about-privacy" />
        <Row title="How to delete your account" icon="Trash" onPress={() => router.push('/delete-account')} testID="about-delete" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, marginBottom: space.xl },
  list: { gap: space.sm },
  links: { padding: 0, marginTop: space.lg, marginBottom: space.xl },
});
