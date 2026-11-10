import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';

import { Chip } from '@/components/Bits';
import { Button } from '@/components/Button';
import { useFileUrl } from '@/components/DocThumb';
import { Card, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { aadhaarMaskRect, type Rect } from '@/domain/extract';
import { imageSize, maskImage } from '@/lib/image-ops';
import { OCR_AVAILABLE, recognize } from '@/lib/ocr';
import { shareResult } from '@/store/files';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { MAX_WIDTH, space } from '@/theme/tokens';

/**
 * Masked Aadhaar: a black bar over the first 8 digits, flattened into the
 * image before it is shared, so a KYC copy cannot be misused. The web app
 * finds the digits itself; anyone can drag the bar to adjust it.
 */
export default function MaskAadhaar() {
  const { id, file: fileIndex } = useLocalSearchParams<{ id: string; file?: string }>();
  const ctx = useCtx();
  const { width: screenW } = useWindowDimensions();
  const doc = ctx?.family.documents.find((d) => d.id === id);
  const file = doc?.files[Number(fileIndex ?? 0)];
  const url = useFileUrl(file);
  const [size, setSize] = useState<{ width: number; height: number }>();
  const [rect, setRect] = useState<Rect>();
  const [status, setStatus] = useState<'idle' | 'finding' | 'found' | 'manual'>('idle');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ key: string; uri: string; blob?: Blob }>();
  const shotRef = useRef<ComponentRef<typeof View>>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    imageSize(url).then(async (s) => {
      if (!alive) return;
      setSize(s);
      // A starting guess for a card, where the number sits low and centred.
      setRect({ x: s.width * 0.2, y: s.height * 0.7, width: s.width * 0.4, height: s.height * 0.12 });
      if (!OCR_AVAILABLE) return setStatus('manual');
      setStatus('finding');
      try {
        const result = await recognize(url);
        const found = result ? aadhaarMaskRect(result.words) : null;
        if (!alive) return;
        if (found) setRect(found);
        setStatus(found ? 'found' : 'manual');
      } catch {
        if (alive) setStatus('manual');
      }
    });
    return () => {
      alive = false;
    };
  }, [url]);

  const displayW = Math.min(screenW, MAX_WIDTH) - space.xl * 2;
  const scale = size ? displayW / size.width : 1;

  const commit = (dx: number, dy: number) => {
    setRect((r) => (r && size ? {
      ...r,
      x: Math.min(Math.max(0, r.x + dx / scale), size.width - r.width),
      y: Math.min(Math.max(0, r.y + dy / scale), size.height - r.height),
    } : r));
    tx.set(0);
    ty.set(0);
  };
  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      tx.set(e.translationX);
      ty.set(e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      scheduleOnRN(commit, e.translationX, e.translationY);
    },
  });
  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }, { translateY: ty.get() }] }));

  if (!ctx) return <Redirect href="/" />;
  if (!doc || !file || file.kind !== 'image') {
    return (
      <Screen title="Masked copy">
        <Card><T variant="body" color="ink2">Masking works on photos of the Aadhaar card. This paper has no photo saved.</T></Card>
      </Screen>
    );
  }

  // Width grows from the left edge (where the first digit is); height grows around the middle.
  const resize = (dw: number, dh: number) =>
    setRect((r) => {
      if (!r || !size) return r;
      const width = Math.min(size.width - r.x, Math.max(20, r.width * dw));
      const height = Math.min(size.height, Math.max(8, r.height * dh));
      const y = Math.min(Math.max(0, r.y - (height - r.height) / 2), size.height - height);
      return { ...r, y, width, height };
    });

  const rectKey = rect ? [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(',') : '';
  const ready = made && made.key === rectKey ? made : undefined;

  const share = async () => {
    if (!ready) return;
    const ok = await shareResult(ready, `${doc.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-masked.jpg`, 'image/jpeg');
    if (!ok) toast('Could not open the share sheet', { tone: 'warn' });
  };

  const make = async () => {
    if (!url || !rect || !size) return;
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        const out = await maskImage(url, [rect]);
        setMade({ key: rectKey, uri: out.uri, blob: out.blob });
      } else {
        const out = await captureRef(shotRef, { format: 'jpg', quality: 0.92, result: 'tmpfile', width: Math.min(size.width, 1600), height: Math.round((Math.min(size.width, 1600) / size.width) * size.height) });
        setMade({ key: rectKey, uri: out });
      }
      toast('Masked copy ready. The first 8 digits are gone from the image itself.', { tone: 'success' });
    } catch (e) {
      toast(`Could not make the masked copy: ${(e as Error).message}`, { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Masked copy"
      subtitle={doc.title}
      footer={
        ready ? (
          <Button label="Share masked copy" icon="Share2" onPress={share} testID="mask-share" />
        ) : (
          <Button label="Make masked copy" icon="EyeOff" onPress={make} loading={busy} disabled={!rect} testID="mask-make" />
        )
      }
      testID="mask"
    >
      <T variant="body" color="ink2" style={styles.lead}>
        {status === 'finding'
          ? 'Finding the number on the card…'
          : status === 'found'
            ? 'Found it. The bar covers the first 8 digits; drag it if it needs adjusting.'
            : 'Drag the black bar over the first 8 digits of the number.'}
      </T>
      {url && size && rect ? (
        <View ref={shotRef} collapsable={false} style={{ width: displayW, height: size.height * scale }}>
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="fill" accessibilityLabel={doc.title} />
          <GestureDetector gesture={pan}>
            <Animated.View
              testID="mask-bar"
              accessibilityLabel="Black bar. Drag to move."
              style={[styles.bar, { left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale }, barStyle]}
            />
          </GestureDetector>
        </View>
      ) : (
        <Card><T variant="body" color="ink2">Opening the photo…</T></Card>
      )}
      <View style={styles.sizeRow}>
        <View style={styles.pair}>
          <Chip label="Narrower" icon="Minus" onPress={() => resize(0.9, 1)} testID="mask-narrower" />
          <Chip label="Wider" icon="Plus" onPress={() => resize(1.1, 1)} testID="mask-wider" />
        </View>
        <View style={styles.pair}>
          <Chip label="Shorter" icon="Minus" onPress={() => resize(1, 0.85)} testID="mask-shorter" />
          <Chip label="Taller" icon="Plus" onPress={() => resize(1, 1.15)} testID="mask-taller" />
        </View>
      </View>
      <T variant="small" color="ink3">The original stays as it is in the almari. Only the shared copy is masked. The full e-Aadhaar letter prints the number more than once; for that, download the masked e-Aadhaar from UIDAI.</T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: space.lg },
  bar: { position: 'absolute', backgroundColor: '#000000' },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.lg },
  pair: { flexDirection: 'row', gap: space.sm },
});
