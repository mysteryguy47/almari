import { Redirect, router } from 'expo-router';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Card, Row, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { MAX_FAMILIES_PER_PERSON } from '@/domain/family-rules';
import { useApp } from '@/store/app-store';
import { useAccount, useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';

/** One person, up to three families: a parent's, an in-law's, a sibling's. */
export default function Families() {
  const ctx = useCtx();
  const account = useAccount();
  const families = useApp((s) => s.families);
  const switchFamily = useApp((s) => s.switchFamily);
  if (!ctx) return <Redirect href="/" />;
  if (ctx.family.isSample || !account) {
    return (
      <Screen title="Your families">
        <Card><T variant="body" color="ink2">The sample family stands alone. Create an account to start your own, and you can belong to up to {MAX_FAMILIES_PER_PERSON} families.</T></Card>
      </Screen>
    );
  }
  const mine = account.familyIds.map((id) => families[id]).filter(Boolean);
  return (
    <Screen title="Your families" subtitle={`${mine.length} of ${MAX_FAMILIES_PER_PERSON}`} testID="families">
      <Card padded={false}>
        {mine.map((f, i) => (
          <Row
            key={f.id}
            title={f.name}
            subtitle={`${f.members.length} members`}
            icon="House"
            tint="inland"
            divider={i > 0}
            chevron={false}
            right={f.id === ctx.family.id ? <Icon name="Check" size={22} color="accent" /> : undefined}
            onPress={() => {
              switchFamily(f.id);
              toast(`Switched to ${f.name}`);
              router.replace('/');
            }}
          />
        ))}
      </Card>
      <T variant="small" color="ink2" style={{ marginVertical: 16 }}>Each family has its own papers, members and plan. Switching never mixes them.</T>
      {mine.length < MAX_FAMILIES_PER_PERSON ? (
        <Button label="Start another family" icon="Plus" variant="secondary" onPress={() => router.push({ pathname: '/start/family', params: { again: '1' } })} testID="start-another" />
      ) : (
        <T variant="small" color="ink2">That is the most. Leave one to start or join another.</T>
      )}
    </Screen>
  );
}
