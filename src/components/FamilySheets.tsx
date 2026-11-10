import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { activeAccountMembers, displayName } from '@/domain/access';
import { MAX_FAMILIES_PER_PERSON } from '@/domain/family-rules';
import { useApp } from '@/store/app-store';
import { useAccount, useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

import { Avatar } from './Bits';
import { Button } from './Button';
import { Icon } from './Icon';
import { Card, Row } from './Layout';
import { Sheet } from './Sheet';
import { T } from './Text';

/** Switch between the families you belong to (up to three), or start another. */
export function FamilySwitcher({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const ctx = useCtx();
  const account = useAccount();
  const families = useApp((s) => s.families);
  const switchFamily = useApp((s) => s.switchFamily);
  const exitSample = useApp((s) => s.exitSample);
  if (!ctx) return null;

  if (ctx.family.isSample) {
    return (
      <Sheet visible={visible} onClose={onClose} title="Sample family" subtitle="The Sharmas are made up. Nothing here is real.">
        <Button
          label="Leave the sample and start your own"
          icon="LogOut"
          onPress={() => {
            onClose();
            exitSample();
            router.replace('/welcome');
          }}
        />
      </Sheet>
    );
  }

  const mine = (account?.familyIds ?? []).map((id) => families[id]).filter(Boolean);
  return (
    <Sheet visible={visible} onClose={onClose} title="Your families" subtitle={`You can belong to up to ${MAX_FAMILIES_PER_PERSON}.`} testID="family-switcher">
      <Card padded={false}>
        {mine.map((f, i) => (
          <Row
            key={f.id}
            testID={`family-${f.id}`}
            title={f.name}
            subtitle={`${f.members.length} members`}
            icon="House"
            tint="inland"
            divider={i > 0}
            chevron={false}
            right={f.id === ctx.family.id ? <Icon name="Check" size={22} color="accent" /> : null}
            onPress={() => {
              switchFamily(f.id);
              onClose();
              toast(`Switched to ${f.name}`);
            }}
          />
        ))}
      </Card>
      <View style={styles.gap} />
      {mine.length < MAX_FAMILIES_PER_PERSON ? (
        <Button
          label="Start another family"
          variant="secondary"
          icon="Plus"
          onPress={() => {
            onClose();
            router.push({ pathname: '/start/family', params: { again: '1' } });
          }}
        />
      ) : (
        <T variant="small" color="ink2" align="center">You are in {MAX_FAMILIES_PER_PERSON} families. Leave one to start or join another.</T>
      )}
    </Sheet>
  );
}

/** Sample family only: see the app through another member's eyes, to understand privacy and reminders. */
export function ViewAsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const ctx = useCtx();
  const setViewAs = useApp((s) => s.setViewAs);
  if (!ctx) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title="View as" subtitle="See what each person sees and is reminded about.">
      <Card padded={false}>
        {activeAccountMembers(ctx.family).map((m, i) => (
          <Row
            key={m.id}
            testID={`view-as-${m.id}`}
            title={displayName(m)}
            subtitle={m.fullName}
            left={<Avatar member={m} size={40} />}
            divider={i > 0}
            chevron={false}
            right={m.id === ctx.viewerId ? <Icon name="Check" size={22} color="accent" /> : null}
            onPress={() => {
              setViewAs(m.id);
              onClose();
              toast(`Now viewing as ${displayName(m)}`);
            }}
          />
        ))}
      </Card>
      <T variant="small" color="ink2" style={styles.note}>
        In a real family each person signs in on their own phone. Kids, grandparents without email and pets are profile-only, so they are not listed here.
      </T>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  gap: { height: space.lg },
  note: { marginTop: space.md },
});
