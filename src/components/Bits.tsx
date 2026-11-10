import { StyleSheet, View, type ViewStyle } from 'react-native';

import { initials } from '@/domain/access';
import type { IconName } from '@/domain/icons';
import type { Tint } from '@/domain/templates';
import type { Member } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, tintColors, tintForId } from '@/theme/tokens';

import { Icon } from './Icon';
import { Pressy } from './Pressy';
import { T } from './Text';

export function IconTile({ icon, tint, size = 44 }: { icon: IconName; tint: Tint; size?: number }) {
  const { palette } = useTheme();
  const { fg, bg } = tintColors(palette, tint);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={Math.round(size * 0.5)} rawColor={fg} />
    </View>
  );
}

export type StampTone = 'stamp' | 'sindoor' | 'haldi' | 'almari' | 'inland';

/** A rubber-stamp label, like the ones on every government paper: EXPIRES 12 DEC, ONLY ME. */
export function Stamp({ text, tone = 'stamp', tilt = -3 }: { text: string; tone?: StampTone; tilt?: number }) {
  const { palette } = useTheme();
  const color = palette[tone];
  return (
    <View style={[styles.stampOuter, { borderColor: color, transform: [{ rotate: `${tilt}deg` }] }]} accessibilityLabel={text}>
      <View style={[styles.stampInner, { borderColor: color }]}>
        <T variant="label" style={{ color, fontSize: 11, lineHeight: 14 }}>{text}</T>
      </View>
    </View>
  );
}

export function Chip({ label, selected, onPress, icon, testID }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; testID?: string }) {
  const { palette } = useTheme();
  return (
    <Pressy
      testID={testID}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      style={[
        styles.chip,
        { backgroundColor: selected ? palette.accent : palette.surface, borderColor: selected ? palette.accent : palette.line },
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? 'onAccent' : 'ink2'} /> : null}
      <T variant="smallStrong" color={selected ? 'onAccent' : 'ink'}>{label}</T>
    </Pressy>
  );
}

export function Avatar({ member, size = 48, ring }: { member: Pick<Member, 'id' | 'fullName' | 'status' | 'isPet' | 'kind'>; size?: number; ring?: boolean }) {
  const { palette } = useTheme();
  const memorial = member.status === 'memorial';
  const { fg, bg } = memorial ? { fg: palette.ink2, bg: palette.surfaceAlt } : tintColors(palette, tintForId(member.id));
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
        borderWidth: ring ? 2 : member.status === 'invited' ? 1.5 : 0,
        borderColor: ring ? palette.accent : fg,
        borderStyle: member.status === 'invited' && !ring ? 'dashed' : 'solid',
      }}
      accessibilityLabel={member.fullName}
    >
      {member.isPet ? (
        <Icon name="PawPrint" size={size * 0.46} rawColor={fg} />
      ) : (
        <T variant="bodyStrong" style={{ color: fg, fontSize: size * 0.36, lineHeight: size * 0.44 }}>{initials(member.fullName)}</T>
      )}
      {memorial ? (
        <View style={[styles.memorialBadge, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <Icon name="Flower2" size={12} color="ink2" />
        </View>
      ) : null}
    </View>
  );
}

/** The family's brass house nameplate: "Sharma's · Est. 1944". */
export function Nameplate({ name, est, onPress, testID }: { name: string; est?: number; onPress?: () => void; testID?: string }) {
  const { palette } = useTheme();
  const plate = (
    <View style={[styles.plate, { backgroundColor: palette.brass, borderColor: palette.brassLine }]}>
      <View style={[styles.plateInner, { borderColor: palette.brassLine }]}>
        <View style={[styles.screw, { backgroundColor: palette.brassLine }]} />
        <View style={styles.plateText}>
          <T variant="title" numberOfLines={1} style={{ color: palette.brassInk }}>{name}</T>
          {est ? <T variant="label" style={{ color: palette.brassInk, opacity: 0.8 }}>Est. {est}</T> : null}
        </View>
        {onPress ? <Icon name="ChevronDown" size={18} rawColor={palette.brassInk} /> : null}
        <View style={[styles.screw, { backgroundColor: palette.brassLine }]} />
      </View>
    </View>
  );
  if (!onPress) return plate;
  return (
    <Pressy testID={testID} onPress={onPress} accessibilityLabel={`${name}. Switch family`} scaleTo={0.98}>
      {plate}
    </Pressy>
  );
}

export function Pill({ text, tone = 'almari', style }: { text: string; tone?: Tint; style?: ViewStyle }) {
  const { palette } = useTheme();
  const { fg, bg } = tintColors(palette, tone);
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <T variant="smallStrong" style={{ color: fg }}>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  stampOuter: { borderWidth: 1.5, borderRadius: 6, padding: 1.5, alignSelf: 'flex-start' },
  stampInner: { borderWidth: 0.75, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, minHeight: 38, borderRadius: radius.pill, borderWidth: 1 },
  memorialBadge: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  plate: { borderRadius: radius.md, borderWidth: 1, padding: 4, alignSelf: 'flex-start', maxWidth: '100%' },
  plateInner: { borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: space.md, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md },
  plateText: { flexShrink: 1, alignItems: 'center' },
  screw: { width: 7, height: 7, borderRadius: 4 },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4, alignSelf: 'flex-start' },
});
