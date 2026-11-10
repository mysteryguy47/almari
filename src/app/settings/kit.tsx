/**
 * The Recovery Kit: 24 words and a QR code, printed and kept in the almari.
 * It opens the account if every device is lost. Shown once; never stored.
 */
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Card, Screen } from '@/components/Layout';
import { Qr } from '@/components/Qr';
import { T } from '@/components/Text';
import { buildKitPdf } from '@/domain/pdf';
import { todayLabel } from '@/lib/doc-sources';
import { qrGrid } from '@/lib/qr';
import { useApp } from '@/store/app-store';
import { shareBytes } from '@/store/files';
import { ensureReauth } from '@/lib/reauth';
import { toast } from '@/store/ui-store';
import { makeRecoveryKit } from '@/sync/actions';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function RecoveryKit() {
  const cloud = useApp((s) => s.cloud);
  const { palette } = useTheme();
  const [kit, setKit] = useState<{ words: string[]; qr: string; pdf?: Uint8Array }>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!cloud) return <Redirect href="/" />;

  const make = async () => {
    if (!(await ensureReauth('Make a new Recovery Kit'))) return;
    setBusy(true);
    const result = await makeRecoveryKit();
    if (!result.ok) {
      setBusy(false);
      return toast(result.error, { tone: 'warn' });
    }
    const pdf = await buildKitPdf({ email: cloud.email, words: result.value.words, qr: qrGrid(result.value.qr), createdOn: todayLabel() });
    setKit({ ...result.value, pdf });
    setBusy(false);
  };

  if (!kit) {
    return (
      <Screen title="Recovery Kit" subtitle={cloud.kitCreatedAt ? `Made ${new Date(cloud.kitCreatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Not made yet'} testID="kit">
        <T variant="body" color="ink2" style={styles.lead}>
          If you lose every phone, this page lets you back in. Print it, or write the words down, and keep it where the family keeps the property papers.
        </T>
        <Card style={styles.card}>
          <T variant="bodyStrong">What it is</T>
          <T variant="small" color="ink2">24 words and a QR code. They work only together with signing in as you, so a lost kit alone opens nothing.</T>
          <T variant="small" color="ink2">Almari never sees or keeps these words. If the kit and every device are lost, nobody can open your Only me items, not even us.</T>
        </Card>
        {cloud.kitCreatedAt ? (
          <Card style={styles.card}>
            <Stamp text="Already made" tone="stamp" />
            <T variant="small" color="ink2">Making a new kit cancels the old one. Do it if the old page is lost or seen by someone else.</T>
          </Card>
        ) : null}
        <Button label={cloud.kitCreatedAt ? 'Make a new kit' : 'Make my Recovery Kit'} icon="QrCode" onPress={make} loading={busy} testID="make-kit" />
      </Screen>
    );
  }

  return (
    <Screen title="Your Recovery Kit" subtitle="Shown once. Print or write it down now." testID="kit-made">
      <View style={[styles.qrWrap, { borderColor: palette.line }]}>
        <Qr text={kit.qr} size={200} testID="kit-qr" />
      </View>
      <View style={styles.words} testID="kit-words-list">
        {kit.words.map((w, i) => (
          <View key={i} style={[styles.word, { backgroundColor: palette.surface, borderColor: palette.line }]}>
            <T variant="small" color="ink3" style={styles.num}>{i + 1}</T>
            <T variant="bodyStrong">{w}</T>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Button
          label="Save or print the PDF"
          icon="Printer"
          testID="kit-pdf"
          onPress={async () => {
            if (kit.pdf && (await shareBytes(kit.pdf, 'almari-recovery-kit.pdf', 'application/pdf'))) setSaved(true);
          }}
        />
        <Button
          label={saved ? 'Done, it is safe' : 'I have written the words down'}
          variant="secondary"
          testID="kit-done"
          onPress={() => {
            setKit(undefined);
            toast('Recovery Kit ready. Keep it in the almari.', { tone: 'success' });
          }}
        />
      </View>
      <T variant="small" color="ink3">Do not photograph it into your gallery or send it on WhatsApp: anyone with it and your login could open your papers.</T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: space.lg },
  card: { gap: space.sm, marginBottom: space.lg },
  qrWrap: { alignSelf: 'center', padding: space.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, backgroundColor: '#FFFFFF', marginBottom: space.lg },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  word: { width: '31%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, paddingHorizontal: space.sm, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  num: { width: 18 },
  actions: { gap: space.md, marginBottom: space.lg },
});
