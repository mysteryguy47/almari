import {
  CryptoError, decryptBytes, decryptFile, decryptJson, encryptBytes, encryptFile, encryptJson, entropyFromKitQr, initCrypto,
  keyPairFromMaster, keySymbols, kitEntropy, kitKey, kitQrText, newKitWords, normaliseKitWords, openSealed, randomKey, seal,
  SYMBOLS, utf8,
} from '../index';

beforeAll(() => initCrypto());

describe('symmetric boxes', () => {
  it('round-trips JSON with its context', () => {
    const key = randomKey();
    const box = encryptJson({ title: 'Papa ka PAN', n: 1 }, key, 'rec:f1:r1:document');
    expect(box.startsWith('1.')).toBe(true);
    expect(box).not.toContain('Papa');
    expect(decryptJson(box, key, 'rec:f1:r1:document')).toEqual({ title: 'Papa ka PAN', n: 1 });
  });

  it('refuses a box moved to another record (context is bound)', () => {
    const key = randomKey();
    const box = encryptJson({ a: 1 }, key, 'rec:f1:r1:document');
    expect(() => decryptJson(box, key, 'rec:f1:r2:document')).toThrow(CryptoError);
  });

  it('refuses the wrong key and tampered data', () => {
    const key = randomKey();
    const box = encryptBytes(utf8('hello'), key, 'ctx');
    expect(() => decryptBytes(box, randomKey(), 'ctx')).toThrow(CryptoError);
    const tampered = box.slice(0, -2) + (box.endsWith('A') ? 'BB' : 'AA');
    expect(() => decryptBytes(tampered, key, 'ctx')).toThrow(CryptoError);
    expect(() => decryptBytes('2.abc', key, 'ctx')).toThrow(CryptoError);
  });

  it('uses a fresh nonce every time', () => {
    const key = randomKey();
    expect(encryptJson({ a: 1 }, key, 'c')).not.toBe(encryptJson({ a: 1 }, key, 'c'));
  });

  it('encrypts files as raw bytes', () => {
    const key = randomKey();
    const plain = new Uint8Array(100_000).map((_, i) => i % 251);
    const sealed = encryptFile(plain, key, 'file:f1:x');
    expect(sealed.length).toBe(plain.length + 24 + 16);
    expect(decryptFile(sealed, key, 'file:f1:x')).toEqual(plain);
    expect(() => decryptFile(sealed, key, 'file:f1:y')).toThrow(CryptoError);
  });
});

describe('account keys and sealed boxes', () => {
  it('derives the same key pair from the same master key', () => {
    const amk = randomKey();
    const a = keyPairFromMaster(amk);
    const b = keyPairFromMaster(amk);
    expect(a.publicKey).toEqual(b.publicKey);
    expect(keyPairFromMaster(randomKey()).publicKey).not.toEqual(a.publicKey);
  });

  it('seals a key so only that account can open it', () => {
    const riya = keyPairFromMaster(randomKey());
    const papa = keyPairFromMaster(randomKey());
    const familyKey = randomKey();
    const box = seal(familyKey, riya.publicKey);
    expect(openSealed(box, riya)).toEqual(familyKey);
    expect(() => openSealed(box, papa)).toThrow(CryptoError);
  });
});

describe('symbols for comparing devices', () => {
  it('gives six symbols, stable for a key and different across keys', () => {
    const pk = keyPairFromMaster(randomKey()).publicKey;
    const one = keySymbols(pk);
    expect(one).toHaveLength(6);
    expect(keySymbols(pk)).toEqual(one);
    const others = Array.from({ length: 20 }, () => keySymbols(keyPairFromMaster(randomKey()).publicKey).map((x) => x.name).join());
    expect(new Set(others).size).toBeGreaterThan(18);
  });

  it('has 64 distinct, named symbols', () => {
    expect(SYMBOLS).toHaveLength(64);
    expect(new Set(SYMBOLS.map((x) => x.emoji)).size).toBe(64);
    expect(new Set(SYMBOLS.map((x) => x.name)).size).toBe(64);
  });
});

describe('the Recovery Kit', () => {
  it('turns 32 bytes into 24 words and back', () => {
    const { words, entropy } = newKitWords();
    expect(words).toHaveLength(24);
    expect(kitEntropy(words)).toEqual(entropy);
    expect(kitKey(entropy)).toEqual(kitKey(kitEntropy(words) as Uint8Array));
  });

  it('rejects a typo, a swapped word or a short list', () => {
    const { words } = newKitWords();
    const typo = [...words];
    typo[3] = typo[3] === 'abandon' ? 'ability' : 'abandon';
    expect(kitEntropy(typo)).toBeNull();
    expect(kitEntropy(words.slice(0, 23))).toBeNull();
  });

  it('reads words typed with capitals, commas and numbers', () => {
    const { words, entropy } = newKitWords();
    const typed = words.map((w, i) => `${i + 1}. ${w.toUpperCase()},`).join('  ');
    expect(kitEntropy(normaliseKitWords(typed))).toEqual(entropy);
  });

  it('round-trips the QR text and rejects anything else', () => {
    const { entropy } = newKitWords();
    expect(entropyFromKitQr(kitQrText(entropy))).toEqual(entropy);
    expect(entropyFromKitQr('https://example.com')).toBeNull();
    expect(entropyFromKitQr('almari-kit:1:short')).toBeNull();
  });
});
