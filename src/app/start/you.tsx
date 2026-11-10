import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { ChipChoice, DateField, TextField } from '@/components/Fields';
import { Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import type { Gender } from '@/domain/types';
import { checkPersonName, checkPhone } from '@/domain/validation';
import { GENDERS } from '@/lib/options';
import { useAccount } from '@/store/hooks';

/** First-run step 1: about you. Only the name is required. */
export default function AboutYou() {
  const account = useAccount();
  const [fullName, setFullName] = useState(account?.name ?? '');
  const [dob, setDob] = useState<string>();
  const [gender, setGender] = useState<Gender>();
  const [phone, setPhone] = useState('+91 ');
  const [tried, setTried] = useState(false);
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
      <T variant="body" color="ink2" style={{ marginBottom: 16 }}>Write your name as it is on your Aadhaar. Everything else can wait.</T>
      <TextField label="Full name" value={fullName} onChangeText={setFullName} required autoComplete="name" check={nameCheck} showCheck={tried} testID="you-name" />
      <DateField label="Date of birth" value={dob} onChange={setDob} allowYearOnly helper="Only the year is fine, as on some older Aadhaar cards" testID="you-dob" />
      <Section title="Gender">
        <ChipChoice options={GENDERS} value={gender} onChange={setGender} testID="you-gender" />
      </Section>
      <TextField label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" check={checkPhone(phone.trim() === '+91' ? '' : phone)} testID="you-phone" />
    </Screen>
  );
}
