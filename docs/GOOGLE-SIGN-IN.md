# Google sign-in, step by step

**Status.** Built for both. Web: `signInWithGoogle` and `/auth/callback` in `src/sync/account.ts` and `src/app/auth/`. Android: the same Google page in an in-app browser that returns to the app (below), so the Android app needs no Android client ID and no SHA-1. Your one extra step for Android is adding `almari://**` to Supabase's Redirect URLs (Part B, step 6).

Only you should type client secrets and keys. They go into the Google and Supabase consoles and your password manager. They never go into this repo, the app, or a chat.

## How it works

**Web (and the iPhone web app).** Almari asks Supabase to start Google sign-in. The person picks an account on Google's page. Google sends them to Supabase's callback, `https://<project-ref>.supabase.co/auth/v1/callback`. Supabase sends them back to `https://almari.blackmonkey.in/auth/callback?code=…`, and the app swaps that one-time code for a session (PKCE).

**Android app.** The same flow, in a secure in-app browser (a Chrome Custom Tab, which the app cannot look into). Supabase sends the person back to `almari://auth/callback?code=…`, Android hands that to the app, and the app swaps the code for a session. Google sees the same web client, so nothing about the app's signing key is needed. A native account picker (Google Play services, `signInWithIdToken`) is an optional upgrade later; it would need the Android clients in Part A, step 6.

## Part A. Google Cloud (about 20 minutes)

1. Open console.cloud.google.com and create a project named **Almari**.
2. **Google Auth Platform → Branding.**
   - App name: Almari. User support email: a team address such as `support@blackmonkey.in`.
   - App home page `https://almari.blackmonkey.in`, plus privacy policy and terms pages.
   - Authorized domains: `blackmonkey.in`. If the console asks about the Supabase callback's domain, add `supabase.co` too.
   - A logo is optional. Showing a name and logo needs *brand verification*: a few business days, and blackmonkey.in verified in Google Search Console.
3. **Audience.** User type **External**. The app starts in **Testing**: only the test users you list (up to 100) can sign in. Add your own Gmail and the beta testers. Before public launch, press **Publish app**. With only the basic scopes below, there is no long security review.
4. **Data Access → Add or remove scopes.** Tick `openid`, `…/auth/userinfo.email` and `…/auth/userinfo.profile`, then save. Add nothing else: scopes like Drive or Gmail would trigger a long review.
5. **Clients → Create client → Web application**, named "Almari web".
   - Authorized JavaScript origins: `https://almari.blackmonkey.in`, and `http://localhost:8081` while developing (remove it before launch).
   - Authorized redirect URIs: the Supabase callback URL. Copy it from Supabase's Google provider page (Part B, step 5). It looks like `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Create, then copy the **Client ID** and **Client secret** into your password manager.
6. *Optional, only for a future native account picker; skip it now.* **Clients → Create client → Android**, once per signing key. Package name `com.blackmonkey.almari`, then the key's SHA-1:
   - **EAS key** (development and preview builds): run `npx eas-cli@latest credentials -p android`, pick the build profile, and copy the *SHA-1 Fingerprint*.
   - **Play App Signing key** (installs from Play, including internal testing): Play Console → Almari → **App integrity → App signing** → *App signing key certificate* → SHA-1. It appears after the first `.aab` upload.
   - **Local debug key** (only for `npx expo run:android` on this Mac): `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`

   Android clients have no secret and are never typed into the app. The app itself uses the **Web** client ID.

Optional, before launch: a Supabase custom domain such as `auth.blackmonkey.in` (a paid Supabase add-on). Then Google's page shows your domain instead of the `supabase.co` address. Add its callback, `https://auth.blackmonkey.in/auth/v1/callback`, to the web client's redirect URIs.

## Part B. Supabase (about 5 minutes)

1. **Authentication → Sign In / Providers → Google**, then turn it on.
2. **Client IDs**: the web client ID (plus any Android client IDs, if you ever add the native picker), separated by commas.
3. **Client Secret**: the web client's secret.
4. **Skip nonce check**: leave it off. The Android library's token carries no nonce, and Supabase accepts that.
5. Copy the **Callback URL** shown on this page into the Google web client's redirect URIs (Part A, step 5).
6. **Authentication → URL Configuration**: Site URL `https://almari.blackmonkey.in`. Redirect URLs `https://almari.blackmonkey.in/**` and `almari://**` (the Android app), plus `http://localhost:8081/**` for local work.

**Same email, two ways in.** Supabase links sign-ins that share a verified email. Someone who signed up with email and password, and later taps Google with the same Gmail, lands in the same account.

## Part C. Code (with the backend build)

```bash
npx expo install @supabase/supabase-js @react-native-google-signin/google-signin
```

The client, with the code exchange done by the app itself:

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_KEY!, {
  auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
});
```

**Web.** Start sign-in:

```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
```

A new route, `src/app/auth/callback.tsx`, reads `code` with `useLocalSearchParams` and calls `await supabase.auth.exchangeCodeForSession(code)`. If there is no code or the exchange fails, it shows a friendly error with a way back.

**Android.** The same call with `skipBrowserRedirect: true` and `redirectTo: 'almari://auth/callback'`, then `WebBrowser.openAuthSessionAsync(url, redirectTo)` (expo-web-browser). On success the app reads `code` from the returned address and calls `exchangeCodeForSession`. `src/app/+native-intent.ts` stops the router from also opening the callback screen for that same link, since a code works once.

**Adding a password to a Google account** (decided: Google users can add one):

```ts
await supabase.auth.updateUser({ password });
```

If Supabase's *Secure password change* is on, a password change needs a recent sign-in. Otherwise, call `supabase.auth.reauthenticate()`, which emails a code, and pass that code as `nonce` in `updateUser`.

## Testing it

- **Web:** sign in with a Gmail on the test-user list, and you come back to Almari signed in. A Gmail not on the list is refused while the app is in Testing, which is expected.
- **Android:** tap **Continue with Google**, pick the account in the in-app browser, and you land back in Almari signed in. Pressing back in the browser returns you to the sign-in screen with nothing changed.

| Error | Usual cause |
| --- | --- |
| `redirect_uri_mismatch` | The Google web client's redirect URI is not exactly Supabase's callback URL. |
| Android opens the website instead of returning to the app, or says the redirect is not allowed | `almari://**` is missing from Supabase's Redirect URLs. |
| `Unacceptable audience in id_token` | That client ID is missing from Supabase's Client IDs list. |
| *Access blocked* or *app not verified* | That Gmail is not on the test-user list while the app is in Testing. |
