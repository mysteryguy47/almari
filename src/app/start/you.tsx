import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { ChipChoice, DateField, TextField } from '@/components/Fields';
import { Card, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import type { Gender } from '@/domain/types';
import { checkPersonName, checkPhone } from '@/domain/validation';
import { GENDERS } from '@/lib/options';
import { useApp } from '@/store/app-store';
import { useAccount } from '@/store/hooks';
import { nextRoute } from '@/sync/account';
import { askToJoin, invitesForMe } from '@/sync/actions';
import type { InviteRow } from '@/sync/api';
import { requestSync } from '@/sync/runtime';
import { space } from '@/theme/tokens';

/** First-run step 1: about you. Only the name is required. */
export default function AboutYou() {
  const account = useAccount();
  const [fullName, setFullName] = useState(account?.name ?? '');
  const [dob, setDob] = useState<string>();
  const [gender, setGender] = useState<Gender>();
  const [phone, setPhone] = useState('+91 ');
  const [tried, setTried] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [asked, setAsked] = useState(false);
  const joined = useApp((s) => Object.keys(s.cloud?.memberships ?? {}).length > 0);

  useEffect(() => {
    invitesForMe().then(setInvites).catch(() => undefined);
  }, []);

  // After asking to join: the family's next sync lets us in; check every few seconds.
  useEffect(() => {
    if (!asked) return;
    const timer = setInterval(() => requestSync(0), 4000);
    return () => clearInterval(timer);
  }, [asked]);

  useEffect(() => {
    if (joined) router.replace(nextRoute());
  }, [joined]);

  if (!account) return <Redirect href="/welcome" />;

  const nameCheck = checkPersonName(fullName);
  const next = () => {
    setTried(true);
    if (nameCheck.level === 'error') return;
    router.push({
      pathname: '/start/family',
      params: { fullName: fullName.trim(), dob: dob ?? '', gender: gender ?? '', phone: phone.trim() === '+91' ? '' : phone.trim() },
    });
  };

  return (
    <Screen title="About you" subtitle="Step 1 of 4" back={false} footer={<Button label="Continue" onPress={next} testID="you-continue" />} testID="start-you">
      {invites.length ? (
        <Card style={styles.invite}>
          <T variant="bodyStrong">You have an invitation</T>
          {asked ? (
            <T variant="small" color="ink2" testID="join-asked">Asked. You are in as soon as someone in that family opens Almari. Or open the invite link they sent you, which works at once.</T>
          ) : (
            <>
              <T variant="small" color="ink2">A family invited {account.email}. Open the link they sent you, or ask to join here and anyone in the family lets you in when they next open Almari.</T>
              <Button
                label="Ask to join"
                size="md"
                variant="secondary"
                testID="ask-to-join"
                onPress={async () => {
                  for (const invite of invites) await askToJoin(invite.id);
                  setAsked(true);
                }}
              />
            </>
          )}
        </Card>
      ) : null}
      <T variant="body" color="ink2" style={{ marginBottom: 16 }}>{invites.length ? 'Or start your own family. ' : ''}Write your name as it is on your Aadhaar. Everything else can wait.</T>
      <TextField label="Full name" value={fullName} onChangeText={setFullName} required autoComplete="name" check={nameCheck} showCheck={tried} testID="you-name" />
      <DateField label="Date of birth" value={dob} onChange={setDob} allowYearOnly helper="Only the year is fine, as on some older Aadhaar cards" testID="you-dob" />
      <Section title="Gender">
        <ChipChoice options={GENDERS} value={gender} onChange={setGender} testID="you-gender" />
      </Section>
      <TextField label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" check={checkPhone(phone.trim() === '+91' ? '' : phone)} testID="you-phone" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  invite: { gap: space.sm, marginBottom: space.xl },
});
