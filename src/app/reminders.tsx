import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Stamp } from '@/components/Bits';
import { Card, EmptyState, Row, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { displayName, findMember } from '@/domain/access';
import { formatDateTime, relativeDays } from '@/domain/dates';
import { attentionFor, plannedNotifications } from '@/domain/reminders';
import { attentionHref, stampFor } from '@/lib/attention';
import { useCtx } from '@/store/hooks';
import { space } from '@/theme/tokens';

/** Everything you will be reminded about, and when the next reminders go out. */
export default function Reminders() {
  const ctx = useCtx();
  const data = useMemo(() => (ctx ? { now: attentionFor(ctx.family, ctx.viewerId), planned: plannedNotifications(ctx.family, ctx.viewerId).slice(0, 12) } : null), [ctx]);
  if (!ctx || !data) return <Redirect href="/" />;

  return (
    <Screen title="Reminders" subtitle="Calm, specific and rare" testID="reminders">
      <Section title="Needs attention">
        {data.now.length ? (
          <Card padded={false}>
            {data.now.map((a, i) => {
              const stamp = stampFor(a);
              const owner = a.ownerId ? findMember(ctx.family, a.ownerId) : undefined;
              return (
                <Row
                  key={a.key}
                  title={a.title}
                  subtitle={[owner ? displayName(owner) : null, a.daysLeft < 0 ? relativeDays(a.daysLeft) : `due ${relativeDays(a.daysLeft)}`].filter(Boolean).join(' · ')}
                  icon={a.kind === 'task' ? 'ListTodo' : a.kind === 'doc' ? 'CalendarClock' : 'CreditCard'}
                  tint={stamp.tone === 'sindoor' ? 'sindoor' : stamp.tone === 'haldi' ? 'haldi' : 'stamp'}
                  divider={i > 0}
                  chevron={false}
                  right={<Stamp text={stamp.text} tone={stamp.tone} />}
                  onPress={() => router.push(attentionHref(a))}
                />
              );
            })}
          </Card>
        ) : (
          <EmptyState icon="CircleCheck" title="All clear" line="Nothing expiring or due soon." />
        )}
      </Section>
      <Section title="Coming up on this phone">
        <Card padded={false}>
          {data.planned.length ? (
            data.planned.map((p, i) => (
              <Row key={p.key} title={p.title} subtitle={formatDateTime(p.at)} icon="Bell" tint="haldi" divider={i > 0} chevron={false} />
            ))
          ) : (
            <T variant="small" color="ink2" style={styles.pad}>No reminders scheduled.</T>
          )}
        </Card>
        <T variant="small" color="ink3">Quiet hours 10 pm to 8 am. In this prototype these show here; phone notifications arrive with the full app.</T>
      </Section>
      <Row title="Choose what you are reminded about" icon="Settings" onPress={() => router.push('/settings/reminders')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg },
});
