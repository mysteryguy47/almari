import { StyleSheet, View } from 'react-native';

import type { PersonalSharing } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { IconTile } from './Bits';
import { Icon } from './Icon';
import { Pressy } from './Pressy';
import { T } from './Text';

export const SHARING_OPTIONS: { value: PersonalSharing; title: string; line: string; recommended?: boolean }[] = [
  {
    value: 'family',
    title: 'We are one family. Everyone sees everything.',
    line: 'Anyone can find Papa’s PAN or Riya’s marksheet when it is needed.',
    recommended: true,
  },
  {
    value: 'private',
    title: 'Share only the family’s common papers.',
    line: 'Each person’s Aadhaar, PAN, certificates and bank cards stay with them. Kids’ and elders’ papers stay shared.',
  },
];

export function SharingChoice({ value, onChange }: { value: PersonalSharing; onChange: (v: PersonalSharing) => void }) {
  const { palette } = useTheme();
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {SHARING_OPTIONS.map((o) => {
        const on = o.value === value;
        return (
          <Pressy
            key={o.value}
            testID={`sharing-${o.value}`}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[styles.option, { backgroundColor: palette.surface, borderColor: on ? palette.accent : palette.line, borderWidth: on ? 2 : 1 }]}
          >
            <IconTile icon={o.value === 'family' ? 'Users' : 'Lock'} tint={o.value === 'family' ? 'almari' : 'stamp'} size={44} />
            <View style={styles.flex}>
              <T variant="bodyStrong">{o.title}</T>
              <T variant="small" color="ink2">{o.line}</T>
              {o.recommended ? <T variant="label" color="accent" style={styles.rec}>Recommended</T> : null}
            </View>
            <Icon name={on ? 'CircleCheck' : 'Plus'} size={22} color={on ? 'accent' : 'line'} />
          </Pressy>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  options: { gap: space.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  rec: { marginTop: 4 },
});
