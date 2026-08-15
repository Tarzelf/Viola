# The iOS app

Expo SDK 57, expo-router, React Native 0.86. It shares `@viola/core` and
`@viola/design` with the web app and calls the same API — there is no separate
mobile backend and no second set of validation rules.

## Running it

```bash
pnpm dev                              # start the web API on :3000 first
pnpm --filter @viola/mobile ios       # simulator
pnpm --filter @viola/mobile web       # renders the real RN components in a browser
```

On a **physical device**, `localhost` means the phone. Point it at your machine:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.x:3000 pnpm --filter @viola/mobile ios
```

## What you must supply

Three placeholders have to be filled before a build can be produced. None of
them can be created from a Linux machine.

| Where                                        | Value                  |
| -------------------------------------------- | ---------------------- |
| `app.json` → `extra.eas.projectId`           | From `eas init`        |
| `eas.json` → `submit.production.ios.appleId` | Your Apple ID          |
| `eas.json` → `ascAppId` and `appleTeamId`    | From App Store Connect |

Then:

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

## Things that will bite you

**iOS does not synthesise bold for custom fonts.** Asking for weight 700 on a
regular face silently gives you the regular face — no error, just wrong
typography. Every weight is registered as its own family and `fontFamily()` in
`src/theme.ts` maps to it. This is why the font list looks redundant.

**Expo 57 requires `deploymentTarget` ≥ 16.4.** Anything lower fails config
resolution with a message that does not obviously point at `app.json`.

**Run `npx expo install --check` after touching dependencies.** It catches
version drift that Metro will otherwise fail on much later and less clearly.

**CORS only matters for the web target.** A native build has no origin and is
not subject to it. But `expo start --web` runs on :8081, so the API middleware
allowlists that origin — without it the UI renders perfectly and every request
fails, which is a confusing way to lose an afternoon.

**Sessions are bearer tokens, not cookies.** React Native's fetch handles
cookies differently across platforms; the token lives in the iOS keychain via
`expo-secure-store` and rides in an `Authorization` header.

## Viola Plus must use StoreKit

Apple requires in-app purchase for digital features consumed inside the app
(guideline 3.1.1), so `/plus` deliberately does **not** link to Stripe web
checkout — that gets rejected. `react-native-purchases` is already a dependency;
it needs a RevenueCat key and matching App Store Connect products, and its
webhook writes to the same `subscriptions` table Stripe does so both platforms
resolve through one entitlement.

Affiliate shop links are the opposite case and stay exactly as they are:
physical goods consumed outside the app must **not** use IAP (3.1.3(e)).

## Guideline 1.2

The App Store requires four things of a UGC app, and all four exist on iOS:

- **Content filter** — the vision safety gate, server-side, before publish
- **Report** — from the overflow menu on any look
- **Block** — same menu; symmetric, so neither party sees the other
- **Published contact** — `/contact` on the web, linked from the app

Plus in-app account deletion, which Apple requires separately.

## Verify on a simulator before shipping

`expo prebuild` succeeds and the generated project is correct in the ways I
could check from Linux: bundle id, `applinks:viola.app` in the entitlements,
deployment target 16.4, and a `SplashScreenBackground` colorset holding exactly
`#0B0A0F`.

One thing I could **not** verify without booting a simulator: the generated
`SplashScreen.storyboard` still sets its container view to
`systemBackgroundColor`, which is white. The colorset is right, so this may be
resolved at runtime, but if you see a white flash on cold launch that is where
to look. It matters more than it sounds for an app this dark.

## Known gaps

- Push notifications are not wired. Worth noting from a prior project: shipping
  `expo-notifications` without care caused an iPad launch crash, so it should be
  added deliberately rather than by default.
- Sign in with Apple is a dependency but not yet a button. Apple requires it
  once any other social login exists — currently there is only email, so this is
  not yet blocking.

## Also see

- [LAUNCH.md](./LAUNCH.md) — soft launch → TestFlight → store
- [APPSTORE.md](./APPSTORE.md) — review questionnaire answers and listing copy
