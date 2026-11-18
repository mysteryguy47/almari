# Play Store images

Everything Play Console asks for under **Grow users → Store presence → Main store listing**, made from the real app with the sample family (the Sharmas, whose numbers are all deliberately impossible). The text to paste is in [docs/PLAY-LISTING.md](../docs/PLAY-LISTING.md).

| Play Console box | File(s) | Size | Play's rule |
| --- | --- | --- | --- |
| App icon | `play/icon-512.png` | 512 × 512, 32-bit PNG | 512 × 512, under 1 MB. Same artwork as the launcher icon in `assets/images`. |
| Feature graphic | `play/feature-graphic-1024x500.png` | 1024 × 500, 24-bit PNG | exactly 1024 × 500, no transparency |
| Phone screenshots | `play/phone/1-home.png` … `8-money.png` (upload in this order) | 1440 × 2560 (9:16) | 2–8; 9:16 at 1080 px or more qualifies for Play's promotions |
| 7-inch tablet screenshots | `play/tablet-7in/*.png` | 1440 × 2560 (9:16) | 4–8 for large screens, each side 1,080–7,680 px |
| 10-inch tablet screenshots | `play/tablet-10in/*.png` | 1800 × 3200 (9:16) | same as 7-inch |
| Chromebook screenshots | `play/chromebook/*.png` | 2880 × 1620 (16:9) | same as tablets |

Why they look the way they do:

- **Phone shots carry a short caption** (at most 17% of the image; Play's limit is 20%) and no phone frame, which Google advises against.
- **Tablet and Chromebook shots are the app alone**, with no caption, because Play crops large-screen images in some places and asks for no extra text there.
- The status bar is drawn with full signal, Wi-Fi and battery and no notifications, as Google asks. The sample family's "made-up family" banner is hidden; everything else is the app as it renders.

## Making them again after the app changes

The scripts need Playwright and Google Chrome on the Mac. They use the app's own fonts from `node_modules`.

1. Start the web app (`npx expo start --web --port 8081`).
2. Capture the screens. They land in `store/raw/`, which git ignores:

```bash
PLAYWRIGHT=/path/to/node_modules/playwright node store/src/capture.cjs
```

3. Compose the screenshots into `store/play/`:

```bash
PLAYWRIGHT=/path/to/node_modules/playwright node store/src/compose.cjs
```

4. The icon and feature graphic only change if their drawings change. The icon is drawn in `src/almari-mark.js` (`render-icons.cjs`). The feature graphic is drawn in `src/feature.html` (`render-feature.cjs`).

Captions live at the top of `src/compose.cjs`. Keep them true to what the app does today, and free of words Play rejects ("best", "#1", "free", "download now").
