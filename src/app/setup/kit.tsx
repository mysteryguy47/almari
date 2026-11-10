/** Opening the account with the Recovery Kit: type the 24 words, or a photo of its QR code. */
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { Card, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { entropyFromKitQr, initCrypto, isKitWord, kitEntropy, normaliseKitWords } from '@/lib/crypto';
import { pickFromPhotos } from '@/lib/pick';
import { QR_READ_AVAILABLE, readQrFromImage } from '@/lib/qr-read';
import { useApp } from '@/store/app-store';
import { toast } from '@/store/ui-store';
import { nextRoute } from '@/sync/account';
import { restoreWithKit } from '@/sync/actions';
import { space } from '@/theme/tokens';

export default function UseKit() {
  const cloud = useApp((s) => s.cloud);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!cloud) return <Redirect href="/welcome" />;

  const words = normaliseKitWords(text);
  const unknown = words.filter((w) => !isKitWord(w));

  const open = async (entropy: Uint8Array | null) => {
    if (!entropy) return setError(words.length === 24 ? 'These 24 words do not form a kit. Check each word and its order.' : `That is ${words.length} words. The kit has 24.`);
    setBusy(true);
    setError(undefined);
    const result = await restoreWithKit(entropy);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (result.value === 'older') {
      toast('This kit is older than your newest key. Ask a family member to approve this device; then use the kit again to open your older Only me items.', { tone: 'warn' });
      return router.replace('/setup/device');
    }
    toast('Opened with your Recovery Kit', { tone: 'success' });
    router.replace(nextRoute());
  };

  const fromPhoto = async () => {
    setError(undefined);
    const picked = await pickFromPhotos().catch(() => null);
    if (!picked || 'denied' in picked) return;
    const found = await readQrFromImage(picked.file.uri).catch(() => null);
    const entropy = found ? entropyFromKitQr(found) : null;
    if (!entropy) return setError('No Recovery Kit QR code found in that photo. Try a sharper, straight photo, or type the words.');
    await initCrypto();
    await open(entropy);
  };

  return (
    <Screen title="Use your Recovery Kit" testID="use-kit-screen">
      {QR_READ_AVAILABLE ? (
        <Card style={styles.card}>
          <T variant="bodyStrong">Photo of the QR code</T>
          <T variant="small" color="ink2">Take a clear photo of the kit’s QR code, then pick it here. It is read on this device.</T>
          <Button label="Pick the photo" variant="secondary" icon="QrCode" onPress={fromPhoto} testID="kit-photo" />
        </Card>
      ) : null}
      <T variant="label" color="ink2" style={styles.or}>{QR_READ_AVAILABLE ? 'OR TYPE THE 24 WORDS' : 'TYPE THE 24 WORDS'}</T>
      <TextField
        label="The 24 words, in order"
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        helper={`${words.length} of 24${unknown.length ? ` · not kit words: ${unknown.slice(0, 3).join(', ')}` : ''}`}
        testID="kit-words"
      />
      {error ? <T variant="smallStrong" color="sindoor" style={styles.error}>{error}</T> : null}
      <View style={styles.actions}>
        <Button
          label="Open my account"
          onPress={async () => {
            await initCrypto();
            await open(kitEntropy(words));
          }}
          loading={busy}
          disabled={words.length === 0}
          testID="kit-open"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, marginBottom: space.lg },
  or: { marginBottom: space.sm },
  error: { marginBottom: space.md },
  actions: { marginTop: space.md },
});
