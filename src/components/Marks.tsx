/**
 * Marks: a bank's logo (SBI's keyhole, HDFC's squares) or, for banks without
 * one, its short name on its colour; the logo of the office behind a paper
 * (UIDAI for Aadhaar, Income Tax for PAN) or else a picture of the paper (an
 * ID card with a car for a driving licence); a picture for each category; a
 * vehicle drawn side-on; and its number plate.
 *
 * Logos and pictures sit on a white tile, the way they are printed, so every
 * colour in them reads the same in light and dark. The files are in assets/logos.
 */
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { bankMark } from '@/domain/banks';
import type { IconName } from '@/domain/icons';
import { ISSUER_LOGO } from '@/domain/issuers';
import { getCategory, getTemplate, type CategoryId } from '@/domain/templates';
import type { VehicleKind } from '@/domain/types';
import { formatPlate, vehicleKindLabel } from '@/domain/vehicles';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

import { IconTile } from './Bits';
import { Icon } from './Icon';
import { BANK_LOGOS, CATEGORY_ART, DOC_LOGOS, PAPER_ART, type LogoAsset } from './logo-assets';
import { T } from './Text';
import { VehicleGlyph } from './VehicleGlyph';

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

const PAPER_WHITE = '#FFFFFF';
const PAPER_DIM = '#F2EFE9';
const VEHICLE_INK = '#34574A';

/**
 * A logo on its tile. Square logos fill about two thirds of it; wide ones
 * (JP Morgan, FASTag) and tall ones (Dhanlaxmi) stretch further along their
 * long side, so every logo looks about the same size.
 */
export function LogoTile({ logo, size = 40, background, label, picture }: { logo: LogoAsset; size?: number; background?: string; label?: string; picture?: boolean }) {
  const { scheme, palette } = useTheme();
  const r = Math.round(size * 0.3);
  // A picture has no small print to keep clear of the edge, so it fills more of the tile.
  const k = picture ? 0.72 : 0.62;
  const most = 0.84;
  const w = logo.aspect >= 1 ? Math.min(k * Math.sqrt(logo.aspect), most) : Math.min(k / Math.sqrt(logo.aspect), most) * logo.aspect;
  const h = w / logo.aspect;
  const bg = background ?? (scheme === 'dark' ? PAPER_DIM : PAPER_WHITE);
  return (
    <View
      accessible={!!label}
      accessibilityLabel={label}
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: r, backgroundColor: bg },
        !background && scheme !== 'dark' ? { borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line } : null,
      ]}
    >
      {/* Keyed by file: on the web, expo-image otherwise keeps the old logo on top when the bank changes. */}
      <Image key={logo.source} source={logo.source} style={{ width: Math.round(size * w), height: Math.round(size * h) }} contentFit="contain" transition={0} />
    </View>
  );
}

/** The logo for a bank's mark, if there is a file for it. */
function bankLogo(name: string | undefined): LogoAsset | undefined {
  return name ? (BANK_LOGOS[name] ?? DOC_LOGOS[name]) : undefined;
}

/** A bank's mark, for any name: its logo when known, else its short name or initials on a colour. */
export function BankMark({ bank, size = 40 }: { bank: string | undefined; size?: number }) {
  const mark = bankMark(bank);
  const logo = bankLogo(mark.logo);
  if (logo) return <LogoTile logo={logo} size={size} label={mark.name ?? bank} />;
  return (
    <View accessibilityLabel={mark.name ?? bank} accessible>
      <MarkTile color={mark.color} text={mark.text} size={size} />
    </View>
  );
}

/** A paper's mark: its issuer's logo, else its picture, else its icon on the category's colour. */
export function DocMark({ templateId, size = 40, bank }: { templateId: string; size?: number; bank?: string }) {
  const template = getTemplate(templateId);
  // A cheque or passbook tied to an account carries that bank's mark.
  if (bank && template.perAccount) return <BankMark bank={bank} size={size} />;
  const withLogo = ISSUER_LOGO[template.id];
  const logo = withLogo ? DOC_LOGOS[withLogo.logo] : undefined;
  if (withLogo && logo) return <LogoTile logo={logo} size={size} background={withLogo.background} label={template.name} />;
  const art = PAPER_ART[template.id];
  if (art) return <LogoTile logo={art} size={size} label={template.name} picture />;
  return <IconTile icon={template.icon} tint={getCategory(template.category).tint} size={size} />;
}

/** A category's picture (a house for Home, a car for Vehicles). */
export function CategoryMark({ categoryId, size = 44 }: { categoryId: CategoryId; size?: number }) {
  const art = CATEGORY_ART[categoryId];
  const category = getCategory(categoryId);
  if (art) return <LogoTile logo={art} size={size} label={category.name} picture />;
  return <IconTile icon={category.icon} tint={category.tint} size={size} />;
}

/** A vehicle, drawn side-on, on the same tile as the papers' marks. */
export function VehicleMark({ kind, size = 44 }: { kind: VehicleKind; size?: number }) {
  const { scheme, palette } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={vehicleKindLabel(kind)}
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: scheme === 'dark' ? PAPER_DIM : PAPER_WHITE },
        scheme !== 'dark' ? { borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line } : null,
      ]}
    >
      {/* The tile is always light, so the drawing keeps the light theme's ink-green. */}
      <VehicleGlyph kind={kind} size={Math.round(size * 0.7)} color={VEHICLE_INK} />
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
