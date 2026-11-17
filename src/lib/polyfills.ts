/**
 * What Android's JavaScript engine (Hermes) lacks and the web has: URL parsing
 * good enough for Supabase, and `crypto` (secure random numbers, UUIDs, and
 * SHA-256 for the sign-in code challenge), backed by expo-crypto.
 * Imported first, before anything that talks to the server.
 */
import 'react-native-url-polyfill/auto';

import * as ExpoCrypto from 'expo-crypto';

type CryptoLike = {
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
  randomUUID?: () => string;
  subtle?: { digest?: (algorithm: string | { name: string }, data: BufferSource) => Promise<ArrayBuffer> };
};

const g = globalThis as unknown as { crypto?: CryptoLike };
const c: CryptoLike = g.crypto ?? {};
if (!c.getRandomValues) c.getRandomValues = (array) => ExpoCrypto.getRandomValues(array as unknown as Uint8Array) as unknown as typeof array;
if (!c.randomUUID) c.randomUUID = () => ExpoCrypto.randomUUID();
if (!c.subtle?.digest) {
  const ALGORITHMS: Record<string, ExpoCrypto.CryptoDigestAlgorithm> = {
    'SHA-1': ExpoCrypto.CryptoDigestAlgorithm.SHA1,
    'SHA-256': ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    'SHA-384': ExpoCrypto.CryptoDigestAlgorithm.SHA384,
    'SHA-512': ExpoCrypto.CryptoDigestAlgorithm.SHA512,
  };
  c.subtle = {
    ...(c.subtle ?? {}),
    digest: (algorithm, data) => {
      const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
      const algo = ALGORITHMS[name.toUpperCase()];
      if (!algo) return Promise.reject(new Error(`Unsupported digest ${name}`));
      return ExpoCrypto.digest(algo, data);
    },
  };
}
g.crypto = c;
