import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Layout';
import { SharingChoice } from '@/components/SharingChoice';
import { T } from '@/components/Text';
import type { PersonalSharing } from '@/domain/types';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { space } from '@/theme/tokens';

/** First-run step 4: who sees personal papers. Common papers are always shared. */
export default function Privacy() {
  const ctx = useCtx();
  const setPersonalSharing = useApp((s) => s.setPersonalSharing);
  const [value, setValue] = useState<PersonalSharing>(ctx?.family.personalSharing ?? 'family');
  if (!ctx) return <Redirect href="/" />;

  return (
    <Screen
      title="Who sees personal papers?"
      subtitle="Step 4 of 4"
      footer={
        <Button
          label="Continue"
          testID="privacy-continue"
          onPress={() => {
            setPersonalSharing(value);
            router.push('/start/pin');
          }}
        />
      }
      testID="start-privacy"
    >
      <T variant="body" color="ink2" style={styles.lead}>
        House, car, insurance and other common papers are always shared with everyone.
      </T>
      <SharingChoice value={value} onChange={setValue} />
      <T variant="small" color="ink2" style={styles.after}>
        Everyone in the family can see this setting and change it later. When anyone changes it, everyone is told. Anyone can also mark a single item Only me.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: space.xl },
  after: { marginTop: space.xl },
});
