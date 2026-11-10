import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { daysUntil, relativeDays } from '@/domain/dates';
import { CARD_TYPE_LABELS, formatRupees, maskTail, NETWORK_LABELS, ordinal } from '@/domain/money';
import { nextMonthlyDate } from '@/domain/reminders';
import type { CardItem } from '@/domain/types';
import { haptic } from '@/lib/device';
import { radius, space } from '@/theme/tokens';

import { T } from './Text';

/** Deep, quiet card colours, picked from the bank name so a bank keeps its colour. */
const CARD_COLOURS = ['#1E3A32', '#262B4F', '#4A2620', '#3A3020', '#2A2A2A', '#2D3B4A', '#3B2440'];
const INK = '#FBF6EC';
const INK_SOFT = 'rgba(251, 246, 236, 0.72)';

export function cardColour(bank: string): string {
  let hash = 0;
  for (let i = 0; i < bank.length; i++) hash = (hash * 31 + bank.charCodeAt(i)) >>> 0;
  return CARD_COLOURS[hash % CARD_COLOURS.length];
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
            <View style={styles.top}>
              <T variant="bodyStrong" style={{ color: INK }} numberOfLines={1}>{card.bank}</T>
              <T variant="label" style={{ color: INK_SOFT }}>{card.type === 'credit' ? 'Credit' : card.type === 'debit' ? 'Debit' : CARD_TYPE_LABELS[card.type]}</T>
            </View>
            <View style={styles.chip} />
            <T variant="numberLarge" style={{ color: INK, letterSpacing: 2 }}>{maskTail(card.number)}</T>
            <View style={styles.bottom}>
              <View style={styles.flex}>
                <T variant="small" style={{ color: INK_SOFT }} numberOfLines={1}>{card.nickname ?? card.nameOnCard ?? ''}</T>
                {card.expiry ? <T variant="smallStrong" style={{ color: INK }}>Valid till {card.expiry}</T> : null}
              </View>
              <T variant="bodyStrong" style={{ color: INK }}>{NETWORK_LABELS[card.network]}</T>
            </View>
          </Animated.View>
          <Animated.View style={[styles.face, styles.backFace, { backgroundColor: bg }, back]}>
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

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  aspect: { width: '100%', aspectRatio: 1.586 },
  face: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.lg, padding: space.xl, justifyContent: 'space-between',
    backfaceVisibility: 'hidden',
  },
  backFace: { justifyContent: 'center', gap: space.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  chip: { width: 40, height: 30, borderRadius: 6, backgroundColor: '#C9A86A', opacity: 0.9 },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  backRow: { flexDirection: 'row', gap: space.lg, marginVertical: space.sm },
  flex: { flex: 1 },
});
