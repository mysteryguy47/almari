import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { DocThumb, useFileUrl } from '@/components/DocThumb';
import { ToggleRow } from '@/components/Fields';
import { Card, EmptyState, goBack, Screen, Section } from '@/components/Layout';
import { ValueRow } from '@/components/Secret';
import { Sheet } from '@/components/Sheet';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { T } from '@/components/Text';
import { canSee, displayName, findMember } from '@/domain/access';
import { daysUntil, formatDate, relativeDays } from '@/domain/dates';
import { eAadhaarPasswordGuess } from '@/domain/family-rules';
import { maskAadhaar } from '@/domain/money';
import { expiryRecipients } from '@/domain/reminders';
import { getCategory, getTemplate } from '@/domain/templates';
import { digitsOnly, formatBytes } from '@/domain/validation';
import { stampFor } from '@/lib/attention';
import { useApp } from '@/store/app-store';
import { shareFile } from '@/store/files';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { MAX_WIDTH, radius, space } from '@/theme/tokens';

function Preview({ file, templateId, width }: { file: Parameters<typeof DocThumb>[0]['file']; templateId: string; width: number }) {
  const url = useFileUrl(file);
  if (file?.kind === 'image' && url) {
    return <Image source={{ uri: url }} style={{ width, height: width * 1.1, borderRadius: radius.md }} contentFit="contain" accessibilityLabel={file.name} />;
  }
  return (
    <View style={styles.previewCenter}>
      <DocThumb templateId={templateId} file={file} width={Math.min(width, getTemplate(templateId).shape === 'card' ? width : width * 0.7)} />
    </View>
  );
}

export default function DocumentView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const { width } = useWindowDimensions();
  const { palette } = useTheme();
  const toggleMute = useApp((s) => s.toggleMute);
  const deleteItem = useApp((s) => s.deleteItem);
  const restoreItem = useApp((s) => s.restoreItem);
  const [index, setIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  const doc = family.documents.find((d) => d.id === id);

  if (!doc || doc.deletedAt || !canSee(family, viewerId, doc)) {
    return (
      <Screen title="Document">
        <EmptyState icon="Lock" title={doc?.deletedAt ? 'This was deleted' : 'Not available'} line={doc?.deletedAt ? 'Restore it from Recently deleted within 30 days.' : 'It may be private to someone else, or it was removed.'} />
      </Screen>
    );
  }

  const template = getTemplate(doc.templateId);
  const owner = findMember(family, doc.ownerId);
  const days = doc.expiryDate ? daysUntil(doc.expiryDate) : null;
  const stamp = days !== null ? stampFor({ daysLeft: days, kind: 'doc', date: doc.expiryDate as string }) : null;
  const recipients = expiryRecipients(family, doc, template.category);
  const muted = doc.mutedBy.includes(viewerId);
  const file = doc.files[Math.min(index, doc.files.length - 1)];
  const previewWidth = Math.min(width, MAX_WIDTH) - space.xl * 2;
  const isAadhaar = template.profileId === 'aadhaar';
  const guess = isAadhaar && owner && file?.kind === 'pdf' ? eAadhaarPasswordGuess(owner.fullName, owner.dob) : null;

  const share = async () => {
    if (!file) return;
    if (file.kind === 'sample') return toast('Sample papers are pictures we drew, so there is no file to share.');
    if (isAadhaar) toast('Share Aadhaar only where it is truly needed.', { tone: 'warn' });
    const ok = await shareFile(file.id, file.name, file.mime);
    if (!ok) toast('Could not open the share sheet on this device', { tone: 'warn' });
  };

  const remove = () => {
    setConfirmDelete(false);
    deleteItem('documents', doc.id);
    toast(`Deleted ${doc.title}. It stays in Recently deleted for 30 days.`, {
      action: { label: 'Undo', onPress: () => restoreItem('documents', doc.id) },
    });
    goBack();
  };

  return (
    <Screen title={doc.title} subtitle={owner ? displayName(owner) : 'Family papers'} testID="doc-view">
      <Card style={styles.previewCard}>
        <Preview file={file} templateId={doc.templateId} width={previewWidth - space.lg * 2} />
        {doc.files.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pages}>
            {doc.files.map((f, i) => (
              <Pressable key={f.id} onPress={() => setIndex(i)} accessibilityRole="button" accessibilityLabel={`${template.sides === 2 ? (i === 0 ? 'Front' : 'Back') : `Page ${i + 1}`}`} style={[styles.page, i === index ? { backgroundColor: palette.accentSoft } : null]}>
                <T variant="smallStrong" color={i === index ? 'accent' : 'ink2'}>{template.sides === 2 ? (i === 0 ? 'Front' : i === 1 ? 'Back' : `Page ${i + 1}`) : `Page ${i + 1}`}</T>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {file && file.kind !== 'sample' ? <T variant="small" color="ink3" align="center">{file.name} · {formatBytes(file.size)}</T> : null}
      </Card>

      <View style={styles.stamps}>
        {stamp ? <Stamp text={days !== null && days >= 0 && days > 7 ? `${template.expiry?.label === 'Valid till' ? 'Expires' : 'Due'} ${stamp.text}` : stamp.text} tone={stamp.tone} /> : null}
        {doc.onlyMe ? <Stamp text="Only me" tone="stamp" tilt={2} /> : null}
        <Stamp text={getCategory(template.category).name} tone="inland" tilt={-1} />
      </View>

      <View style={styles.actions}>
        <View style={styles.flex}><Button label="Share" icon="Share2" onPress={share} testID="doc-share" /></View>
        <View style={styles.flex}><Button label="Edit" icon="PenLine" variant="secondary" onPress={() => router.push({ pathname: '/doc/new', params: { id: doc.id } })} testID="doc-edit" /></View>
      </View>

      {doc.number ? (
        <Card style={styles.block}>
          <ValueRow
            label={template.number?.label ?? 'Number'}
            value={doc.number}
            secret={isAadhaar}
            masked={isAadhaar ? maskAadhaar(doc.number) : undefined}
            copyValue={isAadhaar ? digitsOnly(doc.number) : undefined}
            large
            testID="doc-number"
          />
        </Card>
      ) : null}

      {guess ? (
        <Card style={styles.block}>
          <T variant="smallStrong">Locked e-Aadhaar PDF?</T>
          <ValueRow label="Password, probably (first 4 letters of the name + birth year)" value={guess.guess} secret />
        </Card>
      ) : null}

      <Section title="Details">
        <Card>
          <Detail label="For" value={owner ? owner.fullName : 'The whole family'} />
          {doc.issueDate ? <Detail label="Issued" value={formatDate(doc.issueDate)} /> : null}
          {doc.expiryDate ? <Detail label={template.expiry?.label ?? 'Expires'} value={`${formatDate(doc.expiryDate)} (${relativeDays(days as number)})`} tone={days !== null && days < 0 ? 'sindoor' : undefined} /> : null}
          <Detail label="Original kept at" value={doc.original || 'Not noted yet. Add it, future you will thank you.'} />
          {doc.description ? <Detail label="Note" value={doc.description} /> : null}
          <Detail label="Added by" value={`${displayName(findMember(family, doc.createdBy))}, ${formatDate(new Date(doc.createdAt).toISOString().slice(0, 10))}`} />
        </Card>
      </Section>

      {doc.expiryDate ? (
        <Section title="Reminders">
          <Card>
            <ToggleRow
              title="Remind me before it expires"
              subtitle={(template.expiry?.rule?.months ? '9 and 3 months before' : '30, 7 and 1 day before') + '. Only you are affected.'}
              value={!muted}
              onValueChange={() => toggleMute('documents', doc.id)}
              testID="doc-remind"
            />
            <T variant="small" color="ink2">
              {recipients.length
                ? `Reminded: ${recipients.map((r) => (r === viewerId ? 'you' : displayName(findMember(family, r)))).join(', ')}`
                : 'Nobody is reminded about this one.'}
            </T>
          </Card>
        </Section>
      ) : null}

      <Button label="Delete" icon="Trash" variant="danger" onPress={() => setConfirmDelete(true)} testID="doc-delete" />

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${doc.title}?`} subtitle="It stays in Recently deleted for 30 days, and anyone in the family can restore it.">
        <SlideToConfirm label="Slide to delete" tone="sindoor" onConfirm={remove} testID="slide-delete" />
      </Sheet>
    </Screen>
  );
}

function Detail({ label, value, tone }: { label: string; value: string; tone?: 'sindoor' }) {
  return (
    <View style={styles.detail}>
      <T variant="label" color="ink2">{label}</T>
      <T variant="body" color={tone ?? 'ink'}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  previewCard: { gap: space.md, marginBottom: space.lg },
  previewCenter: { alignItems: 'center', paddingVertical: space.md },
  pages: { gap: space.sm },
  page: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.lg, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: space.md, marginBottom: space.lg },
  block: { marginBottom: space.lg, gap: space.sm },
  detail: { paddingVertical: space.sm, gap: 2 },
});
