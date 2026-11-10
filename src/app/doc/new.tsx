import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, IconTile } from '@/components/Bits';
import { Button } from '@/components/Button';
import { DocThumb } from '@/components/DocThumb';
import { DateField, TextField, ToggleRow } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Card, Row, Screen, Section } from '@/components/Layout';
import { FAMILY, MemberPicker } from '@/components/MemberPicker';
import { T } from '@/components/Text';
import { displayName, findMember, visibleTo } from '@/domain/access';
import { readiness } from '@/domain/family-rules';
import { searchEntries, templateEntries } from '@/domain/search';
import {
  CATEGORIES, CUSTOM_TEMPLATE, getCategory, getTemplate, nameInSentence, scopeOfTemplate, TEMPLATES, templatesIn, type CategoryId, type Template,
} from '@/domain/templates';
import type { FileRef } from '@/domain/types';
import {
  checkAadhaar, checkDocDescription, checkDocTitle, checkDrivingLicence, checkFile, checkIfsc, checkPan, checkPassport,
  checkVoterId, compactUpper, digitsOnly, fileKindOf, formatBytes, LIMITS, OK, type Check,
} from '@/domain/validation';
import { extractFromText, suggestFor, type Suggestion } from '@/domain/extract';
import { formatDate } from '@/domain/dates';
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

const MAX_FILES = 4;

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

/** Step one: "What are you adding?" Gaps first, then search, then every category. */
function TemplatePicker({ onPick, initialCategory, ownerId }: { onPick: (t: Template) => void; initialCategory?: CategoryId; ownerId?: string }) {
  const ctx = useCtx();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId>(initialCategory ?? 'identity');
  const entries = useMemo(() => templateEntries(TEMPLATES), []);
  const results = query.trim() ? searchEntries(query, entries, 12) : [];
  const gaps = useMemo(() => {
    if (!ctx) return [];
    return readiness(ctx.family, ctx.viewerId).items.filter((i) => !i.done && !i.hidden && (!ownerId || i.memberId === ownerId || !i.memberId)).slice(0, 4);
  }, [ctx, ownerId]);
  if (!ctx) return null;

  return (
    <View>
      <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Aadhaar, RC, marksheet, bima…" autoCapitalize="none" testID="template-search" />
      {query.trim() ? (
        <Card padded={false}>
          {results.length ? (
            results.map((r, i) => {
              const t = getTemplate(r.id);
              return <Row key={r.id} testID={`template-${r.id}`} title={t.name} subtitle={getCategory(t.category).name} icon={t.icon} tint={getCategory(t.category).tint} divider={i > 0} onPress={() => onPick(t)} />;
            })
          ) : (
            <Row title="Something else" subtitle={`Save “${query.trim()}” with a title and a file`} icon="FileText" onPress={() => onPick(CUSTOM_TEMPLATE)} />
          )}
        </Card>
      ) : (
        <>
          {gaps.length ? (
            <Section title="Missing, worth adding">
              <Card padded={false}>
                {gaps.map((g, i) => {
                  const t = getTemplate(g.templateId);
                  const who = g.memberId ? findMember(ctx.family, g.memberId) : undefined;
                  return (
                    <Row
                      key={g.key}
                      title={who ? `${who.id === ctx.viewerId ? 'Your' : `${displayName(who)}’s`} ${g.label}` : g.label}
                      icon={t.icon}
                      tint={getCategory(t.category).tint}
                      divider={i > 0}
                      onPress={() => onPick(t)}
                    />
                  );
                })}
              </Card>
            </Section>
          ) : null}
          <Section title="Browse">
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <Chip key={c.id} label={c.name} icon={c.icon} selected={c.id === category} onPress={() => setCategory(c.id)} testID={`cat-${c.id}`} />
              ))}
            </View>
            <Card padded={false} style={styles.browse}>
              {templatesIn(category).map((t, i) => (
                <Row key={t.id} testID={`template-${t.id}`} title={t.name} icon={t.icon} tint={getCategory(t.category).tint} divider={i > 0} onPress={() => onPick(t)} />
              ))}
            </Card>
          </Section>
          <Button label="Something else" variant="secondary" icon="Plus" onPress={() => onPick(CUSTOM_TEMPLATE)} testID="template-custom" />
        </>
      )}
    </View>
  );
}

function FileTile({ slot, onRemove, label }: { slot: Slot; onRemove: () => void; label: string }) {
  const { palette } = useTheme();
  const name = slot.kind === 'saved' ? slot.ref.name : slot.picked.name;
  const size = slot.kind === 'saved' ? slot.ref.size : slot.picked.size;
  const isImage = slot.kind === 'new' && fileKindOf(slot.picked.name, slot.picked.mime) === 'image';
  return (
    <View style={[styles.fileTile, { borderColor: palette.line, backgroundColor: palette.surface }]}>
      {isImage && slot.kind === 'new' ? (
        <Image source={{ uri: slot.picked.uri }} style={styles.fileImage} contentFit="cover" />
      ) : slot.kind === 'saved' ? (
        <DocThumb templateId="custom" file={slot.ref} width={56} />
      ) : (
        <View style={[styles.fileImage, styles.fileIcon, { backgroundColor: palette.surfaceAlt }]}>
          <Icon name="FileText" size={24} color="ink2" />
        </View>
      )}
      <View style={styles.flex}>
        <T variant="smallStrong" numberOfLines={1}>{label}</T>
        <T variant="small" color="ink2" numberOfLines={1}>{name}{size ? ` · ${formatBytes(size)}` : ''}</T>
      </View>
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${label}`} hitSlop={10} style={styles.remove}>
        <Icon name="X" size={20} color="ink2" />
      </Pressable>
    </View>
  );
}

export default function AddDocument() {
  const params = useLocalSearchParams<{ template?: string; owner?: string; category?: string; id?: string; renew?: string }>();
  const ctx = useCtx();
  const saveDocument = useApp((s) => s.saveDocument);
  const existing = ctx && params.id ? ctx.family.documents.find((d) => d.id === params.id) : undefined;
  const renew = params.renew === '1';

  const [template, setTemplate] = useState<Template | undefined>(
    existing ? getTemplate(existing.templateId) : params.template ? getTemplate(params.template) : undefined,
  );
  const [ownerId, setOwnerId] = useState<string>(existing ? existing.ownerId ?? FAMILY : params.owner ?? ctx?.viewerId ?? FAMILY);
  const [slots, setSlots] = useState<Slot[]>(existing && !renew ? existing.files.map((ref) => ({ kind: 'saved' as const, ref })) : []);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [titleEdited, setTitleEdited] = useState(!!existing);
  const [number, setNumber] = useState(existing?.number ?? (template?.profileId && params.owner && ctx ? findMember(ctx.family, params.owner)?.ids[template.profileId] ?? '' : ''));
  const [issueDate, setIssueDate] = useState<string | undefined>(renew ? undefined : existing?.issueDate);
  const [expiryDate, setExpiryDate] = useState<string | undefined>(renew ? undefined : existing?.expiryDate);
  const [original, setOriginal] = useState(existing?.original ?? '');
  const [nominee, setNominee] = useState(existing?.nominee ?? '');
  const [ocr, setOcr] = useState<{ state: 'idle' | 'reading' | 'done' | 'failed'; suggestion?: Suggestion }>({ state: 'idle' });
  const [dateKey, setDateKey] = useState(0);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [onlyMe, setOnlyMe] = useState(existing?.onlyMe ?? false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string>();

  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  const members = family.members.filter((m) => m.status !== 'memorial');

  if (!template) {
    return (
      <Screen title="What are you adding?" testID="doc-new-pick">
        <TemplatePicker
          initialCategory={params.category as CategoryId | undefined}
          ownerId={params.owner}
          onPick={(t) => {
            setTemplate(t);
            if (scopeOfTemplate(t) === 'common') setOwnerId(FAMILY);
            else if (ownerId === FAMILY) setOwnerId(params.owner ?? viewerId);
          }}
        />
      </Screen>
    );
  }

  const common = template.id !== 'custom' && scopeOfTemplate(template) === 'common';
  const effectiveOwner = common || ownerId === FAMILY ? undefined : ownerId;
  const owner = effectiveOwner ? findMember(family, effectiveOwner) : undefined;
  const suggestedTitle = owner
    ? `${owner.id === viewerId ? 'My' : `${displayName(owner)}’s`} ${template.id === 'custom' ? 'document' : nameInSentence(template.name)}`.slice(0, LIMITS.docTitle)
    : template.id === 'custom' ? '' : template.name.slice(0, LIMITS.docTitle);
  const shownTitle = titleEdited ? title : suggestedTitle;

  const checks = {
    title: checkDocTitle(shownTitle),
    description: checkDocDescription(description),
    number: numberCheck(template, number),
    files: slots.length ? OK : ({ level: 'error', message: 'Add a photo or file of the document' } as Check),
  };
  const duplicate = number && template.profileId
    ? visibleTo(family, viewerId, family.documents).find((d) => d.id !== existing?.id && d.templateId === template.id && d.ownerId === effectiveOwner && compactUpper(digitsOnly(d.number ?? '') || (d.number ?? '')) === compactUpper(digitsOnly(number) || number))
    : undefined;

  const firstImage = slots.find((sl) => (sl.kind === 'new' ? fileKindOf(sl.picked.name, sl.picked.mime) === 'image' : sl.ref.kind === 'image'));
  const readPhoto = async () => {
    if (!firstImage) return;
    setOcr({ state: 'reading' });
    try {
      const uri = firstImage.kind === 'new' ? firstImage.picked.uri : await fileUrl(firstImage.ref.id, firstImage.ref.name);
      const result = uri ? await recognize(uri) : null;
      if (!result) return setOcr({ state: 'failed' });
      setOcr({ state: 'done', suggestion: suggestFor(template.number?.kind, extractFromText(result.text), !!template.expiry) });
    } catch {
      setOcr({ state: 'failed' });
    }
  };

  const addFile = async (pick: () => Promise<PickResult>) => {
    setFileError(undefined);
    if (slots.length >= MAX_FILES) return setFileError(`Up to ${MAX_FILES} pages or sides for now`);
    try {
      const result = await pick();
      if (!result) return;
      if ('denied' in result) return setFileError('Camera permission is off. Turn it on in phone settings, or pick a photo instead.');
      const check = checkFile({ name: result.file.name, size: result.file.size, mime: result.file.mime });
      if (check.level === 'error') return setFileError(check.message);
      setSlots((s) => [...s, { kind: 'new', id: newId(), picked: result.file }]);
    } catch {
      setFileError('Could not open that file. Try another, or a photo of it.');
    }
  };

  const save = async () => {
    setTried(true);
    if (checks.files.level === 'error') setFileError(undefined);
    if ([checks.title, checks.description, checks.files].some((c) => c.level === 'error')) return;
    setSaving(true);
    try {
      const files: FileRef[] = [];
      for (const slot of slots) {
        if (slot.kind === 'saved') files.push(slot.ref);
        else {
          await saveFile(slot.id, slot.picked);
          const kind = fileKindOf(slot.picked.name, slot.picked.mime) ?? 'doc';
          files.push({ id: slot.id, name: slot.picked.name, mime: slot.picked.mime ?? 'application/octet-stream', size: slot.picked.size ?? 0, kind });
        }
      }
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
        files,
      });
      toast(existing ? (renew ? 'Renewed. The reminder starts again.' : 'Saved') : 'Saved. Safe in the almari.', { tone: 'success' });
      router.replace(`/doc/${id}`);
    } catch {
      toast('Could not save the file. Is the phone out of space?', { tone: 'warn' });
    } finally {
      setSaving(false);
    }
  };

  const sideLabel = (i: number) => (template.sides === 2 ? (i === 0 ? 'Front' : i === 1 ? 'Back' : `Page ${i + 1}`) : slots.length > 1 ? `Page ${i + 1}` : 'File');
  const category = getCategory(template.category);

  return (
    <Screen
      title={renew ? `Renewed ${existing?.title ?? template.name}` : existing ? 'Edit document' : template.name}
      subtitle={category.id === 'other' ? 'Something else' : category.name}
      footer={<Button label={renew ? 'Save the renewed copy' : 'Save'} onPress={save} loading={saving} testID="doc-save" />}
      testID="doc-new"
    >
      {!existing ? (
        <Pressable onPress={() => setTemplate(undefined)} accessibilityRole="button" style={styles.change}>
          <IconTile icon={template.icon} tint={category.tint} size={36} />
          <T variant="smallStrong" color="accent">Change what you are adding</T>
        </Pressable>
      ) : null}

      <Section title="For whom">
        {common ? (
          <Card style={styles.commonNote}>
            <Icon name="Users" size={20} color="inland" />
            <T variant="small" color="ink2" style={styles.flex}>Family papers. Everyone in {family.name} can see them.</T>
          </Card>
        ) : (
          <MemberPicker members={members} value={[ownerId]} onChange={(v) => setOwnerId(v[0] ?? viewerId)} allowFamily={template.id === 'custom'} testID="owner" />
        )}
      </Section>

      <Section title={template.sides === 2 ? 'Photo of the front, then the back' : 'Photo or file'}>
        {slots.map((slot, i) => (
          <FileTile key={slot.kind === 'saved' ? slot.ref.id : slot.id} slot={slot} label={sideLabel(i)} onRemove={() => setSlots((s) => s.filter((_, j) => j !== i))} />
        ))}
        {slots.length < MAX_FILES ? (
          <View style={styles.pickRow}>
            <View style={styles.flex}><Button label="Camera" icon="Camera" variant="secondary" size="md" onPress={() => addFile(pickFromCamera)} testID="pick-camera" /></View>
            <View style={styles.flex}><Button label="Photos" icon="Image" variant="secondary" size="md" onPress={() => addFile(pickFromPhotos)} testID="pick-photos" /></View>
            <View style={styles.flex}><Button label="Files" icon="Folder" variant="secondary" size="md" onPress={() => addFile(pickFromFiles)} testID="pick-files" /></View>
          </View>
        ) : null}
        {fileError ? <T variant="small" color="sindoor">{fileError}</T> : tried && checks.files.level === 'error' ? <T variant="small" color="sindoor">{checks.files.message}</T> : (
          <T variant="small" color="ink3">Photos, PDF, Word, Excel. Up to 10 MB each. Shared from WhatsApp or DigiLocker works too.</T>
        )}
      </Section>

      {(template.number || template.expiry) && firstImage ? (
        <Card style={styles.ocr}>
          {OCR_AVAILABLE ? (
            <>
              <Button
                label={ocr.state === 'reading' ? 'Reading the photo…' : 'Read the number from the photo'}
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
                    <Chip testID="ocr-use-number" icon="Check" label={`Use ${ocr.suggestion.number}`} onPress={() => setNumber(ocr.suggestion?.number ?? '')} />
                  ) : null}
                  {ocr.suggestion.expiryDate && template.expiry ? (
                    <Chip testID="ocr-use-expiry" icon="Check" label={`${template.expiry.label} ${formatDate(ocr.suggestion.expiryDate)}`} onPress={() => { setExpiryDate(ocr.suggestion?.expiryDate); setDateKey((k) => k + 1); }} />
                  ) : null}
                  {ocr.suggestion.issueDate && template.issueDate ? (
                    <Chip icon="Check" label={`Issued ${formatDate(ocr.suggestion.issueDate)}`} onPress={() => { setIssueDate(ocr.suggestion?.issueDate); setDateKey((k) => k + 1); }} />
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
      {template.number ? (
        <TextField
          label={template.number.label}
          value={number}
          onChangeText={setNumber}
          keyboardType={template.number.kind === 'aadhaar' ? 'number-pad' : undefined}
          autoCapitalize={template.number.kind && template.number.kind !== 'aadhaar' ? 'characters' : 'none'}
          check={duplicate ? { level: 'warn', message: `Already saved as ${duplicate.title}` } : checks.number}
          helper={template.profileId ? `Also fills ${owner && owner.id !== viewerId ? `${displayName(owner)}’s` : 'your'} profile` : undefined}
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

      <Section title="Where is the original kept?">
        <View style={styles.chips}>
          {ORIGINAL_PLACES.map((p) => (
            <Chip key={p} label={p} selected={original === p} onPress={() => setOriginal(original === p ? '' : p)} />
          ))}
        </View>
        <TextField label="Or describe it" value={original} onChangeText={setOriginal} placeholder="Steel almari, top shelf, red file" max={80} testID="doc-original" />
      </Section>

      <TextField label="Description" value={description} onChangeText={setDescription} max={LIMITS.docDescription} multiline check={checks.description} showCheck={tried} placeholder="Optional" testID="doc-description" />

      {effectiveOwner === viewerId ? (
        <Card style={styles.onlyMe}>
          <ToggleRow title="Only me" subtitle="Nobody else in the family sees this, whatever the family setting." value={onlyMe} onValueChange={setOnlyMe} testID="doc-only-me" />
        </Card>
      ) : null}
      {renew ? <T variant="small" color="ink2">The renewed copy replaces the old one on this card. (Keeping the old one in history comes with the full app.)</T> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  browse: { marginTop: space.md },
  change: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xl },
  commonNote: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pickRow: { flexDirection: 'row', gap: space.sm },
  fileTile: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  fileImage: { width: 56, height: 56, borderRadius: radius.sm },
  fileIcon: { alignItems: 'center', justifyContent: 'center' },
  remove: { padding: space.sm },
  onlyMe: { marginBottom: space.lg },
  ocr: { gap: space.sm, marginBottom: space.lg },
  ocrFound: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
