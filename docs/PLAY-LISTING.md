# Play Store listing: final text and images

Paste these into Play Console → **Grow users → Store presence → Main store listing**. The images are in [`store/play/`](../store/play); [`store/README.md`](../store/README.md) says which file goes in which box.

Limits: app name 30 characters, short description 80, full description 4,000. Play rejects words like "best", "#1", "free" or "download now" in the name, short description and images; none are used here.

## App name (29 of 30)

```text
Almari: Family Document Vault
```

## Short description (71 of 80)

```text
Family papers, IDs, passwords and bank details, encrypted in one place.
```

If you would rather lead with what people search for in India, this one is 72:

```text
Aadhaar, PAN, passwords and bank details for the whole family, encrypted.
```

## Full description (3,218 of 4,000)

```text
Ghar ke saare kaagaz, ek jagah.

Almari keeps your family's important papers safe, organised and ready when you need them: Aadhaar, PAN, passports, driving licences, property papers, insurance, bank accounts, cards, passwords and emergency details. Found in three taps, on every phone in the family.

Locked so even we cannot read it
• Everything is encrypted on your phone before it is saved or sent. Our server only ever holds locked boxes.
• The keys stay on your family's phones and in your printed Recovery Kit.
• Fingerprint or PIN lock. Numbers stay hidden until you tap to see them.
• No screenshots or screen recordings, and Almari stays blank in your recent apps.

You choose where it is kept
• On this phone only: no account needed, and nothing ever reaches us.
• In the cloud: nothing stays on the phone.
• Both: on your phone and synced, so a lost phone loses nothing.
• Opens without internet. No OTP to see your own papers.

Made for the whole family
• Invite family members. Shared papers reach everyone; "Only me" items stay yours.
• Add children, grandparents and pets as profiles, no email needed.
• A family to-do list: give a task to Papa, and his phone reminds him the evening before.
• A readiness check shows which essentials are saved and which are missing.

One paper, every copy
• One Aadhaar per person, with every copy kept with it: the masked copy, PVC card, e-Aadhaar PDF and a self-attested photocopy.
• Share every page as one PDF, or front and back on one page like a photocopy.
• Crop photos free, square, portrait, landscape or to ID-card shape.
• Each vehicle with its own RC, insurance, PUC, service records and bills.
• Bank names suggested as you type. Net banking with every password it has: login, profile, transaction and the app's MPIN.

Never miss a renewal
• A reminder on your phone before a passport, licence, insurance policy, PUC or warranty runs out, and before a card bill is due.
• Quiet hours from 10 pm to 8 am, and reminders name the paper, never its number.
• Everything coming up, on one list.

Ready when it matters
• Situation packs: everything for a hospital admission, bank KYC, school admission, an exam form or travel abroad, gathered as one PDF.
• Reads the Aadhaar, PAN or passport number from a photo, on your phone.
• Photos and signatures resized to the exact pixels and file size a government portal asks for.
• A masked Aadhaar copy to share safely.
• Emergency cards with blood group, allergies, medicines and who to call.
• Money map: every account, deposit and policy, and whether it has a nominee.
• Where is the original? Note which almari, locker or file holds each paper.
• Print-ready sheet: cards at true size, front and back, on A4.
• Bank IFSC codes fill in the branch by themselves.
• Search the way you speak: "pan", "gaadi", "bima".

Try it before you sign up
Explore a sample family, the Sharmas, with nothing real in it.

Almari is not affiliated with the Government of India, UIDAI or any bank. Copies kept in Almari are for your convenience and are not legally valid IDs; DigiLocker and mParivahan hold the official digital versions. Keep the paper originals safe as always.

Privacy policy: https://almari.blackmonkey.in/privacy
```

Everything above is true of the Android app from version code 5 (19 Nov 2026: versions, crop, vehicles, bank suggestions, several passwords per account). With version code 4, leave out the "One paper, every copy" block. Reminders are scheduled on the phone, so they work without internet; Android may deliver them a little after the hour. Reading from a photo uses Google ML Kit inside the app: the photo stays on the phone, and ML Kit's diagnostics are declared in the data safety form (see ANDROID.md).

## App details

| Field | Value |
| --- | --- |
| App category | Productivity |
| Tags (up to 5 that Play offers) | Document management, Password manager, Organiser, Family, Security |
| Contact email | the same address as `EXPO_PUBLIC_CONTACT_EMAIL` |
| Website | `https://almari.blackmonkey.in` |
| Privacy policy | `https://almari.blackmonkey.in/privacy` |

## Release notes for the first testing release

```text
First test build of Almari for Android. Please try: sign up, create or join your family, add a few papers with photos, and check they appear on the web app too. Tell us anything that confuses you.
```
