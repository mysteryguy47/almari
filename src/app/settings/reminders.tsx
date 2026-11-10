import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconTile } from '@/components/Bits';
import { ToggleRow } from '@/components/Fields';
import { Card, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { prefsFor } from '@/domain/reminders';
import { CATEGORIES } from '@/domain/templates';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/**
 * Everyone is reminded about everything they can see, by default. Here each
 * person opts out, for themselves only. Their own papers always remind them
 * unless they mute that one paper.
 */
export default function ReminderSettings() {
  const ctx = useCtx();
  const setReminderPrefs = useApp((s) => s.setReminderPrefs);
  const { palette } = useTheme();
  if (!ctx) return <Redirect href="/" />;
  const prefs = prefsFor(ctx.family, ctx.viewerId);

  return (
    <Screen title="Reminders" subtitle="Only affects you" testID="reminder-settings">
      <Card style={styles.card}>
        <ToggleRow
          title="Family reminders"
          subtitle="Expiries of the family’s papers and other members’ papers. Your own papers always remind you."
          value={!prefs.familyMuted}
          onValueChange={(v) => setReminderPrefs({ familyMuted: !v })}
          testID="family-reminders"
        />
      </Card>
      {!prefs.familyMuted ? (
        <Section title="By category">
          <Card padded={false}>
            {CATEGORIES.map((c, i) => (
              <View key={c.id} style={[styles.row, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line } : null]}>
                <IconTile icon={c.icon} tint={c.tint} size={36} />
                <View style={styles.flex}>
                  <ToggleRow
                    title={c.name}
                    value={!prefs.mutedCategories.includes(c.id)}
                    onValueChange={(v) =>
                      setReminderPrefs({ mutedCategories: v ? prefs.mutedCategories.filter((x) => x !== c.id) : [...prefs.mutedCategories, c.id] })
                    }
                    testID={`mute-${c.id}`}
                  />
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
      <T variant="small" color="ink2">Private papers remind only their owner. Credit-card bills remind only the cardholder. Quiet hours: 10 pm to 8 am.</T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.xxl },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
});
