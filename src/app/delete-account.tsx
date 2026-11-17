/**
 * How to delete an Almari account, public at /delete-account (Google Play
 * asks for a web page that works without the app installed).
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { CONTACT_EMAIL } from '@/lib/contact';
import { useApp } from '@/store/app-store';
import { space } from '@/theme/tokens';

const STEPS = [
  'Open Almari on your phone, or this website, and sign in.',
  'Go to Settings → Delete account.',
  'Read what will happen, then slide to confirm.',
];

const REMOVED = [
  'Your sign-in, email address, keys, devices and Recovery Kit.',
  'Your personal papers, passwords, cards and notes, and their files.',
  'Any family where nobody else has an account: completely, files and all.',
];

const KEPT = [
  'Papers you shared with your family stay with them, so the family does not lose its common papers. Ask a family member to delete any you want gone, before or after.',
  'Server backups expire on their own within a few days.',
  'A family kept on this phone only was never on our server: uninstalling Almari or clearing its data removes it.',
];

export default function DeleteAccountInfo() {
  const signedIn = useApp((s) => !!s.cloud);
  return (
    <Screen title="Delete your Almari account" testID="delete-account-info">
      <Section title="In the app">
        <Card style={styles.list}>
          {STEPS.map((s, i) => (
            <T key={s} variant="small">{i + 1}. {s}</T>
          ))}
        </Card>
      </Section>
      {signedIn ? (
        <View style={styles.button}>
          <Button label="Go to Delete account" variant="secondary" onPress={() => router.push('/settings/account')} testID="go-delete-account" />
        </View>
      ) : null}
      <Section title="Cannot open the app?">
        <Card style={styles.list}>
          <T variant="small">
            {CONTACT_EMAIL ? `Write to ${CONTACT_EMAIL}` : 'Write to the contact email on Almari’s Google Play page'} from the email on your account, asking to delete it. We reply within 7 days and delete it within 30.
          </T>
        </Card>
      </Section>
      <Section title="What is deleted">
        <Card style={styles.list}>{REMOVED.map((w) => <T key={w} variant="small">• {w}</T>)}</Card>
      </Section>
      <Section title="What stays">
        <Card style={styles.list}>{KEPT.map((w) => <T key={w} variant="small" color="ink2">• {w}</T>)}</Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  button: { marginBottom: space.lg },
});
