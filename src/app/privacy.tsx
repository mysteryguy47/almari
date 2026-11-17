/**
 * The privacy policy, public at /privacy (Google Play links to it). Plain
 * words, and only what the app really does: keep it in step with the code.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { CONTACT_EMAIL } from '@/lib/contact';
import { space } from '@/theme/tokens';

const CONTACT = CONTACT_EMAIL ? `write to ${CONTACT_EMAIL}` : 'write to the contact email on Almari’s Google Play page';
const UPDATED = '17 November 2026';

const PARTS: { title: string; points: string[] }[] = [
  {
    title: 'The short version',
    points: [
      'Almari keeps your family’s papers, ID numbers, passwords, bank and card details. We built it so that we cannot read them.',
      'Everything you add is encrypted on your device before it is saved or sent. The keys stay on your family’s devices and in your printed Recovery Kit; our server never has them.',
      'No ads, no tracking, no analytics, and we never sell or share your data.',
    ],
  },
  {
    title: 'Where your papers are kept',
    points: [
      'You choose, per family, in Settings → Where papers are kept.',
      'On this phone only: nothing about the family reaches our server. You can use Almari this way without any account.',
      'In the cloud: encrypted copies are kept on our server and nothing is saved on the device.',
      'Both (the default): encrypted on the device and on our server, so it syncs to your family and survives a lost phone.',
    ],
  },
  {
    title: 'What our server stores',
    points: [
      'Your account: email address, your name, and a password hash, or your Google sign-in (name and email). Sign-in is run by Supabase.',
      'Your family’s items and files, as encrypted boxes we cannot open, with what is needed to deliver them: which family and member they belong to, who may read them, their size and when they changed.',
      'Your devices: a name for each (such as “Chrome on Mac”), its public key, and when it was let in, so your family can approve or remove it.',
      'Invites: the email address you invited, until they join or you cancel.',
      'Failed password attempts for an email, to pause guessing after five tries.',
      'Our hosting providers keep short-lived technical logs (such as IP addresses) to run and protect the service.',
    ],
  },
  {
    title: 'Who else is involved',
    points: [
      'Supabase runs our database, sign-in, file storage and email, in Mumbai, India. Vercel serves the web app.',
      'Google, only if you choose “Continue with Google”.',
      'Razorpay’s public IFSC lookup: when you type an IFSC code while online, that code (and nothing else) is sent to fetch the bank’s branch name.',
      'Reading numbers from a photo happens on your device. The web app downloads the reading model from a public code library (jsDelivr); your photo is not sent.',
    ],
  },
  {
    title: 'On your device',
    points: [
      'What Almari saves on your phone or browser is encrypted with a key that the device keeps (the Android Keystore, or the browser’s protected key store).',
      'Camera, photos and files are used only when you add a paper. Fingerprint or face unlock is checked by your phone; Almari never sees it.',
    ],
  },
  {
    title: 'Your choices and rights',
    points: [
      'See, change, share or delete any item at any time. Deleted items wait 30 days in Recently deleted, then are removed.',
      'Delete your account in the app: Settings → Delete account. Your personal items, sign-in, keys and devices are removed from our server. Items shared with the family stay with the family; a family with nobody else in it is deleted completely, files and all. Server backups expire on their own within a few days.',
      `Cannot open the app? ${CONTACT[0].toUpperCase()}${CONTACT.slice(1)} from the email on your account and we will delete it.`,
      'Under India’s Digital Personal Data Protection Act, 2023 you may ask what we hold about you, correct it, or have it erased, and raise a grievance.',
    ],
  },
  {
    title: 'Children',
    points: [
      'Accounts are for adults. Parents can keep a child’s papers in a profile in the family; the child does not get an account and we collect nothing from them.',
    ],
  },
  {
    title: 'Changes and contact',
    points: [
      'If this policy changes, the new version appears here with a new date, and the app will tell you about any important change.',
      `Questions or a grievance: ${CONTACT}.`,
    ],
  },
];

export default function Privacy() {
  return (
    <Screen title="Privacy policy" testID="privacy">
      <T variant="small" color="ink2" style={styles.updated}>Almari, by BlackMonkey · Updated {UPDATED}</T>
      {PARTS.map((part) => (
        <Section key={part.title} title={part.title}>
          <Card style={styles.list}>
            {part.points.map((p) => (
              <T key={p} variant="small">• {p}</T>
            ))}
          </Card>
        </Section>
      ))}
      <View style={styles.footer}>
        <Button label="How to delete your account" variant="secondary" onPress={() => router.push('/delete-account')} testID="privacy-delete" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  updated: { marginBottom: space.lg },
  list: { gap: space.sm },
  footer: { marginTop: space.md, marginBottom: space.xl },
});
