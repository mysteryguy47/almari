# Almari

*Ghar ke saare kaagaz, ek jagah.* A family vault for Indian households: every member's documents, ID numbers, passwords, bank accounts and cards, plus a family to-do with reminders.

The web app is complete with its backend: real accounts (email or Google), end-to-end encryption, sync between the family's phones, encrypted files, invites, device approval and a printed Recovery Kit. The server (Supabase) never holds a key, so it cannot read what a family keeps. It is in beta: test with real families, but keep paper originals safe and expect an independent security audit before public launch. The design is in [docs/BACKEND.md](docs/BACKEND.md); the product plan is a Claude Doc: https://claude.ai/artifact/VoyDzH5oxgHKhVZGpfeHcX

## Run it

Use Node 24 LTS. React Native 0.88 supports Node 22, 24 and 26; this Mac currently has Node 25, which works but prints engine warnings.

```bash
npm install
npx supabase start            # a local Supabase in Docker (first run downloads it)
npx supabase db reset         # applies supabase/migrations
cp .env.local.example .env.local   # then paste the URL and publishable key from `npx supabase status`
npx expo start --web          # the web app (what iPhone users install from Safari)
```

Sign-up and reset emails land in the local mailbox at http://127.0.0.1:54324. The Android app has not been run against the backend yet. libsodium needs WebAssembly, which Android's JavaScript engine lacks, so expect to switch to `react-native-libsodium` in a development build; see docs/DEPLOY.md.

To try it without signing up, open the web app and tap **Explore a sample family** (the Sharmas). Under the family nameplate, **Viewing as** shows the app through Papa's or Mummy's eyes, which is how to check privacy and reminders.

To put the web app online, or to set up Google sign-in, follow [docs/DEPLOY.md](docs/DEPLOY.md) and [docs/GOOGLE-SIGN-IN.md](docs/GOOGLE-SIGN-IN.md).

## Check it

```bash
npm run typecheck   # TypeScript, strict
npm run lint        # ESLint with the React Compiler rules
npm test            # Jest: domain rules, encryption, sync merging, app state, colour contrast
npm run check       # all three
npm run test:backend   # the server's rules, sync between two members, recovery: against the local Supabase
npx expo export -p web   # production web build in dist/ (installable, works offline)
```

## How the code is laid out

| Folder | What lives there |
| --- | --- |
| `src/domain` | Every rule, as pure TypeScript with no React: the data model, who can see what, who is reminded and when, the 121 templates, validation (Verhoeff for Aadhaar, Luhn for cards, PAN, IFSC), search with Hinglish synonyms, the sample family. Most tests are here. |
| `src/lib` | Device-specific work with a web and a native version side by side: image resizing and masking (`image-ops`), reading text from a photo (`ocr`), turning saved files into PDF pages. |
| `src/lib/crypto` | All the cryptography (libsodium): boxes bound to what they belong to, sealed keys, the six comparison symbols, the Recovery Kit's 24 words. |
| `src/sync` | The cloud: Supabase calls (`api`), family ↔ records (`model`), merging two edits (`merge`), the sync engine, device set-up and recovery (`vault`), sign-in (`account`), invites and removals (`actions`), and the runtime that keeps it all in sync. |
| `src/store` | App state (Zustand + Immer), saved shortly after every change. On the web it is IndexedDB, encrypted with a non-extractable device key; files are stored encrypted with their own keys. On Android, files written one at a time and atomically (encryption at rest there comes with the Android build). |
| `supabase` | The database: tables, access rules and server functions in one migration, and the local configuration. |
| `tests/backend` | Tests that run against the local Supabase with real accounts. |
| `src/theme` | Colours (light and dark, every text pair checked for WCAG AA contrast by a test), spacing, fonts (Anek Latin, Eczar). |
| `src/components` | The UI kit: rows, cards, rubber-stamp labels, the brass nameplate, sheets that follow the finger, slide to confirm, PIN pad, flipping bank cards. |
| `src/app` | Screens, one file per route (Expo Router). |
| `public` | The web app's page, manifest, icons and service worker (offline support for the installed iPhone app). |

`metro.config.js` points every import of `tslib` at its plain ES module build. Without it, pdf-lib crashes the web app at startup ("Cannot destructure property '__extends'"). Keep it.

## Phase 2: papers that work for you

| Feature | Where | How it works |
| --- | --- | --- |
| Situation packs | Home → Handy → Ready for a situation | Hospital, bank KYC, school admission, exam form, travel abroad, vehicle check, home loan. Shows what is missing for the chosen person, then makes one PDF: a checklist page, then every paper. |
| Print-ready sheet | Home → Handy → Print-ready sheet | Up to 8 card-sized papers at true size (85.6 × 54 mm), front and back side by side, four to an A4 page, with cut lines. |
| Form-ready export | A photo paper → Resize for a form | Exact pixels and a KB limit (photo 200 × 230 under 50 KB, signature 140 × 60 under 20 KB, and others, or custom). Finds the best JPEG quality that fits. |
| Masked Aadhaar | An Aadhaar photo → Make a masked copy | Blacks out the first 8 digits, as UIDAI's masked Aadhaar does. On the web the bar is placed by reading the number; it can be dragged and resized by hand. |
| Read numbers from the scan | Add a paper → Read from the photo | Finds Aadhaar (Verhoeff-checked), PAN, passport, voter ID, licence, IFSC, vehicle numbers and dates, and offers them as chips. Nothing is filled in without a tap. Web only for now (Tesseract in the browser; the photo stays on the device). |
| Life-stage nudges | Home → Coming up, and Reminders | Aadhaar biometric updates at 5 and 15, voter ID and own login at 18, senior-citizen benefits at 60, the pensioner's life certificate in November. One tap makes a task. |
| Money map | Home → Handy → Money map | Every account, deposit and policy in one list, with the nominee where one is noted and a flag where none is. |

## What works, and what is still to come

| Works on the web | Still to come |
| --- | --- |
| Accounts: email and password with confirmation, Google, reset by email, a Google user adding a password, five-try pause, deleting the account | Android app (development build with native encryption, Google sign-in, ML Kit) |
| End-to-end encryption of every record and file; private items sealed for one person; the server sees only locked boxes | Phone notifications and iPhone web push |
| Sync between family phones: offline first, merging two people's edits, live updates, a removed device wiped at its next connection | Email sending from your own domain (SMTP) for family testers |
| Families, invites by link (WhatsApp, copy, QR) or by email, joining, leaving, removals approved by a second member, up to 3 families | Family key rotation after someone leaves (Phase 2) |
| New devices: approval from your own device or a family member's with six matching symbols, the printed Recovery Kit (words or QR photo), starting fresh | Hindi and other languages; export as readable folders |
| Everything from the prototype and Phase 2: 121 templates, locker, to-do, reminders, packs, print sheet, form export, masked Aadhaar, nudges, money map | Independent security audit; account deletion on a web page |

## Verified

- 202 unit tests and 38 backend tests (against a local Supabase with real accounts), type check and lint clean.
- The backend in headless Chrome, two to five browser profiles playing family members, with real confirmation and reset emails: sign-up and first family; an invite link opened before signing up; joining by email without the link; a shared note and an encrypted PAN photo reaching the other member; an Only me note never reaching them; edits both ways; a live update within seconds; a note written offline syncing on reconnect; a new browser let in by Papa's other browser (six symbols matching) and by a family member (old phone then wiped, Only me items stayed locked); the Recovery Kit by typed words and by a photo of the printed PDF; five wrong passwords pausing sign-in, a reset link lifting it; five wrong PINs and signing in again with nothing lost; leaving a family; deleting an account; the Google button reaching Google with the right client. On the production build: sign-up with email confirmation, a family, an encrypted photo, sync, and opening offline. The server's tables hold no readable names, numbers or titles.
- Scripted runs of the web app in headless Chrome at phone size: sign-up to first family, the sample family, privacy by viewer, real file uploads (size and type limits), lockouts and resets, card and bank forms, and the installed web app opening with no network.
- Phase 2 in headless Chrome, on the dev server and on the production build: a nudge becoming a task, the money map's missing-nominee flags, a vehicle-check PDF (6 A4 pages, checked with pdf-lib), a print sheet, reading a licence and a test Aadhaar card, the masked copy, and a 200 × 230 px photo under 50 KB.
- The Android app in the emulator through Expo Go: rendering, tabs, sheets, the card flip, and data surviving a force-close. Phase 2: the home nudge, a pack PDF built on the phone and handed to the share sheet, the form export (200 × 230 px, 28 KB) opening the share sheet, and a masked Aadhaar copy placed by hand and shared exactly as shown.
- Not tested: a real iPhone or iOS Safari (this Mac has no Xcode or iOS Simulator), a physical Android phone, the Android app with the backend, real Google sign-in (needs your Google client), and your hosted Supabase project (needs the migration applied there).
