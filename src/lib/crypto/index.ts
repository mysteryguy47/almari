/**
 * Almari's cryptography, in one small place. libsodium only:
 * - XChaCha20-Poly1305 (AEAD) for content, with the context bound as associated data
 * - X25519 sealed boxes to share a key with one account
 * - libsodium's KDF for subkeys, BLAKE2b for fingerprints
 *
 * Boxes are strings: "1." + URL-safe base64 of (nonce || ciphertext). The "1."
 * leaves room to change the format later without guessing.
 *
 * Call `initCrypto()` once (the app does it at start-up) before anything else.
 */
import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import sodiumModule from 'libsodium-wrappers';

type Sodium = typeof sodiumModule;

let sodium: Sodium | null = null;
let loading: Promise<void> | null = null;

export function initCrypto(): Promise<void> {
  if (sodium) return Promise.resolve();
  if (!loading) {
    // The default export is the whole library, `ready` included.
    // eslint-disable-next-line import/no-named-as-default-member
    loading = sodiumModule.ready.then(() => {
      sodium = sodiumModule;
    });
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

function s(): Sodium {
  if (!sodium) throw new Error('Encryption is still starting. Try again in a moment.');
  return sodium;
}

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

const BOX_PREFIX = '1.';
const enc = new TextEncoder();
const dec = new TextDecoder();

export const KEY_BYTES = 32;

export function toB64(bytes: Uint8Array): string {
  return s().to_base64(bytes, s().base64_variants.URLSAFE_NO_PADDING);
}

export function fromB64(text: string): Uint8Array {
  try {
    return s().from_base64(text, s().base64_variants.URLSAFE_NO_PADDING);
  } catch {
    throw new CryptoError('This data is damaged');
  }
}

export function utf8(text: string): Uint8Array {
  return enc.encode(text);
}

export function fromUtf8(bytes: Uint8Array): string {
  return dec.decode(bytes);
}

export function randomBytes(length: number): Uint8Array {
  return s().randombytes_buf(length);
}

export function randomKey(): Uint8Array {
  return randomBytes(KEY_BYTES);
}

/** Overwrites key material that is no longer needed. */
export function wipe(bytes: Uint8Array | undefined | null): void {
  if (bytes) s().memzero(bytes);
}

// ---------------------------------------------------------------- symmetric boxes

function unbox(box: string): Uint8Array {
  if (!box.startsWith(BOX_PREFIX)) throw new CryptoError('This data is in a format this version of Almari cannot read');
  return fromB64(box.slice(BOX_PREFIX.length));
}

export function encryptBytes(plain: Uint8Array, key: Uint8Array, context: string): string {
  const so = s();
  const nonce = so.randombytes_buf(so.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const cipher = so.crypto_aead_xchacha20poly1305_ietf_encrypt(plain, utf8(context), null, nonce, key);
  const out = new Uint8Array(nonce.length + cipher.length);
  out.set(nonce);
  out.set(cipher, nonce.length);
  return BOX_PREFIX + toB64(out);
}

export function decryptBytes(box: string, key: Uint8Array, context: string): Uint8Array {
  const so = s();
  const raw = unbox(box);
  const n = so.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  if (raw.length <= n) throw new CryptoError('This data is damaged');
  try {
    return so.crypto_aead_xchacha20poly1305_ietf_decrypt(null, raw.subarray(n), utf8(context), raw.subarray(0, n), key);
  } catch {
    throw new CryptoError('This data could not be unlocked with this key');
  }
}

export function encryptJson(value: unknown, key: Uint8Array, context: string): string {
  return encryptBytes(utf8(JSON.stringify(value)), key, context);
}

export function decryptJson<T>(box: string, key: Uint8Array, context: string): T {
  return JSON.parse(fromUtf8(decryptBytes(box, key, context))) as T;
}

/** Files: raw bytes out, so large files are not base64-encoded. Layout: nonce || ciphertext. */
export function encryptFile(plain: Uint8Array, key: Uint8Array, context: string): Uint8Array {
  const so = s();
  const nonce = so.randombytes_buf(so.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const cipher = so.crypto_aead_xchacha20poly1305_ietf_encrypt(plain, utf8(context), null, nonce, key);
  const out = new Uint8Array(nonce.length + cipher.length);
  out.set(nonce);
  out.set(cipher, nonce.length);
  return out;
}

export function decryptFile(data: Uint8Array, key: Uint8Array, context: string): Uint8Array {
  const so = s();
  const n = so.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  if (data.length <= n) throw new CryptoError('This file is damaged');
  try {
    return so.crypto_aead_xchacha20poly1305_ietf_decrypt(null, data.subarray(n), utf8(context), data.subarray(0, n), key);
  } catch {
    throw new CryptoError('This file could not be unlocked');
  }
}

// ---------------------------------------------------------------- keys from keys

/** Context strings for the KDF must be exactly 8 characters. */
export function deriveKey(master: Uint8Array, id: number, context: string): Uint8Array {
  if (context.length !== 8) throw new Error('KDF context must be 8 characters');
  return s().crypto_kdf_derive_from_key(KEY_BYTES, id, context, master);
}

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/** The account's X25519 key pair, derived from its master key so the secret key is never stored on its own. */
export function keyPairFromMaster(amk: Uint8Array): KeyPair {
  const seed = deriveKey(amk, 1, 'almident');
  const pair = s().crypto_box_seed_keypair(seed);
  wipe(seed);
  return { publicKey: pair.publicKey, secretKey: pair.privateKey };
}

// ---------------------------------------------------------------- sealed boxes

export function seal(message: Uint8Array, publicKey: Uint8Array): string {
  return BOX_PREFIX + toB64(s().crypto_box_seal(message, publicKey));
}

export function openSealed(box: string, pair: KeyPair): Uint8Array {
  try {
    return s().crypto_box_seal_open(unbox(box), pair.publicKey, pair.secretKey);
  } catch (e) {
    if (e instanceof CryptoError) throw e;
    throw new CryptoError('This was not sealed for this account');
  }
}

// ---------------------------------------------------------------- comparing keys by eye

/**
 * Six everyday things, the same on both screens, so a person can check that
 * the device asking is really the one in front of them. 64 symbols, 36 bits.
 */
export const SYMBOLS: readonly { emoji: string; name: string }[] = [
  { emoji: '🪔', name: 'diya' }, { emoji: '🐘', name: 'elephant' }, { emoji: '🥭', name: 'mango' }, { emoji: '🚲', name: 'cycle' },
  { emoji: '🦚', name: 'peacock' }, { emoji: '🪁', name: 'kite' }, { emoji: '🍵', name: 'chai' }, { emoji: '🛺', name: 'auto' },
  { emoji: '🌶️', name: 'chilli' }, { emoji: '🥥', name: 'coconut' }, { emoji: '🐅', name: 'tiger' }, { emoji: '🌸', name: 'flower' },
  { emoji: '🏏', name: 'cricket' }, { emoji: '🎺', name: 'trumpet' }, { emoji: '🪷', name: 'lotus' }, { emoji: '🐄', name: 'cow' },
  { emoji: '🦜', name: 'parrot' }, { emoji: '🍋', name: 'lemon' }, { emoji: '🌙', name: 'moon' }, { emoji: '☀️', name: 'sun' },
  { emoji: '⭐', name: 'star' }, { emoji: '🔔', name: 'bell' }, { emoji: '🔑', name: 'key' }, { emoji: '🌧️', name: 'rain' },
  { emoji: '🐒', name: 'monkey' }, { emoji: '🐫', name: 'camel' }, { emoji: '🐟', name: 'fish' }, { emoji: '🦋', name: 'butterfly' },
  { emoji: '🌴', name: 'palm' }, { emoji: '🍌', name: 'banana' }, { emoji: '🍉', name: 'watermelon' }, { emoji: '🥕', name: 'carrot' },
  { emoji: '🧅', name: 'onion' }, { emoji: '🍞', name: 'bread' }, { emoji: '🥛', name: 'milk' }, { emoji: '🍬', name: 'sweet' },
  { emoji: '🎈', name: 'balloon' }, { emoji: '🪀', name: 'yo-yo' }, { emoji: '🎲', name: 'dice' }, { emoji: '🧵', name: 'thread' },
  { emoji: '✂️', name: 'scissors' }, { emoji: '📮', name: 'postbox' }, { emoji: '✉️', name: 'letter' }, { emoji: '📻', name: 'radio' },
  { emoji: '☂️', name: 'umbrella' }, { emoji: '🚂', name: 'train' }, { emoji: '⛵', name: 'boat' }, { emoji: '✈️', name: 'plane' },
  { emoji: '🏠', name: 'house' }, { emoji: '🕰️', name: 'clock' }, { emoji: '💡', name: 'bulb' }, { emoji: '🪑', name: 'chair' },
  { emoji: '🧸', name: 'teddy' }, { emoji: '🎁', name: 'gift' }, { emoji: '🌻', name: 'sunflower' }, { emoji: '🍎', name: 'apple' },
  { emoji: '🍇', name: 'grapes' }, { emoji: '🐓', name: 'rooster' }, { emoji: '🐐', name: 'goat' }, { emoji: '🦆', name: 'duck' },
  { emoji: '🐢', name: 'tortoise' }, { emoji: '🐝', name: 'bee' }, { emoji: '🌈', name: 'rainbow' }, { emoji: '🥁', name: 'drum' },
];

export const SYMBOL_COUNT = 6;

export function keySymbols(publicKey: Uint8Array): { emoji: string; name: string }[] {
  const hash = s().crypto_generichash(16, publicKey, utf8('almari-symbols'));
  const out: { emoji: string; name: string }[] = [];
  // Six 6-bit groups from the first 36 bits.
  let bits = 0;
  let acc = 0;
  for (let i = 0; out.length < SYMBOL_COUNT; i++) {
    acc = (acc << 8) | hash[i];
    bits += 8;
    while (bits >= 6 && out.length < SYMBOL_COUNT) {
      bits -= 6;
      out.push(SYMBOLS[(acc >> bits) & 63]);
    }
    acc &= (1 << bits) - 1;
  }
  return out;
}

// ---------------------------------------------------------------- the Recovery Kit

/** 24 words (BIP39 English) from 32 random bytes. */
export function newKitWords(): { words: string[]; entropy: Uint8Array } {
  const entropy = randomBytes(32);
  return { words: entropyToMnemonic(entropy, wordlist).split(' '), entropy };
}

export function normaliseKitWords(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
}

/** The entropy behind 24 kit words, or null when they are not a valid kit (wrong word, wrong order, typo). */
export function kitEntropy(words: string[]): Uint8Array | null {
  const phrase = words.join(' ');
  if (words.length !== 24 || !validateMnemonic(phrase, wordlist)) return null;
  return mnemonicToEntropy(phrase, wordlist);
}

export function isKitWord(word: string): boolean {
  return wordlist.includes(word);
}

/** The key that opens the account's recovery box. */
export function kitKey(entropy: Uint8Array): Uint8Array {
  return deriveKey(entropy, 1, 'almrecov');
}

/** What the kit's QR code holds: a short, versioned text with the 32 bytes. */
export function kitQrText(entropy: Uint8Array): string {
  return `almari-kit:1:${toB64(entropy)}`;
}

export function entropyFromKitQr(text: string): Uint8Array | null {
  const match = /^almari-kit:1:([A-Za-z0-9_-]{43})$/.exec(text.trim());
  if (!match) return null;
  try {
    const bytes = fromB64(match[1]);
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- invite secrets

/** The key that opens an invite, from the secret in the link's #fragment. */
export function inviteKey(secret: Uint8Array): Uint8Array {
  return deriveKey(secret, 1, 'alminvit');
}
