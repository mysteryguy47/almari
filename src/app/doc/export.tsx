import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Bits';
import { Button } from '@/components/Button';
import { useFileUrl } from '@/components/DocThumb';
import { TextField } from '@/components/Fields';
import { Card, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { EXPORT_PRESETS, exportFileName, type ExportTarget } from '@/domain/form-export';
import { digitsOnly, formatBytes } from '@/domain/validation';
import { exportForForm, type ExportResult } from '@/lib/image-ops';
import { shareResult } from '@/store/files';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

/** Form-ready export: the exact pixels and KB a portal asks for, made on the phone. */
export default function FormExport() {
  const { id, file: fileIndex } = useLocalSearchParams<{ id: string; file?: string }>();
  const ctx = useCtx();
  const doc = ctx?.family.documents.find((d) => d.id === id);
  const file = doc?.files[Number(fileIndex ?? 0)];
  const url = useFileUrl(file);
  const [presetId, setPresetId] = useState<string>(
    doc?.templateId === 'signature' ? 'sign-140x60-20' : doc?.templateId?.includes('photo') ? 'photo-200x230-50' : 'doc-200',
  );
  const [custom, setCustom] = useState({ width: '', height: '', kb: '' });
  const [result, setResult] = useState<ExportResult>();
  const [busy, setBusy] = useState(false);

  if (!ctx) return <Redirect href="/" />;
  if (!doc || !file || file.kind !== 'image') {
    return (
      <Screen title="Resize for a form">
        <Card><T variant="body" color="ink2">Resizing works on photos. Add a photo to this paper first.</T></Card>
      </Screen>
    );
  }

  const target: ExportTarget | undefined =
    presetId === 'custom'
      ? Number(custom.kb) > 0
        ? { id: 'custom', label: 'Custom', width: Number(custom.width) || undefined, height: Number(custom.height) || undefined, maxKB: Number(custom.kb) }
        : undefined
      : EXPORT_PRESETS.find((p) => p.id === presetId);

  const make = async () => {
    if (!url || !target) return;
    setBusy(true);
    setResult(undefined);
    try {
      setResult(await exportForForm(url, target));
    } catch (e) {
      toast(`Could not resize: ${(e as Error).message}`, { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!result || !target) return;
    const ok = await shareResult(result, exportFileName(doc.title, target, result.bytes), 'image/jpeg');
    if (!ok) toast('Could not open the share sheet', { tone: 'warn' });
  };

  return (
    <Screen title="Resize for a form" subtitle={doc.title} testID="form-export">
      <T variant="body" color="ink2" style={styles.lead}>Exam, passport and job portals reject files for size. Pick what the form asks for.</T>
      <Section title="The form asks for">
        <View style={styles.chips}>
          {EXPORT_PRESETS.map((p) => <Chip key={p.id} testID={`preset-${p.id}`} label={p.label} selected={presetId === p.id} onPress={() => { setPresetId(p.id); setResult(undefined); }} />)}
          <Chip label="Something else" testID="preset-custom" selected={presetId === 'custom'} onPress={() => { setPresetId('custom'); setResult(undefined); }} />
        </View>
      </Section>
      {presetId === 'custom' ? (
        <View style={styles.row}>
          <View style={styles.flex}><TextField label="Width px" value={custom.width} onChangeText={(v) => setCustom((c) => ({ ...c, width: digitsOnly(v).slice(0, 4) }))} keyboardType="number-pad" /></View>
          <View style={styles.flex}><TextField label="Height px" value={custom.height} onChangeText={(v) => setCustom((c) => ({ ...c, height: digitsOnly(v).slice(0, 4) }))} keyboardType="number-pad" /></View>
          <View style={styles.flex}><TextField label="Max KB" value={custom.kb} onChangeText={(v) => setCustom((c) => ({ ...c, kb: digitsOnly(v).slice(0, 5) }))} keyboardType="number-pad" testID="custom-kb" /></View>
        </View>
      ) : null}
      <Button label="Make it" icon="Sparkles" onPress={make} loading={busy} disabled={!target} testID="export-make" />
      {result ? (
        <Card style={styles.result}>
          <Image source={{ uri: result.uri }} style={{ width: Math.min(220, result.width), aspectRatio: result.width / result.height, alignSelf: 'center' }} contentFit="contain" />
          <T variant="heading" align="center" testID="export-summary">{result.width} × {result.height} px · {formatBytes(result.bytes)}</T>
          <T variant="small" color={result.fits ? 'ink2' : 'sindoor'} align="center">
            {result.fits ? `Under ${target?.maxKB} KB, at ${Math.round(result.quality * 100)}% quality.` : `Could not get under ${target?.maxKB} KB even at the lowest quality. Try a smaller size.`}
          </T>
          <Button label="Save or share" icon="Share2" onPress={share} disabled={!result.fits} testID="export-share" />
        </Card>
      ) : null}
      <T variant="small" color="ink3" style={styles.note}>These sizes are common starting points. Always check the form’s own instructions. Your original stays untouched.</T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lead: { marginBottom: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  result: { gap: space.md, marginTop: space.lg, alignItems: 'stretch' },
  note: { marginTop: space.lg },
});
