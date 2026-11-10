/** Sending an invite link: WhatsApp first (that is how families talk), then the share sheet or a copy. */
import * as Linking from 'expo-linking';
import { Platform, StyleSheet, View } from 'react-native';

import { copyText } from '@/lib/device';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

import { Button } from './Button';
import { Qr } from './Qr';
import { Sheet } from './Sheet';
import { T } from './Text';

export function inviteMessage(name: string, familyName: string, link: string): string {
  return `${name}, join ${familyName} on Almari, our family's locked almari for papers. Open this link and sign in with this email: ${link}`;
}

export function InviteActions({ link, message }: { link: string; message: string }) {
  const canShare = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.share;
  return (
    <View style={styles.actions}>
      <Button label="Send on WhatsApp" icon="MessageCircle" onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`)} testID="invite-whatsapp" />
      {canShare ? (
        <Button
          label="Share another way"
          variant="secondary"
          icon="Share2"
          onPress={() => navigator.share({ text: message }).catch(() => undefined)}
          testID="invite-share"
        />
      ) : null}
      <Button
        label="Copy the link"
        variant="secondary"
        icon="Copy"
        testID="invite-copy"
        onPress={async () => {
          await copyText(link);
          toast('Link copied', { tone: 'success' });
        }}
      />
    </View>
  );
}

export function InviteSheet({ visible, onClose, name, email, familyName, link }: { visible: boolean; onClose: () => void; name: string; email: string; familyName: string; link: string }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={`Invite ${name}`} subtitle={`They join when they open this link signed in as ${email}.`} testID="invite-sheet">
      <View style={styles.body}>
        <InviteActions link={link} message={inviteMessage(name, familyName, link)} />
        <View style={styles.qr}>
          <Qr text={link} size={168} testID="invite-qr" />
          <T variant="small" color="ink2" align="center">Setting up a phone in person? They can scan this.</T>
        </View>
        <T variant="small" color="ink3" testID="invite-link" selectable numberOfLines={2}>{link}</T>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  actions: { gap: space.md },
  qr: { alignItems: 'center', gap: space.sm },
});
