import { ScrollView, StyleSheet, View } from 'react-native';

import { displayName } from '@/domain/access';
import type { ID, Member } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

import { Avatar } from './Bits';
import { Icon } from './Icon';
import { Pressy } from './Pressy';
import { T } from './Text';

export const FAMILY = 'family';

/** "For whom?" A row of faces. Optionally a Family choice first, and multiple selection for tasks. */
export function MemberPicker({
  members, value, onChange, allowFamily, familyLabel = 'Family', multiple, testID,
}: {
  members: Member[];
  value: ID[];
  onChange: (value: ID[]) => void;
  allowFamily?: boolean;
  familyLabel?: string;
  multiple?: boolean;
  testID?: string;
}) {
  const { palette } = useTheme();
  const toggle = (id: ID) => {
    if (!multiple) return onChange([id]);
    if (id === FAMILY) return onChange([]);
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value.filter((v) => v !== FAMILY), id]);
  };
  const isOn = (id: ID) => (multiple && id === FAMILY ? value.length === 0 : value.includes(id));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {allowFamily ? (
        <Pressy testID={testID ? `${testID}-family` : undefined} onPress={() => toggle(FAMILY)} style={styles.item} accessibilityState={{ selected: isOn(FAMILY) }} accessibilityLabel={familyLabel}>
          <View style={[styles.familyIcon, { backgroundColor: palette.inlandSoft, borderColor: isOn(FAMILY) ? palette.accent : 'transparent' }]}>
            <Icon name="Users" size={24} color="inland" />
          </View>
          <T variant="smallStrong" color={isOn(FAMILY) ? 'accent' : 'ink2'} numberOfLines={1}>{familyLabel}</T>
        </Pressy>
      ) : null}
      {members.map((m) => (
        <Pressy key={m.id} testID={testID ? `${testID}-${m.id}` : undefined} onPress={() => toggle(m.id)} style={styles.item} accessibilityState={{ selected: isOn(m.id) }} accessibilityLabel={m.fullName}>
          <Avatar member={m} size={56} ring={isOn(m.id)} />
          <T variant="smallStrong" color={isOn(m.id) ? 'accent' : 'ink2'} numberOfLines={1}>{displayName(m)}</T>
        </Pressy>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.md, paddingVertical: space.xs },
  item: { alignItems: 'center', gap: 6, width: 72 },
  familyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
