# Putting Almari online

## What runs where

Today the whole app, screens and rules alike, runs on the phone or in the browser. There is no server: data stays on the device. So going live today means hosting the web app's files, nothing more.

The MVP adds a backend for sign-in, encrypted sync between family phones, file storage and push reminders. That backend is **Supabase** in Mumbai. No custom server is planned, so **Railway is not needed**. If a small server job comes up later (for example sending the morning reminders), Supabase Edge Functions with a schedule cover it.

| Piece | Where | Cost to start |
| --- | --- | --- |
| Web app (iPhone, desktop, anyone with a link) | **Vercel**, from this GitHub repo | Hobby is free but for non-commercial use only. Move to Pro before charging money. |
| Backend (MVP) | **Supabase**, region South Asia (Mumbai) | Free while building (free projects pause after a week without use). Pro for launch. |
| Android app | **EAS Build** makes it, **Play Console** ships it | EAS free tier is enough to start. You already have the Play account. |
| iPhone | The Vercel web app, added to the Home Screen | Free. No Apple account needed. |

## 1. Web app on Vercel (about 10 minutes)

`vercel.json` in this repo already says how to build: `expo export -p web` into `dist`, every page answered by the one `index.html`, the service worker never cached, the hashed app files cached for a year.

1. Go to vercel.com and sign in with GitHub.
2. **Add New → Project**, then import `mysteryguy47/almari`. Allow Vercel to see the repo if it asks.
3. Leave the build settings as Vercel fills them from `vercel.json` (Framework: Other, Root: `./`). No environment variables are needed yet.
4. **Deploy**. In about two minutes you get a `https://almari-….vercel.app` address. Open it and tap **Explore a sample family**.
5. From now on every push to `main` deploys by itself. Other branches get their own preview addresses.
6. Your own address: **Project → Settings → Domains → Add** `almari.blackmonkey.in`. Vercel shows a DNS record (a CNAME for the name `almari`). Add exactly that record where blackmonkey.in's DNS is managed. When Vercel shows *Valid Configuration*, HTTPS is on.
7. If a build fails on the Node version, set **Settings → Build and Deployment → Node.js Version** to 24.x.

Notes

- The web app must be on HTTPS for offline use, installing to the Home Screen and the share sheet. Vercel gives HTTPS by default.
- When you change how the service worker caches, bump `VERSION` in `public/sw.js`.
- The first **Read from the photo** downloads the text-reading engine and its English data from a public CDN. The photo itself never leaves the device. Before launch these files should be served from our own domain (it is on the remaining-work list).
- Expo's own EAS Hosting also works. Vercel is suggested because it deploys straight from GitHub with previews per branch.

## 2. Backend on Supabase (when the MVP backend is built)

The backend code (tables, row-level security, encryption, storage) is the next build step and is not in this repo yet. The project can be created now:

1. supabase.com → **New project**. Name `almari`, region **South Asia (Mumbai)**. Choose a long database password and keep it in your password manager.
2. **Project Settings → API Keys**: note the Project URL and the *publishable* key. These two are public by design. They go in Vercel as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`, and locally in `.env.local` (git ignores it). The *secret* key never goes in the app or the repo.
3. **Authentication → URL Configuration**: Site URL `https://almari.blackmonkey.in`; Redirect URLs `https://almari.blackmonkey.in/auth/callback` and `http://localhost:8081/auth/callback`.
4. **Authentication → Emails → SMTP Settings**: Supabase's built-in email allows only a few messages an hour and is for testing. For real sign-up and reset emails, connect an email service (Amazon SES, Resend, Zoho and similar) sending from an address like `no-reply@blackmonkey.in`.
5. Google sign-in: follow [GOOGLE-SIGN-IN.md](GOOGLE-SIGN-IN.md).

## 3. Android app (EAS Build, then Play Console)

You need a free Expo account (expo.dev). Run these in this folder:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

```bash
npx eas-cli@latest build:configure
```

`init` links the project to your Expo account and writes its id into `app.json`. `build:configure` writes `eas.json` with `development`, `preview` and `production` profiles.

```bash
npx eas-cli@latest build -p android --profile development
```

A development build installs like a normal app and can run native modules that Expo Go cannot: Google sign-in, ML Kit text reading, the document scanner. When EAS asks to create an Android keystore, say yes; EAS keeps it safe for you.

```bash
npx eas-cli@latest build -p android --profile production
```

This makes the `.aab` for Play. In Play Console:

1. **Create app**: Almari, App, Free (subscriptions are sold inside a free app).
2. Fill in the setup list: privacy policy URL, app access (give reviewers a test login), ads (none), content rating, target audience (adults), data safety.
3. **Testing → Internal testing → Create release**, upload the `.aab`, add testers' emails, share the opt-in link.
4. Play App Signing is on by default. After this first upload, the app-signing key's SHA-1 appears under **App integrity**. Google sign-in needs it (see the Google guide).
5. If your Play developer account is a *personal* account, Google requires a closed test with at least 12 testers for 14 days before the app can go to production. An organisation account does not have this rule.

Later uploads can go through `npx eas-cli@latest submit -p android` once a Play service-account key is set up. The very first upload has to be done by hand in Play Console.

## 4. iPhone

iPhone users use the web app. On a real iPhone:

1. Open the Vercel address in **Safari**.
2. **Share → Add to Home Screen**. It opens full screen with the Almari icon.
3. Check: it opens in flight mode after the first visit, the camera and photo picker work, a pack PDF and a resized photo open the share sheet, the masked copy saves, dark mode follows the phone, and the data is still there after closing the app.

Until sync is built, data lives only on that phone. Use the sample family or test papers, never real ones.
