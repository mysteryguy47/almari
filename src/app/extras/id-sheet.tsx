import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Card, Screen } from '@/components/Layout';
import { ValueRow } from '@/components/Secret';
import { T } from '@/components/Text';
import { familyRow } from '@/domain/access';
import { ageFrom, formatDate } from '@/domain/dates';
import { maskAadhaar } from '@/domain/money';
import { digitsOnly } from '@/domain/validation';
import { ensureReauth } from '@/lib/reauth';
import { useCtx } from '@/store/hooks';
import { space } from '@/theme/tokens';

/** Everyone's numbers on one page, behind the fingerprint or PIN: school forms, insurance forms, train bookings. */
export default function IdSheet() {
  const ctx = useCtx();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    ensureReauth('Open the Family ID sheet').then(setOpen);
  }, []);
  if (!ctx) return <Redirect href="/" />;
  const people = familyRow(ctx.family).filter((m) => !m.isPet && m.status !== 'memorial');

  return (
    <Screen title="Family ID sheet" subtitle={ctx.family.name} testID="id-sheet">
      {!open ? (
        <Card style={styles.locked}>
          <T variant="body" color="ink2">Everyone’s numbers in one place. Prove it is you to open it.</T>
          <Button label="Open" icon="FingerprintPattern" onPress={async () => setOpen(await ensureReauth('Open the Family ID sheet'))} />
        </Card>
      ) : (
        people.map((m) => {
          const age = ageFrom(m.dob);
          return (
            <Card key={m.id} style={styles.card}>
              <View style={styles.head}>
                <Avatar member={m} size={40} />
                <View style={styles.flex}>
                  <T variant="bodyStrong">{m.fullName}</T>
                  <T variant="small" color="ink2">
                    {[m.dob ? formatDate(m.dob) : null, age ? `${age.years} yrs` : null, m.bloodGroup ? `Blood ${m.bloodGroup}` : null].filter(Boolean).join(' · ') || 'No details yet'}
                  </T>
                </View>
              </View>
              <ValueRow label="Aadhaar" value={m.ids.aadhaar} secret masked={m.ids.aadhaar ? maskAadhaar(m.ids.aadhaar) : undefined} copyValue={m.ids.aadhaar ? digitsOnly(m.ids.aadhaar) : undefined} />
              <ValueRow label="PAN" value={m.ids.pan} />
              <ValueRow label="Passport" value={m.ids.passport} />
              <ValueRow label="Voter ID" value={m.ids.voter} />
              <ValueRow label="Driving licence" value={m.ids.dl} />
              <ValueRow label="Mobile" value={m.phone} />
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  locked: { gap: space.md },
  card: { marginBottom: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
});
