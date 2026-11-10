# Almari (working name)

*Ghar ke saare kaagaz, ek jagah.* A family vault for Indian households: every member's documents, ID numbers, passwords, bank accounts and cards, plus a family to-do with reminders.

This folder holds the **prototype**. It is a real app on the stack the MVP will use, but sign-in is simulated, nothing leaves the device, and nothing is encrypted yet. Use the sample family or test papers, never real ones. The product plan is a Claude Doc: https://claude.ai/artifact/VoyDzH5oxgHKhVZGpfeHcX

## Run it

Use Node 24 LTS. React Native 0.88 supports Node 22, 24 and 26; this Mac currently has Node 25, which works but prints engine warnings.

```bash
npm install
npx expo start --web          # the web app (what iPhone users install from Safari)
npx expo start                # then press a: Android, through Expo Go
```

To try it without signing up, open the web app and tap **Explore a sample family** (the Sharmas). Under the family nameplate, **Viewing as** shows the app through Papa's or Mummy's eyes, which is how to check privacy and reminders.

## Check it

```bash
npm run typecheck   # TypeScript, strict
npm run lint        # ESLint with the React Compiler rules
npm test            # Jest: domain rules, app state, colour contrast
npm run check       # all three
npx expo export -p web   # production web build in dist/ (installable, works offline)
```

## How the code is laid out

| Folder | What lives there |
| --- | --- |
| `src/domain` | Every rule, as pure TypeScript with no React: the data model, who can see what, who is reminded and when, the 121 templates, validation (Verhoeff for Aadhaar, Luhn for cards, PAN, IFSC), search with Hinglish synonyms, the sample family. Most tests are here. |
| `src/store` | App state (Zustand + Immer), saved after every change. Storage on Android is files written one at a time and atomically; on the web it is IndexedDB. |
| `src/theme` | Colours (light and dark, every text pair checked for WCAG AA contrast by a test), spacing, fonts (Anek Latin, Eczar). |
| `src/components` | The UI kit: rows, cards, rubber-stamp labels, the brass nameplate, sheets that follow the finger, slide to confirm, PIN pad, flipping bank cards. |
| `src/app` | Screens, one file per route (Expo Router). |
| `public` | The web app's page, manifest, icons and service worker (offline support for the installed iPhone app). |

## What is real and what is simulated

| Real in the prototype | Simulated or not built yet |
| --- | --- |
| Families (up to 3 per person), members with or without email, pets, in loving memory | Google sign-in (a stand-in screen asks for the name and Gmail) |
| Privacy: personal papers shared or private, Only me, no admin, second-member removals | Reset email (the reset screen is shown in place of the email) |
| Documents: 121 templates, camera / photos / files, 10 MB limit, profile numbers filled in | Encryption, server, sync between phones, recovery |
| Locker: passwords, many bank accounts, credit cards without an account, CVV and PIN behind a re-check | Phone notifications (reminders are calculated and listed in the app) |
| To-do, reminders for everyone with opt-outs, the renew-the-paper loop | Scanner with edge detection, compression, HEIC to JPG, PDF merge |
| App PIN (5 tries), password pause (5 tries, 30 minutes), fingerprint on Android | Hindi and other languages |
| Dark mode, offline web app, Android app through Expo Go | Export, account deletion on a web page |

## Verified

- 145 unit tests, type check and lint clean.
- Scripted runs of the web app in headless Chrome at phone size: sign-up to first family, the sample family, privacy by viewer, real file uploads (size and type limits), lockouts and resets, card and bank forms, and the installed web app opening with no network.
- The Android app in the emulator through Expo Go: rendering, tabs, sheets, the card flip, and data surviving a force-close.
- Not tested: a real iPhone or iOS Safari (this Mac has no Xcode or iOS Simulator), and a physical Android phone.
