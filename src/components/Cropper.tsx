import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/domain/icons';
import { haptic } from '@/lib/device';
import { cropTo, rotateRight, type Edited } from '@/lib/crop';
import { imageSize } from '@/lib/image-ops';
import { toast } from '@/store/ui-store';
import { fonts, radius, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { T } from './Text';

export type Aspect = 'free' | 'square' | 'portrait' | 'landscape' | 'card';

const RATIO: Record<Aspect, number | null> = { free: null, square: 1, portrait: 3 / 4, landscape: 4 / 3, card: 85.6 / 54 };
const ASPECTS: { value: Aspect; label: string; icon: IconName }[] = [
  { value: 'free', label: 'Free', icon: 'Scan' },
  { value: 'square', label: 'Square', icon: 'Square' },
  { value: 'portrait', label: 'Portrait', icon: 'RectangleVertical' },
  { value: 'landscape', label: 'Landscape', icon: 'RectangleHorizontal' },
  { value: 'card', label: 'ID card', icon: 'IdCard' },
];

/** The smallest crop, in screen points: a thumb's width. */
const MIN = 48;
/**
 * Room around the photo. Android's back gesture starts within about 30 points
 * of the left and right edges, so corners there would close the crop tool.
 */
const EDGE_X = 48;
const EDGE_Y = 28;
const HANDLE = 44;
const INK = '#F7F2E8';
const INK_SOFT = 'rgba(247, 242, 232, 0.66)';
const BG = '#0E0D0B';
const ACCENT = '#E7C58A';

type Corner = 'tl' | 'tr' | 'bl' | 'br';

function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(Math.max(v, lo), hi);
}

/** The largest rectangle of this shape that fits, centred. */
function fitted(W: number, H: number, ratio: number | null) {
  if (!ratio) return { x: 0, y: 0, w: W, h: H };
  let w = W;
  let h = W / ratio;
  if (h > H) {
    h = H;
    w = H * ratio;
  }
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

export interface CropperProps {
  visible: boolean;
  uri: string | undefined;
  /** The file name the cropped copy gets. */
  name: string;
  /** Offer the ID-card shape (Aadhaar, PAN, licence). */
  cardShaped?: boolean;
  /** A cropped or turned copy; null when nothing changed. */
  onDone: (result: Edited | null) => void;
  onClose: () => void;
  testID?: string;
}

/**
 * Crop and turn a photo: drag the corners or the frame, or pick a shape
 * (free, square, portrait, landscape, ID card). Made on the device.
 */
export function Cropper({ visible, uri, name, cardShaped, onDone, onClose, testID }: CropperProps) {
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState<{ uri: string; width: number; height: number; turned: boolean }>();
  const [area, setArea] = useState<{ width: number; height: number }>();
  const [aspect, setAspect] = useState<Aspect>('free');
  const [busy, setBusy] = useState(false);

  // The crop, in points on the shown photo.
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const W = useSharedValue(0);
  const H = useSharedValue(0);
  const ratio = useSharedValue<number | null>(null);

  useEffect(() => {
    if (!visible || !uri) return;
    let alive = true;
    imageSize(uri)
      .then((s) => alive && setSource({ uri, width: s.width, height: s.height, turned: false }))
      .catch(() => {
        if (!alive) return;
        toast('Could not open this photo for cropping', { tone: 'warn' });
        onClose();
      });
    return () => {
      alive = false;
    };
  }, [visible, uri, onClose]);

  const shown = source && area
    ? (() => {
      const scale = Math.min(area.width / source.width, area.height / source.height);
      return { width: source.width * scale, height: source.height * scale, scale };
    })()
    : undefined;

  const place = (to: { x: number; y: number; w: number; h: number }, animate: boolean) => {
    const set = (sv: SharedValue<number>, v: number) => sv.set(animate ? withTiming(v, { duration: 220 }) : v);
    set(x, to.x);
    set(y, to.y);
    set(w, to.w);
    set(h, to.h);
  };

  // A new photo or a new size on screen: start from the whole photo, in the chosen shape.
  useEffect(() => {
    if (!shown) return;
    W.set(shown.width);
    H.set(shown.height);
    ratio.set(RATIO[aspect]);
    place(fitted(shown.width, shown.height, RATIO[aspect]), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.width, shown?.height]);

  const pickAspect = (next: Aspect) => {
    haptic.tap();
    setAspect(next);
    ratio.set(RATIO[next]);
    if (shown) place(fitted(shown.width, shown.height, RATIO[next]), true);
  };

  // ---- gestures: the frame moves; each corner resizes, keeping the shape when one is chosen
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const sw = useSharedValue(0);
  const sh = useSharedValue(0);
  const remember = () => {
    'worklet';
    sx.set(x.get());
    sy.set(y.get());
    sw.set(w.get());
    sh.set(h.get());
  };

  // Follow the finger from the first point, not after the usual slop: a crop is precise work.
  const move = usePanGesture({
    minDistance: 1,
    onBegin: remember,
    onUpdate: (e) => {
      'worklet';
      x.set(clamp(sx.get() + e.translationX, 0, W.get() - w.get()));
      y.set(clamp(sy.get() + e.translationY, 0, H.get() - h.get()));
    },
  });

  const resize = (corner: Corner, tx: number, ty: number) => {
    'worklet';
    const left = corner === 'tl' || corner === 'bl';
    const top = corner === 'tl' || corner === 'tr';
    const ax = left ? sx.get() + sw.get() : sx.get();
    const ay = top ? sy.get() + sh.get() : sy.get();
    let mx = (left ? sx.get() : sx.get() + sw.get()) + tx;
    let my = (top ? sy.get() : sy.get() + sh.get()) + ty;
    mx = left ? clamp(mx, 0, ax - MIN) : clamp(mx, ax + MIN, W.get());
    my = top ? clamp(my, 0, ay - MIN) : clamp(my, ay + MIN, H.get());
    let nw = Math.abs(mx - ax);
    let nh = Math.abs(my - ay);
    const r = ratio.get();
    if (r) {
      const maxW = left ? ax : W.get() - ax;
      const maxH = top ? ay : H.get() - ay;
      if (Math.abs(tx) / Math.max(1, sw.get()) >= Math.abs(ty) / Math.max(1, sh.get())) nh = nw / r;
      else nw = nh * r;
      if (nw > maxW) {
        nw = maxW;
        nh = nw / r;
      }
      if (nh > maxH) {
        nh = maxH;
        nw = nh * r;
      }
      if (nw < MIN || nh < MIN) {
        const grow = Math.max(MIN / nw, MIN / nh);
        nw *= grow;
        nh *= grow;
      }
    }
    x.set(left ? ax - nw : ax);
    y.set(top ? ay - nh : ay);
    w.set(nw);
    h.set(nh);
  };
  const corner = (c: Corner) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    usePanGesture({
      minDistance: 1,
      onBegin: remember,
      onUpdate: (e) => {
        'worklet';
        resize(c, e.translationX, e.translationY);
      },
    });
  const tl = corner('tl');
  const tr = corner('tr');
  const bl = corner('bl');
  const br = corner('br');

  // ---- what the frame looks like
  const frame = useAnimatedStyle(() => ({ left: x.get(), top: y.get(), width: w.get(), height: h.get() }));
  const shadeTop = useAnimatedStyle(() => ({ left: 0, top: 0, right: 0, height: y.get() }));
  const shadeBottom = useAnimatedStyle(() => ({ left: 0, top: y.get() + h.get(), right: 0, bottom: 0 }));
  const shadeLeft = useAnimatedStyle(() => ({ left: 0, top: y.get(), width: x.get(), height: h.get() }));
  const shadeRight = useAnimatedStyle(() => ({ left: x.get() + w.get(), top: y.get(), right: 0, height: h.get() }));
  const at = (c: Corner) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({
      left: (c === 'tl' || c === 'bl' ? x.get() : x.get() + w.get()) - HANDLE / 2,
      top: (c === 'tl' || c === 'tr' ? y.get() : y.get() + h.get()) - HANDLE / 2,
    }));
  const tlAt = at('tl');
  const trAt = at('tr');
  const blAt = at('bl');
  const brAt = at('br');

  const turn = async () => {
    if (!source || busy) return;
    setBusy(true);
    try {
      const next = await rotateRight(source.uri);
      haptic.tap();
      setSource({ ...next, turned: true });
    } catch (e) {
      toast(`Could not turn the photo: ${(e as Error).message}`, { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (!uri) return;
    haptic.tap();
    setAspect('free');
    ratio.set(null);
    if (source?.turned) {
      imageSize(uri).then((s) => setSource({ uri, width: s.width, height: s.height, turned: false })).catch(() => undefined);
    } else if (shown) {
      place(fitted(shown.width, shown.height, null), true);
    }
  };

  const done = async () => {
    if (!source || !shown || busy) return;
    const k = 1 / shown.scale;
    const rect = { x: x.get() * k, y: y.get() * k, width: w.get() * k, height: h.get() * k };
    const whole = rect.x < 2 && rect.y < 2 && rect.width > source.width - 3 && rect.height > source.height - 3;
    if (whole && !source.turned) {
      onDone(null);
      return;
    }
    setBusy(true);
    try {
      const base = name.replace(/\.[a-z0-9]+$/i, '') || 'photo';
      onDone(await cropTo(source.uri, whole ? { x: 0, y: 0, width: source.width, height: source.height } : rect, `${base}.jpg`));
    } catch (e) {
      toast(`Could not crop: ${(e as Error).message}`, { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  const onArea = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const next = { width: Math.max(1, width - EDGE_X * 2), height: Math.max(1, height - EDGE_Y * 2) };
    if (!area || Math.abs(area.width - next.width) > 1 || Math.abs(area.height - next.height) > 1) setArea(next);
  };

  if (!visible) return null;
  const aspects = ASPECTS.filter((a) => a.value !== 'card' || cardShaped);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={[styles.fill, { backgroundColor: BG }]} testID={testID}>
        <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12} style={styles.topButton} testID="crop-cancel">
            <T variant="bodyStrong" style={{ color: INK_SOFT }}>Cancel</T>
          </Pressable>
          <T variant="heading" style={{ color: INK }}>Crop</T>
          <Pressable onPress={done} accessibilityRole="button" hitSlop={12} style={[styles.topButton, styles.doneButton]} disabled={busy} testID="crop-done">
            {busy ? <ActivityIndicator color={BG} /> : <T variant="bodyStrong" style={{ color: BG }}>Done</T>}
          </Pressable>
        </View>

        <View style={styles.stage} onLayout={onArea}>
          {source && shown ? (
            <View style={{ width: shown.width, height: shown.height }}>
              <Image source={{ uri: source.uri }} style={StyleSheet.absoluteFill} contentFit="fill" accessibilityLabel="Photo being cropped" />
              <Animated.View pointerEvents="none" style={[styles.shade, shadeTop]} />
              <Animated.View pointerEvents="none" style={[styles.shade, shadeBottom]} />
              <Animated.View pointerEvents="none" style={[styles.shade, shadeLeft]} />
              <Animated.View pointerEvents="none" style={[styles.shade, shadeRight]} />
              <GestureDetector gesture={move}>
                <Animated.View style={[styles.frame, frame]} accessibilityLabel="Crop frame. Drag to move." testID="crop-frame">
                  <View pointerEvents="none" style={[styles.third, styles.v1]} />
                  <View pointerEvents="none" style={[styles.third, styles.v2]} />
                  <View pointerEvents="none" style={[styles.third, styles.h1]} />
                  <View pointerEvents="none" style={[styles.third, styles.h2]} />
                </Animated.View>
              </GestureDetector>
              {([['tl', tl, tlAt], ['tr', tr, trAt], ['bl', bl, blAt], ['br', br, brAt]] as const).map(([c, g, style]) => (
                <GestureDetector key={c} gesture={g}>
                  <Animated.View style={[styles.handle, style]} accessibilityLabel={`Corner. Drag to resize.`} testID={`crop-${c}`}>
                    <View style={[styles.bracket, c.includes('t') ? styles.bt : styles.bb, c.includes('l') ? styles.bl : styles.br]} />
                  </Animated.View>
                </GestureDetector>
              ))}
            </View>
          ) : (
            <ActivityIndicator color={INK} />
          )}
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.aspects} accessibilityRole="radiogroup">
            {aspects.map((a) => {
              const on = a.value === aspect;
              return (
                <Pressable
                  key={a.value}
                  onPress={() => pickAspect(a.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={a.label}
                  style={styles.aspect}
                  testID={`crop-aspect-${a.value}`}
                >
                  <View style={[styles.aspectIcon, on ? { backgroundColor: 'rgba(231, 197, 138, 0.16)' } : null]}>
                    <Icon name={a.icon} size={20} rawColor={on ? ACCENT : INK_SOFT} />
                  </View>
                  <T variant="small" style={{ color: on ? ACCENT : INK_SOFT, fontFamily: on ? fonts.semibold : fonts.regular }}>{a.label}</T>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.tools}>
            <Pressable onPress={reset} accessibilityRole="button" style={styles.tool} testID="crop-reset">
              <Icon name="RotateCcw" size={18} rawColor={INK_SOFT} />
              <T variant="smallStrong" style={{ color: INK_SOFT }}>Reset</T>
            </Pressable>
            <Pressable onPress={turn} accessibilityRole="button" style={styles.tool} testID="crop-rotate" disabled={busy}>
              <Icon name="RotateCw" size={18} rawColor={INK} />
              <T variant="smallStrong" style={{ color: INK }}>Turn</T>
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const LINE = 'rgba(255, 255, 255, 0.85)';

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.sm },
  topButton: { minWidth: 76, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: space.md },
  doneButton: { backgroundColor: ACCENT },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shade: { position: 'absolute', backgroundColor: 'rgba(14, 13, 11, 0.62)' },
  frame: { position: 'absolute', borderWidth: 1, borderColor: LINE },
  third: { position: 'absolute', backgroundColor: 'rgba(255, 255, 255, 0.28)' },
  v1: { left: '33.33%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  v2: { left: '66.66%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  h1: { top: '33.33%', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  h2: { top: '66.66%', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  handle: { position: 'absolute', width: HANDLE, height: HANDLE, alignItems: 'center', justifyContent: 'center' },
  bracket: { position: 'absolute', width: 22, height: 22, borderColor: '#FFFFFF' },
  bt: { top: HANDLE / 2 - 3, borderTopWidth: 3 },
  bb: { bottom: HANDLE / 2 - 3, borderBottomWidth: 3 },
  bl: { left: HANDLE / 2 - 3, borderLeftWidth: 3 },
  br: { right: HANDLE / 2 - 3, borderRightWidth: 3 },
  bottom: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.lg },
  aspects: { flexDirection: 'row', justifyContent: 'space-around' },
  aspect: { alignItems: 'center', gap: 4, minWidth: 56 },
  aspectIcon: { width: 44, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: space.xxl },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(247, 242, 232, 0.25)' },
});
