import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BankCard } from '@/components/BankCard';
import { BankField } from '@/components/BankField';
import { Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { ChipChoice, Segmented, TextField, ToggleRow } from '@/components/Fields';
import { DeleteItem, NotFound, OnlyMeToggle, OwnerPicker, ownerName } from '@/components/ItemBits';
import { countFilled, More, MoreGroup } from '@/components/More';
import { Card, Screen } from '@/components/Layout';
import { NetworkLogo } from '@/components/NetworkLogo';
import { ValueRow } from '@/components/Secret';
import { Sheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { canSee, findMember, visibleTo } from '@/domain/access';
import { daysUntil, formatDate, relativeDays } from '@/domain/dates';
import {
  CARD_SHARE_LABELS, CARD_TYPE_LABELS, detectNetwork, formatRupees, groupCardNumber, maskTail, NETWORK_LABELS, ordinal, shareCardText,
  type CardShareField,
} from '@/domain/money';
import { nextMonthlyDate } from '@/domain/reminders';
import type { CardNetwork, CardType } from '@/domain/types';
import { checkCardExpiry, checkCardNumber, checkDayOfMonth, checkRequiredText, digitsOnly } from '@/domain/validation';
import { shareText } from '@/lib/device';
import { CARD_TYPES } from '@/lib/options';
import { ensureReauth } from '@/lib/reauth';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const GUARD = 'No bank will ever ask you for your CVV or PIN.';
const NETWORKS = (Object.keys(NETWORK_LABELS) as CardNetwork[]).map((n) => ({ value: n, label: NETWORK_LABELS[n] }));

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const { palette } = useTheme();
  const saveCard = useApp((s) => s.saveCard);
  const toggleMute = useApp((s) => s.toggleMute);
  const c = ctx && id !== 'new' ? ctx.family.cards.find((x) => x.id === id) : undefined;
  const [editing, setEditing] = useState(id === 'new');
  const [type, setType] = useState<CardType>(c?.type ?? 'credit');
  const [ownerId, setOwnerId] = useState<string | undefined>(c ? c.ownerId : ctx?.viewerId);
  const [bank, setBank] = useState(c?.bank ?? '');
  const [nickname, setNickname] = useState(c?.nickname ?? '');
  const [nameOnCard, setNameOnCard] = useState(c?.nameOnCard ?? '');
  // A new card's name follows whoever it is for, in capitals as cards print it, until typed over.
  const [nameEdited, setNameEdited] = useState(!!c);
  const [sharing, setSharing] = useState(false);
  const [shareFields, setShareFields] = useState<CardShareField[]>(['name', 'number', 'expiry']);
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
  const [moreOpen, setMoreOpen] = useState(!!c && countFilled(c.nickname, c.creditLimit, c.statementDay, c.dueDay, c.linkedAccountId) > 0);
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
    const holderName = findMember(family, c.ownerId)?.fullName;
    const available = (Object.keys(CARD_SHARE_LABELS) as CardShareField[]).filter((f) =>
      f === 'number' ? true : f === 'expiry' ? !!c.expiry : f === 'cvv' ? !!c.cvv : !!(c.nameOnCard || holderName));
    const chosen = shareFields.filter((f) => available.includes(f));
    const share = async () => {
      if (!chosen.length) return;
      if (!(await ensureReauth('Share card details'))) return;
      setSharing(false);
      const result = await shareText(shareCardText(c, chosen, holderName), `${c.bank} card`);
      toast(result === 'copied' ? 'Card details copied. Paste them only where you mean to.' : 'Card details shared. Never share the PIN or an OTP.', { tone: 'success' });
    };
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
        <View style={styles.block}>
          <Button label="Share card details" icon="Send" onPress={() => setSharing(true)} testID="share-card" />
        </View>
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

        <Sheet visible={sharing} onClose={() => setSharing(false)} title="Share card details" subtitle="The bank’s name goes on top. Pick what to send." testID="share-card-sheet">
          <Card padded={false} style={styles.shareCard}>
            {available.map((f, i) => (
              <View key={f} style={[styles.shareRow, i > 0 ? styles.shareDivider : null]}>
                <ToggleRow
                  title={CARD_SHARE_LABELS[f]}
                  subtitle={f === 'number' ? maskTail(c.number) : f === 'expiry' ? c.expiry : f === 'cvv' ? 'Anyone with the number and CVV can spend online' : (c.nameOnCard || holderName)}
                  value={chosen.includes(f)}
                  onValueChange={(on) => setShareFields((list) => (on ? [...list.filter((x) => x !== f), f] : list.filter((x) => x !== f)))}
                  testID={`share-${f}`}
                />
              </View>
            ))}
          </Card>
          {chosen.includes('cvv') ? (
            <T variant="small" color="sindoor" style={styles.shareWarn}>Send the CVV only to family you trust, and never to someone who called you. The PIN is never shared.</T>
          ) : (
            <T variant="small" color="ink2" style={styles.shareWarn}>The PIN is never shared. Asks for your fingerprint or PIN first.</T>
          )}
          <Button label={chosen.length ? 'Share' : 'Pick something to share'} icon="Share2" onPress={share} disabled={!chosen.length} testID="share-card-go" />
        </Sheet>
      </Screen>
    );
  }

  const ownerAccounts = visibleTo(family, viewerId, family.bankAccounts).filter((a) => a.ownerId === ownerId);
  const shownName = nameEdited ? nameOnCard : (findMember(family, ownerId)?.fullName ?? '').toUpperCase();
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
      id: c?.id, type, ownerId, bank: bank.trim(), nickname: nickname.trim() || undefined, nameOnCard: shownName.trim() || undefined,
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
      {/* The card as it will look, drawn as it is typed: the bank's logo and colour, the network, the last digits. */}
      <View style={styles.preview} pointerEvents="none">
        <BankCard
          card={{
            ...(c ?? { id: 'draft', ownerId, onlyMe: false, createdBy: viewerId, createdAt: 0, updatedAt: 0, mutedBy: [] }),
            bank: bank.trim(),
            type,
            number: digitsOnly(number),
            network,
            expiry: expiry || undefined,
            nickname: nickname.trim() || undefined,
            nameOnCard: shownName || undefined,
          }}
        />
      </View>
      <Segmented<CardType> value={type} onChange={setType} options={CARD_TYPES} testID="card-type" />
      <T variant="small" color="ink2" style={styles.hint}>
        {type === 'credit' ? 'A credit card needs no bank account here. Add as many as you have, even several from one bank.' : 'A debit card can point to one of the owner’s accounts.'}
      </T>
      <OwnerPicker family={family} value={ownerId} onChange={setOwnerId} />
      <BankField label="Bank or issuer" value={bank} onChange={setBank} check={checks.bank} showCheck={tried} issuers testID="card-bank" />
      <TextField
        label="Card number"
        value={number}
        onChangeText={onNumber}
        keyboardType="number-pad"
        required
        check={checks.number}
        showCheck={tried || digitsOnly(number).length >= 12}
        helper={network !== 'other' ? NETWORK_LABELS[network] : undefined}
        right={network !== 'other' ? <View style={styles.netLogo}><NetworkLogo network={network} height={16} color={palette.ink} /></View> : undefined}
        testID="card-number-input"
      />
      <View style={styles.row}>
        <View style={styles.flex}><TextField label="Valid till (MM/YY)" value={expiry} onChangeText={onExpiry} keyboardType="number-pad" check={checks.expiry} testID="card-expiry" /></View>
      </View>
      <TextField
        label="Name on card"
        value={shownName}
        onChangeText={(v) => {
          setNameEdited(true);
          setNameOnCard(v);
        }}
        autoCapitalize="characters"
        helper={!nameEdited ? 'From the profile. Cards often shorten it: RAJESH K SHARMA.' : undefined}
        testID="card-name"
      />
      <OnlyMeToggle visible={ownerId === viewerId} value={onlyMe} onChange={setOnlyMe} />
      <More
        summary={type === 'credit' ? 'Card name, network, bill dates and limit, CVV and PIN' : type === 'debit' ? 'Card name, network, linked account, CVV and PIN' : 'Card name, network, CVV and PIN'}
        filled={countFilled(nickname, type === 'credit' ? creditLimit : '', type === 'credit' ? statementDay : '', type === 'credit' ? dueDay : '', type === 'debit' ? linkedAccountId : '', showSecrets ? cvv || pin : '')}
        open={moreOpen || (tried && [checks.statement, checks.due].some((x) => x.level === 'error'))}
        onToggle={setMoreOpen}
        testID="card-more"
      >
        <MoreGroup title="On the card">
          <TextField label="Card name (optional)" value={nickname} onChangeText={setNickname} placeholder="Shopping card, Travel card" testID="card-nickname" />
          <T variant="smallStrong" color="ink2">Network</T>
          <View style={styles.networks}>
            <ChipChoice options={NETWORKS} value={network} onChange={(n) => { setNetwork(n); setNetworkTouched(true); }} />
          </View>
        </MoreGroup>
        {type === 'credit' ? (
          <MoreGroup title="Bill and limit">
            <TextField label="Credit limit (₹)" value={creditLimit} onChangeText={(v) => setCreditLimit(digitsOnly(v))} keyboardType="number-pad" helper={creditLimit ? formatRupees(Number(creditLimit)) : undefined} testID="card-limit" />
            <View style={styles.row}>
              <View style={styles.flex}><TextField label="Statement day" value={statementDay} onChangeText={(v) => setStatementDay(digitsOnly(v).slice(0, 2))} keyboardType="number-pad" check={checks.statement} helper="e.g. 18" testID="card-statement" /></View>
              <View style={styles.flex}><TextField label="Payment due day" value={dueDay} onChangeText={(v) => setDueDay(digitsOnly(v).slice(0, 2))} keyboardType="number-pad" check={checks.due} helper="e.g. 7" testID="card-due" /></View>
            </View>
          </MoreGroup>
        ) : null}
        {type === 'debit' && ownerAccounts.length ? (
          <MoreGroup title="Linked account">
            <ChipChoice
              options={[{ value: '', label: 'None' }, ...ownerAccounts.map((a) => ({ value: a.id, label: `${a.bank} ${maskTail(a.accountNumber)}` }))]}
              value={linkedAccountId ?? ''}
              onChange={(v) => setLinkedAccountId(v || undefined)}
            />
          </MoreGroup>
        ) : null}
        <MoreGroup title="CVV and PIN">
          <ToggleRow title="Also keep CVV and PIN" subtitle={GUARD} value={showSecrets} onValueChange={setShowSecrets} />
          {showSecrets ? (
            <View style={styles.row}>
              <View style={styles.flex}><TextField label="CVV" value={cvv} onChangeText={(v) => setCvv(digitsOnly(v).slice(0, 4))} keyboardType="number-pad" secure /></View>
              <View style={styles.flex}><TextField label="PIN" value={pin} onChangeText={(v) => setPin(digitsOnly(v).slice(0, 6))} keyboardType="number-pad" secure /></View>
            </View>
          ) : null}
        </MoreGroup>
      </More>
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
  networks: { marginBottom: space.lg },
  preview: { marginBottom: space.xl },
  netLogo: { paddingHorizontal: space.sm, justifyContent: 'center' },
  shareCard: { marginBottom: space.md },
  shareRow: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  shareDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.25)' },
  shareWarn: { marginBottom: space.lg },
});
