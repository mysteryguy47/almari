import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';

import { daysInMonth, parseDob, parseISODate, toISODate } from '@/domain/dates';
import { charLength, type Check } from '@/domain/validation';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';

import { Chip } from './Bits';
import { Icon } from './Icon';
import { T } from './Text';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Shows a counter and stops typing at this length. */
  max?: number;
  check?: Check;
  /** Show the check only after the person has tried to save. */
  showCheck?: boolean;
  helper?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  multiline?: boolean;
  required?: boolean;
  testID?: string;
  right?: ReactNode;
  onSubmitEditing?: () => void;
}

export function TextField({
  label, value, onChangeText, placeholder, max, check, showCheck = true, helper, secure, keyboardType, autoCapitalize,
  autoComplete, multiline, required, testID, right, onSubmitEditing,
}: TextFieldProps) {
  const { palette } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const visibleCheck = showCheck && check && check.level !== 'ok' ? check : undefined;
  const borderColor = visibleCheck?.level === 'error' ? palette.sindoor : focused ? palette.accent : palette.line;
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <T variant="smallStrong" color="ink2">
          {label}
          {required ? <T variant="smallStrong" color="sindoor"> *</T> : null}
        </T>
        {max ? (
          <T variant="small" color={charLength(value) > max ? 'sindoor' : 'ink3'}>
            {charLength(value)}/{max}
          </T>
        ) : null}
      </View>
      <View style={[styles.inputWrap, { borderColor, backgroundColor: palette.surface }]}>
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          value={value}
          onChangeText={(text) => onChangeText(max ? Array.from(text).slice(0, max).join('') : text)}
          placeholder={placeholder}
          placeholderTextColor={palette.ink3}
          secureTextEntry={secure && hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? (secure ? 'none' : 'sentences')}
          autoComplete={autoComplete}
          autoCorrect={!secure && keyboardType === undefined}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          maxFontSizeMultiplier={2}
          style={[styles.input, multiline ? styles.multiline : null, { color: palette.ink, fontFamily: fonts.regular }]}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show' : 'Hide'}
            hitSlop={10}
            style={styles.eye}
          >
            <Icon name={hidden ? 'Eye' : 'EyeOff'} size={20} color="ink2" />
          </Pressable>
        ) : null}
        {right}
      </View>
      {visibleCheck ? (
        <T variant="small" color={visibleCheck.level === 'error' ? 'sindoor' : 'haldi'} accessibilityLiveRegion="polite">
          {visibleCheck.message}
        </T>
      ) : helper ? (
        <T variant="small" color="ink3">{helper}</T>
      ) : null}
    </View>
  );
}

/** Day / month / year boxes. Easier than a calendar for elders, and allows year-only birth dates. */
export function DateField({
  label, value, onChange, allowYearOnly, helper, required, testID,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  allowYearOnly?: boolean;
  helper?: string;
  required?: boolean;
  testID?: string;
}) {
  const { palette } = useTheme();
  const initial = parseISODate(value);
  const yearOnly = !initial ? parseDob(value)?.year : undefined;
  const [d, setD] = useState(initial ? String(initial.d) : '');
  const [m, setM] = useState(initial ? String(initial.m) : '');
  const [y, setY] = useState(initial ? String(initial.y) : yearOnly ? String(yearOnly) : '');

  const update = (nd: string, nm: string, ny: string) => {
    setD(nd);
    setM(nm);
    setY(ny);
    const year = Number(ny);
    if (ny.length === 4 && !nd && !nm && allowYearOnly) return onChange(ny);
    const day = Number(nd);
    const month = Number(nm);
    if (ny.length === 4 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) {
      return onChange(toISODate({ y: year, m: month, d: day }));
    }
    onChange(undefined);
  };

  const partial = (d || m || y) && !value;
  const box = (v: string, set: (s: string) => void, placeholder: string, width: number, max: number, a11y: string) => (
    <TextInput
      testID={testID ? `${testID}-${placeholder}` : undefined}
      accessibilityLabel={`${label}: ${a11y}`}
      value={v}
      onChangeText={(t) => set(t.replace(/\D/g, '').slice(0, max))}
      placeholder={placeholder}
      placeholderTextColor={palette.ink3}
      keyboardType="number-pad"
      maxFontSizeMultiplier={2}
      style={[styles.dateBox, { width, borderColor: palette.line, backgroundColor: palette.surface, color: palette.ink, fontFamily: fonts.medium }]}
    />
  );
  return (
    <View style={styles.field}>
      <T variant="smallStrong" color="ink2">
        {label}
        {required ? <T variant="smallStrong" color="sindoor"> *</T> : null}
      </T>
      <View style={styles.dateRow}>
        {box(d, (t) => update(t, m, y), 'DD', 64, 2, 'day')}
        {box(m, (t) => update(d, t, y), 'MM', 64, 2, 'month')}
        {box(y, (t) => update(d, m, t), 'YYYY', 92, 4, 'year')}
        {value || d || m || y ? (
          <Pressable onPress={() => update('', '', '')} accessibilityRole="button" accessibilityLabel={`Clear ${label}`} hitSlop={10}>
            <Icon name="X" size={18} color="ink3" />
          </Pressable>
        ) : null}
      </View>
      {partial ? (
        <T variant="small" color="haldi">{allowYearOnly ? 'Add the full date, or only the year' : 'Add the day, month and year'}</T>
      ) : helper ? (
        <T variant="small" color="ink3">{helper}</T>
      ) : null}
    </View>
  );
}

export function Segmented<V extends string>({
  options, value, onChange, testID,
}: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; testID?: string }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: palette.surfaceAlt }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.segment, selected ? { backgroundColor: palette.surface, borderColor: palette.line } : null]}
          >
            <T variant="smallStrong" color={selected ? 'ink' : 'ink2'} align="center">{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ title, subtitle, value, onValueChange, testID }: { title: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void; testID?: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={styles.flex}>
        <T variant="bodyStrong">{title}</T>
        {subtitle ? <T variant="small" color="ink2">{subtitle}</T> : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: palette.accent, false: palette.line }}
        thumbColor={palette.surface}
        // react-native-web colours the knob separately when on
        {...({ activeThumbColor: palette.surface } as object)}
      />
    </View>
  );
}

/** A wrap of chips, single choice. */
export function ChipChoice<V extends string>({
  options, value, onChange, testID,
}: { options: { value: V; label: string }[]; value: V | undefined; onChange: (v: V) => void; testID?: string }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o.value} testID={testID ? `${testID}-${o.value}` : undefined} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { gap: 6, marginBottom: space.lg },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.2, borderRadius: radius.md, paddingHorizontal: space.md },
  input: { flex: 1, fontSize: 17, minHeight: 52, paddingVertical: space.sm },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: space.md },
  eye: { padding: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dateBox: { height: 52, borderWidth: 1.2, borderRadius: radius.md, textAlign: 'center', fontSize: 18 },
  segmented: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 56 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
