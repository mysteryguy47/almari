import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Fields';
import { Card, EmptyState, Row, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { displayName, findMember, visibleTo } from '@/domain/access';
import { daysUntil, relativeDays } from '@/domain/dates';
import { ACCOUNT_TYPE_LABELS, CARD_TYPE_LABELS, maskTail } from '@/domain/money';
import { nextMonthlyDate } from '@/domain/reminders';
import type { ID } from '@/domain/types';
import { useCtx } from '@/store/hooks';
import { space, TAB_BAR_HEIGHT } from '@/theme/tokens';

type Tab = 'passwords' | 'bank' | 'notes';

export default function Locker() {
  const ctx = useCtx();
  const [tab, setTab] = useState<Tab>('passwords');

  const data = useMemo(() => {
    if (!ctx) return null;
    const { family, viewerId } = ctx;
    const logins = visibleTo(family, viewerId, family.logins).sort((a, b) => a.title.localeCompare(b.title));
    const accounts = visibleTo(family, viewerId, family.bankAccounts);
    const cards = visibleTo(family, viewerId, family.cards);
    const notes = visibleTo(family, viewerId, family.notes).sort((a, b) => a.title.localeCompare(b.title));
    const owners: ID[] = [];
    for (const item of [...accounts, ...cards]) if (item.ownerId && !owners.includes(item.ownerId)) owners.push(item.ownerId);
    owners.sort((a, b) => (a === viewerId ? -1 : b === viewerId ? 1 : 0));
    return { logins, accounts, cards, notes, owners };
  }, [ctx]);

  if (!ctx || !data) return null;
  const { family, viewerId } = ctx;
  const ownerLabel = (ownerId?: ID) => (!ownerId ? 'Family' : ownerId === viewerId ? 'Yours' : displayName(findMember(family, ownerId)));

  return (
    <Screen title="Locker" large subtitle="Hidden until your fingerprint or PIN." back={false} bottomInset={TAB_BAR_HEIGHT} testID="locker">
      <Segmented<Tab>
        testID="locker-tab"
        value={tab}
        onChange={setTab}
        options={[{ value: 'passwords', label: 'Passwords' }, { value: 'bank', label: 'Bank & cards' }, { value: 'notes', label: 'Notes' }]}
      />
      <View style={styles.gap} />

      {tab === 'passwords' ? (
        data.logins.length ? (
          <>
            <Card padded={false}>
              {data.logins.map((l, i) => (
                <Row
                  key={l.id}
                  testID={`login-${l.id}`}
                  title={l.title}
                  subtitle={[l.username, ownerLabel(l.ownerId)].filter(Boolean).join(' · ')}
                  icon={l.kind === 'wifi' ? 'Wifi' : 'KeyRound'}
                  tint="stamp"
                  divider={i > 0}
                  right={l.onlyMe ? <Stamp text="Only me" tone="stamp" /> : undefined}
                  onPress={() => router.push(`/login/${l.id}`)}
                />
              ))}
            </Card>
            <View style={styles.gap} />
            <Button label="Add a password" variant="secondary" icon="Plus" onPress={() => router.push('/login/new')} />
          </>
        ) : (
          <EmptyState icon="KeyRound" title="No passwords yet" line="Wi-Fi, Netflix, IRCTC, the Income Tax portal. Saved once, never asked for again." action={<Button label="Add a password" full={false} icon="Plus" onPress={() => router.push('/login/new')} />} />
        )
      ) : null}

      {tab === 'bank' ? (
        data.owners.length ? (
          <>
            {data.owners.map((ownerId) => {
              const owner = findMember(family, ownerId);
              const accounts = data.accounts.filter((a) => a.ownerId === ownerId);
              const cards = data.cards.filter((c) => c.ownerId === ownerId);
              return (
                <Section key={ownerId} title={ownerId === viewerId ? 'Yours' : owner?.fullName ?? 'Family'}>
                  <Card padded={false}>
                    {accounts.map((a, i) => (
                      <Row
                        key={a.id}
                        testID={`account-${a.id}`}
                        title={a.bank}
                        subtitle={`${ACCOUNT_TYPE_LABELS[a.type]} account · ${maskTail(a.accountNumber)}`}
                        icon="Landmark"
                        tint="haldi"
                        divider={i > 0}
                        right={a.onlyMe ? <Stamp text="Only me" /> : undefined}
                        onPress={() => router.push(`/bank/${a.id}`)}
                      />
                    ))}
                    {cards.map((c, i) => {
                      const due = c.type === 'credit' && c.dueDay ? daysUntil(nextMonthlyDate(c.dueDay)) : null;
                      return (
                        <Row
                          key={c.id}
                          testID={`card-${c.id}`}
                          title={`${c.bank}${c.nickname ? ` ${c.nickname}` : ''}`}
                          subtitle={[CARD_TYPE_LABELS[c.type], maskTail(c.number), due !== null ? `bill due ${relativeDays(due)}` : null].filter(Boolean).join(' · ')}
                          icon="CreditCard"
                          tint="inland"
                          divider={accounts.length + i > 0}
                          right={due !== null && due <= 7 ? <Stamp text={due <= 1 ? 'Pay now' : `${due} days`} tone="haldi" /> : undefined}
                          onPress={() => router.push(`/card/${c.id}`)}
                        />
                      );
                    })}
                  </Card>
                </Section>
              );
            })}
            <View style={styles.row}>
              <View style={styles.flex}><Button label="Bank account" variant="secondary" icon="Plus" onPress={() => router.push('/bank/new')} /></View>
              <View style={styles.flex}><Button label="Card" variant="secondary" icon="Plus" onPress={() => router.push('/card/new')} /></View>
            </View>
          </>
        ) : (
          <EmptyState
            icon="Landmark"
            title="No bank details yet"
            line="Every account and card, with IFSC, nominee and the credit-card due date. Share account details in one tap."
            action={
              <View style={styles.row}>
                <Button label="Account" full={false} icon="Plus" onPress={() => router.push('/bank/new')} />
                <Button label="Card" full={false} variant="secondary" icon="Plus" onPress={() => router.push('/card/new')} />
              </View>
            }
          />
        )
      ) : null}

      {tab === 'notes' ? (
        data.notes.length ? (
          <>
            <Card padded={false}>
              {data.notes.map((n, i) => (
                <Row key={n.id} title={n.title} subtitle={ownerLabel(n.ownerId)} icon="StickyNote" tint="stamp" divider={i > 0} right={n.onlyMe ? <Stamp text="Only me" /> : undefined} onPress={() => router.push(`/note/${n.id}`)} />
              ))}
            </Card>
            <View style={styles.gap} />
            <Button label="Add a note" variant="secondary" icon="Plus" onPress={() => router.push('/note/new')} />
          </>
        ) : (
          <EmptyState icon="StickyNote" title="No notes yet" line="Locker number and where its key is. SIM PUK codes. Where the will is kept." action={<Button label="Add a note" full={false} icon="Plus" onPress={() => router.push('/note/new')} />} />
        )
      ) : null}

      <View style={styles.footerNote}>
        <Avatar member={ctx.viewer} size={24} />
        <T variant="small" color="ink2" style={styles.flex}>
          {family.personalSharing === 'private'
            ? 'Personal accounts and cards are private in this family: you see your own and the family’s.'
            : 'Shared with the family unless marked Only me.'}
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { height: space.lg },
  row: { flexDirection: 'row', gap: space.md },
  footerNote: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xxl },
});
