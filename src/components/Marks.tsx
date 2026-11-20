/**
 * Marks: a bank's short name on its own colour (SBI in blue, HDFC in navy),
 * a document's short name (PAN, DL, RC, PUC), and a vehicle's number plate.
 *
 * They are Almari's drawings, not logos. Bank logos are their trademarks,
 * and the Aadhaar logo and the national emblem on PAN may not be used by
 * apps outside the government. Text on a colour tells them apart just as fast.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { bankMark } from '@/domain/banks';
import type { IconName } from '@/domain/icons';
import { getCategory, getTemplate } from '@/domain/templates';
import { formatPlate } from '@/domain/vehicles';
import { fonts } from '@/theme/tokens';

import { IconTile } from './Bits';
import { Icon } from './Icon';
import { T } from './Text';

const WHITE = '#FFFFFF';

/** The soft light from above that makes a flat colour read as a pressed card. */
function Sheen({ size, radius }: { size: number; radius: number }) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="almari-sheen" x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.22" />
          <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.14" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={size} height={size} rx={radius} ry={radius} fill="url(#almari-sheen)" />
    </Svg>
  );
}

function textSize(size: number, text: string): number {
  const n = text.length;
  const k = n <= 2 ? 0.4 : n === 3 ? 0.33 : n === 4 ? 0.27 : n === 5 ? 0.225 : 0.19;
  return Math.round(size * k);
}

/** A rounded tile of colour with a short word or an icon on it. */
export function MarkTile({ color, text, icon, size = 40 }: { color: string; text?: string; icon?: IconName; size?: number }) {
  const r = Math.round(size * 0.3);
  const fontSize = text ? textSize(size, text) : 0;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: r, backgroundColor: color }]}>
      <Sheen size={size} radius={r} />
      {icon ? <Icon name={icon} size={Math.round(size * 0.5)} rawColor={WHITE} /> : null}
      {text ? (
        <T
          numberOfLines={1}
          allowFontScaling={false}
          style={{ color: WHITE, fontFamily: fonts.bold, fontSize, lineHeight: Math.round(fontSize * 1.15), letterSpacing: text.length >= 4 ? 0.2 : 0.6 }}
        >
          {text}
        </T>
      ) : null}
    </View>
  );
}

/** A bank's mark, for any name: known banks in their colour, others by initials. */
export function BankMark({ bank, size = 40 }: { bank: string | undefined; size?: number }) {
  const mark = bankMark(bank);
  return (
    <View accessibilityLabel={mark.name ?? bank} accessible>
      <MarkTile color={mark.color} text={mark.text} size={size} />
    </View>
  );
}

/** Papers with a short name everyone knows get it as a mark; colours chosen to tell them apart. */
const DOC_MARKS: Record<string, { text?: string; icon?: IconName; color: string }> = {
  aadhaar: { icon: 'FingerprintPattern', color: '#B5481E' },
  pan: { text: 'PAN', color: '#1F4E8C' },
  'voter-id': { text: 'EPIC', color: '#5A3E8E' },
  'driving-licence': { text: 'DL', color: '#0F6B5C' },
  passport: { icon: 'BookOpen', color: '#1C2B4E' },
  'birth-certificate': { icon: 'Baby', color: '#9A4E6A' },
  abha: { text: 'ABHA', color: '#0D7472' },
  'ayushman-card': { text: 'PMJAY', color: '#2B6E3A' },
  nps: { text: 'PRAN', color: '#3D4F8A' },
  'pf-passbook': { text: 'UAN', color: '#2D5A88' },
  'apaar-id': { text: 'ABC', color: '#7A3E1D' },
  rc: { text: 'RC', color: '#2C5E8A' },
  puc: { text: 'PUC', color: '#3E7A3A' },
  fastag: { text: 'TAG', color: '#5A4A1E' },
  'vehicle-insurance': { icon: 'ShieldCheck', color: '#36507A' },
  gst: { text: 'GST', color: '#5B3A7A' },
  itr: { text: 'ITR', color: '#2F5D50' },
  'form-16': { text: '16', color: '#46556E' },
  'ration-card': { icon: 'Wheat', color: '#7A5A1E' },
  'cancelled-cheque': { icon: 'Banknote', color: '#3D5A4A' },
};

/** A document's mark: its short name when it has a well-known one, else its icon on the category's colour. */
export function DocMark({ templateId, size = 40, bank }: { templateId: string; size?: number; bank?: string }) {
  const template = getTemplate(templateId);
  // A cheque or passbook tied to an account carries that bank's mark.
  if (bank && template.perAccount) return <BankMark bank={bank} size={size} />;
  const mark = DOC_MARKS[template.id];
  if (!mark) return <IconTile icon={template.icon} tint={getCategory(template.category).tint} size={size} />;
  return (
    <View accessibilityLabel={template.name} accessible>
      <MarkTile color={mark.color} text={mark.text} icon={mark.icon} size={size} />
    </View>
  );
}

/** An Indian number plate: white, black letters, the thin border and the blue strip. */
export function NumberPlate({ number, size = 'md' }: { number: string | undefined; size?: 'sm' | 'md' | 'lg' }) {
  if (!number) return null;
  const text = formatPlate(number);
  const fontSize = size === 'lg' ? 22 : size === 'md' ? 15 : 12;
  return (
    <View style={[styles.plate, size === 'sm' ? styles.plateSm : null]} accessibilityLabel={`Number plate ${text}`} accessible>
      <View style={[styles.ind, { width: fontSize * 0.95 }]}>
        <T allowFontScaling={false} style={{ color: WHITE, fontFamily: fonts.bold, fontSize: fontSize * 0.36, lineHeight: fontSize * 0.5 }}>IND</T>
      </View>
      <T allowFontScaling={false} numberOfLines={1} style={{ color: '#111111', fontFamily: fonts.bold, fontSize, lineHeight: Math.round(fontSize * 1.25), letterSpacing: 1.2, paddingHorizontal: fontSize * 0.45 }}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  plate: { flexDirection: 'row', alignItems: 'stretch', alignSelf: 'flex-start', backgroundColor: '#FBFBF7', borderRadius: 5, borderWidth: 1.5, borderColor: '#1A1A1A', overflow: 'hidden' },
  plateSm: { borderWidth: 1, borderRadius: 4 },
  ind: { backgroundColor: '#1F4BA5', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
});
