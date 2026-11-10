import { StyleSheet, View } from 'react-native';

import { initCrypto } from '@/lib/crypto';
import { symbolsFor } from '@/sync/vault';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { T } from './Text';

void initCrypto();

/** The six symbols for a device's key, the same on both screens. */
export function Symbols({ publicKey, testID }: { publicKey: string; testID?: string }) {
  const { palette } = useTheme();
  let symbols: { emoji: string; name: string }[] = [];
  try {
    symbols = symbolsFor(publicKey);
  } catch {
    return null; // encryption still starting
  }
  return (
    <View style={styles.grid} testID={testID} accessibilityLabel={`Symbols: ${symbols.map((s) => s.name).join(', ')}`}>
      {symbols.map((s, i) => (
        <View key={i} style={[styles.cell, { backgroundColor: palette.surfaceAlt, borderColor: palette.line }]}>
          <T style={styles.emoji}>{s.emoji}</T>
          <T variant="small" color="ink2">{s.name}</T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  cell: { width: 92, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  emoji: { fontSize: 30, lineHeight: 38 },
});
