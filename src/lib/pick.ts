/**
 * Getting a file in: camera, photos, or files (PDF, Word, Excel...).
 * Returns what the file store needs; size and type are checked by the caller.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { ACCEPTED_MIME_TYPES, extensionOf } from '@/domain/validation';
import type { PickedFile } from '@/store/files';

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function fromImageAsset(asset: ImagePicker.ImagePickerAsset, fallbackName: string): PickedFile {
  const mime = asset.mimeType ?? 'image/jpeg';
  let name = asset.fileName ?? fallbackName;
  if (!extensionOf(name)) name = `${name}.${mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1] ?? 'jpg'}`;
  return { uri: asset.uri, name, mime, size: asset.fileSize ?? asset.file?.size, blob: asset.file };
}

export type PickResult = { file: PickedFile } | { denied: true } | null;

export async function pickFromCamera(): Promise<PickResult> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { denied: true };
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.7 });
  if (result.canceled || !result.assets?.[0]) return null;
  return { file: fromImageAsset(result.assets[0], `photo-${stamp()}.jpg`) };
}

export async function pickFromPhotos(): Promise<PickResult> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
  if (result.canceled || !result.assets?.[0]) return null;
  return { file: fromImageAsset(result.assets[0], `photo-${stamp()}.jpg`) };
}

export async function pickFromFiles(): Promise<PickResult> {
  const result = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_MIME_TYPES, copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { file: { uri: asset.uri, name: asset.name, mime: asset.mimeType, size: asset.size ?? asset.file?.size, blob: asset.file } };
}
