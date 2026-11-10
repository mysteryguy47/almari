import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { qrGrid } from '@/lib/qr';

/** A QR code drawn as one SVG path, dark on white with a quiet zone, readable in dark mode too. */
export function Qr({ text, size = 200, testID }: { text: string; size?: number; testID?: string }) {
  const { path, cells } = useMemo(() => {
    const grid = qrGrid(text);
    const quiet = 4;
    let d = '';
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) if (grid.dark(x, y)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
    return { path: d, cells: grid.size + quiet * 2 };
  }, [text]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${cells} ${cells}`} testID={testID} accessibilityLabel="Recovery Kit QR code">
      <Rect x={0} y={0} width={cells} height={cells} fill="#FFFFFF" />
      <Path d={path} fill="#000000" />
    </Svg>
  );
}
