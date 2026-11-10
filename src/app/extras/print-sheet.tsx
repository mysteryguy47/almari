import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { DocThumb } from '@/components/DocThumb';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { displayName, findMember, visibleTo } from '@/domain/access';
import { buildPrintSheet, CARDS_PER_PAGE } from '@/domain/pdf';
import { getTemplate } from '@/domain/templates';
import { fileToPdfSource } from '@/lib/doc-sources';
import { shareBytes } from '@/store/files';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const MAX = 8;

/** Card fronts and backs at true size on A4, for the photocopy shop. */
export default function PrintSheet() {
  const ctx = useCtx();
  const { palette } = useTheme();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ key: string; bytes: Uint8Array; pages: number }>();
  const cards = useMemo(
    () => (ctx ? visibleTo(ctx.family, ctx.viewerId, ctx.family.documents).filter((d) => getTemplate(d.templateId).shape === 'card') : []),
    [ctx],
  );
  if (!ctx) return <Redirect href="/" />;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX ? p : [...p, id]));

  const key = [...picked].sort().join(',');
  const ready = made && made.key === key ? made : undefined;
  const share = async () => {
    if (!ready) return;
    const ok = await shareBytes(ready.bytes, 'print-ready-sheet.pdf', 'application/pdf');
    if (!ok) toast('Could not open the share sheet', { tone: 'warn' });
  };

  const make = async () => {
    setBusy(true);
    try {
      const chosen = cards.filter((c) => picked.includes(c.id));
      const sheet = await Promise.all(
        chosen.map(async (d) => ({
          title: `${d.title}${d.ownerId ? ` · ${displayName(findMember(ctx.family, d.ownerId))}` : ''}`,
          front: await fileToPdfSource(d.files[0]),
          back: d.files[1] ? await fileToPdfSource(d.files[1]) : undefined,
        })),
      );
      const bytes = await buildPrintSheet(sheet, ctx.family.name);
      const pages = Math.ceil(chosen.length / CARDS_PER_PAGE);
      setMade({ key, bytes, pages });
      toast(`Sheet ready: ${pages} A4 page${pages > 1 ? 's' : ''}. Print at actual size.`, { tone: 'success' });
    } catch (e) {
      toast(`Could not make the sheet: ${(e as Error).message}`, { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Print-ready sheet"
      subtitle="Cards at true size, front and back"
      footer={
        ready ? (
          <Button label={`Share the sheet (${ready.pages} page${ready.pages > 1 ? 's' : ''})`} icon="Share2" onPress={share} testID="print-share" />
        ) : (
          <Button label={`Make the A4 sheet (${picked.length})`} icon="FileText" onPress={make} loading={busy} disabled={picked.length === 0} testID="print-make" />
        )
      }
      testID="print-sheet"
    >
      <T variant="body" color="ink2" style={styles.lead}>Pick up to {MAX} cards. Each prints at 85.6 × 54 mm with its back beside it, four to a page.</T>
      {cards.length === 0 ? (
        <EmptyState icon="IdCard" title="No cards yet" line="Aadhaar, PAN, licence, voter ID and other card-sized papers show here." />
      ) : (
        <Card padded={false}>
          {cards.map((d, i) => {
            const on = picked.includes(d.id);
            return (
              <Pressable
                key={d.id}
                testID={`print-${d.id}`}
                onPress={() => toggle(d.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[styles.row, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line } : null]}
              >
                <DocThumb templateId={d.templateId} file={d.files[0]} width={64} />
                <View style={styles.flex}>
                  <T variant="bodyStrong">{d.title}</T>
                  <T variant="small" color="ink2">{d.files.length > 1 ? 'Front and back' : 'Front only'}</T>
                </View>
                <View style={[styles.check, { borderColor: on ? palette.accent : palette.ink3, backgroundColor: on ? palette.accent : 'transparent' }]}>
                  {on ? <Icon name="Check" size={16} color="onAccent" strokeWidth={2.6} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lead: { marginBottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 64 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
