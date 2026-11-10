import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Stamp } from '@/components/Bits';
import { Card, EmptyState, Row, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { displayName, findMember } from '@/domain/access';
import { moneyMap, type MoneyEntry } from '@/domain/money-map';
import type { ID } from '@/domain/types';
import { useCtx } from '@/store/hooks';
import { space } from '@/theme/tokens';

/** Every account, deposit, policy and investment, with its nominee. The answer to "what did Papa have?". */
export default function MoneyMap() {
  const ctx = useCtx();
  const map = useMemo(() => (ctx ? moneyMap(ctx.family, ctx.viewerId) : null), [ctx]);
  if (!ctx || !map) return <Redirect href="/" />;
  const groups = new Map<ID | 'family', MoneyEntry[]>();
  for (const e of map.entries) {
    const key = e.ownerId ?? 'family';
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  return (
    <Screen title="Money map" subtitle="Accounts, deposits, policies and their nominees" testID="money-map">
      {map.entries.length === 0 ? (
        <EmptyState icon="PiggyBank" title="Nothing here yet" line="Bank accounts, FDs, PPF, LIC, mutual funds and loans show here with their nominees." />
      ) : (
        <>
          <Card style={styles.summary}>
            <T variant="heading">{map.entries.length} accounts and policies</T>
            <T variant="body" color={map.withoutNominee ? 'haldi' : 'accent'}>
              {map.withoutNominee
                ? `${map.withoutNominee} without a nominee. Families often learn what existed only after a death; a nominee makes the claim simple.`
                : 'Every one has a nominee. Well done.'}
            </T>
          </Card>
          {[...groups.entries()].map(([owner, entries]) => (
            <Section key={owner} title={owner === 'family' ? 'Family' : owner === ctx.viewerId ? 'Yours' : findMember(ctx.family, owner)?.fullName ?? displayName(undefined)}>
              <Card padded={false}>
                {entries.map((e, i) => (
                  <Row
                    key={e.id}
                    testID={`money-${e.id}`}
                    title={e.title}
                    subtitle={`${e.subtitle}${e.nominee ? ` · Nominee: ${e.nominee}` : ''}`}
                    icon={e.kind === 'bank' ? 'Landmark' : 'PiggyBank'}
                    tint="haldi"
                    divider={i > 0}
                    right={e.nominee ? undefined : <Stamp text="No nominee" tone="haldi" />}
                    onPress={() => router.push(e.kind === 'bank' ? `/bank/${e.id}` : `/doc/${e.id}`)}
                  />
                ))}
              </Card>
            </Section>
          ))}
        </>
      )}
      <T variant="small" color="ink3">Only what you can see is listed. Private papers of others stay private here too.</T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: space.sm, marginBottom: space.xxl },
});
