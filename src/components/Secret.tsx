import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { copyText } from '@/lib/device';
import { ensureReauth } from '@/lib/reauth';
import { toast } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

import { Icon } from './Icon';
import { T } from './Text';

export interface ValueRowProps {
  label: string;
  value: string | undefined;
  /** Hidden until the fingerprint or PIN; copying asks too. */
  secret?: boolean;
  /** What to show while hidden, e.g. a masked Aadhaar. Defaults to dots. */
  masked?: string;
  /** What to copy, if it differs from what is shown (e.g. digits without spaces). */
  copyValue?: string;
  /** One calm line shown on reveal: "No bank will ever ask you for these." */
  guard?: string;
  large?: boolean;
  testID?: string;
}

/** A number or secret with its own copy button: the number matters more than the file. */
export function ValueRow({ label, value, secret, masked, copyValue, guard, large, testID }: ValueRowProps) {
  const { palette } = useTheme();
  const [shown, setShown] = useState(!secret);
  if (!value) return null;

  const reveal = async () => {
    if (shown && secret) return setShown(false);
    if (await ensureReauth(`See ${label}`)) {
      setShown(true);
      if (guard) toast(guard, { tone: 'warn' });
    }
  };
  const copy = async () => {
    if (secret && !(await ensureReauth(`Copy ${label}`))) return;
    await copyText(copyValue ?? value, { secret });
    toast(secret ? `${label} copied. It clears from the clipboard in a minute.` : `${label} copied`, { tone: 'success' });
  };

  return (
    <View style={[styles.row, { borderColor: palette.line }]} testID={testID}>
      <View style={styles.text}>
        <T variant="label" color="ink2">{label}</T>
        <T variant={large ? 'numberLarge' : 'number'} selectable={shown} accessibilityLabel={shown ? `${label}: ${value}` : `${label}: hidden`}>
          {shown ? value : masked ?? '••••••••'}
        </T>
      </View>
      {secret ? (
        <Pressable onPress={reveal} accessibilityRole="button" accessibilityLabel={shown ? `Hide ${label}` : `Show ${label}`} hitSlop={8} style={styles.action}>
          <Icon name={shown ? 'EyeOff' : 'Eye'} size={22} color="ink2" />
        </Pressable>
      ) : null}
      <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={`Copy ${label}`} hitSlop={8} style={[styles.action, styles.copy, { backgroundColor: palette.accentSoft }]}>
        <Icon name="Copy" size={20} color="accent" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2 },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  copy: {},
});
