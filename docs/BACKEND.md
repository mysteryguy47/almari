# Backend and encryption design

Supabase (Postgres, Auth, Storage, Realtime) stores and relays. It never holds a key, so it can never read a family's papers, numbers or passwords. This page is the reference for the code in `supabase/migrations`, `src/lib/crypto`, `src/sync` and for the security audit.

## What the server can and cannot see

| Server sees | Server never sees |
| --- | --- |
| Account emails (Supabase Auth) | Names, relations, dates of birth, ID numbers |
| Which account belongs to which family | Document titles, numbers, dates, files |
| How many records a family has, their kinds, sizes and times | Passwords, bank and card details, notes |
| Who can read a record (whole family, or one account) | Task titles, family name, activity text |
| Devices: a name like "Chrome on Mac", last seen | Any key |

## Keys

All cryptography is libsodium (`libsodium-wrappers` on the web): XChaCha20-Poly1305 for content, X25519 sealed boxes for sharing keys, BLAKE2b-based KDF for subkeys.

- **Account master key (AMK)**, 32 random bytes, made on the first device. It has a version (1, 2, …). The account's X25519 key pair is derived from it (`crypto_box_seed_keypair(kdf(AMK, "almident"))`), so the secret key is never stored anywhere on its own.
- **Keyring**: every AMK version the account has had. Stored on the server only as `keyring_box` (sealed with the current AMK) and `recovery_box` (sealed with the Recovery Kit key).
- **Family key (FK)**, 32 random bytes per family. The server keeps one copy per member, sealed to that member's public key (`family_keys`).
- **Item key**, 32 random bytes per record. `key_box` is the item key sealed with the family key (shared items) or sealed to one account's public key (private items). `data_box` is the record's JSON encrypted with the item key. Making an item private or shared re-seals only the item key.
- **File key**, 32 random bytes per file, kept inside the document record. Files are encrypted before upload and stay encrypted in the browser's storage.
- **Device key**: a non-extractable WebCrypto AES-GCM key kept in IndexedDB. Everything the web app saves on the device (records, keys, sync state) is encrypted with it.
- Every box binds its context as associated data (family id, record id, kind), so the server cannot move a box to another record without the app noticing.

## Who can read a record

`records.visible_to` is null (the whole family) or one account. It follows the app's own rule (`src/domain/access.ts`):

- Only me → the account that saved it.
- Common items, profile-only members' items → whole family.
- Personal items of an account member → whole family, or only that account when the family keeps personal papers private.
- An owner who has not joined yet → whole family until they join; the screens already hide it.

Any app that can read a record and sees its visibility is out of date re-seals it ("reconcile"). Sharing → private can be done by anyone; private → sharing only by the owner, the next time they open Almari.

## Sync

- Every change is saved on the device first, then queued in an outbox with the last version the device saw (`base`).
- `push_records` takes a per-family lock, so server sequence numbers follow commit order within a family. A record whose server version moved on since `base` comes back as a conflict.
- Conflicts merge on the device: fields only one side changed are kept; when both changed the same field, the change reaching the server later wins, and the other value goes into the item's history. List fields that are sets (mutedBy, dismissedNudges) merge as sets. An edit restores an item the other side deleted.
- `pull_records` returns everything after the device's cursor. Records the caller may no longer read come back as hidden stubs, so the device drops them.
- Realtime tells open apps to pull when their family changes. Apps also pull on start, on focus, when back online and every minute.
- A device whose account has left or been removed from a family drops that family at the next sync.

## Joining a family

- An invite is made for an email. It holds the family key and name, encrypted with a secret that exists only in the invite link's `#fragment` (browsers never send it to a server).
- Opening the link and signing in with that email joins at once.
- Signing in with an invited email without the link shows the invite; any family member's app completes it at its next sync by sealing the family key to the new member.

## A new device, and recovery

1. **Another of your own devices approves**: both screens show the same six symbols (36 bits; the plan said four, six makes a forged key far harder to pass off); the keyring is sealed to the new device.
2. **A family member approves**: the new device gets a new AMK version and the family keys; your other devices are signed out. Your Only-me items stay locked until you use the Recovery Kit.
3. **Recovery Kit**: 24 words (BIP39) and a QR code, printed and kept in the almari. They open `recovery_box`, which holds the whole keyring.
4. None of these: shared papers come back when a family member approves; Only-me items cannot be recovered, by design.

A removed device wipes its data the next time it connects.

## Sign-in

- Supabase Auth: email and password (with email confirmation), Google, reset by email link, a Google user can add a password.
- Five wrong passwords pause password sign-in for that email for 30 minutes. The app enforces it and the server records failures, so the pause shows on every device. Supabase can enforce it server-side only on its Teams plan (Password Verification Hook); the table is ready for that hook.
- Deleting an account: the app removes the person's personal records and files, then `delete_my_account` removes their memberships, keys, devices and the auth user. A family with no account member left is deleted with all its records and files.

## Honest limits

- Key distribution trusts the server to hand out the right public keys (trust on first use). The six-symbol check covers device approval; invites and joins rely on the server and on the email match. The audit should look here first.
- The five-wrong-passwords pause is enforced by the app and recorded on the server (so every device sees it), but someone calling Supabase directly is held back only by Supabase's own rate limits. A true server-side pause needs Supabase's Password Verification Hook (Teams plan); `sign_in_failures` is ready for it.
- Family keys are not rotated when someone leaves or a device is lost. Removed members lose access to everything new on the server, but keep anything already on their device. Rotation is planned for Phase 2.
- The app PIN gates the screens; it does not encrypt. The device key does.

## Where it lives, and how it is tested

| Part | Code | Tests |
| --- | --- | --- |
| Tables, access rules, server functions, file bucket | `supabase/migrations/` | `tests/backend/rules.test.ts`: 24 rules against a real local Supabase |
| Encryption | `src/lib/crypto/` | `src/lib/crypto/__tests__/`: 13 |
| Records, merging, the sync engine | `src/sync/model.ts`, `merge.ts`, `engine.ts` | `src/sync/__tests__/` (16) and `tests/backend/sync.test.ts`: two family members' devices against the server (9) |
| Device set-up, approval, Recovery Kit, starting fresh | `src/sync/vault.ts` | `tests/backend/vault.test.ts` (5) |
| Sign-in, invites, removals, devices in the app | `src/sync/account.ts`, `actions.ts`, `runtime.ts` | Scripted browser runs: sign-up with real confirmation emails, invites by link and by email, Only me, file sync, live updates, offline, own-device and family approval, the kit by words and by photo, the password pause and reset, PIN lockout, leaving, deleting an account, the production build |

`npx supabase start` runs the local Supabase (Docker); `npm run test:backend` runs the server tests against it.

