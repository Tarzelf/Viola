# App Store submission

Everything below is what App Review will look for. The product already
implements the hard requirements; this file is the operator checklist for
filing the build.

## Differentiation (Guideline 4.3(b) — June 2026)

Viola is **not** a generic photo social network. Lead with this in screenshots
and the description:

1. Auto-tagged shoppable look cards (garment ID + retailer catalogue images)
2. Viola Score + vibe archetype (upvote-only Blooms, no downvotes)
3. One-tap iMessage share with a rendered story card
4. Vaults (paid accumulation) vs free social surface

## Required App Review answers

| Topic | Answer |
|---|---|
| UGC filter | Vision safety gate before publish (`packages/pipeline`) |
| Report | Overflow menu on every look → `/api/reports` |
| Block | Same menu → `/api/blocks` (symmetric hide) |
| Contact | https://viola.app/contact · moderation@ / help@ / privacy@ |
| Account deletion | Settings → Danger zone (type DELETE) |
| IAP | Viola Plus via StoreKit / RevenueCat only on iOS |
| Physical goods | Shop links are affiliate outbound — no IAP (3.1.3(e)) |
| Encryption | `ITSAppUsesNonExemptEncryption: false` |
| Tracking | No ATT at launch (no third-party ad SDK) |

## Privacy Nutrition Labels (App Privacy)

Declare at least:

- **Contact Info** — Email (Account) — linked to user
- **User Content** — Photos / Other User Content — linked to user; used for App Functionality
- **Identifiers** — User ID — App Functionality
- **Purchases** — Purchase History — App Functionality (Plus)
- **Usage Data** — Product Interaction (analytics events) — Analytics; not used for tracking

Do **not** declare tracking if you have not shipped an ad/attribution SDK.

## Age rating

Suggest **12+** (Infrequent/Mild Mature/Suggestive Themes possible via UGC fashion
photos; unrestricted web access via shop links). Adjust after questionnaire.

## Listing copy (draft)

**Subtitle:** Post your fit — every piece shoppable

**Promotional text:** Upload a mirror selfie. Viola names every piece, scores the look, and hands you a card built for iMessage.

**Description:**
Viola turns an outfit photo into a shoppable look card.

• Every primary garment identified with where to buy it  
• Viola Score + vibe archetype — made to share, never to shame  
• Blooms only — no downvotes  
• One-tap share to Messages  
• Vaults to save the pieces you love (Viola Plus)

Retailers may pay us a commission when you shop. It never costs you more.

**Keywords:** outfit,OOTD,fashion,shop the look,style,closet,wardrobe,fit check

**Support URL:** https://viola.app/contact  
**Marketing URL:** https://viola.app/early  
**Privacy Policy URL:** https://viola.app/privacy  
**Terms:** https://viola.app/terms

## Screenshots (required set)

Capture on iPhone 6.7" and 6.1" (and iPad if you keep `supportsTablet: true`).

1. Annotated look card with score pill  
2. Upload → Voilà reveal mid-flight  
3. Public share page (guest Bloom)  
4. Feed with “Looks earning the room”  
5. Vault lookbook / Plus paywall

Script: `pnpm --filter @viola/web e2e` plus Playwright gallery shots under `/opt/cursor/artifacts`.

## Credentials you must fill

| File | Field |
|---|---|
| `apps/mobile/app.json` | `extra.eas.projectId` |
| `apps/mobile/eas.json` | `appleId`, `ascAppId`, `appleTeamId` |
| App Store Connect | Bundle id `app.viola.ios`, IAP products matching Plus |
| RevenueCat | iOS key + webhook → same `subscriptions` table |

## Build & submit

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init   # writes projectId into app.json
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

## Demo account for review

Create in production (or seed) and list in App Review notes:

- Email: `iosreview@viola.app`  
- OTP / password: document the path you actually ship  
- Bypass: review account should skip paywall (mirror the Blueprint BaZi pattern if you add one)

## Known honest limitations to state in notes

- Push notifications intentionally not shipped yet  
- Sign in with Apple not required while email OTP is the only auth method  
- Cold-launch splash: verify on a real device (see `docs/IOS.md`)
