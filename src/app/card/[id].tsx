import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BankCard } from '@/components/BankCard';
import { Chip, Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { ChipChoice, Segmented, TextField, ToggleRow } from '@/components/Fields';
import { DeleteItem, NotFound, OnlyMeToggle, OwnerPicker, ownerName } from '@/components/ItemBits';
import { Card, Screen, Section } from '@/components/Layout';
import { ValueRow } from '@/components/Secret';
import { T } from '@/components/Text';
import { canSee, visibleTo } from '@/domain/access';
import { daysUntil, formatDate, relativeDays } from '@/domain/dates';
import { CARD_TYPE_LABELS, COMMON_BANKS, detectNetwork, formatRupees, groupCardNumber, maskTail, NETWORK_LABELS, ordinal } from '@/domain/money';
import { nextMonthlyDate } from '@/domain/reminders';
import type { CardNetwork, CardType } from '@/domain/types';
import { checkCardExpiry, checkCardNumber, checkDayOfMonth, checkRequiredText, digitsOnly } from '@/domain/validation';
import { CARD_TYPES } from '@/lib/options';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

const GUARD = 'No bank will ever ask you for your CVV or PIN.';
const NETWORKS = (Object.keys(NETWORK_LABELS) as CardNetwork[]).map((n) => ({ value: n, label: NETWORK_LABELS[n] }));

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const saveCard = useApp((s) => s.saveCard);
  const toggleMute = useApp((s) => s.toggleMute);
  const c = ctx && id !== 'new' ? ctx.family.cards.find((x) => x.id === id) : undefined;
  const [editing, setEditing] = useState(id === 'new');
  const [type, setType] = useState<CardType>(c?.type ?? 'credit');
  const [ownerId, setOwnerId] = useState<string | undefined>(c ? c.ownerId : ctx?.viewerId);
  const [bank, setBank] = useState(c?.bank ?? '');
  const [nickname, setNickname] = useState(c?.nickname ?? '');
  const [nameOnCard, setNameOnCard] = useState(c?.nameOnCard ?? '');
  const [number, setNumber] = useState(c ? groupCardNumber(c.number) : '');
  const [network, setNetwork] = useState<CardNetwork>(c?.network ?? 'other');
  const [networkTouched, setNetworkTouched] = useState(!!c);
  const [expiry, setExpiry] = useState(c?.expiry ?? '');
  const [linkedAccountId, setLinkedAccountId] = useState(c?.linkedAccountId);
  const [creditLimit, setCreditLimit] = useState(c?.creditLimit ? String(c.creditLimit) : '');
  const [statementDay, setStatementDay] = useState(c?.statementDay ? String(c.statementDay) : '');
  const [dueDay, setDueDay] = useState(c?.dueDay ? String(c.dueDay) : '');
  const [showSecrets, setShowSecrets] = useState(!!(c?.cvv || c?.pin));
  const [cvv, setCvv] = useState(c?.cvv ?? '');
  const [pin, setPin] = useState(c?.pin ?? '');
  const [onlyMe, setOnlyMe] = useState(c?.onlyMe ?? false);
  const [tried, setTried] = useState(false);

  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  if (id !== 'new' && (!c || c.deletedAt || !canSee(family, viewerId, c))) return <Screen title="Card"><NotFound /></Screen>;

  if (!editing && c) {
    const account = c.linkedAccountId ? family.bankAccounts.find((a) => a.id === c.linkedAccountId && !a.deletedAt) : undefined;
    const due = c.type === 'credit' && c.dueDay ? nextMonthlyDate(c.dueDay) : undefined;
    const dueIn = due ? daysUntil(due) : null;
    const isOwner = c.ownerId === viewerId;
    return (
      <Screen
        title={`${c.bank}${c.nickname ? ` ${c.nickname}` : ''}`}
        subtitle={`${CARD_TYPE_LABELS[c.type]} · ${ownerName(family, viewerId, c.ownerId)}`}
        right={<Pressable onPress={() => setEditing(true)} accessibilityRole="button" hitSlop={8}><T variant="smallStrong" color="accent">Edit</T></Pressable>}
        testID="card-view"
      >
        <BankCard card={c} accountLabel={account ? `${account.bank} ${maskTail(account.accountNumber)}` : undefined} testID="bank-card" />
        <T variant="small" color="ink3" align="center" style={styles.hint}>Tap the card to flip it</T>
        {c.onlyMe ? <View style={styles.stamp}><Stamp text="Only me" /></View> : null}
        {due ? (
          <Card style={styles.block}>
            <T variant="label" color="ink2">Next bill</T>
            <T variant="heading" color={dueIn !== null && dueIn <= 3 ? 'sindoor' : 'ink'}>Pay by {formatDate(due)} ({relativeDays(dueIn as number)})</T>
            {isOwner ? (
              <ToggleRow title="Remind me 3 days and 1 day before" subtitle="Card bills remind only the cardholder." value={!c.mutedBy.includes(viewerId)} onValueChange={() => toggleMute('cards', c.id)} testID="bill-remind" />
            ) : (
              <T variant="small" color="ink2">Bill reminders go to the cardholder only.</T>
            )}
          </Card>
        ) : null}
        <Card style={styles.block}>
          <ValueRow label="Card number" value={groupCardNumber(c.number)} copyValue={digitsOnly(c.number)} secret masked={maskTail(c.number)} testID="card-number" />
          <ValueRow label="Name on card" value={c.nameOnCard} />
          <ValueRow label="Valid till" value={c.expiry} />
          <ValueRow label="Network" value={NETWORK_LABELS[c.network]} />
          {c.type === 'credit' ? <ValueRow label="Credit limit" value={c.creditLimit ? formatRupees(c.creditLimit) : undefined} /> : null}
          {c.type === 'credit' ? <ValueRow label="Statement" value={c.statementDay ? `${ordinal(c.statementDay)} of every month` : undefined} /> : null}
          {c.type === 'credit' ? <ValueRow label="Payment due" value={c.dueDay ? `${ordinal(c.dueDay)} of every month` : undefined} /> : null}
          {account ? <ValueRow label="Linked account" value={`${account.bank} ${maskTail(account.accountNumber)}`} /> : null}
          <ValueRow label="CVV" value={c.cvv} secret guard={GUARD} />
          <ValueRow label="PIN" value={c.pin} secret guard={GUARD} />
        </Card>
        <DeleteItem collection="cards" id={c.id} title={`${c.bank} card`} />
      </Screen>
    );
  }

  const ownerAccounts = visibleTo(family, viewerId, family.bankAccounts).filter((a) => a.ownerId === ownerId);
  const checks = {
    bank: checkRequiredText(bank, 'Bank', 60),
    number: checkCardNumber(number),
    expiry: checkCardExpiry(expiry),
    statement: checkDayOfMonth(statementDay ? Number(statementDay) : undefined, 'Statement day'),
    due: checkDayOfMonth(dueDay ? Number(dueDay) : undefined, 'Due day'),
  };
  const onNumber = (value: string) => {
    const digits = digitsOnly(value).slice(0, 19);
    setNumber(groupCardNumber(digits));
    if (!networkTouched) setNetwork(detectNetwork(digits));
  };
  const onExpiry = (value: string) => {
    const d = digitsOnly(value).slice(0, 4);
    setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
  };
  const save = () => {
    setTried(true);
    const blocking = [checks.bank, checks.number, checks.statement, checks.due].some((x) => x.level === 'error');
    if (blocking || !ownerId) {
      if (!ownerId) toast('Pick whose card it is', { tone: 'warn' });
      return;
    }
    const saved = saveCard({
      id: c?.id, type, ownerId, bank: bank.trim(), nickname: nickname.trim() || undefined, nameOnCard: nameOnCard.trim() || undefined,
      number: digitsOnly(number), network, expiry: expiry || undefined,
      linkedAccountId: type === 'debit' ? linkedAccountId : undefined,
      creditLimit: creditLimit ? Number(digitsOnly(creditLimit)) : undefined,
      statementDay: statementDay ? Number(statementDay) : undefined,
      dueDay: dueDay ? Number(dueDay) : undefined,
      cvv: showSecrets ? cvv || undefined : undefined, pin: showSecrets ? pin || undefined : undefined,
      onlyMe: ownerId === viewerId ? onlyMe : false,
    });
    toast('Card saved', { tone: 'success' });
    if (c) setEditing(false);
    else router.replace(`/card/${saved}`);
  };

  return (
    <Screen title={c ? 'Edit card' : 'New card'} footer={<Button label="Save" onPress={save} testID="card-save" />} testID="card-edit">
      <Segmented<CardType> value={type} onChange={setType} options={CARD_TYPES} testID="card-type" />
      <T variant="small" color="ink2" style={styles.hint}>
        {type === 'credit' ? 'A credit card needs no bank account here. Add as many as you have, even several from one bank.' : 'A debit card can point to one of the owner’s accounts.'}
      </T>
      <OwnerPicker family={family} value={ownerId} onChange={setOwnerId} />
      <TextField label="Bank or issuer" value={bank} onChangeText={setBank} required check={checks.bank} showCheck={tried} testID="card-bank" />
      {!bank ? <View style={styles.chips}>{COMMON_BANKS.slice(0, 8).map((b) => <Chip key={b} label={b} onPress={() => setBank(b)} />)}</View> : null}
      <TextField label="Card name (optional)" value={nickname} onChangeText={setNickname} placeholder="Shopping card, Travel card" testID="card-nickname" />
      <TextField label="Card number" value={number} onChangeText={onNumber} keyboardType="number-pad" required check={checks.number} showCheck={tried || digitsOnly(number).length >= 12} testID="card-number-input" />
      <Section title="Network">
        <ChipChoice options={NETWORKS} value={network} onChange={(n) => { setNetwork(n); setNetworkTouched(true); }} />
      </Section>
      <View style={styles.row}>
        <View style={styles.flex}><TextField label="Valid till (MM/YY)" value={expiry} onChangeText={onExpiry} keyboardType="number-pad" check={checks.expiry} testID="card-expiry" /></View>
        <View style={styles.flex}><TextField label="Name on card" value={nameOnCard} onChangeText={setNameOnCard} autoCapitalize="characters" /></View>
      </View>
      {type === 'credit' ? (
        <Section title="Bill">
          <TextField label="Credit limit (₹)" value={creditLimit} onChangeText={(v) => setCreditLimit(digitsOnly(v))} keyboardType="number-pad" helper={creditLimit ? formatRupees(Number(creditLimit)) : undefined} testID="card-limit" />
          <View style={styles.row}>
            <View style={styles.flex}><TextField label="Statement day" value={statementDay} onChangeText={(v) => setStatementDay(digitsOnly(v).slice(0, 2))} keyboardType="number-pad" check={checks.statement} helper="e.g. 18" testID="card-statement" /></View>
            <View style={styles.flex}><TextField label="Payment due day" value={dueDay} onChangeText={(v) => setDueDay(digitsOnly(v).slice(0, 2))} keyboardType="number-pad" check={checks.due} helper="e.g. 7" testID="card-due" /></View>
          </View>
        </Section>
      ) : null}
      {type === 'debit' && ownerAccounts.length ? (
        <Section title="Linked account">
          <ChipChoice
            options={[{ value: '', label: 'None' }, ...ownerAccounts.map((a) => ({ value: a.id, label: `${a.bank} ${maskTail(a.accountNumber)}` }))]}
            value={linkedAccountId ?? ''}
            onChange={(v) => setLinkedAccountId(v || undefined)}
          />
        </Section>
      ) : null}
      <Card style={styles.block}>
        <ToggleRow title="Also keep CVV and PIN" subtitle={GUARD} value={showSecrets} onValueChange={setShowSecrets} />
        {showSecrets ? (
          <View style={styles.row}>
            <View style={styles.flex}><TextField label="CVV" value={cvv} onChangeText={(v) => setCvv(digitsOnly(v).slice(0, 4))} keyboardType="number-pad" secure /></View>
            <View style={styles.flex}><TextField label="PIN" value={pin} onChangeText={(v) => setPin(digitsOnly(v).slice(0, 6))} keyboardType="number-pad" secure /></View>
          </View>
        ) : null}
      </Card>
      <OnlyMeToggle visible={ownerId === viewerId} value={onlyMe} onChange={setOnlyMe} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.md },
  hint: { marginTop: space.sm, marginBottom: space.lg },
  stamp: { marginBottom: space.md },
  block: { marginBottom: space.lg, gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -space.sm, marginBottom: space.lg },
});
