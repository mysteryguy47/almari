import { StyleSheet, View } from 'react-native';

import { AlmariArt } from '@/components/Art';
import { Stamp } from '@/components/Bits';
import { Card, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { space } from '@/theme/tokens';

const WORKS = [
  'Sign up with email, or a stand-in for Google; add a password to a Google account; five-try pause and reset',
  'Families: name, members (with or without email), pets, in loving memory, up to 3 families per person',
  'Personal papers shared or private, Only me items, no admin, removals need a second member',
  '121 document templates, camera / photos / files up to 10 MB, front and back, profile numbers filled in',
  'Passwords, many bank accounts, credit cards without an account, card bills and limits',
  'Family to-do with deadlines, repeat, nudges, and the renew-the-paper loop',
  'Reminders for everyone by default, with opt-outs; private papers remind only their owner',
  'App PIN with five-try lock, fingerprint on Android, re-check before secrets',
  'Search that understands typos and Hinglish, readiness check, Family ID sheet, emergency cards',
  'Day, Night, or like the phone',
];

const COMING = [
  'Real Google sign-in and a server in Mumbai (Supabase)',
  'End-to-end encryption of everything, on the phone and in the cloud',
  'Sync across the family’s phones, and recovery through the family or a printed kit',
  'Phone notifications (Android) and web push (iPhone web app)',
  'Document scanner with edge detection, photo compression, HEIC to JPG, PDF merge',
  'Hindi, then other Indian languages',
  'Export everything as readable folders',
];

export default function About() {
  return (
    <Screen title="About this prototype" testID="about">
      <View style={styles.hero}>
        <AlmariArt size={72} />
        <T variant="title">Almari</T>
        <T variant="small" color="ink2">Ghar ke saare kaagaz, ek jagah.</T>
        <Stamp text="Prototype · Nov 2026" />
      </View>
      <Card style={styles.warn}>
        <T variant="bodyStrong" color="sindoor">Please do not store real documents yet</T>
        <T variant="small" color="ink2">
          In this prototype everything stays on this phone or browser only, without encryption, and sign-in is simulated. Use the sample family or test papers.
        </T>
      </Card>
      <Section title="Works in this prototype">
        <Card style={styles.list}>{WORKS.map((w) => <T key={w} variant="small">• {w}</T>)}</Card>
      </Section>
      <Section title="Coming in the full app">
        <Card style={styles.list}>{COMING.map((w) => <T key={w} variant="small" color="ink2">• {w}</T>)}</Card>
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
  warn: { gap: space.sm, marginBottom: space.xxl },
  list: { gap: space.sm },
});
