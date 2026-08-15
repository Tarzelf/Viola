# Billing

## Web — Whop

| Resource | Id |
|---|---|
| Account | `biz_C5RaxuzjBv7KDk` |
| Product | `prod_Dbdsn3dazecNe` (Viola Plus) |
| Monthly plan | `plan_N10txmmhZciIL` — $6.99 / 30d |
| Annual plan | `plan_xtUcJ3EzAQ3MY` — $39.99 / 365d |

Checkout: `POST /api/billing/checkout` → Whop purchase URL.  
Webhook: `POST /api/billing/whop-webhook` (set `WHOP_WEBHOOK_SECRET` in Whop dashboard).

Env:

```bash
WHOP_ACCOUNT_ID=biz_C5RaxuzjBv7KDk
WHOP_PRODUCT_ID=prod_Dbdsn3dazecNe
WHOP_PLAN_MONTHLY=plan_N10txmmhZciIL
WHOP_PLAN_ANNUAL=plan_xtUcJ3EzAQ3MY
WHOP_API_KEY=...          # optional; enables checkout_configurations with metadata
WHOP_WEBHOOK_SECRET=...
```

## iOS — Superwall + StoreKit

1. Create App Store Connect products matching Plus monthly/yearly.
2. Connect them in the Superwall dashboard.
3. Create a campaign with placement name **`campaign_trigger`**.
4. Set:

```bash
EXPO_PUBLIC_SUPERWALL_API_KEY=pk_...
```

The mobile Plus screen calls `registerPlacement({ placement: "campaign_trigger" })`.
Never link to Whop/web checkout from the iOS app (Guideline 3.1.1).

## Local development

Without `WHOP_API_KEY` and outside production, `/api/billing/dev-upgrade` still
grants Plus for offline testing. Public Whop plan URLs also work without an API key.
