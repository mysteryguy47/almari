/**
 * Where a family's papers are kept: this phone and the cloud (both), the
 * cloud only, or this phone only. Each says plainly what it gives and what
 * it costs.
 */
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Stamp } from '@/components/Bits';
import { Card, Screen } from '@/components/Layout';
import { Pressy } from '@/components/Pressy';
import { Sheet } from '@/components/Sheet';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { T } from '@/components/Text';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/domain/icons';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { canKeepOnPhoneOnly, keepOnThisPhoneOnly, moveToCloud, setCloudOnly, storageOf, type StorageChoice } from '@/sync/actions';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const CHOICES: { value: StorageChoice; icon: IconName; title: string; line: string; points: string[] }[] = [
  {
    value: 'both',
    icon: 'ShieldCheck',
    title: 'This phone and the cloud',
    line: 'Recommended. Opens without internet, and nothing is lost with the phone.',
    points: ['Locked on this phone before it is saved or sent', 'Shared with your family’s phones', 'Comes back on a new phone'],
  },
  {
    value: 'cloud',
    icon: 'Cloud',
    title: 'Cloud only',
    line: 'Nothing is kept on this phone. Papers load each time, so internet is needed.',
    points: ['Good for a shared or work phone', 'Shared with your family’s phones', 'Changes made offline wait on the phone until they are sent'],
  },
  {
    value: 'local',
    icon: 'Smartphone',
    title: 'This phone only',
    line: 'Never reaches our server. Almari is an organiser on this phone.',
    points: ['Works with no account and no internet', 'Not shared with anyone else’s phone', 'If this phone is lost or reset, the papers are gone'],
  },
];

export default function Storage() {
  const ctx = useCtx();
  const cloud = useApp((s) => s.cloud);
  const familyId = ctx?.family.id ?? '';
  const current = useApp(() => (familyId ? storageOf(familyId) : 'both'));
  const { palette } = useTheme();
  const [pending, setPending] = useState<StorageChoice>();
  const [busy, setBusy] = useState(false);
  if (!ctx || ctx.family.isSample) return <Redirect href="/" />;

  const localCheck = canKeepOnPhoneOnly(familyId);

  const apply = async (choice: StorageChoice) => {
    setPending(undefined);
    setBusy(true);
    const result =
      choice === 'local' ? await keepOnThisPhoneOnly(familyId)
        : current === 'local' ? await moveToCloud(familyId).then(async (r) => (r.ok && choice === 'cloud' ? setCloudOnly(familyId, true) : r))
          : await setCloudOnly(familyId, choice === 'cloud');
    setBusy(false);
    if (!result.ok) return toast(result.error, { tone: 'warn' });
    toast(
      choice === 'local' ? `${ctx.family.name} is now on this phone only. Nothing of it is left on our server.`
        : choice === 'cloud' ? 'Cloud only. Copies have left this phone.'
          : 'Kept on this phone and in the cloud.',
      { tone: 'success' },
    );
  };

  const pick = (choice: StorageChoice) => {
    if (choice === current || busy) return;
    if (choice !== 'local' && !cloud) {
      toast('Create an account first: the cloud copy needs one.', { tone: 'info' });
      return router.push('/auth/sign-up');
    }
    if (choice === 'local' && !localCheck.ok) return toast(localCheck.reason, { tone: 'warn' });
    setPending(choice);
  };

  return (
    <Screen title="Where papers are kept" subtitle={ctx.family.name} testID="storage">
      <T variant="body" color="ink2" style={styles.lead}>
        Whichever you choose, papers are locked on this phone before they go anywhere. Even we cannot read the cloud copy.
      </T>
      {CHOICES.map((c) => {
        const on = c.value === current;
        const blocked = c.value === 'local' && !localCheck.ok;
        return (
          <Pressy
            key={c.value}
            onPress={() => pick(c.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: blocked }}
            testID={`storage-${c.value}`}
            style={[styles.choice, { backgroundColor: palette.surface, borderColor: on ? palette.accent : palette.line }, on ? { boxShadow: `0 0 0 3px ${palette.accentSoft}` } as object : null, blocked ? styles.blocked : null]}
          >
            <View style={styles.choiceHead}>
              <Icon name={c.icon} size={22} color={on ? 'accent' : 'ink2'} />
              <T variant="bodyStrong" style={styles.flex}>{c.title}</T>
              {on ? <Stamp text="In use" tone="almari" tilt={0} /> : null}
            </View>
            <T variant="small" color="ink2">{c.line}</T>
            <View style={styles.points}>
              {c.points.map((p) => (
                <View key={p} style={styles.point}>
                  <View style={[styles.dot, { backgroundColor: palette.ink3 }]} />
                  <T variant="small" color="ink2" style={styles.flex}>{p}</T>
                </View>
              ))}
            </View>
            {blocked ? <T variant="small" color="haldi">{localCheck.reason}</T> : null}
          </Pressy>
        );
      })}
      {busy ? (
        <Card style={styles.busy}>
          <ActivityIndicator color={palette.accent} />
          <T variant="small" color="ink2">Moving the papers. Keep Almari open.</T>
        </Card>
      ) : null}

      <Sheet
        visible={!!pending}
        onClose={() => setPending(undefined)}
        title={pending === 'local' ? 'Keep on this phone only?' : pending === 'cloud' ? 'Cloud only?' : 'Keep a copy on this phone too?'}
        subtitle={
          pending === 'local' ? `Every paper comes to this phone, then ${ctx.family.name} is deleted from our server. If this phone is lost or reset, it cannot be recovered.`
            : pending === 'cloud' ? 'Copies leave this phone. Papers load from the cloud each time, so they will not open without internet.'
              : current === 'local' ? 'Your papers are locked on this phone and uploaded, so they come back on a new phone and can be shared with your family.'
                : 'Papers come back to this phone, so they open without internet.'
        }
        testID="storage-confirm"
      >
        <View style={styles.sheet}>
          <SlideToConfirm label="Slide to change" tone={pending === 'local' ? 'sindoor' : 'accent'} onConfirm={() => pending && void apply(pending)} testID="slide-storage" />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lead: { marginBottom: space.lg },
  choice: { borderWidth: 1.2, borderRadius: radius.lg, padding: space.lg, gap: space.sm, marginBottom: space.md },
  choiceHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  points: { gap: 4, marginTop: 2 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 9 },
  blocked: { opacity: 0.62 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sheet: { paddingBottom: space.md },
});
