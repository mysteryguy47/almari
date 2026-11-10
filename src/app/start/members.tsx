import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Card, Row, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { ageFrom } from '@/domain/dates';
import { useCtx } from '@/store/hooks';
import { space } from '@/theme/tokens';

/** First-run step 3: add members. Adding them can wait. */
export default function AddMembers() {
  const ctx = useCtx();
  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  const others = family.members.filter((m) => m.id !== viewerId);

  return (
    <Screen
      title="Who is in the family?"
      subtitle="Step 3 of 4"
      back={false}
      footer={<Button label={others.length ? 'Continue' : 'Skip for now'} variant={others.length ? 'primary' : 'secondary'} onPress={() => router.push('/start/privacy')} testID="members-continue" />}
      testID="start-members"
    >
      <T variant="body" color="ink2" style={styles.lead}>
        Add the people who will open the app with their email; they join when they sign in. Kids, grandparents without email, and pets need no email at all.
      </T>
      {others.length ? (
        <Card padded={false} style={styles.list}>
          {others.map((m, i) => {
            const age = ageFrom(m.dob);
            return (
              <Row
                key={m.id}
                title={m.fullName}
                subtitle={[m.relation, age ? `${age.years}${age.approximate ? '+' : ''} yrs` : null, m.kind === 'account' ? `Invite sent to ${m.email}` : 'Profile only'].filter(Boolean).join(' · ')}
                left={<Avatar member={m} size={40} />}
                divider={i > 0}
                onPress={() => router.push(`/member/${m.id}`)}
              />
            );
          })}
        </Card>
      ) : null}
      <View style={styles.add}>
        <Button label="Add a family member" icon="UserPlus" variant="secondary" onPress={() => router.push('/member/new')} testID="add-member" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: space.xl },
  list: { marginBottom: space.lg },
  add: { marginTop: space.sm },
});
