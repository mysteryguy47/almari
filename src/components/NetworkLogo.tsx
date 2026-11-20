/**
 * Card network logos, drawn as they appear on the card itself: Visa, Amex,
 * Diners and JCB in white, Mastercard's two circles in colour, RuPay's name
 * with its orange and green arrow. Shapes from Simple Icons (CC0).
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';

import type { CardNetwork } from '@/domain/types';
import { fonts } from '@/theme/tokens';

import { T } from './Text';

const VISA =
  'M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z';
const DINERS =
  'M16.506 11.982a6.026 6.026 0 0 0-3.866-5.618V17.6a6.025 6.025 0 0 0 3.866-5.618zM8.33 17.598V6.365a6.03 6.03 0 0 0-3.863 5.617 6.028 6.028 0 0 0 3.863 5.616zm2.156-15.113A9.497 9.497 0 0 0 .99 11.982a9.495 9.495 0 0 0 9.495 9.494c5.245 0 9.495-4.25 9.496-9.494a9.499 9.499 0 0 0-9.496-9.497Zm-.023 19.888C4.723 22.4 0 17.75 0 12.09 0 5.905 4.723 1.626 10.463 1.627h2.69C18.822 1.627 24 5.903 24 12.09c0 5.658-5.176 10.283-10.848 10.283';
const JCB =
  'M13.05 9.8643c.9723.0736 1.7257.3671 2.3545.6843v-1.31s-1.2577-.3162-2.4408-.368c-4.1256-.1849-5.295 1.4344-5.295 3.1292 0 1.6947 1.1694 3.3145 5.295 3.1296 1.1831-.0536 2.4408-.3694 2.4408-.3694v-1.3086c-.6193.3081-1.3826.6107-2.3545.683-1.6793.1272-2.6898-.6907-2.6898-2.1342 0-1.4448 1.0105-2.2613 2.6898-2.1354m7.685 4.1223c-.0513.0105-.1581.02-.215.02h-1.8005V12.376H20.52c.0568 0 .1636.01.2149.02a.8056.8056 0 01.6325.7951c0 .4162-.2872.721-.6325.796zm-2.0155-4.0374h1.6325c.059 0 .1454.0077.1772.0137.3376.0572.6256.3307.6256.7392 0 .409-.288.6815-.626.7392a1.571 1.571 0 01-.1773.0137h-1.6311V9.9506zm3.4994 1.9856v-.0364c.9133-.1331 1.4149-.726 1.4149-1.4199 0-.8828-.7343-1.3916-1.7293-1.4416-.0772-.0032-.203-.011-.3044-.011h-5.3323v5.9467h5.7548c1.13 0 1.9774-.6043 1.9774-1.5466 0-.8701-.7724-1.4222-1.781-1.4917zm-17.8644.6788c0 .8787-.5906 1.5311-1.6656 1.5311-.917 0-1.8174-.2726-2.6889-.6938V14.76s1.4021.383 3.191.383c2.9714 0 3.8374-1.125 3.8374-2.529V9.0266H4.3541v3.5876Z';
const AMEX_WORD = 'AMEX';

/** One path in white, cropped to the part of the 24-unit square it fills. */
function Mono({ d, box, height, color }: { d: string; box: [number, number, number, number]; height: number; color: string }) {
  const [, , w, h] = box;
  return (
    <Svg width={(height * w) / h} height={height} viewBox={box.join(' ')}>
      <Path d={d} fill={color} />
    </Svg>
  );
}

/** A network's logo at the given height, for a dark card face (or `color` for a light one). */
export function NetworkLogo({ network, height = 22, color = '#FFFFFF' }: { network: CardNetwork; height?: number; color?: string }) {
  switch (network) {
    case 'visa':
      return <Mono d={VISA} box={[0, 8.1, 24, 7.8]} height={height * 0.82} color={color} />;
    case 'diners':
      return <Mono d={DINERS} box={[0, 1.5, 24, 21]} height={height} color={color} />;
    case 'jcb':
      return <Mono d={JCB} box={[0, 8.8, 24, 6.5]} height={height * 0.8} color={color} />;
    case 'mastercard':
      return (
        <Svg width={(height * 1000) / 618} height={height} viewBox="0 0 1000 618">
          <Path fill="#EB001B" d="m308,0a309,309 0 1,0 2,0z" />
          <Path fill="#F79E1B" d="m690,0a309,309 0 1,0 2,0z" />
          <Path fill="#FF5F00" d="m500,66a309,309 0 0,0 0,486 309,309 0 0,0 0-486" />
        </Svg>
      );
    case 'rupay':
      return (
        <View style={styles.row} accessibilityLabel="RuPay">
          <T allowFontScaling={false} style={[styles.word, { color, fontSize: height * 0.86, lineHeight: height * 1.05 }]}>RuPay</T>
          <Svg width={height * 0.62} height={height * 0.7} viewBox="0 0 12 14">
            <Polygon points="3.2,0 12,7 3.2,14" fill="#2E9B47" />
            <Polygon points="0,0 8.8,7 0,14" fill="#F47B20" />
          </Svg>
        </View>
      );
    case 'amex':
      return (
        <View style={[styles.amex, { height: height * 1.1, paddingHorizontal: height * 0.28, borderColor: color }]} accessibilityLabel="American Express">
          <T allowFontScaling={false} style={[styles.amexWord, { color, fontSize: height * 0.56, lineHeight: height * 0.7 }]}>{AMEX_WORD}</T>
        </View>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  word: { fontFamily: fonts.bold, letterSpacing: -0.3, transform: [{ skewX: '-12deg' }] },
  amex: { borderWidth: 1.5, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  amexWord: { fontFamily: fonts.bold, letterSpacing: 1.2 },
});
