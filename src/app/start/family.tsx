import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Nameplate } from '@/components/Bits';
import { Button } from '@/components/Button';
import { ChipChoice, TextField } from '@/components/Fields';
import { Card, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { familyNameSuggestions, MAX_FAMILIES_PER_PERSON } from '@/domain/family-rules';
import type { Gender } from '@/domain/types';
import { checkFamilyName, LIMITS } from '@/domain/validation';
import { useAccount } from '@/store/hooks';
import { createFamily } from '@/sync/actions';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

/** First-run step 2: name the family. The name becomes the app's title for everyone in it. */
export default function NameFamily() {
  const params = useLocalSearchParams<{ fullName?: string; dob?: string; gender?: string; phone?: string; again?: string }>();
  const account = useAccount();
  const fullName = params.fullName || account?.name || '';
  const suggestions = familyNameSuggestions(fullName);
  const [name, setName] = useState(suggestions[0] ?? '');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (!account) return <Redirect href="/welcome" />;
  const again = params.again === '1';

  const check = checkFamilyName(name);
  const create = async () => {
    setTried(true);
    if (check.level === 'error') return;
    setBusy(true);
    const result = await createFamily(name, {
      fullName,
      dob: params.dob || undefined,
      gender: (params.gender as Gender) || undefined,
      phone: params.phone || undefined,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (again) {
      toast(`${name} is ready`, { tone: 'success' });
      router.replace('/');
    } else {
      router.replace('/start/members');
    }
  };

  return (
    <Screen
      title={again ? 'Start another family' : 'Name your family'}
      subtitle={again ? `You can be in up to ${MAX_FAMILIES_PER_PERSON} families` : 'Step 2 of 4'}
      back={again || !!params.fullName}
      footer={<Button label="Create family" onPress={create} loading={busy} testID="create-family" />}
      testID="start-family"
    >
      <View style={styles.preview}>
        <Nameplate name={name.trim() || 'Your family'} />
      </View>
      <T variant="body" color="ink2" style={styles.lead}>This name is the title of the app for everyone in the family.</T>
      {suggestions.length ? (
        <Section title="Suggestions">
          <ChipChoice options={suggestions.map((s) => ({ value: s, label: s }))} value={name} onChange={setName} testID="family-suggestion" />
        </Section>
      ) : null}
      <TextField label="Family name" value={name} onChangeText={setName} max={LIMITS.familyName} required check={check} showCheck={tried} testID="family-name" />
      {error ? <T variant="smallStrong" color="sindoor">{error}</T> : null}
      {!again ? (
        <Card style={styles.invite}>
          <T variant="bodyStrong">Were you invited?</T>
          <T variant="small" color="ink2">
            Then you do not need a new family. Open the invite link they sent you, signed in as {account.email}.
          </T>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', marginVertical: space.lg },
  lead: { marginBottom: space.lg, textAlign: 'center' },
  invite: { gap: space.sm, marginTop: space.md },
});
