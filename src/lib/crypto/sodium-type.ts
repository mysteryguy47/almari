/** The part of libsodium Almari uses, the same on the web and on the phone. */
export interface Sodium {
  ready: Promise<void>;
  base64_variants: { URLSAFE_NO_PADDING: number };
  to_base64(input: Uint8Array, variant: number): string;
  from_base64(input: string, variant: number): Uint8Array;
  randombytes_buf(length: number): Uint8Array;
  memzero?(bytes: Uint8Array): void;
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: number;
  /** Associated data is passed as a string: the phone's library accepts only strings, and both turn it into the same UTF-8 bytes. */
  crypto_aead_xchacha20poly1305_ietf_encrypt(message: Uint8Array, additionalData: string, secretNonce: null, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_decrypt(secretNonce: null, ciphertext: Uint8Array, additionalData: string, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  crypto_kdf_derive_from_key(length: number, id: number, context: string, key: Uint8Array): Uint8Array;
  crypto_box_seed_keypair(seed: Uint8Array): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_box_seal(message: Uint8Array, publicKey: Uint8Array): Uint8Array;
  crypto_box_seal_open(ciphertext: Uint8Array, publicKey: Uint8Array, privateKey: Uint8Array): Uint8Array;
  crypto_generichash(length: number, message: Uint8Array, key?: Uint8Array | null): Uint8Array;
}
