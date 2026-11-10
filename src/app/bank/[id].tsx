import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { ChipChoice, TextField } from '@/components/Fields';
import { DeleteItem, NotFound, OnlyMeToggle, OwnerPicker, ownerName } from '@/components/ItemBits';
import { Card, Row, Screen, Section } from '@/components/Layout';
import { ValueRow } from '@/components/Secret';
import { T } from '@/components/Text';
import { canSee, findMember, visibleTo } from '@/domain/access';
import { ACCOUNT_TYPE_LABELS, bankFromIfsc, CARD_TYPE_LABELS, COMMON_BANKS, maskTail, shareAccountText } from '@/domain/money';
import type { BankAccountType } from '@/domain/types';
import { checkIfsc, checkPhone, checkRequiredText, compactUpper, digitsOnly, OK } from '@/domain/validation';
import { shareText } from '@/lib/device';
import { ACCOUNT_TYPES } from '@/lib/options';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

const GUARD = 'No bank will ever ask you for these. Not on a call, not by SMS.';

export default function BankAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const saveBankAccount = useApp((s) => s.saveBankAccount);
  const a = ctx && id !== 'new' ? ctx.family.bankAccounts.find((x) => x.id === id) : undefined;
  const [editing, setEditing] = useState(id === 'new');
  const [ownerId, setOwnerId] = useState<string | undefined>(a ? a.ownerId : ctx?.viewerId);
  const [bank, setBank] = useState(a?.bank ?? '');
  const [type, setType] = useState<BankAccountType>(a?.type ?? 'savings');
  const [accountNumber, setAccountNumber] = useState(a?.accountNumber ?? '');
  const [ifsc, setIfsc] = useState(a?.ifsc ?? '');
  const [branch, setBranch] = useState(a?.branch ?? '');
  const [holder, setHolder] = useState(a?.holder ?? '');
  const [customerId, setCustomerId] = useState(a?.customerId ?? '');
  const [netbankingId, setNetbankingId] = useState(a?.netbankingId ?? '');
  const [netbankingPassword, setNetbankingPassword] = useState(a?.netbankingPassword ?? '');
  const [registeredMobile, setRegisteredMobile] = useState(a?.registeredMobile ?? '');
  const [nominee, setNominee] = useState(a?.nominee ?? '');
  const [upiIds, setUpiIds] = useState(a?.upiIds ?? '');
  const [notes, setNotes] = useState(a?.notes ?? '');
  const [onlyMe, setOnlyMe] = useState(a?.onlyMe ?? false);
  const [tried, setTried] = useState(false);

  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  if (id !== 'new' && (!a || a.deletedAt || !canSee(family, viewerId, a))) return <Screen title="Bank account"><NotFound /></Screen>;

  if (!editing && a) {
    const owner = findMember(family, a.ownerId);
    const cards = visibleTo(family, viewerId, family.cards).filter((c) => c.linkedAccountId === a.id);
    const share = async () => {
      const result = await shareText(shareAccountText(a, owner?.fullName ?? ''), 'Account details');
      toast(result === 'copied' ? 'Account details copied. Never share OTP, PIN or CVV.' : 'Shared name, account number, IFSC and bank only. Never share OTP, PIN or CVV.', { tone: 'success' });
    };
    return (
      <Screen
        title={a.bank}
        subtitle={`${ACCOUNT_TYPE_LABELS[a.type]} account · ${ownerName(family, viewerId, a.ownerId)}`}
        right={<Pressable onPress={() => setEditing(true)} accessibilityRole="button" hitSlop={8}><T variant="smallStrong" color="accent">Edit</T></Pressable>}
        testID="bank-view"
      >
        {a.onlyMe ? <View style={styles.stamp}><Stamp text="Only me" /></View> : null}
        <Button label="Share account details" icon="Send" onPress={share} testID="share-account" />
        <T variant="small" color="ink2" style={styles.shareNote}>Sends only the name, account number, IFSC and bank. Never passwords, PIN or CVV.</T>
        <Card>
          <ValueRow label="Account number" value={a.accountNumber} large />
          <ValueRow label="IFSC" value={a.ifsc} />
          <ValueRow label="Branch" value={a.branch} />
          <ValueRow label="Account holder" value={a.holder} />
          <ValueRow label="Customer ID" value={a.customerId} />
          <ValueRow label="Registered mobile" value={a.registeredMobile} />
          <ValueRow label="Nominee" value={a.nominee} />
          <ValueRow label="UPI IDs" value={a.upiIds} />
        </Card>
        {a.netbankingId || a.netbankingPassword ? (
          <Section title="Net banking" style={styles.section}>
            <Card>
              <ValueRow label="Net-banking ID" value={a.netbankingId} secret guard={GUARD} />
              <ValueRow label="Net-banking password" value={a.netbankingPassword} secret guard={GUARD} testID="nb-password" />
            </Card>
          </Section>
        ) : null}
        {!a.nominee ? (
          <Card style={styles.section}>
            <T variant="bodyStrong" color="haldi">No nominee noted</T>
            <T variant="small" color="ink2">Families often learn what existed only after a death. Adding a nominee at the bank takes one form.</T>
          </Card>
        ) : null}
        {cards.length ? (
          <Section title="Cards on this account" style={styles.section}>
            <Card padded={false}>
              {cards.map((c, i) => (
                <Row key={c.id} title={`${c.bank}${c.nickname ? ` ${c.nickname}` : ''}`} subtitle={`${CARD_TYPE_LABELS[c.type]} · ${maskTail(c.number)}`} icon="CreditCard" tint="inland" divider={i > 0} onPress={() => router.push(`/card/${c.id}`)} />
              ))}
            </Card>
          </Section>
        ) : null}
        {a.notes ? <Card style={styles.section}><T variant="label" color="ink2">Notes</T><T variant="body">{a.notes}</T></Card> : null}
        <DeleteItem collection="bankAccounts" id={a.id} title={`${a.bank} account`} />
      </Screen>
    );
  }

  const checks = {
    bank: checkRequiredText(bank, 'Bank', 60),
    number: digitsOnly(accountNumber).length >= 6 ? OK : ({ level: 'error', message: 'Add the account number' } as const),
    ifsc: checkIfsc(ifsc),
  };
  const onIfsc = (value: string) => {
    setIfsc(value);
    const name = bankFromIfsc(value);
    if (name && !bank.trim()) setBank(name);
  };
  const save = () => {
    setTried(true);
    if (checks.bank.level === 'error' || checks.number.level === 'error' || !ownerId) {
      if (!ownerId) toast('Pick whose account it is', { tone: 'warn' });
      return;
    }
    const saved = saveBankAccount({
      id: a?.id, ownerId, bank: bank.trim(), type, accountNumber: accountNumber.replace(/\s/g, ''), ifsc: ifsc ? compactUpper(ifsc) : undefined,
      branch: branch.trim() || undefined, holder: holder.trim() || undefined, customerId: customerId.trim() || undefined,
      netbankingId: netbankingId.trim() || undefined, netbankingPassword: netbankingPassword || undefined,
      registeredMobile: registeredMobile.trim() || undefined, nominee: nominee.trim() || undefined, upiIds: upiIds.trim() || undefined,
      notes: notes.trim() || undefined, onlyMe: ownerId === viewerId ? onlyMe : false,
    });
    toast('Account saved', { tone: 'success' });
    if (a) setEditing(false);
    else router.replace(`/bank/${saved}`);
  };

  return (
    <Screen title={a ? 'Edit account' : 'New bank account'} footer={<Button label="Save" onPress={save} testID="bank-save" />} testID="bank-edit">
      <OwnerPicker family={family} value={ownerId} onChange={setOwnerId} />
      <TextField label="IFSC" value={ifsc} onChangeText={onIfsc} autoCapitalize="characters" check={checks.ifsc} helper="Typing the IFSC fills in the bank" testID="bank-ifsc" />
      <TextField label="Bank" value={bank} onChangeText={setBank} required check={checks.bank} showCheck={tried} testID="bank-name" />
      {!bank ? (
        <View style={styles.chips}>
          {COMMON_BANKS.slice(0, 8).map((b) => <Chip key={b} label={b} onPress={() => setBank(b)} />)}
        </View>
      ) : null}
      <Section title="Account type">
        <ChipChoice options={ACCOUNT_TYPES} value={type} onChange={setType} testID="bank-type" />
      </Section>
      <TextField label="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" required check={checks.number} showCheck={tried} testID="bank-number" />
      <TextField label="Branch" value={branch} onChangeText={setBranch} />
      <TextField label="Account holder, as printed" value={holder} onChangeText={setHolder} />
      <TextField label="Nominee" value={nominee} onChangeText={setNominee} helper="Worth checking for every account" />
      <TextField label="Customer ID / CIF" value={customerId} onChangeText={setCustomerId} autoCapitalize="none" />
      <TextField label="Registered mobile" value={registeredMobile} onChangeText={setRegisteredMobile} keyboardType="phone-pad" check={checkPhone(registeredMobile)} />
      <TextField label="UPI IDs" value={upiIds} onChangeText={setUpiIds} autoCapitalize="none" placeholder="name@bank" />
      <Section title="Net banking (hidden until fingerprint or PIN)">
        <TextField label="Net-banking ID" value={netbankingId} onChangeText={setNetbankingId} autoCapitalize="none" />
        <TextField label="Net-banking password" value={netbankingPassword} onChangeText={setNetbankingPassword} secure />
      </Section>
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline max={300} />
      <OnlyMeToggle visible={ownerId === viewerId} value={onlyMe} onChange={setOnlyMe} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stamp: { marginBottom: space.md },
  shareNote: { marginTop: space.sm, marginBottom: space.lg },
  section: { marginTop: space.lg, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -space.sm, marginBottom: space.lg },
});
