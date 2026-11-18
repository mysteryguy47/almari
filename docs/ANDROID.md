# Almari on Android: from this repo to Play Store testing

The Android app is the same code as the web app, built into a real app by **EAS Build** (Expo's build service) and shipped through **Play Console**. You do not need Android Studio for this; EAS builds in the cloud and keeps the signing key safe.

## What is different on Android

- **Encryption** runs natively (`react-native-libsodium`), byte for byte the same as the web app, so a family can mix Android phones and browsers.
- **On the phone**, everything Almari saves is encrypted with a key held in the **Android Keystore** (`expo-secure-store`). Files are encrypted one by one in the app's private folder.
- **No screenshots or screen recordings** of Almari, and it shows blank in the recent-apps view (Android's secure-window flag, `src/lib/screen-guard.ts`). Sharing a paper on purpose still works through Share. This needs the `DETECT_SCREEN_CAPTURE` permission on Android 14+, an ordinary one with no prompt; the photo-library permissions the same library would add are blocked in `app.json`.
- **Google sign-in** opens Google's page in a secure in-app browser and comes back to the app at `almari://auth/callback`. No Android client ID or SHA-1 is needed.
- **Email and invite links** point to the website (`EXPO_PUBLIC_SITE_URL`, default `https://almari.blackmonkey.in`), so they work on any device. Invite links open straight in the app once App Links are verified (step 10). Until then, an invited person can sign in on the phone and tap **Ask to join**.
- **Reminders are phone notifications**, scheduled on the phone itself (`src/lib/notify.ts`, `expo-notifications`): no push server, no Firebase. Almari asks for the notification permission once, right after someone saves a date that will remind them, and Settings → Reminders shows whether they are on. Times are approximate (Android may batch them within the hour) because exact alarms need a permission Play restricts to alarm and calendar apps.
- **Reading numbers and the Recovery Kit's QR from a photo** uses Google ML Kit inside the app (`src/lib/ocr.ts`, `src/lib/qr-read.ts`), so photos never leave the phone. ML Kit does send Google basic diagnostics; see the data safety answers below.

## Your steps (one time)

Only you type passwords and keys. Everything below that is public says so.

### 1. Supabase: allow the app's return address

Supabase → **Authentication → URL Configuration → Redirect URLs** → add `almari://**`.
Without it, Google sign-in on Android ends on the website instead of in the app, and a password-reset link asked for in the app cannot come back to it.

Recommended too: the two email templates in [DEPLOY.md](DEPLOY.md), step D. Then confirmation and reset links work on any device, whichever one asked for them.

### 2. Vercel: the contact email for the privacy policy

The app now has a public privacy policy at `/privacy` and an account-deletion page at `/delete-account` (Play asks for both). Vercel → **Settings → Environment Variables** → add `EXPO_PUBLIC_CONTACT_EMAIL` = the address you want people to write to (for example `support@blackmonkey.in`; it must be one you read). Redeploy. Until then both pages say "the contact email on Almari's Google Play page".

### 3. Expo account and EAS

Create a free account at expo.dev, then in this folder:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

`init` links the project to your account and adds its project id (and owner) to `app.json`. Commit that change. `eas.json` is already in the repo with three profiles:

| Profile | Makes | For |
| --- | --- | --- |
| `development` | APK with developer tools | running the app against Metro on your Mac |
| `preview` | APK | installing on your own phone straight from a link, before Play |
| `production` | AAB (app bundle) | Play Console. The version code goes up by itself on every build |

### 4. Tell EAS where the server is

EAS builds in the cloud and does not see your `.env.local`. Set the same public values you gave Vercel (the Project URL and the **publishable** key; never the secret key):

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co --environment production --environment preview --visibility plaintext
```

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_KEY --value sb_publishable_YOUR_KEY --environment production --environment preview --visibility plaintext
```

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_CONTACT_EMAIL --value support@blackmonkey.in --environment production --environment preview --visibility plaintext
```

`EXPO_PUBLIC_SITE_URL` is optional; without it the app uses `https://almari.blackmonkey.in`.

### 5. Try it on your own phone first

```bash
npx eas-cli@latest build -p android --profile preview
```

The first build asks **Generate a new Android Keystore?** Say **yes**: EAS creates the upload key and stores it for you. The build takes 10–20 minutes and ends with a link and a QR code. Open it on your Android phone, allow installing from your browser, and install. Sign in, add a paper, open the same account on the web, and check it arrives.

### 6. The Play build

```bash
npx eas-cli@latest build -p android --profile production
```

Download the `.aab` from the link it prints.

### 7. Play Console: create the app

play.google.com/console → **Create app**: name *Almari*, default language *English (India)*, **App**, **Free**, accept the declarations.

Then **Dashboard → Set up your app**. Answers that match the app today:

| Task | Answer |
| --- | --- |
| Privacy policy | `https://almari.blackmonkey.in/privacy` |
| App access | *All or some functionality is restricted.* Add instructions and a test login for Google's reviewers: make an account for them (for example `review@blackmonkey.in`), put a few sample papers in it, and give the email and password here. |
| Ads | No ads |
| Content rating | Fill the questionnaire: category *Utility, Productivity, Communication or other*; no violence, no user-to-user chat with strangers, no gambling. |
| Target audience | 18 and over. (Parents add children as profiles; children do not use the app.) |
| News app | No |
| Data safety | See below |
| Government app | No. Almari is not affiliated with any government; the store listing should say so too. |
| Financial features | None of the listed features. Almari stores your own bank details for reference; it does not move money, lend, or trade. |
| Health | No |

**Data safety**, as the app works today:

- *Does your app collect or share user data?* **Yes**.
- *Is all user data encrypted in transit?* **Yes**.
- *Do you provide a way for users to request deletion?* **Yes**. Account deletion URL: `https://almari.blackmonkey.in/delete-account`.
- Data types to declare as **collected** (not shared), for *Account management* and *App functionality*:
  - **Personal info → Email address**: required.
  - **Personal info → Name**: required (asked at sign-up, or from Google).
  - **Device or other IDs**: a random id per device and its name, used to let devices in and remove them.
- Family papers, files, photos, numbers and passwords are **end-to-end encrypted**: the server stores them but cannot read them. Google's help beside the form lists the cases that need not be declared; check whether end-to-end encrypted data is one of them when you fill it. If in doubt, also declare **Files and docs**, **Photos** and **Financial info → Other financial info** as collected for *App functionality*, and say in the description that they are end-to-end encrypted. Declaring more is never a problem; declaring less can be.
- **App info and performance → Diagnostics** and **Device or other IDs**: collected by Google ML Kit when someone reads a number or a QR code from a photo (phone model, app version, an installation ID, how the reading performed). Purpose: *Analytics*. Optional, encrypted in transit, not shared. The photo and its text never leave the phone.
- Nothing is shared with third parties or used for ads.

**Store listing** (Grow → Store presence → Main store listing):

- Name, short and full description: copy them from [PLAY-LISTING.md](PLAY-LISTING.md).
- Icon, feature graphic and screenshots for phone, 7-inch tablet, 10-inch tablet and Chromebook are ready in [`store/play/`](../store/play); [`store/README.md`](../store/README.md) maps each file to its box in Play Console. They come from the web app with the sample family, because the Android app blocks screenshots; the screens are the same code. Category: **Productivity**. Contact email: the same as step 2.

### 8. Internal testing (start testing today)

1. **Test and release → Testing → Internal testing → Testers** → create an email list with your testers' Gmail addresses (up to 100).
2. **Create new release.** Accept **Play App Signing** (Google keeps the final signing key; EAS's key becomes the upload key).
3. Upload the `.aab` from step 6, add release notes, **Next → Save and publish**.
4. Copy the **opt-in link** and send it to your testers. Each opens it signed in with the listed Gmail, accepts, then installs Almari from Play. Updates arrive through Play like any app.

Internal testing does not need Google's review, so it is usually available within minutes.

### 9. Closed testing, then production

If your Play developer account is a **personal** account (made after November 2023), Google requires a **closed test with at least 12 testers who stay opted in for 14 days in a row** before you can apply for production. An organisation account (needs a D-U-N-S number) does not have this rule.

1. **Testing → Closed testing → Create track** (or use *Alpha*), add a tester list of 12 or more, and create a release with the same `.aab` (or promote the internal release).
2. This one is reviewed by Google (hours to a few days).
3. Keep at least 12 testers opted in for 14 days. Then **Dashboard → Apply for production** and answer the questions about your test.

### 10. Later: invite links that open in the app (App Links)

Once Play App Signing is on: Play Console → **Test and release → App integrity → App signing** → copy the **SHA-256 certificate fingerprint** of the *App signing key*. Send it over (it is public, not a secret) and it goes into `public/.well-known/assetlinks.json` on the website. Android then opens `https://almari.blackmonkey.in/join/…` links straight in the app. `app.json` already declares those links.

## Every update after that

1. Change the code, push to `main` (Vercel updates the web app by itself).
2. Build:

```bash
npx eas-cli@latest build -p android --profile production
```

3. Upload the new `.aab` to the testing track in Play Console, or let EAS do it:

```bash
npx eas-cli@latest submit -p android --latest
```

`submit` needs a Google service-account key once: follow `expo.fyi/creating-google-service-account`, then upload it under expo.dev → your project → **Credentials → Android → Google Service Account Key**. Submissions go to the internal track as a **draft** (Play only accepts drafts until the app has been reviewed once); finish them in Play Console.

## For developers: run it on the emulator

Needs the Android SDK and JDK 17.

```bash
npx supabase start
```

```bash
npx expo run:android
```

`run:android` generates the `android/` folder (never edit it, it is rebuilt from `app.json`), builds a debug app and installs it. The app reaches Metro and the local Supabase on your Mac through:

```bash
adb reverse tcp:8081 tcp:8081
```

```bash
adb reverse tcp:54321 tcp:54321
```

Sign-up emails land in the local mailbox at http://127.0.0.1:54324. Open a link from there in the emulator's browser, or paste the confirmation into the web app.
