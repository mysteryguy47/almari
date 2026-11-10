import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Row, Screen, Section } from '@/components/Layout';
import { Icon } from '@/components/Icon';
import { T } from '@/components/Text';
import { displayName, findMember } from '@/domain/access';
import { readiness } from '@/domain/family-rules';
import { getTemplate } from '@/domain/templates';
import { useCtx } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** The essentials checklist: ID proof, photo, signature, PAN, Voter ID, health cover. */
export default function Readiness() {
  const ctx = useCtx();
  const { palette } = useTheme();
  const ready = useMemo(() => (ctx ? readiness(ctx.family, ctx.viewerId) : null), [ctx]);
  if (!ctx || !ready) return <Redirect href="/" />;
  const byPerson = new Map<string, typeof ready.items>();
  for (const item of ready.items) {
    const key = item.memberId ?? 'family';
    byPerson.set(key, [...(byPerson.get(key) ?? []), item]);
  }

  return (
    <Screen title="Readiness check" subtitle={`${ready.done} of ${ready.total} essentials saved`} testID="readiness">
      <View style={[styles.bar, { backgroundColor: palette.surfaceAlt }]}>
        <View style={[styles.fill, { width: `${Math.round((ready.done / Math.max(1, ready.total)) * 100)}%`, backgroundColor: palette.accent }]} />
      </View>
      {[...byPerson.entries()].map(([key, items]) => {
        const member = key === 'family' ? undefined : findMember(ctx.family, key);
        const hidden = items.every((i) => i.hidden);
        return (
          <Section key={key} title={member ? (member.id === ctx.viewerId ? 'You' : member.fullName) : 'The family'}>
            {hidden ? (
              <Card><T variant="small" color="ink2">{displayName(member)}’s papers are private in this family.</T></Card>
            ) : (
              <Card padded={false}>
                {items.map((i, n) => (
                  <Row
                    key={i.key}
                    title={i.label}
                    icon={getTemplate(i.templateId).icon}
                    tint={i.done ? 'almari' : 'haldi'}
                    divider={n > 0}
                    chevron={!i.done}
                    right={i.done ? <Icon name="CircleCheck" size={22} color="accent" /> : undefined}
                    onPress={i.done ? undefined : () => router.push({ pathname: '/doc/new', params: { template: i.templateId, ...(i.memberId ? { owner: i.memberId } : {}) } })}
                  />
                ))}
              </Card>
            )}
          </Section>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: space.xxl },
  fill: { height: 10, borderRadius: 5 },
});
