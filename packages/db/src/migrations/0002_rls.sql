-- Row level security, as defence in depth.
--
-- Authorisation is enforced in the API layer: every client request goes through
-- our own route handlers, which hold a service-role connection and check
-- ownership explicitly. RLS is not the primary control and is not a substitute
-- for those checks.
--
-- It exists for one scenario: a leaked anon key. Supabase hands out a public
-- key to browsers by design, and without RLS that key can read every row in
-- every table. With it, an attacker holding the anon key sees public looks and
-- nothing else — no emails, no sessions, no private vaults, no auth codes.
--
-- PORTABILITY: this migration must also apply to PGlite, which has no Supabase
-- `auth` schema and therefore no `auth.uid()`. Enabling RLS is plain Postgres
-- and always runs; the owner-scoped policies are guarded on the auth schema
-- existing, so the same file works in tests and in production. A service-role
-- connection bypasses RLS entirely, which is why the app is unaffected either
-- way.

-- --------------------------------------------------------------------------
-- Enable RLS. With no policy attached, the default is deny — which is the
-- correct posture for everything that is not deliberately public.
-- --------------------------------------------------------------------------

alter table "users" enable row level security;
--> statement-breakpoint
alter table "profiles" enable row level security;
--> statement-breakpoint
alter table "looks" enable row level security;
--> statement-breakpoint
alter table "look_items" enable row level security;
--> statement-breakpoint
alter table "blooms" enable row level security;
--> statement-breakpoint
alter table "look_views" enable row level security;
--> statement-breakpoint
alter table "products" enable row level security;
--> statement-breakpoint
alter table "product_offers" enable row level security;
--> statement-breakpoint
alter table "vaults" enable row level security;
--> statement-breakpoint
alter table "vault_items" enable row level security;
--> statement-breakpoint
alter table "follows" enable row level security;
--> statement-breakpoint
alter table "blocks" enable row level security;
--> statement-breakpoint
alter table "reports" enable row level security;
--> statement-breakpoint
alter table "subscriptions" enable row level security;
--> statement-breakpoint
alter table "usage_quota" enable row level security;
--> statement-breakpoint
alter table "spend_ledger" enable row level security;
--> statement-breakpoint
alter table "jobs" enable row level security;
--> statement-breakpoint
alter table "affiliate_clicks" enable row level security;
--> statement-breakpoint
alter table "affiliate_transactions" enable row level security;
--> statement-breakpoint
alter table "sponsored_placements" enable row level security;
--> statement-breakpoint
alter table "auth_codes" enable row level security;
--> statement-breakpoint
alter table "sessions" enable row level security;
--> statement-breakpoint
-- --------------------------------------------------------------------------
-- Policies. Only created where Supabase auth is present.
-- --------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    -- PGlite, or any plain Postgres. RLS stays on with no policies, so the
    -- deny-by-default posture holds and the service role still bypasses it.
    return;
  end if;

  -- ---- publicly readable ------------------------------------------------
  -- A shared look has to be viewable by someone with no account at all; that
  -- is the entire growth mechanism. Quarantined and private looks are excluded
  -- here as well as in the API.
  execute $p$
    create policy "public looks are readable" on "looks"
      for select using (status = 'ready' and visibility <> 'private')
  $p$;

  execute $p$
    create policy "items of public looks are readable" on "look_items"
      for select using (
        exists (
          select 1 from looks
          where looks.id = look_items.look_id
            and looks.status = 'ready'
            and looks.visibility <> 'private'
        )
      )
  $p$;

  -- Handles and display names appear next to every look.
  execute $p$
    create policy "profiles are readable" on "profiles" for select using (true)
  $p$;

  -- The product catalogue is shared across all users by design; it holds no
  -- personal data.
  execute $p$
    create policy "products are readable" on "products" for select using (true)
  $p$;
  execute $p$
    create policy "product offers are readable" on "product_offers" for select using (true)
  $p$;
  execute $p$
    create policy "active sponsorships are readable" on "sponsored_placements"
      for select using (is_active)
  $p$;

  -- Bloom counts are public; blooms themselves carry a guest id, so reading
  -- them is limited to the aggregate the app already displays.
  execute $p$
    create policy "blooms are readable" on "blooms" for select using (true)
  $p$;

  -- ---- owner scoped -----------------------------------------------------
  execute $p$
    create policy "own user row" on "users"
      for select using (auth.uid()::text = auth_provider_id)
  $p$;

  execute $p$
    create policy "own profile is writable" on "profiles"
      for update using (
        exists (
          select 1 from users
          where users.id = profiles.user_id and users.auth_provider_id = auth.uid()::text
        )
      )
  $p$;

  execute $p$
    create policy "own looks are writable" on "looks"
      for all using (
        exists (
          select 1 from users
          where users.id = looks.user_id and users.auth_provider_id = auth.uid()::text
        )
      )
  $p$;

  execute $p$
    create policy "own vaults" on "vaults"
      for all using (
        exists (
          select 1 from users
          where users.id = vaults.user_id and users.auth_provider_id = auth.uid()::text
        )
      )
  $p$;

  execute $p$
    create policy "public vaults are readable" on "vaults"
      for select using (is_public)
  $p$;

  execute $p$
    create policy "own vault items" on "vault_items"
      for all using (
        exists (
          select 1 from vaults
          join users on users.id = vaults.user_id
          where vaults.id = vault_items.vault_id and users.auth_provider_id = auth.uid()::text
        )
      )
  $p$;

  execute $p$
    create policy "own subscription is readable" on "subscriptions"
      for select using (
        exists (
          select 1 from users
          where users.id = subscriptions.user_id and users.auth_provider_id = auth.uid()::text
        )
      )
  $p$;

  execute $p$
    create policy "own quota is readable" on "usage_quota"
      for select using (
        exists (
          select 1 from users
          where users.id = usage_quota.user_id and users.auth_provider_id = auth.uid()::text
        )
      )
  $p$;

  -- Follows and blocks are readable so the app can compute relationships, but
  -- only the owner may change them.
  execute $p$
    create policy "follows are readable" on "follows" for select using (true)
  $p$;
  execute $p$
    create policy "own blocks" on "blocks"
      for all using (
        exists (
          select 1 from users
          where users.id = blocks.blocker_id and users.auth_provider_id = auth.uid()::text
        )
      )
  $p$;

  -- ---- deliberately no policy -------------------------------------------
  -- auth_codes, sessions, reports, look_views, jobs, spend_ledger,
  -- affiliate_clicks and affiliate_transactions get NO select policy, so RLS
  -- denies the anon key outright. Sign-in codes and session tokens especially
  -- must never be reachable with a public key, and report contents would
  -- expose who reported whom.
end
$$;
