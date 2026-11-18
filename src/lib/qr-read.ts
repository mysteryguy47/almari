/** Android: reads the Recovery Kit's QR from a photo with ML Kit barcode scanning, on the phone. */
import { scanFromURLAsync } from 'expo-camera';

export const QR_READ_AVAILABLE = true;

export async function readQrFromImage(uri: string): Promise<string | null> {
  const found = await scanFromURLAsync(uri, ['qr']);
  return found[0]?.data ?? null;
}
