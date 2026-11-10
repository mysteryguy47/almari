import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getCategory, getTemplate } from '@/domain/templates';
import type { FileRef } from '@/domain/types';
import { extensionOf } from '@/domain/validation';
import { fileUrl } from '@/store/files';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, tintColors } from '@/theme/tokens';

import { Stamp } from './Bits';
import { Icon } from './Icon';
import { T } from './Text';

const ASPECT = { card: 1.586, a4: 0.707, photo: 0.78 } as const;

/** Loads a stored file's local URL (file:// on Android, blob: on the web). */
export function useFileUrl(file: FileRef | undefined): string | null {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null }>();
  useEffect(() => {
    let alive = true;
    if (!file || file.kind === 'sample') return;
    fileUrl(file.id, file.name)
      .then((url) => alive && setLoaded({ id: file.id, url }))
      .catch(() => alive && setLoaded({ id: file.id, url: null }));
    return () => {
      alive = false;
    };
  }, [file]);
  // Only the URL of the file being shown, never a stale one from a previous file.
  return file && loaded?.id === file.id ? loaded.url : null;
}

/**
 * The document's own shape: card-sized for IDs, A4 for certificates, so the
 * eye knows what it is looking at. Sample documents draw a plain stand-in
 * marked SAMPLE (never anything that resembles a government design).
 */
export function DocThumb({ templateId, file, width, title }: { templateId: string; file?: FileRef; width: number; title?: string }) {
  const { palette } = useTheme();
  const template = getTemplate(templateId);
  const { fg, bg } = tintColors(palette, getCategory(template.category).tint);
  const url = useFileUrl(file);
  const height = width / ASPECT[template.shape];

  if (url && file?.kind === 'image') {
    return (
      <Image
        source={{ uri: url }}
        style={{ width, height, borderRadius: radius.sm, backgroundColor: palette.surfaceAlt }}
        contentFit="cover"
        accessibilityLabel={title ?? template.name}
      />
    );
  }
  const isSample = file?.kind === 'sample';
  const big = width > 160;
  return (
    <View
      style={[styles.paper, { width, height, backgroundColor: isSample ? palette.surface : bg, borderColor: palette.line }]}
      accessibilityLabel={title ?? template.name}
    >
      {isSample ? (
        <>
          <View style={styles.sampleTop}>
            <Icon name={template.icon} size={big ? 26 : 16} rawColor={fg} />
            {big ? <T variant="smallStrong" numberOfLines={1} style={{ color: fg, flex: 1 }}>{template.name}</T> : null}
          </View>
          <View style={styles.lines}>
            {[0.9, 0.7, 0.8, 0.5].slice(0, big ? 4 : 2).map((w, i) => (
              <View key={i} style={[styles.line, { width: `${w * 100}%`, backgroundColor: palette.line }]} />
            ))}
          </View>
          {big ? <Stamp text="Sample" tone="stamp" tilt={-8} /> : null}
        </>
      ) : (
        <View style={styles.fileCenter}>
          <Icon name={file?.kind === 'pdf' ? 'FileText' : template.icon} size={big ? 40 : 22} rawColor={fg} />
          {file ? <T variant="label" style={{ color: fg }}>{extensionOf(file.name) || 'file'}</T> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, padding: space.sm, justifyContent: 'space-between', overflow: 'hidden' },
  sampleTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lines: { gap: 6 },
  line: { height: 5, borderRadius: 3 },
  fileCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
