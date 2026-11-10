import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { DeleteItem, NotFound, OnlyMeToggle, OwnerPicker, ownerName } from '@/components/ItemBits';
import { Card, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { canSee } from '@/domain/access';
import { checkRequiredText } from '@/domain/validation';
import { ensureReauth } from '@/lib/reauth';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const saveNote = useApp((s) => s.saveNote);
  const n = ctx && id !== 'new' ? ctx.family.notes.find((x) => x.id === id) : undefined;
  const [editing, setEditing] = useState(id === 'new');
  const [revealed, setRevealed] = useState(false);
  const [title, setTitle] = useState(n?.title ?? '');
  const [body, setBody] = useState(n?.body ?? '');
  const [ownerId, setOwnerId] = useState<string | undefined>(n ? n.ownerId : undefined);
  const [onlyMe, setOnlyMe] = useState(n?.onlyMe ?? false);
  const [tried, setTried] = useState(false);

  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  if (id !== 'new' && (!n || n.deletedAt || !canSee(family, viewerId, n))) return <Screen title="Note"><NotFound /></Screen>;

  if (!editing && n) {
    return (
      <Screen
        title={n.title}
        subtitle={ownerName(family, viewerId, n.ownerId)}
        right={<Pressable onPress={async () => (await ensureReauth('Edit the note')) && setEditing(true)} accessibilityRole="button" hitSlop={8}><T variant="smallStrong" color="accent">Edit</T></Pressable>}
        testID="note-view"
      >
        {n.onlyMe ? <View style={styles.stamp}><Stamp text="Only me" /></View> : null}
        <Card>
          {revealed ? (
            <T variant="body" selectable>{n.body}</T>
          ) : (
            <Button label="Show the note" icon="Eye" variant="secondary" onPress={async () => setRevealed(await ensureReauth(`Read ${n.title}`))} testID="note-reveal" />
          )}
        </Card>
        <DeleteItem collection="notes" id={n.id} title={n.title} />
      </Screen>
    );
  }

  const check = checkRequiredText(title, 'Title', 60);
  const save = () => {
    setTried(true);
    if (check.level === 'error') return;
    const saved = saveNote({ id: n?.id, title: title.trim(), body, ownerId, onlyMe: ownerId === viewerId ? onlyMe : false });
    toast('Note saved', { tone: 'success' });
    if (n) setEditing(false);
    else router.replace(`/note/${saved}`);
  };

  return (
    <Screen title={n ? 'Edit note' : 'New secure note'} footer={<Button label="Save" onPress={save} testID="note-save" />} testID="note-edit">
      <TextField label="Title" value={title} onChangeText={setTitle} required check={check} showCheck={tried} placeholder="Bank locker, SIM PUK codes" testID="note-title" />
      <TextField label="Note" value={body} onChangeText={setBody} multiline max={2000} placeholder="Locker 214 at SBI. Key in Mummy’s almari, red pouch." testID="note-body" />
      <OwnerPicker family={family} value={ownerId} onChange={setOwnerId} allowFamily title="Whose is it?" />
      <OnlyMeToggle visible={ownerId === viewerId} value={onlyMe} onChange={setOnlyMe} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stamp: { marginBottom: space.md },
});
