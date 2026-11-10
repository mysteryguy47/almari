import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * The steel almari, drawn with plain shapes: two doors, brass handles, a
 * keyhole, and the little locker inside every Indian family's papers.
 */
export function AlmariArt({ size = 132 }: { size?: number }) {
  const { palette } = useTheme();
  const w = size;
  const h = size * 1.32;
  return (
    <View style={{ width: w, height: h + 10 }} accessibilityLabel="An almari" accessible>
      <View style={[styles.body, { width: w, height: h, backgroundColor: palette.accent, borderRadius: w * 0.08 }]}>
        <View style={[styles.door, { borderColor: palette.accentSoft, borderRightWidth: 1.5 }]}>
          <View style={[styles.panel, { borderColor: palette.accentSoft }]} />
          <View style={[styles.handle, { right: 8, backgroundColor: palette.brass }]} />
        </View>
        <View style={styles.door}>
          <View style={[styles.panel, { borderColor: palette.accentSoft }]} />
          <View style={[styles.handle, { left: 8, backgroundColor: palette.brass }]} />
          <View style={[styles.keyhole, { backgroundColor: palette.brass, left: 6 }]} />
        </View>
      </View>
      <View style={[styles.legs, { width: w }]}>
        <View style={[styles.leg, { backgroundColor: palette.ink2 }]} />
        <View style={[styles.leg, { backgroundColor: palette.ink2 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flexDirection: 'row', overflow: 'hidden' },
  door: { flex: 1, padding: 10, justifyContent: 'center' },
  panel: { flex: 1, borderWidth: 1.5, borderRadius: 6 },
  handle: { position: 'absolute', top: '46%', width: 5, height: 22, borderRadius: 3 },
  keyhole: { position: 'absolute', top: '62%', width: 6, height: 9, borderRadius: 3 },
  legs: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
  leg: { width: 10, height: 10, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
});
