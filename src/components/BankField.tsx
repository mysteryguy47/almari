import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { findBank, POPULAR_BANKS, searchBanks } from '@/domain/banks';
import type { Check } from '@/domain/validation';
import { haptic } from '@/lib/device';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { TextField } from './Fields';
import { useLift } from './Layout';
import { BankMark } from './Marks';
import { Pressy } from './Pressy';
import { T } from './Text';

/** How the quick picks read: the name people say. */
const CHIP: Record<string, string> = {
  'State Bank of India': 'SBI', 'HDFC Bank': 'HDFC', 'ICICI Bank': 'ICICI', 'Axis Bank': 'Axis', 'Kotak Mahindra Bank': 'Kotak',
  'Punjab National Bank': 'PNB', 'Bank of Baroda': 'Bank of Baroda', 'Canara Bank': 'Canara', 'Union Bank of India': 'Union Bank', 'IndusInd Bank': 'IndusInd',
};

/**
 * The bank's name, with suggestions as you type ("sb" → State Bank of
 * India, "vijaya" → Bank of Baroda) and the bank's mark once it is known.
 * Any name can be typed: a small co-operative bank is still a bank.
 */
export function BankField({
  label = 'Bank', value, onChange, check, showCheck, issuers, testID,
}: { label?: string; value: string; onChange: (v: string) => void; check?: Check; showCheck?: boolean; issuers?: boolean; testID?: string }) {
  const { palette } = useTheme();
  const lift = useLift();
  const known = findBank(value);
  const exact = known && known.name.toLowerCase() === value.trim().toLowerCase();
  const results = value.trim() && !exact ? searchBanks(value, 5, issuers) : [];
  const pick = (name: string) => {
    haptic.tap();
    onChange(name);
  };

  return (
    <View>
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="Type a few letters: sbi, hdfc, canara"
        autoCapitalize="words"
        required
        check={check}
        showCheck={showCheck}
        testID={testID}
        right={known ? <View style={styles.mark}><BankMark bank={known.name} size={30} /></View> : undefined}
      />
      {results.length ? (
        <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(100)} style={[styles.list, { backgroundColor: palette.surface, borderColor: palette.line }, lift]} testID={testID ? `${testID}-suggestions` : undefined}>
          {results.map((bank, i) => (
            <Pressy
              key={bank.name}
              onPress={() => pick(bank.name)}
              scaleTo={0.98}
              accessibilityLabel={bank.name}
              testID={testID ? `${testID}-pick-${i}` : undefined}
              style={[styles.option, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line } : null]}
            >
              <BankMark bank={bank.name} size={32} />
              <View style={styles.flex}>
                <T variant="bodyStrong" numberOfLines={1}>{bank.name}</T>
                {bank.aka?.length && !bank.name.toLowerCase().includes(value.trim().toLowerCase()) ? (
                  <T variant="small" color="ink3" numberOfLines={1}>Also {bank.aka.find((a) => a.includes(value.trim().toLowerCase())) ?? bank.aka[0]}</T>
                ) : null}
              </View>
            </Pressy>
          ))}
        </Animated.View>
      ) : !value.trim() ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.scroller} contentContainerStyle={styles.row} testID="bank-suggestions">
          {POPULAR_BANKS.map((name) => (
            <Pressy key={name} onPress={() => pick(name)} accessibilityLabel={name} style={[styles.quick, { backgroundColor: palette.surface, borderColor: palette.line }]} scaleTo={0.96}>
              <BankMark bank={name} size={24} />
              <T variant="smallStrong">{CHIP[name] ?? name}</T>
            </Pressy>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mark: { marginLeft: space.sm },
  list: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginTop: -space.sm, marginBottom: space.lg },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, minHeight: 52, paddingVertical: space.sm },
  scroller: { marginTop: -space.sm, marginBottom: space.lg, marginHorizontal: -space.xl },
  row: { gap: space.sm, paddingHorizontal: space.xl },
  quick: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: 6, paddingRight: space.md, minHeight: 38, borderRadius: radius.pill, borderWidth: 1 },
});
