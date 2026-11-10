import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Card, Screen } from '@/components/Layout';
import { ValueRow } from '@/components/Secret';
import { T } from '@/components/Text';
import { canSee, displayName, familyRow } from '@/domain/access';
import { ageFrom } from '@/domain/dates';
import { useCtx } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const HEALTH_TEMPLATES = ['health-insurance-card', 'family-floater', 'cghs-echs-card', 'ayushman-card'];

/** What a hospital asks first: blood group, allergies, medicines, the insurance policy and its number. */
export default function Emergency() {
  const { member: memberParam } = useLocalSearchParams<{ member?: string }>();
  const ctx = useCtx();
  const { palette } = useTheme();
  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  const people = familyRow(family).filter((m) => !m.isPet && m.status !== 'memorial' && (!memberParam || m.id === memberParam));
  const policies = family.documents.filter((d) => HEALTH_TEMPLATES.includes(d.templateId) && canSee(family, viewerId, d));

  return (
    <Screen title="Emergency cards" subtitle="Show this at the hospital desk" testID="emergency">
      {people.map((m) => {
        const age = ageFrom(m.dob);
        const own = policies.filter((p) => p.ownerId === m.id || !p.ownerId);
        const e = m.emergency ?? {};
        const empty = !m.bloodGroup && !e.allergies && !e.conditions && !e.medicines && !e.doctor && !e.contacts;
        return (
          <Card key={m.id} style={[styles.card, { borderLeftColor: palette.sindoor }]}>
            <View style={styles.head}>
              <Avatar member={m} size={44} />
              <View style={styles.flex}>
                <T variant="heading">{m.fullName}</T>
                <T variant="small" color="ink2">{[age ? `${age.years} yrs` : null, m.bloodGroup ? `Blood group ${m.bloodGroup}` : null].filter(Boolean).join(' · ')}</T>
              </View>
            </View>
            {empty ? (
              <T variant="small" color="ink2">Nothing added yet for {displayName(m)}.</T>
            ) : (
              <>
                <Line label="Allergies" value={e.allergies} warn />
                <Line label="Conditions" value={e.conditions} />
                <Line label="Medicines" value={e.medicines} />
                <Line label="Doctor" value={e.doctor} />
                <Line label="Emergency contacts" value={e.contacts} />
              </>
            )}
            {own.map((p) => <ValueRow key={p.id} label={p.title} value={p.number} />)}
            <Button label={empty ? 'Add details' : 'Edit'} variant="ghost" size="md" full={false} onPress={() => router.push(`/member/${m.id}`)} />
          </Card>
        );
      })}
      <T variant="small" color="ink3">A printable wallet card comes with the full app.</T>
    </Screen>
  );
}

function Line({ label, value, warn }: { label: string; value?: string; warn?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.line}>
      <T variant="label" color={warn ? 'sindoor' : 'ink2'}>{label}</T>
      <T variant="bodyStrong">{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginBottom: space.lg, borderLeftWidth: 4, gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  line: { paddingVertical: 4, gap: 1 },
});
