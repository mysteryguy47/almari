import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { findBank } from '@/domain/banks';
import { daysUntil, relativeDays } from '@/domain/dates';
import { ACCOUNT_TYPE_LABELS, CARD_TYPE_LABELS, formatRupees, maskTail, NETWORK_LABELS, ordinal } from '@/domain/money';
import { nextMonthlyDate } from '@/domain/reminders';
import type { BankAccount, CardItem } from '@/domain/types';
import { haptic } from '@/lib/device';
import { radius, space } from '@/theme/tokens';

import { BankMark } from './Marks';
import { NetworkLogo } from './NetworkLogo';
import { T } from './Text';

/** Deep, quiet card colours, picked from the bank name so a bank keeps its colour. */
const CARD_COLOURS = ['#1E3A32', '#262B4F', '#4A2620', '#3A3020', '#2A2A2A', '#2D3B4A', '#3B2440'];
const INK = '#FBF6EC';
const INK_SOFT = 'rgba(251, 246, 236, 0.72)';

/** A deep shade of the bank's own colour, so an SBI card reads blue and an ICICI card maroon. */
function deepen(hex: string, keep = 0.62): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * keep).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

export function cardColour(bank: string): string {
  const known = findBank(bank);
  if (known?.color) return deepen(known.color);
  let hash = 0;
  for (let i = 0; i < bank.length; i++) hash = (hash * 31 + bank.charCodeAt(i)) >>> 0;
  return CARD_COLOURS[hash % CARD_COLOURS.length];
}

/** Light from the top left and a soft ring, so the face reads as a pressed, printed card. */
function Finish({ id }: { id: string }) {
  return (
    // In a full-size layer of its own: on Android, an Svg's 100% is the parent's size less its padding.
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 316 200" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`light-${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.02" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.28" />
          </LinearGradient>
          <RadialGradient id={`ring-${id}`} cx="0.92" cy="0.05" r="0.9">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.10" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="316" height="200" fill={`url(#light-${id})`} />
        <Circle cx="300" cy="-10" r="170" fill={`url(#ring-${id})`} />
        <Circle cx="300" cy="-10" r="120" fill="none" stroke="#FFFFFF" strokeOpacity="0.05" strokeWidth="1" />
        <Circle cx="300" cy="-10" r="200" fill="none" stroke="#FFFFFF" strokeOpacity="0.04" strokeWidth="1" />
      </Svg>
    </View>
  );
}

/** The gold contact chip, with its pads. */
function ChipPads() {
  return (
    <Svg width={42} height={32} viewBox="0 0 42 32">
      <Defs>
        <LinearGradient id="chip-gold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F3DDA6" />
          <Stop offset="0.5" stopColor="#C9A35C" />
          <Stop offset="1" stopColor="#E7C987" />
        </LinearGradient>
      </Defs>
      <Rect x="0.5" y="0.5" width="41" height="31" rx="6" fill="url(#chip-gold)" stroke="#8C6B2F" strokeOpacity="0.5" />
      <Path d="M0.5 11h12M0.5 21h12M29.5 11h12M29.5 21h12M12.5 0.5v31M29.5 0.5v31M12.5 16h17" stroke="#8C6B2F" strokeOpacity="0.55" strokeWidth="1" fill="none" />
    </Svg>
  );
}

/** The four waves of "tap to pay". */
function Contactless({ color }: { color: string }) {
  return (
    <Svg width={20} height={22} viewBox="0 0 20 22">
      {[4, 8, 12, 16].map((x, i) => (
        <Path key={x} d={`M${x} ${7 - i * 1.6} Q${x + 3 + i} 11 ${x} ${15 + i * 1.6}`} stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  );
}

/**
 * A card that looks like the card. Tap to flip: credit cards show the limit,
 * statement day and days left to pay on the back. The full number is never
 * on the face; the details screen reveals it after the fingerprint or PIN.
 */
export function BankCard({ card, accountLabel, onPress, testID }: { card: CardItem; accountLabel?: string; onPress?: () => void; testID?: string }) {
  const flip = useSharedValue(0);
  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.get(), [0, 1], [0, 180])}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.get(), [0, 1], [180, 360])}deg` }],
  }));
  const bg = cardColour(card.bank);
  const due = card.type === 'credit' && card.dueDay ? nextMonthlyDate(card.dueDay) : undefined;
  const dueIn = due ? daysUntil(due) : null;

  const toggle = () => {
    haptic.tap();
    flip.set(withSpring(flip.get() > 0.5 ? 0 : 1, { damping: 16, stiffness: 140 }));
  };

  return (
    <View style={styles.wrap}>
      <Pressable testID={testID} onPress={toggle} onLongPress={onPress} accessibilityRole="button" accessibilityLabel={`${card.bank} ${CARD_TYPE_LABELS[card.type]} ending ${card.number.slice(-4)}. Tap to flip.`}>
        <View style={styles.aspect}>
          <Animated.View style={[styles.face, { backgroundColor: bg }, front]}>
            <Finish id={card.id} />
            <View style={styles.top}>
              <View style={styles.bankName}>
                {card.bank.trim() ? <BankMark bank={card.bank} size={30} /> : <View style={styles.markSpace} />}
                <T variant="bodyStrong" style={[styles.flex, { color: card.bank.trim() ? INK : INK_SOFT }]} numberOfLines={1}>{card.bank.trim() || 'Bank name'}</T>
              </View>
              <T variant="label" style={{ color: INK_SOFT }}>{card.type === 'credit' ? 'Credit' : card.type === 'debit' ? 'Debit' : CARD_TYPE_LABELS[card.type]}</T>
            </View>
            <View style={styles.chipRow}>
              <ChipPads />
              <Contactless color={INK_SOFT} />
            </View>
            <T variant="numberLarge" style={{ color: INK, letterSpacing: 2 }}>{maskTail(card.number)}</T>
            <View style={styles.bottom}>
              <View style={styles.flex}>
                <T variant="small" style={{ color: INK_SOFT }} numberOfLines={1}>{card.nickname ?? card.nameOnCard ?? ''}</T>
                {card.expiry ? <T variant="smallStrong" style={{ color: INK }}>Valid till {card.expiry}</T> : null}
              </View>
              {card.network === 'other' ? null : (
                <View accessibilityLabel={NETWORK_LABELS[card.network]} accessible>
                  <NetworkLogo network={card.network} height={24} />
                </View>
              )}
            </View>
          </Animated.View>
          <Animated.View style={[styles.face, styles.backFace, { backgroundColor: bg }, back]}>
            <Finish id={`${card.id}-back`} />
            {card.type === 'credit' ? (
              <>
                <T variant="label" style={{ color: INK_SOFT }}>Credit limit</T>
                <T variant="numberLarge" style={{ color: INK }}>{card.creditLimit ? formatRupees(card.creditLimit) : 'Not added'}</T>
                <View style={styles.backRow}>
                  <View style={styles.flex}>
                    <T variant="label" style={{ color: INK_SOFT }}>Statement</T>
                    <T variant="bodyStrong" style={{ color: INK }}>{card.statementDay ? `${ordinal(card.statementDay)} of the month` : '—'}</T>
                  </View>
                  <View style={styles.flex}>
                    <T variant="label" style={{ color: INK_SOFT }}>Pay by</T>
                    <T variant="bodyStrong" style={{ color: INK }}>{card.dueDay ? `${ordinal(card.dueDay)} of the month` : '—'}</T>
                  </View>
                </View>
                {dueIn !== null ? (
                  <T variant="bodyStrong" style={{ color: dueIn <= 3 ? '#FFC9BE' : INK }}>Next bill due {relativeDays(dueIn)}</T>
                ) : null}
              </>
            ) : (
              <>
                <T variant="label" style={{ color: INK_SOFT }}>{card.type === 'debit' ? 'Linked account' : 'Card'}</T>
                <T variant="bodyStrong" style={{ color: INK }}>{accountLabel ?? 'Not linked to an account'}</T>
                <T variant="small" style={{ color: INK_SOFT }}>Tap again to flip back</T>
              </>
            )}
          </Animated.View>
        </View>
      </Pressable>
    </View>
  );
}

/** A bank account as a passbook cover: the bank's colour and logo, the last digits, the holder and IFSC. */
export function AccountCard({ account, holder }: { account: Pick<BankAccount, 'id' | 'bank' | 'type' | 'accountNumber' | 'ifsc'>; holder?: string }) {
  return (
    <View style={[styles.account, { backgroundColor: cardColour(account.bank) }]} accessibilityLabel={`${account.bank} ${ACCOUNT_TYPE_LABELS[account.type]} account ending ${account.accountNumber.slice(-4)}`} accessible>
      <Finish id={`acct-${account.id}`} />
      <View style={styles.top}>
        <View style={styles.bankName}>
          <BankMark bank={account.bank} size={34} />
          <T variant="bodyStrong" style={[styles.flex, { color: INK }]} numberOfLines={1}>{account.bank}</T>
        </View>
        <T variant="label" style={{ color: INK_SOFT }}>{ACCOUNT_TYPE_LABELS[account.type]}</T>
      </View>
      <T variant="numberLarge" style={{ color: INK, letterSpacing: 2 }} testID="bank-tail">{maskTail(account.accountNumber)}</T>
      <View style={styles.bottom}>
        <View style={styles.flex}>
          <T variant="label" style={{ color: INK_SOFT }}>Account holder</T>
          <T variant="bodyStrong" style={{ color: INK }} numberOfLines={1}>{holder || '—'}</T>
        </View>
        {account.ifsc ? (
          <View style={styles.ifsc}>
            <T variant="label" style={{ color: INK_SOFT }}>IFSC</T>
            <T variant="bodyStrong" style={{ color: INK, letterSpacing: 0.6 }}>{account.ifsc}</T>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  aspect: { width: '100%', aspectRatio: 1.586 },
  face: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.lg, padding: space.xl, justifyContent: 'space-between',
    backfaceVisibility: 'hidden', overflow: 'hidden',
    boxShadow: '0 10px 24px -12px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
  },
  backFace: { justifyContent: 'center', gap: space.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  bankName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  markSpace: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(251, 246, 236, 0.4)' },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  backRow: { flexDirection: 'row', gap: space.lg, marginVertical: space.sm },
  account: {
    borderRadius: radius.lg, padding: space.xl, gap: space.lg, overflow: 'hidden',
    boxShadow: '0 10px 24px -12px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
  },
  ifsc: { alignItems: 'flex-end' },
  flex: { flex: 1 },
});
