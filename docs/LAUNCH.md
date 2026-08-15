# Launch checklist

Ordered for a Jobs/Chesky soft launch: make the loop undeniable, then open the
door a crack.

## 0. Blockers already in the repo

- [x] Core loop (upload → reveal → share → guest Bloom)
- [x] Privacy Policy `/privacy` + Terms `/terms`
- [x] Contact + report/block/delete (Guideline 1.2)
- [x] Invite-only mode (`VIOLA_INVITE_ONLY=1`) + `/early` waitlist
- [x] App Store operator guide (`docs/APPSTORE.md`)
- [x] Provider wiring guide (`docs/PROVIDERS.md`)

## 1. Content spike (do this before ads)

1. Turn on live vision + product search (`docs/PROVIDERS.md`).
2. Post **20 real OOTDs** from ICP users (or your team).
3. Kill any look with a wrong brand or ugly cutout.
4. Re-capture share-card / OG screenshots from those 20.

## 2. Production infra

```bash
# Required
DATABASE_URL=...                 # Supabase Postgres or equivalent
NEXT_PUBLIC_APP_URL=https://viola.app
VIOLA_PROVIDERS=live
GEMINI_API_KEY=...
SERPAPI_API_KEY=...
# Soft launch
VIOLA_INVITE_ONLY=1
# Billing
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
# Affiliate (optional at day 0)
SOVRN_API_KEY=...
VIOLA_CRON_SECRET=...
# Analytics
NEXT_PUBLIC_POSTHOG_KEY=...
```

Apply migrations, seed invite codes:

```sql
insert into invite_codes (code, max_uses, note) values
  ('VIOLA2026', 50, 'founding batch'),
  ('MAYA', 10, 'creator friends');
```

## 3. Soft launch week

1. Enable `VIOLA_INVITE_ONLY=1`.
2. Share 30 invites with ICP (group chats, not Twitter ads).
3. Watch funnel events already wired:  
   `share_trigger_reached → share_opened → share_sent → share_link_opened → guest_activated → referred_signup_completed`
4. Target: K ≥ 0.25 with &lt; 1 day cycle time.

## 4. iOS TestFlight

1. Fill EAS + ASC placeholders (`docs/IOS.md`, `docs/APPSTORE.md`).
2. Production build → internal TestFlight → 5 ICP testers.
3. Fix crash/launch issues on device (splash flash noted in IOS.md).
4. Submit for review with demo account + 4.3(b) differentiation notes.

## 5. Open the door

1. Flip `VIOLA_INVITE_ONLY` off (or raise invite inventory).
2. Keep Plus paywall only at vault limits.
3. Turn on affiliate reconciliation cron.
4. Do **not** add an ad SDK until Plus conversion is understood.

## Definition of “ready to go out”

| Bar | Met when |
|---|---|
| Soft web launch | Live providers + 20 real looks + invite mode + legal pages |
| TestFlight | Signed build, demo account, no launch crash |
| App Store | Review notes filled, privacy labels set, IAP products live |
| Growth-ready | Share funnel instrumented and at least one organic share chain observed |
