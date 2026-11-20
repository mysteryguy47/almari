/**
 * Several passwords under one login, and several logins under one account.
 * SBI net banking has one user ID with a login, a profile and a transaction
 * password; the bank's app has its own MPIN. Each is one tap to add.
 */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { CREDENTIAL_LABELS, SECRET_LABELS } from '@/domain/money';
import type { Credential, SecretEntry } from '@/domain/types';
import { haptic } from '@/lib/device';
import { newId } from '@/store/secrets';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { Chip } from './Bits';
import { TextField } from './Fields';
import { Icon } from './Icon';
import { Card, Section } from './Layout';
import { ValueRow } from './Secret';
import { T } from './Text';

const OTHER = 'Other';

/** Quick chips for the passwords not yet added, then "Other" for anything else. */
function AddSecret({ used, presets, onAdd, testID }: { used: string[]; presets: readonly string[]; onAdd: (label: string) => void; testID?: string }) {
  const left = presets.filter((p) => !used.includes(p));
  return (
    <View style={styles.addRow}>
      <T variant="small" color="ink3">Add</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.addChips}>
        {left.map((p) => <Chip key={p} label={p} icon="Plus" onPress={() => onAdd(p)} testID={testID ? `${testID}-${p}` : undefined} />)}
        <Chip label={OTHER} icon="Plus" onPress={() => onAdd('')} testID={testID ? `${testID}-other` : undefined} />
      </ScrollView>
    </View>
  );
}

/** The passwords of one login, each with its own label. */
export function SecretsEditor({
  secrets, onChange, presets = SECRET_LABELS, testID,
}: { secrets: SecretEntry[]; onChange: (next: SecretEntry[]) => void; presets?: readonly string[]; testID?: string }) {
  const { palette } = useTheme();
  const update = (id: string, patch: Partial<SecretEntry>) => onChange(secrets.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <View>
      {secrets.map((s, i) => {
        const custom = !presets.includes(s.label as (typeof presets)[number]);
        return (
          <Animated.View key={s.id} entering={FadeIn.duration(160)} layout={LinearTransition.duration(180)}>
            {custom ? (
              <TextField label="What is this password for?" value={s.label} onChangeText={(v) => update(s.id, { label: v })} placeholder="Locker PIN, grid card, security answer" max={40} testID={testID ? `${testID}-label-${i}` : undefined} />
            ) : null}
            <TextField
              label={s.label || 'Password'}
              value={s.value}
              onChangeText={(v) => update(s.id, { value: v })}
              secure
              testID={testID ? `${testID}-value-${i}` : undefined}
              right={
                <Pressable
                  onPress={() => {
                    haptic.tap();
                    onChange(secrets.filter((x) => x.id !== s.id));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${s.label || 'password'}`}
                  hitSlop={8}
                  style={[styles.remove, { backgroundColor: palette.surfaceAlt }]}
                >
                  <Icon name="X" size={14} color="ink2" />
                </Pressable>
              }
            />
          </Animated.View>
        );
      })}
      <AddSecret used={secrets.map((s) => s.label)} presets={presets} testID={testID ? `${testID}-add` : undefined} onAdd={(label) => {
        haptic.tap();
        onChange([...secrets, { id: newId(), label, value: '' }]);
      }} />
    </View>
  );
}

/** A blank login to start from, so the first one needs no extra tap. */
export function blankCredential(label: string = CREDENTIAL_LABELS[0]): Credential {
  return { id: newId(), label, username: '', secrets: [{ id: newId(), label: label === 'Mobile app' ? 'MPIN' : 'Login password', value: '' }] };
}

/** Every login of a bank account: a user ID and its passwords, and another login when there is one. */
export function CredentialsEditor({ value, onChange, testID = 'cred' }: { value: Credential[]; onChange: (next: Credential[]) => void; testID?: string }) {
  const { palette } = useTheme();
  const update = (id: string, patch: Partial<Credential>) => onChange(value.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const nextLabel = CREDENTIAL_LABELS.find((l) => !value.some((c) => c.label === l)) ?? 'Another login';
  return (
    <View>
      {value.map((c, i) => (
        <Animated.View key={c.id} entering={FadeIn.duration(180)} layout={LinearTransition.duration(200)} style={[styles.cred, { borderColor: palette.line, backgroundColor: palette.bg }]}>
          <View style={styles.credHead}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.kinds}>
              {CREDENTIAL_LABELS.map((l) => (
                <Pressable
                  key={l}
                  onPress={() => update(c.id, { label: l })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: c.label === l }}
                  style={[styles.kind, c.label === l ? { backgroundColor: palette.accent } : { backgroundColor: palette.surfaceAlt }]}
                  testID={`${testID}-${i}-kind-${l}`}
                >
                  <T variant="smallStrong" color={c.label === l ? 'onAccent' : 'ink2'}>{l}</T>
                </Pressable>
              ))}
            </ScrollView>
            {value.length > 1 || c.username || c.secrets.some((s) => s.value) ? (
              <Pressable
                onPress={() => {
                  haptic.tap();
                  onChange(value.filter((x) => x.id !== c.id));
                }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${c.label}`}
                hitSlop={8}
                style={[styles.remove, { backgroundColor: palette.surfaceAlt }]}
                testID={`${testID}-${i}-remove`}
              >
                <Icon name="Trash" size={14} color="ink2" />
              </Pressable>
            ) : null}
          </View>
          <TextField label="User ID" value={c.username ?? ''} onChangeText={(v) => update(c.id, { username: v })} autoCapitalize="none" testID={`${testID}-${i}-user`} />
          <SecretsEditor secrets={c.secrets} onChange={(secrets) => update(c.id, { secrets })} testID={`${testID}-${i}-secret`} />
        </Animated.View>
      ))}
      <Pressable
        onPress={() => {
          haptic.tap();
          onChange([...value, blankCredential(nextLabel)]);
        }}
        accessibilityRole="button"
        style={[styles.another, { borderColor: palette.line }]}
        testID={`${testID}-another`}
      >
        <Icon name="Plus" size={18} color="accent" />
        <T variant="smallStrong" color="accent">{value.length ? 'Another login for this account' : 'Add net banking or app login'}</T>
      </Pressable>
    </View>
  );
}

/** The logins, as the account screen shows them: everything hidden until the fingerprint or PIN. */
export function CredentialsView({ credentials, guard }: { credentials: Credential[]; guard: string }) {
  if (!credentials.length) return null;
  return (
    <>
      {credentials.map((c) => (
        <Section key={c.id} title={c.label} style={styles.viewSection}>
          <Card>
            <ValueRow label="User ID" value={c.username} secret guard={guard} testID={`cred-user-${c.id}`} />
            {c.secrets.map((s) => (
              <ValueRow key={s.id} label={s.label} value={s.value} secret guard={guard} testID={`cred-secret-${s.id}`} />
            ))}
          </Card>
        </Section>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  cred: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.md, paddingBottom: space.xs, marginBottom: space.md },
  credHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  kinds: { gap: 6 },
  kind: { paddingHorizontal: space.md, minHeight: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  remove: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: space.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: -space.sm, marginBottom: space.md },
  addChips: { gap: space.sm, paddingRight: space.lg },
  another: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', marginBottom: space.lg },
  viewSection: { marginTop: space.lg, marginBottom: 0 },
});
