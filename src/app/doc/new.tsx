import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Chip } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Cropper } from '@/components/Cropper';
import { DocThumb, useFileUrl } from '@/components/DocThumb';
import { DateField, TextField, ToggleRow } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Card, Screen, Section } from '@/components/Layout';
import { BankMark, DocMark, NumberPlate } from '@/components/Marks';
import { countFilled, More, MoreGroup } from '@/components/More';
import { FAMILY, MemberPicker } from '@/components/MemberPicker';
import { TemplatePicker } from '@/components/TemplatePicker';
import { T } from '@/components/Text';
import { VehicleSheet } from '@/components/VehicleSheet';
import { displayName, findMember, visibleTo } from '@/domain/access';
import { bankShortName } from '@/domain/banks';
import { formatDate } from '@/domain/dates';
import { extractFromText, suggestFor, type Suggestion } from '@/domain/extract';
import { maskTail } from '@/domain/money';
import {
  getCategory, getTemplate, nameInSentence, scopeOfTemplate, versionLabelsFor, type CategoryId, type Template,
} from '@/domain/templates';
import { MAIN_VERSION, type FileRef } from '@/domain/types';
import {
  checkAadhaar, checkDocDescription, checkDocTitle, checkDrivingLicence, checkFile, checkIfsc, checkPan, checkPassport,
  checkVoterId, fileKindOf, formatBytes, LIMITS, OK, type Check,
} from '@/domain/validation';
import { docVersions, existingUnique, MAX_PAGES, MAX_VERSIONS, versionFiles } from '@/domain/versions';
import { findVehicle, formatPlate, vehicleDocTitle, vehiclesOf } from '@/domain/vehicles';
import { initCrypto, randomKey, toB64 } from '@/lib/crypto';
import { haptic } from '@/lib/device';
import { askOnceForReminders } from '@/lib/notify';
import { OCR_AVAILABLE, OCR_UNAVAILABLE_REASON, recognize } from '@/lib/ocr';
import { ORIGINAL_PLACES } from '@/lib/options';
import { pickFromCamera, pickFromFiles, pickFromPhotos, type PickResult } from '@/lib/pick';
import { useApp } from '@/store/app-store';
import { fileUrl, saveFile, type PickedFile } from '@/store/files';
import { useCtx } from '@/store/hooks';
import { newId } from '@/store/secrets';
import { toast } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type Slot = { kind: 'saved'; ref: FileRef } | { kind: 'new'; id: string; picked: PickedFile };

function numberCheck(template: Template, value: string): Check {
  switch (template.number?.kind) {
    case 'aadhaar': return checkAadhaar(value);
    case 'pan': return checkPan(value);
    case 'passport': return checkPassport(value);
    case 'voter': return checkVoterId(value);
    case 'dl': return checkDrivingLicence(value);
    case 'ifsc': return checkIfsc(value);
    default: return OK;
  }
}

const isImageSlot = (slot: Slot) => (slot.kind === 'new' ? fileKindOf(slot.picked.name, slot.picked.mime) === 'image' : slot.ref.kind === 'image');

function SlotImage({ slot }: { slot: Slot }) {
  const { palette } = useTheme();
  const url = useFileUrl(slot.kind === 'saved' ? slot.ref : undefined);
  if (slot.kind === 'new' && fileKindOf(slot.picked.name, slot.picked.mime) === 'image') {
    return <Image source={{ uri: slot.picked.uri }} style={styles.fileImage} contentFit="cover" />;
  }
  if (slot.kind === 'saved' && slot.ref.kind === 'image' && url) return <Image source={{ uri: url }} style={styles.fileImage} contentFit="cover" />;
  if (slot.kind === 'saved') return <DocThumb templateId="custom" file={slot.ref} width={56} />;
  return (
    <View style={[styles.fileImage, styles.fileIcon, { backgroundColor: palette.surfaceAlt }]}>
      <Icon name="FileText" size={24} color="ink2" />
    </View>
  );
}

function FileTile({ slot, onRemove, onCrop, label, testID }: { slot: Slot; onRemove: () => void; onCrop?: () => void; label: string; testID?: string }) {
  const { palette } = useTheme();
  const name = slot.kind === 'saved' ? slot.ref.name : slot.picked.name;
  const size = slot.kind === 'saved' ? slot.ref.size : slot.picked.size;
  return (
    <Animated.View entering={FadeIn.duration(180)} layout={LinearTransition.duration(200)} style={[styles.fileTile, { borderColor: palette.line, backgroundColor: palette.surface }]} testID={testID}>
      <SlotImage slot={slot} />
      <View style={styles.flex}>
        <T variant="smallStrong" numberOfLines={1}>{label}</T>
        <T variant="small" color="ink2" numberOfLines={1}>{name}{size ? ` · ${formatBytes(size)}` : ''}</T>
      </View>
      {onCrop ? (
        <Pressable onPress={onCrop} accessibilityRole="button" accessibilityLabel={`Crop ${label}`} hitSlop={6} style={[styles.cropButton, { backgroundColor: palette.accentSoft }]} testID={testID ? `${testID}-crop` : undefined}>
          <Icon name="Crop" size={16} color="accent" />
          <T variant="smallStrong" color="accent">Crop</T>
        </Pressable>
      ) : null}
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${label}`} hitSlop={10} style={styles.remove}>
        <Icon name="X" size={20} color="ink2" />
      </Pressable>
    </Animated.View>
  );
}

/** Version labels as one swipeable line of chips, plus a field for any other name. */
function VersionLabel({ template, value, onChange, taken }: { template: Template; value: string; onChange: (v: string) => void; taken: string[] }) {
  const options = versionLabelsFor(template).filter((l) => !taken.includes(l.toLowerCase()));
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.labelScroller} contentContainerStyle={styles.labelRow}>
        {options.map((l) => <Chip key={l} label={l} selected={value === l} onPress={() => onChange(value === l ? '' : l)} testID={`version-label-${l}`} />)}
      </ScrollView>
      <TextField label="Name this version" value={value} onChangeText={onChange} placeholder="Masked, PVC card, attested copy" max={40} required testID="version-label" />
    </View>
  );
}

export default function AddDocument() {
  const params = useLocalSearchParams<{
    template?: string; owner?: string; category?: string; id?: string; renew?: string;
    /** Adding a version to the document `id` ("new"), or editing one version's pages. */
    version?: string;
    vehicle?: string; account?: string;
  }>();
  const ctx = useCtx();
  const { palette } = useTheme();
  const saveDocument = useApp((s) => s.saveDocument);
  const addDocVersion = useApp((s) => s.addDocVersion);
  const existing = ctx && params.id ? ctx.family.documents.find((d) => d.id === params.id && !d.deletedAt) : undefined;
  const renew = params.renew === '1';
  const addingVersion = !!existing && params.version === 'new';
  const editVersion = existing && params.version && params.version !== 'new' ? params.version : MAIN_VERSION;

  const [template, setTemplate] = useState<Template | undefined>(
    existing ? getTemplate(existing.templateId) : params.template ? getTemplate(params.template) : undefined,
  );
  const account = ctx && params.account ? ctx.family.bankAccounts.find((a) => a.id === params.account && !a.deletedAt) : undefined;
  const [ownerId, setOwnerId] = useState<string>(existing ? existing.ownerId ?? FAMILY : params.owner ?? account?.ownerId ?? ctx?.viewerId ?? FAMILY);
  const [slots, setSlots] = useState<Slot[]>(
    existing && !renew && !addingVersion ? versionFiles(existing, editVersion).map((ref) => ({ kind: 'saved' as const, ref })) : [],
  );
  const [vehicleId, setVehicleId] = useState<string | undefined>(existing?.vehicleId ?? params.vehicle);
  const [accountId, setAccountId] = useState<string | undefined>(existing?.accountId ?? account?.id);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [titleEdited, setTitleEdited] = useState(!!existing);
  const initialNumber = existing?.number
    ?? (template?.profileId && params.owner && ctx ? findMember(ctx.family, params.owner)?.ids[template.profileId] : undefined)
    ?? (template?.perAccount && account ? account.accountNumber : undefined)
    ?? (template?.number?.kind === 'vehicle' && ctx && params.vehicle ? findVehicle(ctx.family, params.vehicle)?.number : undefined)
    ?? '';
  const [number, setNumber] = useState(initialNumber);
  const [issueDate, setIssueDate] = useState<string | undefined>(renew ? undefined : existing?.issueDate);
  const [expiryDate, setExpiryDate] = useState<string | undefined>(renew ? undefined : existing?.expiryDate);
  const [original, setOriginal] = useState(existing?.original ?? '');
  const [nominee, setNominee] = useState(existing?.nominee ?? '');
  const [ocr, setOcr] = useState<{ state: 'idle' | 'reading' | 'done' | 'failed'; suggestion?: Suggestion }>({ state: 'idle' });
  const [dateKey, setDateKey] = useState(0);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [onlyMe, setOnlyMe] = useState(existing?.onlyMe ?? false);
  const [versionLabel, setVersionLabel] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string>();
  const [cropping, setCropping] = useState<{ index: number; uri: string; name: string }>();
  const [vehicleSheet, setVehicleSheet] = useState(false);
  const [moreOpen, setMoreOpen] = useState(!!existing && countFilled(existing.number, existing.issueDate, existing.expiryDate, existing.nominee, existing.original) > 0);

  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  const members = family.members.filter((m) => m.status !== 'memorial');

  if (!template) {
    return (
      <Screen title="What are you adding?" testID="doc-new-pick">
        <TemplatePicker
          initialCategory={params.category as CategoryId | undefined}
          ownerId={ownerId === FAMILY ? undefined : ownerId}
          onPick={(t) => {
            setTemplate(t);
            const who = scopeOfTemplate(t) === 'common' ? FAMILY : ownerId === FAMILY ? params.owner ?? viewerId : ownerId;
            setOwnerId(who);
            // The profile already knows this number (PAN, Aadhaar): fill it in.
            const known = t.profileId && who !== FAMILY ? findMember(family, who)?.ids[t.profileId] : undefined;
            if (known && !number.trim()) setNumber(known);
          }}
        />
      </Screen>
    );
  }

  const common = template.id !== 'custom' && scopeOfTemplate(template) === 'common';
  const effectiveOwner = common || ownerId === FAMILY ? undefined : ownerId;
  const owner = effectiveOwner ? findMember(family, effectiveOwner) : undefined;
  const vehicle = template.perVehicle ? findVehicle(family, vehicleId) : undefined;
  const vehicles = template.perVehicle ? vehiclesOf(family) : [];
  const ownerAccounts = template.perAccount && effectiveOwner ? visibleTo(family, viewerId, family.bankAccounts).filter((a) => a.ownerId === effectiveOwner) : [];
  const linkedAccount = template.perAccount ? ownerAccounts.find((a) => a.id === accountId) ?? (account && account.id === accountId ? account : undefined) : undefined;

  // The same one-per-person paper already saved for this person (or this vehicle): this becomes a version of it.
  const twin = addingVersion ? existing : existingUnique(family, viewerId, template.id, effectiveOwner, { exceptId: existing?.id, vehicleId });
  const versionMode = addingVersion || (!existing && !!twin);
  // Editing clashes only when it moves the paper to someone (or a vehicle) that already has one;
  // papers saved twice before the rule can still be edited, and merged from their page.
  const editingClash = !!existing && !addingVersion && !!twin
    && (effectiveOwner !== existing.ownerId || (!!template.perVehicle && vehicleId !== existing.vehicleId));

  const suggestedTitle = (() => {
    if (vehicle) return vehicleDocTitle(vehicle, template.id).slice(0, LIMITS.docTitle);
    if (linkedAccount && template.short) {
      const base = `${bankShortName(linkedAccount.bank)} ${template.short}`;
      return (owner && owner.id !== viewerId ? `${displayName(owner)}’s ${base}` : base).slice(0, LIMITS.docTitle);
    }
    if (owner) return `${owner.id === viewerId ? 'My' : `${displayName(owner)}’s`} ${template.id === 'custom' ? 'document' : nameInSentence(template.name)}`.slice(0, LIMITS.docTitle);
    return template.id === 'custom' ? '' : template.name.slice(0, LIMITS.docTitle);
  })();
  const shownTitle = titleEdited ? title : suggestedTitle;
  const takenLabels = twin ? docVersions(twin).map((v) => v.label.toLowerCase()) : [];
  const labelClash = versionMode && versionLabel.trim() && takenLabels.includes(versionLabel.trim().toLowerCase());

  const checks = {
    title: checkDocTitle(shownTitle),
    description: checkDocDescription(description),
    number: numberCheck(template, number),
    files: slots.length ? OK : ({ level: 'error', message: 'Add a photo or file of the document' } as Check),
    label: !versionLabel.trim() ? ({ level: 'error', message: 'Name this version, so it can be told apart' } as Check) : OK,
  };

  const firstImage = slots.find(isImageSlot);
  const readPhoto = async () => {
    if (!firstImage) return;
    setOcr({ state: 'reading' });
    try {
      const uri = firstImage.kind === 'new' ? firstImage.picked.uri : await fileUrl(firstImage.ref);
      const result = uri ? await recognize(uri) : null;
      if (!result) return setOcr({ state: 'failed' });
      setOcr({ state: 'done', suggestion: suggestFor(template.number?.kind, extractFromText(result.text), !!template.expiry) });
    } catch {
      setOcr({ state: 'failed' });
    }
  };

  const openCrop = async (index: number) => {
    const slot = slots[index];
    if (!slot || !isImageSlot(slot)) return;
    const uri = slot.kind === 'new' ? slot.picked.uri : await fileUrl(slot.ref);
    if (!uri) return toast('Could not open this photo', { tone: 'warn' });
    setCropping({ index, uri, name: slot.kind === 'new' ? slot.picked.name : slot.ref.name });
  };

  const addFile = async (pick: (limit: number) => Promise<PickResult>, fromCamera = false) => {
    setFileError(undefined);
    const room = MAX_PAGES - slots.length;
    if (room <= 0) return setFileError(`Up to ${MAX_PAGES} pages or sides per document`);
    try {
      const result = await pick(room);
      if (!result) return;
      if ('denied' in result) return setFileError('Camera permission is off. Turn it on in phone settings, or pick a photo instead.');
      const good: Slot[] = [];
      let problem: string | undefined;
      for (const file of result.files.slice(0, room)) {
        const check = checkFile({ name: file.name, size: file.size, mime: file.mime });
        if (check.level === 'error') problem = problem ?? `${file.name}: ${check.message}`;
        else good.push({ kind: 'new', id: newId(), picked: file });
      }
      if (good.length) {
        const at = slots.length;
        setSlots((s) => [...s, ...good].slice(0, MAX_PAGES));
        // A photo just taken nearly always has the table around it: straight to cropping.
        if (fromCamera && good[0].kind === 'new' && fileKindOf(good[0].picked.name, good[0].picked.mime) === 'image') {
          setCropping({ index: at, uri: good[0].picked.uri, name: good[0].picked.name });
        }
      }
      if (problem) setFileError(result.files.length > 1 ? `${problem}. The others were added.` : problem.replace(/^[^:]+: /, ''));
    } catch {
      // A tablet or Chromebook may have no camera at all: the camera is optional for installing Almari.
      setFileError(fromCamera ? 'The camera could not open. Pick a photo or a file instead.' : 'Could not open that file. Try another, or a photo of it.');
    }
  };

  /** Locks and stores the picked files; saved ones pass through unchanged. */
  const storeSlots = async (versionId?: string): Promise<FileRef[]> => {
    const files: FileRef[] = [];
    for (const slot of slots) {
      if (slot.kind === 'saved') {
        files.push(versionId && versionId !== MAIN_VERSION ? { ...slot.ref, versionId } : slot.ref);
        continue;
      }
      const kind = fileKindOf(slot.picked.name, slot.picked.mime) ?? 'doc';
      const ref: FileRef = { id: slot.id, name: slot.picked.name, mime: slot.picked.mime ?? 'application/octet-stream', size: slot.picked.size ?? 0, kind };
      if (versionId && versionId !== MAIN_VERSION) ref.versionId = versionId;
      // Papers of a real family are locked with their own key before they are stored or uploaded.
      if (!family.isSample) {
        await initCrypto();
        ref.key = toB64(randomKey());
        ref.familyId = family.id;
      }
      await saveFile(ref, slot.picked);
      files.push(ref);
    }
    return files;
  };

  const saveVersion = async () => {
    setTried(true);
    if (!twin || checks.files.level === 'error' || checks.label.level === 'error') return;
    if (docVersions(twin).length >= MAX_VERSIONS) return toast(`Up to ${MAX_VERSIONS} versions of one paper. Remove an old one first.`, { tone: 'warn' });
    setSaving(true);
    try {
      const files = await storeSlots();
      const vid = addDocVersion(twin.id, versionLabel.trim(), files);
      haptic.success();
      toast(`Saved as a new version of ${twin.title}`, { tone: 'success' });
      router.replace({ pathname: '/doc/[id]', params: { id: twin.id, version: vid ?? MAIN_VERSION } });
    } catch {
      toast('Could not save the file. Is the phone out of space?', { tone: 'warn' });
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (versionMode) return saveVersion();
    setTried(true);
    if (checks.files.level === 'error') setFileError(undefined);
    if ([checks.title, checks.description, checks.files].some((c) => c.level === 'error')) return;
    if (editingClash && twin) {
      return toast(`${owner ? `${displayName(owner)} already has` : 'There is already'} ${nameInSentence(template.name)} saved. Open it and add this as a version.`, { tone: 'warn' });
    }
    setSaving(true);
    try {
      const pages = await storeSlots(editVersion);
      // Editing one version's pages leaves the other versions as they are.
      const others = existing && !renew ? existing.files.filter((f) => (f.versionId ?? MAIN_VERSION) !== editVersion) : existing ? existing.files.filter((f) => f.versionId) : [];
      const files = editVersion === MAIN_VERSION ? [...pages, ...others] : [...others, ...pages];
      const id = saveDocument({
        id: existing?.id,
        templateId: template.id,
        title: shownTitle.trim(),
        description: description.trim() || undefined,
        scope: effectiveOwner ? 'personal' : 'common',
        ownerId: effectiveOwner,
        onlyMe: effectiveOwner === viewerId ? onlyMe : false,
        number: number.trim() || undefined,
        issueDate,
        expiryDate,
        original: original.trim() || undefined,
        nominee: template.nominee ? nominee.trim() || undefined : undefined,
        vehicleId: template.perVehicle ? vehicle?.id : undefined,
        accountId: template.perAccount ? linkedAccount?.id : undefined,
        files,
      });
      haptic.success();
      toast(existing ? (renew ? 'Renewed. The reminder starts again.' : 'Saved') : 'Saved. Safe in the almari.', { tone: 'success' });
      router.replace(`/doc/${id}`);
      // A date that will remind them: the moment to ask for notifications, once.
      if (expiryDate && !family.isSample) void askOnceForReminders();
    } catch {
      toast('Could not save the file. Is the phone out of space?', { tone: 'warn' });
    } finally {
      setSaving(false);
    }
  };

  const moreSummary = [
    template.number?.label,
    template.issueDate ? 'issue date' : undefined,
    template.expiry ? `${template.expiry.label.toLowerCase()} (for reminders)` : undefined,
    template.nominee ? 'nominee' : undefined,
    'where the original is kept',
  ].filter(Boolean).join(', ').replace(/^./, (c) => c.toUpperCase());
  const sideLabel = (i: number) => (template.sides === 2 ? (i === 0 ? 'Front' : i === 1 ? 'Back' : `Page ${i + 1}`) : slots.length > 1 ? `Page ${i + 1}` : 'File');
  const category = getCategory(template.category);
  const editingLabel = existing && editVersion !== MAIN_VERSION ? docVersions(existing).find((v) => v.id === editVersion)?.label : undefined;

  const screenTitle = addingVersion && existing ? 'Add a version'
    : versionMode && twin ? `Another ${nameInSentence(template.name)}`
      : renew ? `Renewed ${existing?.title ?? template.name}`
        : existing ? (editingLabel ? `Edit ${editingLabel}` : 'Edit document')
          : template.name;

  const files = (
    <Section title={template.sides === 2 ? 'Photo of the front, then the back' : 'Photo or file'} required>
      {slots.map((slot, i) => (
        <FileTile
          key={slot.kind === 'saved' ? slot.ref.id : slot.id}
          slot={slot}
          label={sideLabel(i)}
          testID={`file-${i}`}
          onCrop={isImageSlot(slot) ? () => void openCrop(i) : undefined}
          onRemove={() => setSlots((s) => s.filter((_, j) => j !== i))}
        />
      ))}
      {slots.length < MAX_PAGES ? (
        <View style={styles.pickRow}>
          <View style={styles.flex}><Button label="Camera" icon="Camera" variant="secondary" size="md" onPress={() => addFile(pickFromCamera, true)} testID="pick-camera" /></View>
          <View style={styles.flex}><Button label="Photos" icon="Image" variant="secondary" size="md" onPress={() => addFile(pickFromPhotos)} testID="pick-photos" /></View>
          <View style={styles.flex}><Button label="Files" icon="Folder" variant="secondary" size="md" onPress={() => addFile(pickFromFiles)} testID="pick-files" /></View>
        </View>
      ) : null}
      {fileError ? <T variant="small" color="sindoor">{fileError}</T> : tried && checks.files.level === 'error' ? <T variant="small" color="sindoor">{checks.files.message}</T> : (
        <T variant="small" color="ink3">
          Up to {MAX_PAGES} pages, several at once from Photos or Files. Photos, PDF, Word, Excel, up to 10 MB each. Tap Crop on a photo to trim it. Shared from WhatsApp or DigiLocker works too.
        </T>
      )}
    </Section>
  );

  const cropper = (
    <Cropper
      visible={!!cropping}
      uri={cropping?.uri}
      name={cropping?.name ?? 'photo.jpg'}
      cardShaped={template.shape === 'card'}
      onClose={() => setCropping(undefined)}
      onDone={(result) => {
        const at = cropping?.index;
        setCropping(undefined);
        if (!result || at === undefined) return;
        haptic.success();
        setSlots((s) => s.map((slot, j) => (j === at ? { kind: 'new', id: newId(), picked: result } : slot)));
      }}
      testID="cropper"
    />
  );

  // ------------------------------------------------ a version of a paper already saved
  if (versionMode && twin) {
    const twinOwner = findMember(family, twin.ownerId);
    return (
      <Screen
        title={screenTitle}
        subtitle={twin.title}
        footer={<Button label="Save as a new version" icon="Layers" onPress={save} loading={saving} testID="doc-save" />}
        testID="doc-version"
      >
        {!addingVersion && !common ? (
          <Section title="For whom" required>
            <MemberPicker members={members} value={[ownerId]} onChange={(v) => setOwnerId(v[0] ?? viewerId)} testID="owner" />
          </Section>
        ) : null}
        <Card style={styles.twin}>
          <View style={styles.twinHead}>
            <DocThumb templateId={twin.templateId} file={versionFiles(twin)[0] ?? twin.files[0]} width={64} />
            <View style={styles.flex}>
              <T variant="bodyStrong">{addingVersion ? twin.title : `${twinOwner && twinOwner.id !== viewerId ? `${displayName(twinOwner)} has` : vehicle ? `${vehicle.name} has` : 'You have'} this paper saved`}</T>
              <T variant="small" color="ink2">
                {docVersions(twin).map((v) => v.label).join(' · ')}
              </T>
            </View>
          </View>
          {!addingVersion ? (
            <T variant="small" color="ink2">
              A person has one {nameInSentence(template.name)}{template.perVehicle ? ' per vehicle' : ''}. What you add now is kept with it as another version, like a masked copy or the PVC card.
            </T>
          ) : null}
          {!addingVersion ? (
            <View style={styles.links}>
              <Pressable onPress={() => router.replace(`/doc/${twin.id}`)} accessibilityRole="button" style={styles.link} testID="open-twin">
                <T variant="smallStrong" color="accent">Open the saved one</T>
                <Icon name="ChevronRight" size={16} color="accent" />
              </Pressable>
              {template.perVehicle ? (
                <Pressable onPress={() => setVehicleId(undefined)} accessibilityRole="button" style={styles.link} testID="other-vehicle">
                  <T variant="smallStrong" color="accent">It is another vehicle’s</T>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Card>
        <VersionLabel template={template} value={versionLabel} onChange={setVersionLabel} taken={takenLabels} />
        {labelClash ? <T variant="small" color="haldi" style={styles.clash}>There is already a version called that; this one gets a number after it.</T> : null}
        {tried && checks.label.level === 'error' ? <T variant="small" color="sindoor" style={styles.clash}>{checks.label.message}</T> : null}
        {files}
        {cropper}
      </Screen>
    );
  }

  // ------------------------------------------------ a new paper, or editing one
  return (
    <Screen
      title={screenTitle}
      subtitle={category.id === 'other' ? 'Something else' : category.name}
      footer={<Button label={renew ? 'Save the renewed copy' : 'Save'} onPress={save} loading={saving} testID="doc-save" />}
      testID="doc-new"
    >
      {!existing ? (
        <Pressable onPress={() => setTemplate(undefined)} accessibilityRole="button" style={styles.change}>
          <DocMark templateId={template.id} size={36} />
          <T variant="smallStrong" color="accent">Change what you are adding</T>
        </Pressable>
      ) : null}

      {template.perVehicle ? (
        <Section title="Which vehicle?">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.pickScroller} contentContainerStyle={styles.pickLine}>
            {vehicles.map((v) => {
              const on = v.id === vehicle?.id;
              return (
                <VehicleChip key={v.id} name={v.name} number={v.number} selected={on} onPress={() => {
                  haptic.tap();
                  setVehicleId(on ? undefined : v.id);
                  if (!on && template.number?.kind === 'vehicle' && !number.trim() && v.number) setNumber(formatPlate(v.number));
                }} testID={`pick-vehicle-${v.id}`} />
              );
            })}
            <Chip label={vehicles.length ? 'New vehicle' : 'Add the vehicle'} icon="Plus" onPress={() => setVehicleSheet(true)} testID="pick-vehicle-new" />
          </ScrollView>
          {!vehicles.length ? <T variant="small" color="ink3">Each vehicle keeps its own RC, insurance, PUC and bills.</T> : null}
        </Section>
      ) : common ? (
        <Card style={styles.commonNote}>
          <Icon name="Users" size={20} color="inland" />
          <T variant="small" color="ink2" style={styles.flex}>Family papers. Everyone in {family.name} can see them.</T>
        </Card>
      ) : null}

      {!common ? (
        <Section title="For whom" required>
          <MemberPicker members={members} value={[ownerId]} onChange={(v) => {
            setOwnerId(v[0] ?? viewerId);
            if (template.perAccount) setAccountId(undefined);
          }} allowFamily={template.id === 'custom'} testID="owner" />
        </Section>
      ) : null}

      {template.perAccount && ownerAccounts.length ? (
        <Section title="Which account?">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.pickScroller} contentContainerStyle={styles.pickLine}>
            {ownerAccounts.map((a) => {
              const on = a.id === linkedAccount?.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    haptic.tap();
                    setAccountId(on ? undefined : a.id);
                    if (!on && !number.trim()) setNumber(a.accountNumber);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.accountChip, { borderColor: on ? palette.accent : palette.line, backgroundColor: on ? palette.accentSoft : palette.surface }]}
                  testID={`pick-account-${a.id}`}
                >
                  <BankMark bank={a.bank} size={28} />
                  <View>
                    <T variant="smallStrong" numberOfLines={1}>{bankShortName(a.bank)}</T>
                    <T variant="small" color="ink2">{maskTail(a.accountNumber)}</T>
                  </View>
                  {on ? <Icon name="CircleCheck" size={18} color="accent" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>
      ) : null}

      {editingClash && twin ? (
        <Card style={styles.twin}>
          <T variant="bodyStrong" color="haldi">{owner ? `${displayName(owner)} already has` : 'There is already'} {nameInSentence(template.name)} saved</T>
          <T variant="small" color="ink2">A person keeps one, with its other copies as versions. Pick someone else, or open the saved one to add this there.</T>
          <Pressable onPress={() => router.push(`/doc/${twin.id}`)} accessibilityRole="button" style={styles.link}>
            <T variant="smallStrong" color="accent">Open {twin.title}</T>
            <Icon name="ChevronRight" size={16} color="accent" />
          </Pressable>
        </Card>
      ) : null}

      {files}

      <TextField
        label="Title"
        value={shownTitle}
        onChangeText={(v) => {
          setTitleEdited(true);
          setTitle(v);
        }}
        max={LIMITS.docTitle}
        required
        check={checks.title}
        showCheck={tried}
        testID="doc-title"
      />

      <TextField label="Description" value={description} onChangeText={setDescription} max={LIMITS.docDescription} multiline check={checks.description} showCheck={tried} placeholder="Optional" testID="doc-description" />

      {effectiveOwner === viewerId ? (
        <Card style={styles.onlyMe}>
          <ToggleRow title="Only me" subtitle="Nobody else in the family sees this, whatever the family setting." value={onlyMe} onValueChange={setOnlyMe} testID="doc-only-me" />
        </Card>
      ) : null}

      {(template.number || template.expiry) && firstImage ? (
        <Card style={styles.ocr}>
          {OCR_AVAILABLE ? (
            <>
              <Button
                label={ocr.state === 'reading' ? 'Reading the photo…' : template.number ? 'Read the number from the photo' : 'Read the dates from the photo'}
                icon="ScanLine"
                variant="secondary"
                size="md"
                loading={ocr.state === 'reading'}
                onPress={readPhoto}
                testID="ocr-read"
              />
              {ocr.state === 'done' && ocr.suggestion ? (
                <View style={styles.ocrFound}>
                  {ocr.suggestion.number ? (
                    <Chip testID="ocr-use-number" icon="Check" label={`Use ${ocr.suggestion.number}`} onPress={() => { setNumber(ocr.suggestion?.number ?? ''); setMoreOpen(true); }} />
                  ) : null}
                  {ocr.suggestion.expiryDate && template.expiry ? (
                    <Chip testID="ocr-use-expiry" icon="Check" label={`${template.expiry.label} ${formatDate(ocr.suggestion.expiryDate)}`} onPress={() => { setExpiryDate(ocr.suggestion?.expiryDate); setDateKey((k) => k + 1); setMoreOpen(true); }} />
                  ) : null}
                  {ocr.suggestion.issueDate && template.issueDate ? (
                    <Chip icon="Check" label={`Issued ${formatDate(ocr.suggestion.issueDate)}`} onPress={() => { setIssueDate(ocr.suggestion?.issueDate); setDateKey((k) => k + 1); setMoreOpen(true); }} />
                  ) : null}
                  {!ocr.suggestion.number && !ocr.suggestion.expiryDate ? <T variant="small" color="ink2">No number found. A sharper, straight photo helps, or type it in.</T> : null}
                </View>
              ) : null}
              {ocr.state === 'failed' ? <T variant="small" color="sindoor">Could not read the photo. Type the number in.</T> : null}
              <T variant="small" color="ink3">Read on this device. Check what it finds before saving.</T>
            </>
          ) : (
            <T variant="small" color="ink3">{OCR_UNAVAILABLE_REASON}</T>
          )}
        </Card>
      ) : null}

      <More
        summary={moreSummary}
        filled={countFilled(number, issueDate, expiryDate, nominee, original)}
        open={moreOpen}
        onToggle={setMoreOpen}
        testID="doc-more"
      >
        {template.number ? (
          <TextField
            label={template.number.label}
            value={number}
            onChangeText={setNumber}
            keyboardType={template.number.kind === 'aadhaar' || template.perAccount ? 'number-pad' : undefined}
            autoCapitalize={template.number.kind && template.number.kind !== 'aadhaar' ? 'characters' : 'none'}
            check={checks.number}
            helper={template.profileId ? `Also fills ${owner && owner.id !== viewerId ? `${displayName(owner)}’s` : 'your'} profile` : linkedAccount ? `From the ${bankShortName(linkedAccount.bank)} account` : undefined}
            testID="doc-number"
          />
        ) : null}
        {template.issueDate ? <DateField key={`issue-${dateKey}`} label="Issued on" value={issueDate} onChange={setIssueDate} testID="doc-issue" /> : null}
        {template.expiry ? (
          <DateField
            key={`expiry-${dateKey}`}
            label={template.expiry.label}
            value={expiryDate}
            onChange={setExpiryDate}
            helper={template.expiry.rule?.months ? 'Reminders 9 and 3 months before, for visa rules' : 'Reminders 30, 7 and 1 day before'}
            testID="doc-expiry"
          />
        ) : null}
        {template.nominee ? (
          <TextField label="Nominee" value={nominee} onChangeText={setNominee} placeholder="Who receives it, as written on the form" helper="The money map flags accounts and policies without one" testID="doc-nominee" />
        ) : null}
        <MoreGroup title="Where is the original kept?">
          <View style={styles.chips}>
            {ORIGINAL_PLACES.map((p) => (
              <Chip key={p} label={p} selected={original === p} onPress={() => setOriginal(original === p ? '' : p)} />
            ))}
          </View>
          <TextField label="Or describe it" value={original} onChangeText={setOriginal} placeholder="Steel almari, top shelf, red file" max={80} testID="doc-original" />
        </MoreGroup>
      </More>
      {renew ? <T variant="small" color="ink2">The renewed copy replaces the old one. Its other versions stay as they are.</T> : null}
      {cropper}
      <VehicleSheet
        visible={vehicleSheet}
        onClose={() => setVehicleSheet(false)}
        family={family}
        onSaved={(id) => {
          setVehicleId(id);
          // The vehicle was saved a moment ago: read it from the store, not from this render.
          const s = useApp.getState();
          const fresh = s.session.familyId ? s.families[s.session.familyId] : undefined;
          const v = fresh ? findVehicle(fresh, id) : undefined;
          if (template.number?.kind === 'vehicle' && !number.trim() && v?.number) setNumber(formatPlate(v.number));
        }}
      />
    </Screen>
  );
}

function VehicleChip({ name, number, selected, onPress, testID }: { name: string; number?: string; selected: boolean; onPress: () => void; testID?: string }) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      style={[styles.vehicleChip, { borderColor: selected ? palette.accent : palette.line, backgroundColor: selected ? palette.accentSoft : palette.surface }]}
      testID={testID}
    >
      <T variant="smallStrong" color={selected ? 'accent' : 'ink'} numberOfLines={1}>{name}</T>
      {number ? <NumberPlate number={number} size="sm" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  change: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xl },
  commonNote: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xxl },
  pickRow: { flexDirection: 'row', gap: space.sm },
  fileTile: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  fileImage: { width: 56, height: 56, borderRadius: radius.sm },
  fileIcon: { alignItems: 'center', justifyContent: 'center' },
  cropButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.md, minHeight: 34, borderRadius: radius.pill },
  remove: { padding: space.sm },
  onlyMe: { marginBottom: space.lg },
  ocr: { gap: space.sm, marginBottom: space.lg },
  ocrFound: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  twin: { gap: space.sm, marginBottom: space.xl },
  twinHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', minHeight: 36 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
  clash: { marginTop: -space.sm, marginBottom: space.lg },
  labelScroller: { marginHorizontal: -space.xl, marginBottom: space.md },
  labelRow: { gap: space.sm, paddingHorizontal: space.xl },
  pickScroller: { marginHorizontal: -space.xl },
  pickLine: { gap: space.sm, paddingHorizontal: space.xl, alignItems: 'center' },
  vehicleChip: { gap: 6, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1.2, minWidth: 120 },
  accountChip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1.2 },
});
