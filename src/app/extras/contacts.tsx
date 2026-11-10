import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, Row, Screen } from '@/components/Layout';
import { callNumber } from '@/lib/device';
import { useCtx } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** Kaam ke numbers: doctor, CA, gas agency, electrician. One tap to call. */
export default function Contacts() {
  const ctx = useCtx();
  const { palette } = useTheme();
  if (!ctx) return <Redirect href="/" />;
  const contacts = [...ctx.family.contacts].sort((a, b) => a.role.localeCompare(b.role));

  return (
    <Screen title="Kaam ke numbers" subtitle="The diary that sat beside the landline" testID="contacts">
      {contacts.length ? (
        <Card padded={false} style={styles.list}>
          {contacts.map((c, i) => (
            <Row
              key={c.id}
              title={c.name}
              subtitle={`${c.role} · ${c.phone}`}
              icon="Phone"
              tint="haldi"
              divider={i > 0}
              chevron={false}
              onPress={() => router.push(`/contact/${c.id}`)}
              right={
                <Pressable onPress={() => callNumber(c.phone)} accessibilityRole="button" accessibilityLabel={`Call ${c.name}`} hitSlop={6} style={[styles.call, { backgroundColor: palette.accentSoft }]}>
                  <Icon name="Phone" size={20} color="accent" />
                </Pressable>
              }
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon="Phone" title="No numbers yet" line="Family doctor, CA, insurance agent, plumber, the gas agency." />
      )}
      <Button label="Add a number" icon="Plus" variant="secondary" onPress={() => router.push('/contact/new')} testID="add-contact" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { marginBottom: space.lg },
  call: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
