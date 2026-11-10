import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ChipChoice, DateField, Segmented, TextField, ToggleRow } from '@/components/Fields';
import { Card, goBack, Screen, Section } from '@/components/Layout';
import { Sheet } from '@/components/Sheet';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { T } from '@/components/Text';
import { ageFrom } from '@/domain/dates';
import { checkRemoval } from '@/domain/family-rules';
import { ID_KINDS, ID_LABELS, type Gender, type IdKind, type MemberKind } from '@/domain/types';
import { checkAadhaar, checkDrivingLicence, checkEmail, checkPan, checkPassport, checkPersonName, checkPhone, checkVoterId, type Check } from '@/domain/validation';
import { BLOOD_GROUPS, GENDERS } from '@/lib/options';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

const ID_CHECKS: Record<IdKind, (v: string) => Check> = {
  aadhaar: checkAadhaar, pan: checkPan, voter: checkVoterId, dl: checkDrivingLicence, passport: checkPassport,
};

/** Add or edit a member. Email only for people who will open the app. */
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const saveMember = useApp((s) => s.saveMember);
  const setMemorial = useApp((s) => s.setMemorial);
  const requestRemoval = useApp((s) => s.requestRemoval);
  const m = ctx && id !== 'new' ? ctx.family.members.find((x) => x.id === id) : undefined;
  const isMe = !!m && m.id === ctx?.viewerId;

  const [kind, setKind] = useState<MemberKind>(m?.kind ?? 'account');
  const [fullName, setFullName] = useState(m?.fullName ?? '');
  const [relation, setRelation] = useState(m?.relation ?? '');
  const [gender, setGender] = useState<Gender | undefined>(m?.gender);
  const [dob, setDob] = useState<string | undefined>(m?.dob);
  const [phone, setPhone] = useState(m?.phone ?? '');
  const [email, setEmail] = useState(m?.email ?? '');
  const [bloodGroup, setBloodGroup] = useState(m?.bloodGroup);
  const [isPet, setIsPet] = useState(m?.isPet ?? false);
  const [ids, setIds] = useState<Partial<Record<IdKind, string>>>(m?.ids ?? {});
  const [emergency, setEmergency] = useState(m?.emergency ?? {});
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!ctx) return <Redirect href="/" />;
  if (id !== 'new' && !m) return <Redirect href="/" />;
  const { family } = ctx;
  const accountLocked = !!m?.accountId; // a signed-in member's email is their login

  const age = ageFrom(dob);
  const checks = {
    name: checkPersonName(fullName),
    email: kind === 'account' ? checkEmail(email, true) : checkEmail(email),
  };

  const save = () => {
    setTried(true);
    setError(undefined);
    if (checks.name.level === 'error' || checks.email.level === 'error') return;
    const result = saveMember({
      id: m?.id, kind: isPet ? 'profile' : kind, accountId: m?.accountId, fullName: fullName.trim(), relation: relation.trim() || undefined,
      gender, dob, phone: phone.trim() || undefined, email: email.trim() || undefined, bloodGroup, isPet,
      ids, emergency,
    });
    if (!result.ok) return setError(result.error);
    toast(m ? 'Saved' : kind === 'account' && !isPet ? `Invite ready for ${email.trim()}. They join when they sign in.` : `${fullName.trim()} added`, { tone: 'success' });
    goBack();
  };

  const removal = m ? checkRemoval(family, ctx.viewerId, m.id) : undefined;
  const pending = m ? family.removalRequests.find((r) => r.memberId === m.id) : undefined;

  return (
    <Screen title={m ? (isMe ? 'Your profile' : `Edit ${fullName || 'member'}`) : 'Add a family member'} footer={<Button label="Save" onPress={save} testID="member-save" />} testID="member">
      {!m ? (
        <Section title="Will they open the app?">
          <Segmented<MemberKind>
            value={kind}
            onChange={setKind}
            options={[{ value: 'account', label: 'Yes, with their email' }, { value: 'profile', label: 'No (child, elder, pet)' }]}
            testID="member-kind"
          />
          <T variant="small" color="ink3">
            {kind === 'account'
              ? 'They sign in with Google or this email and join the family automatically.'
              : 'The family keeps their papers. They can claim the profile later with their own email.'}
          </T>
        </Section>
      ) : null}
      {m && m.kind === 'profile' && !m.isPet && m.status !== 'memorial' ? (
        <Card style={styles.claim}>
          <ToggleRow
            title="Claim this profile"
            subtitle="Got their own email? They sign in and their papers come with them."
            value={kind === 'account'}
            onValueChange={(v) => setKind(v ? 'account' : 'profile')}
            testID="member-claim"
          />
        </Card>
      ) : null}
      {kind === 'profile' && !m ? <ToggleRow title="This is a pet" subtitle="Vaccinations, registration, the vet’s number" value={isPet} onValueChange={setIsPet} /> : null}

      <TextField label={isPet ? 'Name' : 'Full name, as on Aadhaar'} value={fullName} onChangeText={setFullName} required check={checks.name} showCheck={tried} testID="member-name" />
      <TextField label="What you call them (optional)" value={relation} onChangeText={setRelation} placeholder="Papa, Mummy, Dadi, Chotu" testID="member-relation" />
      {kind === 'account' || m?.email ? (
        <TextField
          label="Email"
          value={email}
          onChangeText={accountLocked ? () => undefined : setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          required={kind === 'account'}
          check={checks.email}
          showCheck={tried}
          helper={accountLocked ? 'This is how they sign in, so it cannot be changed here.' : 'Their Google or sign-in email'}
          testID="member-email"
        />
      ) : null}
      {!isPet ? (
        <>
          <Section title="Gender">
            <ChipChoice options={GENDERS} value={gender} onChange={setGender} />
          </Section>
          <DateField label="Date of birth" value={dob} onChange={setDob} allowYearOnly helper={age ? `${age.years}${age.approximate ? ' (approx.)' : ''} years old` : 'Only the year is fine'} testID="member-dob" />
          <TextField label="Mobile" value={phone} onChangeText={setPhone} keyboardType="phone-pad" check={checkPhone(phone)} />
          <Section title="Blood group">
            <ChipChoice options={BLOOD_GROUPS} value={bloodGroup} onChange={setBloodGroup} />
          </Section>
          <Section title="ID numbers (fill in themselves when the papers are added)">
            {ID_KINDS.map((k) => (
              <TextField
                key={k}
                label={ID_LABELS[k]}
                value={ids[k] ?? ''}
                onChangeText={(v) => setIds((cur) => ({ ...cur, [k]: v }))}
                keyboardType={k === 'aadhaar' ? 'number-pad' : undefined}
                autoCapitalize={k === 'aadhaar' ? 'none' : 'characters'}
                check={ID_CHECKS[k](ids[k] ?? '')}
                testID={`member-id-${k}`}
              />
            ))}
          </Section>
          <Section title="Emergency card">
            <TextField label="Allergies" value={emergency.allergies ?? ''} onChangeText={(v) => setEmergency((e) => ({ ...e, allergies: v }))} />
            <TextField label="Conditions" value={emergency.conditions ?? ''} onChangeText={(v) => setEmergency((e) => ({ ...e, conditions: v }))} />
            <TextField label="Regular medicines" value={emergency.medicines ?? ''} onChangeText={(v) => setEmergency((e) => ({ ...e, medicines: v }))} multiline />
            <TextField label="Doctor" value={emergency.doctor ?? ''} onChangeText={(v) => setEmergency((e) => ({ ...e, doctor: v }))} />
            <TextField label="Emergency contacts" value={emergency.contacts ?? ''} onChangeText={(v) => setEmergency((e) => ({ ...e, contacts: v }))} multiline />
          </Section>
        </>
      ) : null}
      {error ? <T variant="smallStrong" color="sindoor">{error}</T> : null}

      {m && !isMe ? (
        <Card style={styles.danger}>
          {m.kind === 'profile' && !m.isPet ? (
            <ToggleRow
              title="In loving memory"
              subtitle="The profile becomes read-only, reminders stop, and the papers stay for claims."
              value={m.status === 'memorial'}
              onValueChange={(v) => setMemorial(m.id, v)}
              testID="member-memorial"
            />
          ) : null}
          {pending ? (
            <T variant="small" color="haldi">A request to remove {m.fullName} is waiting for a second member to approve it in Settings → Family.</T>
          ) : removal?.ok ? (
            <Button label={removal.needsApproval ? 'Ask to remove from the family' : 'Remove from the family'} icon="Trash" variant="danger" onPress={() => setConfirmRemove(true)} testID="member-remove" />
          ) : removal ? (
            <T variant="small" color="ink2">{removal.reason}</T>
          ) : null}
        </Card>
      ) : null}

      <Sheet
        visible={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`Remove ${m?.fullName ?? ''}?`}
        subtitle={removal?.ok && removal.needsApproval ? 'Nobody is the boss: a second member must approve before it happens.' : 'Their papers move to Recently deleted.'}
      >
        <View style={styles.sheet}>
          <SlideToConfirm
            label={removal?.ok && removal.needsApproval ? 'Slide to ask' : 'Slide to remove'}
            tone="sindoor"
            onConfirm={() => {
              setConfirmRemove(false);
              if (!m) return;
              const r = requestRemoval(m.id);
              if (!r.ok) return toast(r.error, { tone: 'warn' });
              toast(r.value === 'removed' ? `${m.fullName} removed` : 'Asked. Another member must approve.', { tone: 'success' });
              goBack();
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  danger: { gap: space.md, marginTop: space.lg },
  claim: { marginBottom: space.lg },
  sheet: { paddingBottom: space.md },
});
