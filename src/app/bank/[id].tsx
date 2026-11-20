import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Stamp } from '@/components/Bits';
import { BankField } from '@/components/BankField';
import { Button } from '@/components/Button';
import { blankCredential, CredentialsEditor, CredentialsView } from '@/components/Credentials';
import { DocThumb } from '@/components/DocThumb';
import { ChipChoice, TextField } from '@/components/Fields';
import { DeleteItem, NotFound, OnlyMeToggle, OwnerPicker, ownerName } from '@/components/ItemBits';
import { Card, Row, Screen, Section } from '@/components/Layout';
import { BankMark, DocMark } from '@/components/Marks';
import { countFilled, More, MoreGroup } from '@/components/More';
import { ValueRow } from '@/components/Secret';
import { T } from '@/components/Text';
import { canSee, findMember, visibleTo } from '@/domain/access';
import { formatDate } from '@/domain/dates';
import { ACCOUNT_TYPE_LABELS, bankCredentials, bankFromIfsc, CARD_TYPE_LABELS, cleanCredentials, maskTail, shareAccountText } from '@/domain/money';
import { ACCOUNT_TEMPLATES } from '@/domain/templates';
import type { BankAccountType, Credential } from '@/domain/types';
import { mainFiles } from '@/domain/versions';
import { checkIfsc, checkPhone, checkRequiredText, compactUpper, digitsOnly, OK } from '@/domain/validation';
import { shareText } from '@/lib/device';
import { ACCOUNT_TYPES } from '@/lib/options';
import { lookupIfsc } from '@/lib/ifsc';
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
  // A new account's holder follows whoever it is for, until typed over.
  const [holderEdited, setHolderEdited] = useState(!!a);
  const [customerId, setCustomerId] = useState(a?.customerId ?? '');
  const [credentials, setCredentials] = useState<Credential[]>(() => {
    const saved = a ? bankCredentials(a) : [];
    return saved.length ? saved : [blankCredential()];
  });
  const [registeredMobile, setRegisteredMobile] = useState(a?.registeredMobile ?? '');
  const [nominee, setNominee] = useState(a?.nominee ?? '');
  const [upiIds, setUpiIds] = useState(a?.upiIds ?? '');
  const [notes, setNotes] = useState(a?.notes ?? '');
  const [onlyMe, setOnlyMe] = useState(a?.onlyMe ?? false);
  const [tried, setTried] = useState(false);
  const [ifscInfo, setIfscInfo] = useState<{ status: 'looking' | 'unknown' | 'offline' } | { status: 'found'; text: string }>();

  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  if (id !== 'new' && (!a || a.deletedAt || !canSee(family, viewerId, a))) return <Screen title="Bank account"><NotFound /></Screen>;

  if (!editing && a) {
    const owner = findMember(family, a.ownerId);
    const cards = visibleTo(family, viewerId, family.cards).filter((c) => c.linkedAccountId === a.id);
    const papers = visibleTo(family, viewerId, family.documents).filter((d) => d.accountId === a.id);
    const logins = bankCredentials(a);
    const addPaper = (templateId: string) => router.push({ pathname: '/doc/new', params: { template: templateId, owner: a.ownerId, account: a.id } });
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
        <View style={styles.head}>
          <BankMark bank={a.bank} size={56} />
          <View style={styles.flex}>
            <T variant="numberLarge" testID="bank-tail">{maskTail(a.accountNumber)}</T>
            <T variant="small" color="ink2" numberOfLines={1}>{a.holder || owner?.fullName}{a.branch ? ` · ${a.branch}` : ''}</T>
          </View>
          {a.onlyMe ? <Stamp text="Only me" /> : null}
        </View>
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
        <CredentialsView credentials={logins} guard={GUARD} />
        <Section title="Cheque, passbook and statements" style={styles.section}>
          <Card padded={false}>
            {papers.map((d, i) => (
              <Row
                key={d.id}
                testID={`paper-${d.id}`}
                title={d.title}
                subtitle={d.issueDate ? formatDate(d.issueDate) : `${d.files.length} ${d.files.length === 1 ? 'page' : 'pages'}`}
                left={<DocThumb templateId={d.templateId} file={mainFiles(d)[0]} width={44} />}
                divider={i > 0}
                onPress={() => router.push(`/doc/${d.id}`)}
              />
            ))}
            {ACCOUNT_TEMPLATES.filter((t) => t.id === 'bank-statement' || !papers.some((d) => d.templateId === t.id)).map((t, i) => (
              <Row
                key={t.id}
                testID={`add-paper-${t.id}`}
                title={t.id === 'bank-statement' && papers.some((d) => d.templateId === t.id) ? 'Add another statement' : `Add the ${t.name.toLowerCase()}`}
                subtitle={t.id === 'cancelled-cheque' ? 'Asked for by employers, insurers and for every KYC' : t.id === 'passbook' ? 'The first page, with the name and IFSC' : 'For a loan, a visa or an income proof'}
                left={<DocMark templateId={t.id} size={40} />}
                divider={papers.length + i > 0}
                right={<View style={styles.plus}><T variant="smallStrong" color="accent">Add</T></View>}
                chevron={false}
                onPress={() => addPaper(t.id)}
              />
            ))}
          </Card>
        </Section>
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
                <Row key={c.id} title={`${c.bank}${c.nickname ? ` ${c.nickname}` : ''}`} subtitle={`${CARD_TYPE_LABELS[c.type]} · ${maskTail(c.number)}`} left={<BankMark bank={c.bank} />} divider={i > 0} onPress={() => router.push(`/card/${c.id}`)} />
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
    const code = value.replace(/\s/g, '').toUpperCase();
    if (code.length === 11) {
      setIfscInfo({ status: 'looking' });
      lookupIfsc(code).then((r) => {
        if (r.status !== 'found') return setIfscInfo({ status: r.status });
        setIfscInfo({ status: 'found', text: [r.info.bank, r.info.branch, r.info.city].filter(Boolean).join(' · ') });
        if (!bank.trim() || bank.trim() === name) setBank(r.info.bank);
        setBranch((current) => current.trim() || r.info.branch);
      });
    } else {
      setIfscInfo(undefined);
    }
  };
  const ifscHelper =
    ifscInfo?.status === 'looking' ? 'Looking up the branch…'
      : ifscInfo?.status === 'found' ? ifscInfo.text
        : ifscInfo?.status === 'unknown' ? 'No branch found for this IFSC. Check it, or type the branch under More.'
          : ifscInfo?.status === 'offline' ? 'Offline: type the branch under More if you like.'
            : 'The bank and branch fill in from the IFSC';
  const ownerMember = findMember(family, ownerId);
  const shownHolder = holderEdited ? holder : ownerMember?.fullName ?? '';
  const save = () => {
    setTried(true);
    if (checks.bank.level === 'error' || checks.number.level === 'error' || !ownerId) {
      if (!ownerId) toast('Pick whose account it is', { tone: 'warn' });
      return;
    }
    const logins = cleanCredentials(credentials);
    const saved = saveBankAccount({
      id: a?.id, ownerId, bank: bank.trim(), type, accountNumber: accountNumber.replace(/\s/g, ''), ifsc: ifsc ? compactUpper(ifsc) : undefined,
      branch: branch.trim() || undefined, holder: shownHolder.trim() || undefined, customerId: customerId.trim() || undefined,
      credentials: logins.length ? logins : undefined, netbankingId: undefined, netbankingPassword: undefined,
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
      <TextField
        label="Account holder, as printed"
        value={shownHolder}
        onChangeText={(v) => {
          setHolderEdited(true);
          setHolder(v);
        }}
        autoCapitalize="words"
        helper={!holderEdited ? 'From the profile. Change it if the bank spells it differently.' : undefined}
        testID="bank-holder"
      />
      <TextField label="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" required check={checks.number} showCheck={tried} testID="bank-number" />
      <TextField
        label="IFSC"
        value={ifsc}
        onChangeText={onIfsc}
        autoCapitalize="characters"
        check={checks.ifsc}
        helper={ifscHelper}
        testID="bank-ifsc"
      />
      <BankField value={bank} onChange={setBank} check={checks.bank} showCheck={tried} testID="bank-name" />
      <Section title="Account type">
        <ChipChoice options={ACCOUNT_TYPES} value={type} onChange={setType} testID="bank-type" />
      </Section>
      <OnlyMeToggle visible={ownerId === viewerId} value={onlyMe} onChange={setOnlyMe} />
      <More
        summary="Branch, customer ID, net banking and app logins, nominee, UPI"
        filled={countFilled(branch, customerId, registeredMobile, cleanCredentials(credentials).length ? 'yes' : '', nominee, upiIds, notes)}
        initiallyOpen={!!a && countFilled(a.branch, a.customerId, a.registeredMobile, bankCredentials(a).length ? 'yes' : '', a.nominee, a.upiIds, a.notes) > 0}
        testID="bank-more"
      >
        <MoreGroup title="Branch and customer ID">
          <TextField label="Branch" value={branch} onChangeText={setBranch} testID="bank-branch" />
          <TextField label="Customer ID / CIF" value={customerId} onChangeText={setCustomerId} autoCapitalize="none" />
          <TextField label="Registered mobile" value={registeredMobile} onChangeText={setRegisteredMobile} keyboardType="phone-pad" check={checkPhone(registeredMobile)} />
        </MoreGroup>
        <MoreGroup title="Net banking and app logins (hidden until fingerprint or PIN)">
          <CredentialsEditor value={credentials} onChange={setCredentials} />
        </MoreGroup>
        <MoreGroup title="Nominee">
          <TextField label="Nominee" value={nominee} onChangeText={setNominee} helper="Worth checking for every account: the money map flags accounts without one" />
        </MoreGroup>
        <MoreGroup title="UPI and notes">
          <TextField label="UPI IDs" value={upiIds} onChangeText={setUpiIds} autoCapitalize="none" placeholder="name@bank" />
          <TextField label="Notes" value={notes} onChangeText={setNotes} multiline max={300} />
        </MoreGroup>
      </More>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  plus: { paddingHorizontal: space.sm },
  stamp: { marginBottom: space.md },
  shareNote: { marginTop: space.sm, marginBottom: space.lg },
  section: { marginTop: space.lg, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -space.sm, marginBottom: space.lg },
});
