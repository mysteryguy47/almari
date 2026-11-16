import { ScrollView, StyleSheet } from 'react-native';

import { space } from '@/theme/tokens';

import { Chip } from './Bits';

/** Quick picks in one swipeable line, instead of a wall of chips. */
export function ChipScroller({ options, onPick, testID }: { options: string[]; onPick: (value: string) => void; testID?: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroller} testID={testID} keyboardShouldPersistTaps="handled">
      {options.map((o) => <Chip key={o} label={o} onPress={() => onPick(o)} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { marginTop: -space.sm, marginBottom: space.lg, marginHorizontal: -space.xl },
  row: { gap: space.sm, paddingHorizontal: space.xl },
});
