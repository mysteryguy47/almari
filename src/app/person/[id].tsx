import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { DocThumb } from '@/components/DocThumb';
import { Icon } from '@/components/Icon';
import { Card, Row, Screen, Section } from '@/components/Layout';
import { ValueRow } from '@/components/Secret';
import { T } from '@/components/Text';
import { displayName, findMember, visibleTo } from '@/domain/access';
import { ageFrom, formatDate } from '@/domain/dates';
import { eAadhaarPasswordGuess } from '@/domain/family-rules';
import { ACCOUNT_TYPE_LABELS, CARD_TYPE_LABELS, listNumber, maskAadhaar, maskTail } from '@/domain/money';
import { getCategory, getTemplate, templateForIdKind } from '@/domain/templates';
import { ID_KINDS, ID_LABELS, type DocItem } from '@/domain/types';
import { digitsOnly } from '@/domain/validation';
import { callNumber } from '@/lib/device';
import { useCtx } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** A person's page: numbers first (needed far more often than files), then papers, bank, emergency. */
export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const { palette } = useTheme();

  const data = useMemo(() => {
    if (!ctx) return null;
    const { family, viewerId } = ctx;
    const member = findMember(family, id);
    if (!member) return null;
    const docs = visibleTo(family, viewerId, family.documents).filter((d) => d.ownerId === member.id);
    const groups = new Map<string, DocItem[]>();
    for (const d of docs) {
      const cat = getTemplate(d.templateId).category;
      groups.set(cat, [...(groups.get(cat) ?? []), d]);
    }
    const hiddenPapers = member.kind === 'account' && member.id !== viewerId && family.personalSharing === 'private';
    return {
      member,
      groups: [...groups.entries()],
      accounts: visibleTo(family, viewerId, family.bankAccounts).filter((a) => a.ownerId === member.id),
      cards: visibleTo(family, viewerId, family.cards).filter((c) => c.ownerId === member.id),
      hiddenPapers,
    };
  }, [ctx, id]);

  if (!ctx) return <Redirect href="/" />;
  if (!data) return <Redirect href="/" />;
  const { member, groups, accounts, cards, hiddenPapers } = data;
  const isMe = member.id === ctx.viewerId;
  const age = ageFrom(member.dob);
  const memorial = member.status === 'memorial';
  const guess = member.ids.aadhaar ? eAadhaarPasswordGuess(member.fullName, member.dob) : null;
  const missing = ID_KINDS.filter((k) => !member.ids[k]);
  const facts = [
    member.relation && member.relation !== member.fullName ? member.relation : null,
    age ? `${age.years}${age.approximate ? ' (approx.)' : ''} years` : null,
    member.dob && !age?.approximate ? `born ${formatDate(member.dob)}` : null,
    member.bloodGroup ? `blood ${member.bloodGroup}` : null,
  ].filter(Boolean);

  return (
    <Screen
      title={isMe ? 'You' : displayName(member)}
      right={
        <Pressable onPress={() => router.push(`/member/${member.id}`)} accessibilityRole="button" accessibilityLabel="Edit profile" hitSlop={8}>
          <T variant="smallStrong" color="accent">Edit</T>
        </Pressable>
      }
      testID="person"
    >
      <View style={styles.head}>
        <Avatar member={member} size={76} />
        <View style={styles.flex}>
          <T variant="title">{member.fullName}</T>
          <T variant="small" color="ink2">{facts.join(' · ')}</T>
          <View style={styles.badges}>
            {memorial ? <Stamp text="In loving memory" tone="stamp" /> : null}
            {member.status === 'invited' ? <Stamp text="Invited" tone="inland" /> : null}
            {member.kind === 'profile' && !memorial ? <Stamp text={member.isPet ? 'Pet' : 'Profile only'} tone="almari" /> : null}
          </View>
        </View>
      </View>
      {member.phone && !memorial ? (
        <View style={styles.actions}>
          <Button label="Call" icon="Phone" variant="secondary" size="md" full={false} onPress={() => callNumber(member.phone as string)} />
          {member.emergency ? <Button label="Emergency card" icon="HeartPulse" variant="secondary" size="md" full={false} onPress={() => router.push({ pathname: '/extras/emergency', params: { member: member.id } })} /> : null}
        </View>
      ) : null}

      {!member.isPet ? (
        <Section title="Numbers">
          <Card>
            {ID_KINDS.filter((k) => member.ids[k]).map((k) => (
              <ValueRow
                key={k}
                testID={`id-${k}`}
                label={ID_LABELS[k]}
                value={member.ids[k]}
                secret={k === 'aadhaar'}
                masked={k === 'aadhaar' ? maskAadhaar(member.ids[k] as string) : undefined}
                copyValue={k === 'aadhaar' ? digitsOnly(member.ids[k] as string) : undefined}
                guard={k === 'aadhaar' ? 'Share Aadhaar only where it is truly needed. Nobody genuine asks for an OTP on a call.' : undefined}
                large
              />
            ))}
            {missing.length && !memorial ? (
              <View style={styles.missing}>
                <T variant="small" color="ink2">Not saved yet:</T>
                <View style={styles.badges}>
                  {missing.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => router.push({ pathname: '/doc/new', params: { template: templateForIdKind(k).id, owner: member.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${ID_LABELS[k]}`}
                      style={[styles.add, { borderColor: palette.accent }]}
                    >
                      <Icon name="Plus" size={14} color="accent" />
                      <T variant="smallStrong" color="accent">{ID_LABELS[k]}</T>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </Card>
          {guess ? (
            <Card style={styles.hint}>
              <T variant="smallStrong">e-Aadhaar PDF password, probably</T>
              <ValueRow label="Usual pattern: first 4 letters of the name + birth year" value={guess.guess} secret masked="••••••••" />
              <T variant="small" color="ink3">
                {guess.certain ? 'This is the widely published pattern, not a guarantee.' : 'The name is shorter than 4 letters, so this guess is less certain.'}
              </T>
            </Card>
          ) : null}
        </Section>
      ) : null}

      <Section title="Papers">
        {hiddenPapers ? (
          <Card>
            <T variant="body" color="ink2">{displayName(member)}’s personal papers are private in this family. Only {member.gender === 'female' ? 'she' : member.gender === 'male' ? 'he' : 'they'} can see them.</T>
          </Card>
        ) : groups.length === 0 ? (
          <Card>
            <T variant="body" color="ink2">Nothing saved for {isMe ? 'you' : displayName(member)} yet.</T>
          </Card>
        ) : (
          groups.map(([cat, docs]) => (
            <Card key={cat} padded={false} style={styles.group}>
              <T variant="label" color="ink2" style={styles.groupTitle}>{getCategory(cat).name}</T>
              {docs.map((d, i) => (
                <Row
                  key={d.id}
                  testID={`doc-${d.id}`}
                  title={d.title}
                  subtitle={d.expiryDate ? `${getTemplate(d.templateId).expiry?.label ?? 'Expires'} ${formatDate(d.expiryDate)}` : listNumber(d.templateId, d.number) ?? getTemplate(d.templateId).name}
                  left={<DocThumb templateId={d.templateId} file={d.files[0]} width={44} />}
                  divider={i > 0}
                  right={d.onlyMe ? <Stamp text="Only me" /> : undefined}
                  onPress={() => router.push(`/doc/${d.id}`)}
                />
              ))}
            </Card>
          ))
        )}
        {!memorial ? (
          <Button label={`Add a paper for ${isMe ? 'you' : displayName(member)}`} variant="secondary" icon="Plus" onPress={() => router.push({ pathname: '/doc/new', params: { owner: member.id } })} testID="add-for-person" />
        ) : null}
      </Section>

      {accounts.length || cards.length ? (
        <Section title="Bank and cards">
          <Card padded={false}>
            {accounts.map((a, i) => (
              <Row key={a.id} title={a.bank} subtitle={`${ACCOUNT_TYPE_LABELS[a.type]} · ${maskTail(a.accountNumber)}`} icon="Landmark" tint="haldi" divider={i > 0} onPress={() => router.push(`/bank/${a.id}`)} />
            ))}
            {cards.map((c, i) => (
              <Row key={c.id} title={`${c.bank}${c.nickname ? ` ${c.nickname}` : ''}`} subtitle={`${CARD_TYPE_LABELS[c.type]} · ${maskTail(c.number)}`} icon="CreditCard" tint="inland" divider={accounts.length + i > 0} onPress={() => router.push(`/card/${c.id}`)} />
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.lg },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 4 },
  actions: { flexDirection: 'row', gap: space.md, marginBottom: space.xxl },
  missing: { paddingTop: space.md, gap: 4 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  hint: { gap: 4 },
  group: { marginBottom: space.sm },
  groupTitle: { paddingHorizontal: space.lg, paddingTop: space.md },
});
