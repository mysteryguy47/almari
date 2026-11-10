# Putting Almari online

## What runs where

The app (screens and rules) runs on the phone or in the browser and keeps everything there, encrypted. The backend is **Supabase** in Mumbai: sign-in, the locked records, locked files and live updates between family phones. It never holds a key, so it cannot read anything. No custom server is needed, so **Railway is not needed**. If a small server job comes up later (for example sending the morning reminders), Supabase Edge Functions with a schedule cover it. The design is in [BACKEND.md](BACKEND.md).

| Piece | Where | Cost to start |
| --- | --- | --- |
| Web app (iPhone, desktop, anyone with a link) | **Vercel**, from this GitHub repo | Hobby is free but for non-commercial use only. Move to Pro before charging money. |
| Backend | **Supabase**, region South Asia (Mumbai) | Free while building (free projects pause after a week without use). Pro for launch. |
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

## 2. Backend on Supabase (one time, about 15 minutes)

The backend is built: tables, access rules and server functions are in `supabase/migrations/20261110120000_vault.sql`, tested by `npm run test:backend` against a local copy of Supabase. Your project needs it applied once, plus a few settings. Only you should type keys and passwords into the dashboards.

**A. Create the database.** Supabase → your project → **SQL Editor → New query**. Paste the whole migration file and press **Run**. You should see "Success. No rows returned". Run it once only; a second run stops at "already exists", which is harmless.
(Command-line alternative: `npx supabase login`, `npx supabase link --project-ref <your-ref>`, `npx supabase db push`.)

**B. Addresses.** **Authentication → URL Configuration**:
- Site URL: `https://almari.blackmonkey.in`
- Redirect URLs: add `https://almari.blackmonkey.in/**` (covers sign-in, email confirmation and password reset). Add `http://localhost:8081/**` only if you run the app on your Mac against this project.

**C. Email sign-in.** **Authentication → Sign In / Providers → Email**: keep **Confirm email** on, and set **Minimum password length** to 8.

Supabase's built-in email sends only to members of your Supabase team, about 2 emails an hour. That is enough to test with your own email. To let family members test before you connect an email service:
- either turn **Confirm email** off for now (sign-up then signs in at once; turn it back on before real users), or
- connect an email service under **Authentication → Emails → SMTP Settings** (Amazon SES, Resend, Zoho and similar), sending from an address like `no-reply@blackmonkey.in`. Password-reset emails need this too.

**D. Optional: links that work on any device.** By default an email link must be opened in the same browser that asked for it (otherwise the app says "Done. Now sign in on this device", which still works). To make links work anywhere, edit two templates under **Authentication → Emails → Templates**, replacing the link in each:
- Confirm sign up: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
- Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

**E. Google.** Already set up. Check the Google web client's *Authorized JavaScript origins* includes `https://almari.blackmonkey.in`, and its redirect URI is the callback URL shown on Supabase's Google provider page.

**F. Connect the web app.** Supabase → **Project Settings → API Keys**: copy the Project URL and the *publishable* key (`sb_publishable_…`; the older *anon* key also works). In Vercel → your project → **Settings → Environment Variables**, add for Production and Preview:
- `EXPO_PUBLIC_SUPABASE_URL` = the Project URL
- `EXPO_PUBLIC_SUPABASE_KEY` = the publishable key

Both are public by design (they ship inside the web app); the access rules protect the data. Never put the *secret* key anywhere in the app or the repo. Then **Deployments → the latest → Redeploy**: the app reads these when it is built.

**G. Try it.** Open `https://almari.blackmonkey.in` in a private window: create an account, confirm the email, make a family, add a paper, invite someone with the link. In Supabase → **Table Editor → records**, every row is locked text: no names, numbers or titles.

### Running it on your Mac

```bash
npx supabase start
```

```bash
npx supabase db reset
```

Then create `.env.local` from `.env.local.example` with the URL and publishable key that `npx supabase status` prints, and run `npx expo start --web`. Sign-up and reset emails land in the local mailbox at http://127.0.0.1:54324. `npm run test:backend` runs the server tests.

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
