# Quiacito on Android

The site is now a Progressive Web App (PWA): it works with touch, installs to the
home screen, and runs offline. There are two ways to get it onto Android.

## 1. Install from Chrome (no store, works today)

1. Push these files to GitHub Pages as usual.
2. On the phone, open https://thepunkduck.github.io/webicito/ in Chrome.
3. Menu (⋮) → **Install app** (or "Add to Home screen").

It opens full-screen with its own icon, like any other app, and works without a
connection after the first visit.

## 2. Publish on Google Play (Trusted Web Activity)

A TWA is a thin Android wrapper that shows the PWA full-screen. No Android code to write.

1. Go to https://www.pwabuilder.com, enter the site URL, then choose
   **Package for stores → Android**.
   - Package ID: e.g. `au.com.qintegral.quiacito`
   - Keep "Signing key: create new". **Back up the key it gives you** — you need
     the same key for every future update.
2. Download the zip. It contains:
   - an `.aab` file to upload to the Play Console,
   - an `.apk` you can sideload to test,
   - `assetlinks.json`.
3. **Domain verification (important for GitHub Pages):** Android looks for
   `assetlinks.json` at the *root* of the domain:
   `https://thepunkduck.github.io/.well-known/assetlinks.json`
   — not under `/webicito/`. So:
   - Create (or use) the repo **`thepunkduck/thepunkduck.github.io`**.
   - Add the file at `.well-known/assetlinks.json`.
   - Add an empty file named `.nojekyll` at that repo's root (Jekyll otherwise
     skips folders starting with a dot).
   - Check the URL above loads in a browser.

   Without this the app still works, but shows a browser address bar at the top.
4. Create the app in the Play Console (one-off US$25 developer fee), upload the
   `.aab`, fill in the store listing, and submit for review.

If you use **Play App Signing** (the default), Google re-signs the app: copy the
SHA-256 fingerprint from Play Console → *App integrity* and add it to
`assetlinks.json` as a second fingerprint.

## Updating the app

Change the web files, bump `VERSION` in `sw.js`, and push. Installed copies (PWA
and Play Store) pick up the new version automatically on next launch — no store
re-submission needed unless you change the app name, icon or package settings.

## What changed for touch

- **Edit-mode bar**: Draw / Flat / Move layer replaces Ctrl and Shift+Ctrl
  (the keyboard modifiers still work with a mouse).
- One input path for mouse, touch and pen (Pointer Events); drags keep tracking
  when your finger leaves the panel.
- Layers can be grabbed from further away with a finger (24 px vs 10 px).
- The page fills the screen with no scrolling, zooming or pull-to-refresh.
- Canvases render at the screen's pixel density, so lines and text are sharp.
- Only redraws when something changes, which is easier on the battery.
