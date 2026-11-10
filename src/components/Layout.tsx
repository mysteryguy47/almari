import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/domain/icons';
import type { Tint } from '@/domain/templates';
import { useTheme } from '@/theme/ThemeProvider';
import { MAX_WIDTH, radius, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { IconTile } from './Bits';
import { Pressy } from './Pressy';
import { T } from './Text';

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export interface ScreenProps {
  title?: string;
  /** A large serif title for top-level screens. */
  large?: boolean;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra space at the bottom (above the tab bar). */
  bottomInset?: number;
  scroll?: boolean;
  testID?: string;
}

export function Screen({ title, large, subtitle, back = true, right, children, footer, bottomInset = 0, scroll = true, testID }: ScreenProps) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <View style={styles.column}>
      {large && title ? (
        <View style={styles.largeHeader}>
          <T variant="display" accessibilityRole="header">{title}</T>
          {subtitle ? <T variant="body" color="ink2">{subtitle}</T> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    <KeyboardAvoidingView
      testID={testID}
      style={[styles.fill, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.headerInner}>
          {back ? (
            <Pressable
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              style={[styles.back, { backgroundColor: palette.surface, borderColor: palette.line }]}
            >
              <Icon name="ChevronLeft" size={22} />
            </Pressable>
          ) : null}
          <View style={styles.headerTitle}>
            {!large && title ? (
              <T variant="heading" numberOfLines={1} accessibilityRole="header">{title}</T>
            ) : null}
            {!large && subtitle ? <T variant="small" color="ink2" numberOfLines={1}>{subtitle}</T> : null}
          </View>
          {right}
        </View>
      </View>
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.huge + bottomInset }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.fill, styles.scroll]}>{body}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, borderTopColor: palette.line, backgroundColor: palette.bg }]}>
          <View style={styles.column}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }, padded ? styles.cardPad : null, style]}>
      {children}
    </View>
  );
}

export function Section({ title, action, children, style }: { title?: string; action?: ReactNode; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.section, style]}>
      {title || action ? (
        <View style={styles.sectionHead}>
          {title ? <T variant="label" color="ink2" accessibilityRole="header">{title}</T> : <View />}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export interface RowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  tint?: Tint;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  divider?: boolean;
  testID?: string;
  danger?: boolean;
}

/** One line in a list: icon, words, and what happens on tap. Rows are at least 56 tall. */
export function Row({ title, subtitle, icon, tint = 'almari', left, right, onPress, chevron = !!onPress, divider = false, testID, danger }: RowProps) {
  const { palette } = useTheme();
  const content = (
    <View style={[styles.row, divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line } : null]}>
      {left ?? (icon ? <IconTile icon={icon} tint={danger ? 'sindoor' : tint} size={40} /> : null)}
      <View style={styles.rowText}>
        <T variant="bodyStrong" color={danger ? 'sindoor' : 'ink'} numberOfLines={2}>{title}</T>
        {subtitle ? <T variant="small" color="ink2" numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {right}
      {chevron ? <Icon name="ChevronRight" size={20} color="ink3" /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{content}</View>;
  return (
    <Pressy testID={testID} onPress={onPress} scaleTo={0.985} accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}>
      {content}
    </Pressy>
  );
}

export function EmptyState({ icon, title, line, action }: { icon: IconName; title: string; line: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <IconTile icon={icon} tint="lifafa" size={64} />
      <T variant="heading" align="center">{title}</T>
      <T variant="body" color="ink2" align="center">{line}</T>
      {action}
    </View>
  );
}

export function OrDivider() {
  const { palette } = useTheme();
  return (
    <View style={styles.or}>
      <View style={[styles.orLine, { backgroundColor: palette.line }]} />
      <T variant="small" color="ink3">or</T>
      <View style={[styles.orLine, { backgroundColor: palette.line }]} />
    </View>
  );
}

export function Gap({ size = space.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function Divider() {
  const { palette } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.line, marginVertical: space.sm }} />;
}

export function Tile({ icon, label, tint, onPress, testID, badge }: { icon: IconName; label: string; tint: Tint; onPress: () => void; testID?: string; badge?: string }) {
  const { palette } = useTheme();
  return (
    <Pressy testID={testID} onPress={onPress} outerStyle={styles.tileOuter} style={[styles.tile, { backgroundColor: palette.surface, borderColor: palette.line }]} accessibilityLabel={label}>
      <IconTile icon={icon} tint={tint} size={44} />
      <T variant="smallStrong" numberOfLines={2}>{label}</T>
      {badge ? <T variant="small" color="ink2">{badge}</T> : null}
    </Pressy>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: space.xl },
  scroll: { paddingTop: space.sm },
  header: { width: '100%' },
  headerInner: {
    width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: space.xl, paddingBottom: space.sm,
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52,
  },
  headerTitle: { flex: 1 },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  largeHeader: { gap: 2, marginBottom: space.lg },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardPad: { padding: space.lg },
  section: { marginBottom: space.xxl, gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, minHeight: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, minHeight: 64 },
  rowText: { flex: 1, gap: 1 },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl, paddingHorizontal: space.lg },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xl },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  tileOuter: { width: '47.5%', flexGrow: 1 },
  tile: { flex: 1, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: space.sm, minHeight: 112 },
});
