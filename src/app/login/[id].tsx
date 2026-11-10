import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Segmented, TextField } from '@/components/Fields';
import { DeleteItem, NotFound, OnlyMeToggle, OwnerPicker, ownerName } from '@/components/ItemBits';
import { Card, Screen } from '@/components/Layout';
import { ValueRow } from '@/components/Secret';
import { T } from '@/components/Text';
import { canSee } from '@/domain/access';
import type { LoginItem } from '@/domain/types';
import { checkRequiredText } from '@/domain/validation';
import { shareText } from '@/lib/device';
import { ensureReauth } from '@/lib/reauth';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

/** A strong, readable password: three words and a number, like "neem-chai-patang-42". */
const WORDS = ['neem', 'chai', 'patang', 'aam', 'gulab', 'lassi', 'tabla', 'diya', 'kesar', 'sitar', 'mitti', 'jhola', 'kulfi', 'pakora', 'barfi', 'tulsi', 'imli', 'lattu', 'chakki', 'sawan'];
function generatePassword(): string {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${pick()}-${pick()}-${pick()}-${10 + Math.floor(Math.random() * 90)}`;
}

export default function Login() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const saveLogin = useApp((s) => s.saveLogin);
  const existing = ctx && id !== 'new' ? ctx.family.logins.find((l) => l.id === id) : undefined;
  const [editing, setEditing] = useState(id === 'new');
  const [kind, setKind] = useState<LoginItem['kind']>(existing?.kind ?? 'login');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [username, setUsername] = useState(existing?.username ?? '');
  const [password, setPassword] = useState(existing?.password ?? '');
  const [website, setWebsite] = useState(existing?.website ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [ownerId, setOwnerId] = useState<string | undefined>(existing ? existing.ownerId : ctx?.viewerId);
  const [onlyMe, setOnlyMe] = useState(existing?.onlyMe ?? false);
  const [tried, setTried] = useState(false);

  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  if (id !== 'new' && (!existing || existing.deletedAt || !canSee(family, viewerId, existing))) {
    return <Screen title="Login"><NotFound /></Screen>;
  }

  if (!editing && existing) {
    const shareWifi = async () => {
      if (!(await ensureReauth('Share the Wi-Fi password'))) return;
      await shareText(`Wi-Fi: ${existing.username ?? existing.title}\nPassword: ${existing.password ?? ''}`, existing.title);
    };
    return (
      <Screen
        title={existing.title}
        subtitle={ownerName(family, viewerId, existing.ownerId)}
        right={<Pressable onPress={() => setEditing(true)} accessibilityRole="button" hitSlop={8}><T variant="smallStrong" color="accent">Edit</T></Pressable>}
        testID="login-view"
      >
        {existing.onlyMe ? <View style={styles.stamp}><Stamp text="Only me" /></View> : null}
        <Card>
          <ValueRow label={existing.kind === 'wifi' ? 'Network name' : 'Username'} value={existing.username} />
          <ValueRow label="Password" value={existing.password} secret testID="login-password" />
          <ValueRow label="Website or app" value={existing.website} />
          {existing.notes ? <View style={styles.notes}><T variant="label" color="ink2">Notes</T><T variant="body">{existing.notes}</T></View> : null}
        </Card>
        {existing.kind === 'wifi' ? (
          <View style={styles.gap}>
            <Button label="Share with a guest" icon="Share2" variant="secondary" onPress={shareWifi} />
            <T variant="small" color="ink3">A QR code guests can scan comes with the full app.</T>
          </View>
        ) : null}
        <DeleteItem collection="logins" id={existing.id} title={existing.title} />
      </Screen>
    );
  }

  const titleCheck = checkRequiredText(title, 'Name', 60);
  const save = () => {
    setTried(true);
    if (titleCheck.level === 'error') return;
    const saved = saveLogin({
      id: existing?.id, kind, title: title.trim(), username: username.trim() || undefined, password: password || undefined,
      website: website.trim() || undefined, notes: notes.trim() || undefined, ownerId, onlyMe: ownerId === viewerId ? onlyMe : false,
    });
    toast('Saved in the locker', { tone: 'success' });
    if (existing) setEditing(false);
    else router.replace(`/login/${saved}`);
  };

  return (
    <Screen title={existing ? 'Edit login' : 'New password'} footer={<Button label="Save" onPress={save} testID="login-save" />} testID="login-edit">
      <Segmented<LoginItem['kind']> value={kind} onChange={setKind} options={[{ value: 'login', label: 'Website or app' }, { value: 'wifi', label: 'Wi-Fi' }]} testID="login-kind" />
      <View style={styles.gap} />
      <TextField label="Name" value={title} onChangeText={setTitle} placeholder={kind === 'wifi' ? 'Home Wi-Fi' : 'Netflix, IRCTC, Income Tax'} required check={titleCheck} showCheck={tried} testID="login-title" />
      <TextField label={kind === 'wifi' ? 'Network name' : 'Username or email'} value={username} onChangeText={setUsername} autoCapitalize="none" testID="login-username" />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        testID="login-password-input"
        right={<Pressable onPress={() => setPassword(generatePassword())} accessibilityRole="button" accessibilityLabel="Suggest a password" hitSlop={8}><T variant="smallStrong" color="accent">Suggest</T></Pressable>}
      />
      {kind === 'login' ? <TextField label="Website or app" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" /> : null}
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline max={300} />
      <OwnerPicker family={family} value={ownerId} onChange={setOwnerId} allowFamily title="Who uses it?" />
      <OnlyMeToggle visible={ownerId === viewerId} value={onlyMe} onChange={setOnlyMe} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stamp: { marginBottom: space.md },
  notes: { paddingTop: space.md, gap: 2 },
  gap: { marginTop: space.lg, gap: space.sm },
});
