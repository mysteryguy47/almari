/**
 * A tiny harness for backend tests: local Supabase keys, throwaway accounts
 * with real keys, and clean-up.
 */
import { execSync } from 'node:child_process';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { encryptJson, initCrypto, keyPairFromMaster, randomKey, seal, toB64, type KeyPair } from '@/lib/crypto';

interface Local {
  url: string;
  publishableKey: string;
  secretKey: string;
}

let local: Local | null = null;

export function localSupabase(): Local {
  if (local) return local;
  const raw = execSync('npx supabase status -o json', { cwd: `${__dirname}/../..`, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const json = JSON.parse(raw.slice(raw.indexOf('{')));
  local = { url: json.API_URL, publishableKey: json.PUBLISHABLE_KEY ?? json.ANON_KEY, secretKey: json.SECRET_KEY ?? json.SERVICE_ROLE_KEY };
  return local;
}

export function admin(): SupabaseClient {
  const { url, secretKey } = localSupabase();
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): SupabaseClient {
  const { url, publishableKey } = localSupabase();
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
  amk: Uint8Array;
  pair: KeyPair;
}

const runId = Date.now().toString(36);
const created: string[] = [];
const families: string[] = [];

export function uniqueEmail(name: string): string {
  return `${name}.${runId}.${Math.random().toString(36).slice(2, 7)}@example.test`;
}

export async function newUser(name: string, opts: { vault?: boolean; email?: string } = {}): Promise<TestUser> {
  await initCrypto();
  const email = opts.email ?? uniqueEmail(name);
  const password = `pass-${Math.random().toString(36).slice(2)}-Aa1`;
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  created.push(data.user.id);
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const amk = randomKey();
  const pair = keyPairFromMaster(amk);
  const user: TestUser = { id: data.user.id, email, password, client, amk, pair };
  if (opts.vault !== false) {
    const { error: e } = await client.rpc('init_vault', {
      p_public_key: toB64(pair.publicKey),
      p_keyring_box: encryptJson([{ version: 1, amk: toB64(amk) }], amk, `keyring:${user.id}`),
    });
    if (e) throw e;
  }
  return user;
}

export function newFamilyId(): string {
  const id = crypto.randomUUID();
  families.push(id);
  return id;
}

export async function createFamily(owner: TestUser, memberId = 'm-owner'): Promise<{ familyId: string; familyKey: Uint8Array }> {
  const familyId = newFamilyId();
  const familyKey = randomKey();
  const { error } = await owner.client.rpc('create_family', {
    p_family_id: familyId,
    p_member_id: memberId,
    p_key_box: seal(familyKey, owner.pair.publicKey),
  });
  if (error) throw error;
  return { familyId, familyKey };
}

/** Puts a second account straight into a family, as an accepted invite would. */
export async function addToFamily(by: TestUser, familyId: string, familyKey: Uint8Array, who: TestUser, memberId: string) {
  const { data: invite, error } = await by.client
    .from('invites')
    .insert({ family_id: familyId, email: who.email, member_id: memberId, box: '1.x', created_by: by.id })
    .select('id')
    .single();
  if (error) throw error;
  const accept = await who.client.rpc('accept_invite', { p_invite_id: invite.id, p_key_box: seal(familyKey, who.pair.publicKey) });
  if (accept.error) throw accept.error;
}

export async function cleanUp() {
  const a = admin();
  if (families.length) await a.from('families').delete().in('id', families);
  for (const id of created.splice(0)) await a.auth.admin.deleteUser(id).catch(() => undefined);
}
