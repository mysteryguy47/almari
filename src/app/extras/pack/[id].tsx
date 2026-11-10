import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconTile } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Card, Row, Screen, Section } from '@/components/Layout';
import { MemberPicker } from '@/components/MemberPicker';
import { T } from '@/components/Text';
import { displayName, findMember } from '@/domain/access';
import { listNumber } from '@/domain/money';
import { evaluatePack, getPack, packDocuments } from '@/domain/packs';
import { buildPackPdf } from '@/domain/pdf';
import { docToPdfSources, todayLabel } from '@/lib/doc-sources';
import { shareBytes } from '@/store/files';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

export default function PackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const pack = getPack(id);
  const [personId, setPersonId] = useState(ctx?.viewerId ?? '');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ personId: string; bytes: Uint8Array; name: string; count: number }>();

  const evaluation = useMemo(
    () => (ctx && pack ? evaluatePack(pack, ctx.family, ctx.viewerId, personId) : null),
    [ctx, pack, personId],
  );

  if (!ctx || !pack || !evaluation) return <Redirect href="/extras/packs" />;
  const { family } = ctx;
  const person = findMember(family, personId);
  const people = family.members.filter((m) => m.status !== 'memorial' && !m.isPet);
  const docs = packDocuments(evaluation.results);

  const ready = made && made.personId === personId ? made : undefined;

  const share = async () => {
    if (!ready) return;
    const ok = await shareBytes(ready.bytes, ready.name, 'application/pdf');
    if (!ok) toast('Could not open the share sheet', { tone: 'warn' });
  };

  const make = async () => {
    setBusy(true);
    try {
      const bytes = await buildPackPdf({
        title: pack.name,
        person: person?.fullName ?? '',
        familyName: family.name,
        generatedOn: todayLabel(),
        checklist: evaluation.results.map((r) => ({ label: r.item.label, done: r.docs.length > 0, optional: r.item.optional })),
        docs: await Promise.all(docs.map(async (d) => ({ title: d.title, number: listNumber(d.templateId, d.number), sources: await docToPdfSources(d) }))),
      });
      const name = `${pack.name}-${displayName(person)}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.pdf';
      setMade({ personId, bytes, name, count: docs.length });
      toast(`${pack.name} PDF ready: ${docs.length} papers`, { tone: 'success' });
    } catch (e) {
      toast(`Could not make the PDF: ${(e as Error).message}`, { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={pack.name} subtitle={pack.line} footer={
        ready ? (
          <Button label={`Share the PDF (${ready.count} papers)`} icon="Share2" onPress={share} testID="pack-share" />
        ) : (
          <Button label={`Make one PDF (${docs.length})`} icon="FileText" onPress={make} loading={busy} disabled={docs.length === 0} testID="pack-make" />
        )
      } testID="pack">
      <View style={styles.head}>
        <IconTile icon={pack.icon} tint="inland" size={52} />
        <T variant="body" color="ink2" style={styles.flex}>
          {evaluation.missingRequired === 0 ? 'Everything needed is here.' : `${evaluation.missingRequired} needed ${evaluation.missingRequired === 1 ? 'paper is' : 'papers are'} missing.`}
        </T>
      </View>
      <Section title="For whom">
        <MemberPicker members={people} value={[personId]} onChange={(v) => v[0] && setPersonId(v[0])} testID="pack-person" />
      </Section>
      <Section title="What it needs">
        <Card padded={false}>
          {evaluation.results.map((r, i) => {
            const doc = r.docs[0];
            return (
              <Row
                key={r.item.label}
                testID={`pack-item-${i}`}
                title={r.item.label}
                subtitle={doc ? doc.title : r.item.optional ? 'Optional, not added' : 'Missing. Tap to add'}
                icon={doc ? 'CircleCheck' : r.item.optional ? 'Info' : 'Plus'}
                tint={doc ? 'almari' : r.item.optional ? 'stamp' : 'haldi'}
                divider={i > 0}
                chevron={!doc}
                right={doc ? <Icon name="Check" size={20} color="accent" /> : undefined}
                onPress={doc ? () => router.push(`/doc/${doc.id}`) : () => router.push({ pathname: '/doc/new', params: { template: r.item.templateIds[0], ...(r.item.from === 'family' ? {} : { owner: personId }) } })}
              />
            );
          })}
        </Card>
      </Section>
      <T variant="small" color="ink3">The PDF starts with this checklist, then each paper. Aadhaar numbers stay masked in the checklist. Word and Excel files are listed, to share separately.</T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
});
