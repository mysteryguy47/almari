import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { DocThumb, useFileUrl } from '@/components/DocThumb';
import { TextField, ToggleRow } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, goBack, Row, Screen, Section } from '@/components/Layout';
import { PaperMark } from '@/components/ItemMark';
import { BankMark, DocMark, NumberPlate } from '@/components/Marks';
import { ValueRow } from '@/components/Secret';
import { Sheet } from '@/components/Sheet';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { T } from '@/components/Text';
import { canSee, displayName, findMember } from '@/domain/access';
import { daysUntil, formatDate, relativeDays } from '@/domain/dates';
import { eAadhaarPasswordGuess } from '@/domain/family-rules';
import { maskAadhaar, maskTail } from '@/domain/money';
import { buildDocumentPdf } from '@/domain/pdf';
import { expiryRecipients } from '@/domain/reminders';
import { getCategory, getTemplate, nameInSentence } from '@/domain/templates';
import { MAIN_VERSION, type DocItem, type DocVersion, type FileRef } from '@/domain/types';
import { digitsOnly, formatBytes } from '@/domain/validation';
import { docVersions, duplicatesOf, MAX_VERSIONS, versionFiles } from '@/domain/versions';
import { findVehicle } from '@/domain/vehicles';
import { stampFor } from '@/lib/attention';
import { haptic } from '@/lib/device';
import { docToPdfSources } from '@/lib/doc-sources';
import { useApp } from '@/store/app-store';
import { shareBytes, shareFile } from '@/store/files';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { MAX_WIDTH, radius, space } from '@/theme/tokens';

function Preview({ file, templateId, width }: { file: FileRef | undefined; templateId: string; width: number }) {
  const url = useFileUrl(file);
  if (file?.kind === 'image' && url) {
    return <Image source={{ uri: url }} style={{ width, height: width * 1.1, borderRadius: radius.md }} contentFit="contain" accessibilityLabel={file.name} transition={160} />;
  }
  return (
    <View style={styles.previewCenter}>
      <DocThumb templateId={templateId} file={file} width={Math.min(width, getTemplate(templateId).shape === 'card' ? width : width * 0.7)} />
    </View>
  );
}

/** "aadhaar-dadi-masked.pdf" */
function pdfName(doc: DocItem, version: DocVersion, suffix = ''): string {
  const base = `${doc.title}${version.id === MAIN_VERSION && version.label === 'Original' ? '' : ` ${version.label}`}${suffix}`;
  return `${base.replace(/[’']/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'document'}.pdf`;
}

type Made = { bytes: Uint8Array; name: string; pages: number };

export default function DocumentView() {
  const { id, version: initialVersion } = useLocalSearchParams<{ id: string; version?: string }>();
  const ctx = useCtx();
  const { width } = useWindowDimensions();
  const { palette } = useTheme();
  const toggleMute = useApp((s) => s.toggleMute);
  const deleteItem = useApp((s) => s.deleteItem);
  const restoreItem = useApp((s) => s.restoreItem);
  const renameDocVersion = useApp((s) => s.renameDocVersion);
  const removeDocVersion = useApp((s) => s.removeDocVersion);
  const mergeDocuments = useApp((s) => s.mergeDocuments);
  const [versionId, setVersionId] = useState(initialVersion ?? MAIN_VERSION);
  const [index, setIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [making, setMaking] = useState<'pages' | 'one-page' | null>(null);
  const [made, setMade] = useState<Made>();
  const [menu, setMenu] = useState<DocVersion>();
  const [rename, setRename] = useState<string>();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [merging, setMerging] = useState(false);
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);
  const shownOnce = useRef(false);

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
  const versions = docVersions(doc);
  const current = versions.find((v) => v.id === versionId) ?? versions[0];
  const pages = versionFiles(doc, current.id);
  const file = pages[Math.min(index, Math.max(0, pages.length - 1))];
  const previewWidth = Math.min(width, MAX_WIDTH) - space.xl * 2;
  const isAadhaar = template.profileId === 'aadhaar';
  const guess = isAadhaar && owner && file?.kind === 'pdf' ? eAadhaarPasswordGuess(owner.fullName, owner.dob) : null;
  const vehicle = findVehicle(family, doc.vehicleId);
  const account = doc.accountId ? family.bankAccounts.find((a) => a.id === doc.accountId && !a.deletedAt && canSee(family, viewerId, a)) : undefined;
  const dups = duplicatesOf(family, viewerId, doc);
  const mergeable = dups.length > 0 && dups.every((d) => d.onlyMe === doc.onlyMe && (!doc.onlyMe || d.createdBy === doc.createdBy));
  const sideName = (i: number) => (template.sides === 2 ? (i === 0 ? 'Front' : i === 1 ? 'Back' : `Page ${i + 1}`) : `Page ${i + 1}`);
  const images = pages.filter((f) => f.kind === 'image');
  const samples = pages.every((f) => f.kind === 'sample');

  const selectVersion = (v: DocVersion) => {
    haptic.tap();
    setVersionId(v.id);
    setIndex(0);
    setMade(undefined);
  };

  const shareOne = async (f: FileRef | undefined) => {
    if (!f) return;
    if (f.kind === 'sample') return toast('Sample papers are pictures we drew, so there is no file to share.');
    if (isAadhaar) toast('Share Aadhaar only where it is truly needed.', { tone: 'warn' });
    const ok = await shareFile(f);
    if (!ok) toast('Could not open the share sheet on this device', { tone: 'warn' });
  };

  const sendMade = async (m: Made) => {
    if (isAadhaar) toast('Share Aadhaar only where it is truly needed.', { tone: 'warn' });
    const ok = await shareBytes(m.bytes, m.name, 'application/pdf');
    if (!ok) toast('Could not open the share sheet on this device', { tone: 'warn' });
  };

  const makePdf = async (layout: 'pages' | 'one-page') => {
    if (samples) return toast('Sample papers are pictures we drew, so there is no file to share.');
    setMaking(layout);
    try {
      const sources = await docToPdfSources(doc, current.id);
      const bytes = await buildDocumentPdf({ title: doc.title, sources, layout });
      const m = { bytes, name: pdfName(doc, current, layout === 'one-page' ? '-one-page' : ''), pages: layout === 'one-page' ? 1 : pages.length };
      // A phone can share straight away; a browser wants a fresh tap after the work is done.
      if (Platform.OS === 'web') setMade(m);
      else {
        setSharing(false);
        await sendMade(m);
      }
    } catch (e) {
      toast(`Could not make the PDF: ${(e as Error).message}`, { tone: 'warn' });
    } finally {
      setMaking(null);
    }
  };

  const share = () => {
    if (pages.length <= 1) return void shareOne(file);
    setMade(undefined);
    setSharing(true);
  };

  const remove = () => {
    setConfirmDelete(false);
    deleteItem('documents', doc.id);
    toast(`Deleted ${doc.title}. It stays in Recently deleted for 30 days.`, {
      action: { label: 'Undo', onPress: () => restoreItem('documents', doc.id) },
    });
    goBack();
  };

  const closeMenu = () => {
    setMenu(undefined);
    setRename(undefined);
    setConfirmRemove(false);
  };

  return (
    <Screen title={doc.title} subtitle={owner ? displayName(owner) : vehicle ? vehicle.name : 'Family papers'} mark={<PaperMark doc={doc} family={family} size={36} />} testID="doc-view">
      {dups.length ? (
        <Card style={styles.dup}>
          <View style={styles.dupHead}>
            <Icon name="Layers" size={20} color="haldi" />
            <T variant="bodyStrong" style={styles.flex}>Saved {dups.length + 1} times</T>
          </View>
          <T variant="small" color="ink2">
            {owner ? `${displayName(owner)} has` : 'There are'} {dups.length + 1} {nameInSentence(template.name)} entries. Keep one, with each copy as a version of it.
          </T>
          {mergeable ? (
            <Button label="Make them one" icon="Merge" variant="secondary" size="md" onPress={() => setMerging(true)} testID="doc-merge" />
          ) : (
            <T variant="small" color="ink3">One of them is marked Only me, so they stay apart.</T>
          )}
        </Card>
      ) : null}

      <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} style={styles.versionScroller} contentContainerStyle={styles.versionRow} testID="versions">
        {versions.map((v) => {
          const on = v.id === current.id;
          const count = versionFiles(doc, v.id).length;
          return (
            <Pressable
              key={v.id}
              onPress={() => (on ? setMenu(v) : selectVersion(v))}
              onLayout={(e) => {
                // Opened on a later version (just added one): bring its tab into view.
                if (on && !shownOnce.current && v.id !== MAIN_VERSION) {
                  shownOnce.current = true;
                  strip.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - space.xl), animated: true });
                }
              }}
              onLongPress={() => setMenu(v)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${v.label}, ${count} ${count === 1 ? 'page' : 'pages'}`}
              accessibilityHint={on ? 'Opens options for this version' : undefined}
              style={[styles.version, { backgroundColor: on ? palette.accent : palette.surface, borderColor: on ? palette.accent : palette.line }]}
              testID={`version-${v.label}`}
            >
              <T variant="smallStrong" color={on ? 'onAccent' : 'ink'}>{v.label}</T>
              <T variant="small" color={on ? 'onAccent' : 'ink3'}>{count}</T>
              {on && versions.length > 1 ? <Icon name="Ellipsis" size={16} color="onAccent" /> : null}
            </Pressable>
          );
        })}
        {versions.length < MAX_VERSIONS ? (
          <Pressable
            onPress={() => router.push({ pathname: '/doc/new', params: { id: doc.id, version: 'new' } })}
            accessibilityRole="button"
            style={[styles.version, styles.addVersion, { borderColor: palette.line }]}
            testID="version-add"
          >
            <Icon name="Plus" size={16} color="accent" />
            <T variant="smallStrong" color="accent">{versions.length > 1 ? 'Version' : 'Add a version'}</T>
          </Pressable>
        ) : null}
      </ScrollView>

      <Animated.View key={current.id} entering={FadeIn.duration(180)}>
        <Card style={styles.previewCard}>
          <Preview file={file} templateId={doc.templateId} width={previewWidth - space.lg * 2} />
          {pages.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pages}>
              {pages.map((f, i) => (
                <Pressable key={f.id} onPress={() => setIndex(i)} accessibilityRole="button" accessibilityLabel={sideName(i)} style={[styles.page, i === index ? { backgroundColor: palette.accentSoft } : null]}>
                  <T variant="smallStrong" color={i === index ? 'accent' : 'ink2'}>{sideName(i)}</T>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {file && file.kind !== 'sample' ? <T variant="small" color="ink3" align="center">{file.name} · {formatBytes(file.size)}</T> : null}
          {!pages.length ? <T variant="small" color="ink3" align="center">No pages in this version yet.</T> : null}
        </Card>
      </Animated.View>

      <View style={styles.stamps}>
        {stamp ? <Stamp text={days !== null && days >= 0 && days > 7 ? `${template.expiry?.label === 'Valid till' ? 'Expires' : 'Due'} ${stamp.text}` : stamp.text} tone={stamp.tone} /> : null}
        {doc.onlyMe ? <Stamp text="Only me" tone="stamp" tilt={2} /> : null}
        <Stamp text={getCategory(template.category).name} tone="inland" tilt={-1} />
      </View>

      <View style={styles.actions}>
        <View style={styles.flex}><Button label="Share" icon="Share2" onPress={share} testID="doc-share" /></View>
        <View style={styles.flex}><Button label="Edit" icon="PenLine" variant="secondary" onPress={() => router.push({ pathname: '/doc/new', params: current.id === MAIN_VERSION ? { id: doc.id } : { id: doc.id, version: current.id } })} testID="doc-edit" /></View>
      </View>

      {file?.kind === 'image' ? (
        <View style={styles.actions}>
          {isAadhaar ? (
            <View style={styles.flex}><Button label="Masked copy" icon="EyeOff" variant="secondary" size="md" onPress={() => router.push({ pathname: '/doc/mask', params: { id: doc.id, file: String(doc.files.indexOf(file)) } })} testID="doc-mask" /></View>
          ) : null}
          <View style={styles.flex}><Button label="Crop or resize" icon="Crop" variant="secondary" size="md" onPress={() => router.push({ pathname: '/doc/export', params: { id: doc.id, file: String(doc.files.indexOf(file)) } })} testID="doc-export" /></View>
        </View>
      ) : null}

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

      {vehicle || account ? (
        <Card padded={false} style={styles.block}>
          {vehicle ? (
            <Row title={vehicle.name} subtitle="Filed under this vehicle" left={<View style={styles.plateLeft}><NumberPlate number={vehicle.number} size="sm" />{!vehicle.number ? <DocMark templateId="rc" size={40} /> : null}</View>} onPress={() => router.push(`/vehicle/${vehicle.id}`)} testID="doc-vehicle" />
          ) : null}
          {account ? (
            <Row title={`${account.bank} ${maskTail(account.accountNumber)}`} subtitle="Filed under this account" left={<BankMark bank={account.bank} />} divider={!!vehicle} onPress={() => router.push(`/bank/${account.id}`)} testID="doc-account" />
          ) : null}
        </Card>
      ) : null}

      <Section title="Details">
        <Card>
          <Detail label="For" value={owner ? owner.fullName : vehicle ? `${vehicle.name}, for the whole family` : 'The whole family'} />
          {doc.issueDate ? <Detail label="Issued" value={formatDate(doc.issueDate)} /> : null}
          {doc.expiryDate ? <Detail label={template.expiry?.label ?? 'Expires'} value={`${formatDate(doc.expiryDate)} (${relativeDays(days as number)})`} tone={days !== null && days < 0 ? 'sindoor' : undefined} /> : null}
          {template.nominee ? <Detail label="Nominee" value={doc.nominee || 'Not noted. Worth adding: it makes a claim simple.'} tone={doc.nominee ? undefined : 'sindoor'} /> : null}
          <Detail label="Original kept at" value={doc.original || 'Not noted yet. Add it, future you will thank you.'} />
          {doc.description ? <Detail label="Note" value={doc.description} /> : null}
          {versions.length > 1 ? <Detail label="Versions" value={versions.map((v) => v.label).join(', ')} /> : null}
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

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${doc.title}?`} subtitle={`${versions.length > 1 ? `All ${versions.length} versions go with it. ` : ''}It stays in Recently deleted for 30 days, and anyone in the family can restore it.`}>
        <SlideToConfirm label="Slide to delete" tone="sindoor" onConfirm={remove} testID="slide-delete" />
      </Sheet>

      <Sheet visible={sharing} onClose={() => setSharing(false)} title={`Share ${current.label === 'Original' ? doc.title : `${doc.title}, ${current.label}`}`} subtitle={`${pages.length} pages`} testID="share-sheet">
        {made ? (
          <View style={styles.made}>
            <Icon name="FileCheck" size={32} color="accent" />
            <T variant="bodyStrong" align="center">{made.name}</T>
            <T variant="small" color="ink2" align="center">{made.pages} {made.pages === 1 ? 'page' : 'pages'} · {formatBytes(made.bytes.length)}</T>
            <Button label="Share the PDF" icon="Share2" onPress={() => { setSharing(false); void sendMade(made); }} testID="share-made" />
          </View>
        ) : (
          <Card padded={false}>
            <Row
              title={`All ${pages.length} pages, one PDF`}
              subtitle="One file to send: what offices and portals ask for"
              icon="Files"
              tint="almari"
              onPress={() => void makePdf('pages')}
              right={making === 'pages' ? <T variant="small" color="ink2">Making…</T> : undefined}
              testID="share-all"
            />
            {template.shape === 'card' && images.length >= 2 ? (
              <Row
                title="Front and back on one page"
                subtitle="Like a photocopy: both sides on one A4"
                icon="Layers"
                tint="inland"
                divider
                onPress={() => void makePdf('one-page')}
                right={making === 'one-page' ? <T variant="small" color="ink2">Making…</T> : undefined}
                testID="share-one-page"
              />
            ) : null}
            <Row
              title={template.sides === 2 && index < 2 ? `Only the ${sideName(index).toLowerCase()}` : `Only page ${Math.min(index, pages.length - 1) + 1}`}
              subtitle={file ? `${file.name} · ${formatBytes(file.size)}` : undefined}
              icon="Image"
              tint="lifafa"
              divider
              onPress={() => {
                setSharing(false);
                void shareOne(file);
              }}
              testID="share-this"
            />
          </Card>
        )}
      </Sheet>

      <Sheet visible={!!menu} onClose={closeMenu} title={menu?.label} subtitle={menu ? `${versionFiles(doc, menu.id).length} ${versionFiles(doc, menu.id).length === 1 ? 'page' : 'pages'} · added ${formatDate(new Date(menu.addedAt).toISOString().slice(0, 10))}` : undefined} testID="version-menu">
        {menu && rename !== undefined ? (
          <View>
            <TextField label="Name this version" value={rename} onChangeText={setRename} max={40} testID="version-rename" />
            <Button label="Save" onPress={() => {
              if (rename.trim()) renameDocVersion(doc.id, menu.id, rename);
              closeMenu();
            }} testID="version-rename-save" />
          </View>
        ) : menu && confirmRemove ? (
          <View style={styles.gapSm}>
            <T variant="body" color="ink2">The {menu.label.toLowerCase()} version and its {versionFiles(doc, menu.id).length} pages leave the almari for everyone. The other versions stay.</T>
            <SlideToConfirm label="Slide to remove" tone="sindoor" onConfirm={() => {
              removeDocVersion(doc.id, menu.id);
              toast(`Removed the ${menu.label.toLowerCase()} version`);
              setVersionId(MAIN_VERSION);
              setIndex(0);
              closeMenu();
            }} testID="version-remove-slide" />
          </View>
        ) : menu ? (
          <Card padded={false}>
            <Row title="Rename" icon="PenLine" tint="almari" onPress={() => setRename(menu.label)} testID="version-rename-open" />
            <Row title="Change its pages" subtitle="Add, crop or remove pages" icon="Image" tint="lifafa" divider onPress={() => {
              closeMenu();
              router.push({ pathname: '/doc/new', params: menu.id === MAIN_VERSION ? { id: doc.id } : { id: doc.id, version: menu.id } });
            }} />
            {versions.length > 1 ? (
              <Row title="Remove this version" icon="Trash" danger divider onPress={() => setConfirmRemove(true)} testID="version-remove" />
            ) : null}
          </Card>
        ) : null}
      </Sheet>

      <Sheet visible={merging} onClose={() => setMerging(false)} title="Make them one?" subtitle={`${doc.title} stays. The others become its versions, with all their pages.`} testID="merge-sheet">
        <Card padded={false} style={styles.block}>
          {[doc, ...dups].map((d, i) => (
            <Row key={d.id} title={d.title} subtitle={i === 0 ? 'Stays, with its details' : `Becomes a version · ${d.files.length} ${d.files.length === 1 ? 'page' : 'pages'}`} left={<DocThumb templateId={d.templateId} file={d.files[0]} width={40} />} divider={i > 0} />
          ))}
        </Card>
        <Button label="Make them one" icon="Merge" onPress={() => {
          mergeDocuments(doc.id, dups.map((d) => d.id));
          setMerging(false);
          haptic.success();
          toast(`Done. ${doc.title} now has ${docVersions(doc).length + dups.length} versions.`, { tone: 'success' });
        }} testID="merge-go" />
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
  gapSm: { gap: space.md },
  dup: { gap: space.sm, marginBottom: space.lg },
  dupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  versionScroller: { marginHorizontal: -space.xl, marginBottom: space.md },
  versionRow: { gap: space.sm, paddingHorizontal: space.xl },
  version: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, minHeight: 38, borderRadius: radius.pill, borderWidth: 1 },
  addVersion: { borderStyle: 'dashed' },
  previewCard: { gap: space.md, marginBottom: space.lg },
  previewCenter: { alignItems: 'center', paddingVertical: space.md },
  pages: { gap: space.sm },
  page: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.lg, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: space.md, marginBottom: space.lg },
  block: { marginBottom: space.lg, gap: space.sm },
  detail: { paddingVertical: space.sm, gap: 2 },
  plateLeft: { minWidth: 40, alignItems: 'flex-start' },
  made: { alignItems: 'center', gap: space.sm, paddingVertical: space.md },
});
