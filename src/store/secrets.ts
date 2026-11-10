/**
 * Ids and secret hashing for the prototype.
 *
 * Prototype note: passwords and the app PIN are stored as salted SHA-256 so
 * they are never kept in plain text on the device. That is enough for a
 * prototype with sample data, not for production. In the MVP, passwords are
 * checked by the server (Supabase Auth) and the PIN unlocks a key held in
 * Android Keystore, so no hash of either is stored by the app.
 */
import * as Crypto from 'expo-crypto';

export function newId(): string {
  return Crypto.randomUUID();
}

export function newSalt(): string {
  return Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashSecret(secret: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `almari:${salt}:${secret}`);
}
