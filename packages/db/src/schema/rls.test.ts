import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DbHandle } from '../client';
import { loadMigrations, rowsOf } from '../migrate';
import { createTestDb } from '../testing';

let handle: DbHandle;

beforeAll(async () => {
  handle = await createTestDb();
});

afterAll(async () => {
  await handle?.close();
});

/**
 * RLS is defence in depth, not the primary control — authorisation lives in the
 * API layer, and the app connects with a service role that bypasses RLS
 * entirely.
 *
 * It exists for exactly one scenario: Supabase hands a public anon key to
 * browsers by design, and without RLS that key can read every row in every
 * table. These tests check the posture is actually in place, because "we
 * enabled RLS" is very easy to believe and very easy to have wrong.
 */
describe('row level security', () => {
  async function rlsEnabled(): Promise<Map<string, boolean>> {
    const rows = rowsOf<{ tablename: string; rowsecurity: boolean }>(
      await handle.db.execute(
        sql.raw(`select tablename, rowsecurity from pg_tables where schemaname = 'public'`),
      ),
    );
    return new Map(rows.map((r) => [r.tablename, r.rowsecurity]));
  }

  it('is enabled on every application table', async () => {
    const enabled = await rlsEnabled();

    for (const [table, on] of enabled) {
      if (table === '_viola_migrations') continue;
      expect(on, `RLS is not enabled on "${table}"`).toBe(true);
    }
  });

  it('covers the tables holding credentials and personal data', async () => {
    const enabled = await rlsEnabled();

    // Named explicitly rather than relying on the sweep above, so adding a
    // table without RLS fails loudly here too.
    for (const table of [
      'users',
      'auth_codes',
      'sessions',
      'reports',
      'look_views',
      'affiliate_clicks',
      'affiliate_transactions',
      'subscriptions',
      'waitlist',
      'invite_codes',
    ]) {
      expect(enabled.get(table), `${table} must have RLS enabled`).toBe(true);
    }
  });

  it('defaults to deny — no policies exist without a Supabase auth schema', async () => {
    // PGlite has no `auth` schema, so the guarded block is skipped and every
    // table falls back to deny-by-default. That is the correct posture: a
    // policy that silently fails open would be worse than none.
    const policies = rowsOf<{ tablename: string }>(
      await handle.db.execute(
        sql.raw(`select tablename from pg_policies where schemaname = 'public'`),
      ),
    );
    expect(policies).toHaveLength(0);
  });

  it('never grants a read policy to credential tables', async () => {
    // The guard is on the SQL text: these tables must not appear in any
    // `create policy` statement, whatever environment the migration runs in.
    const sqlText = loadMigrations()
      .flatMap((m) => m.statements)
      .join('\n');

    const policyBlocks = sqlText.match(/create policy[\s\S]*?\$p\$/g) ?? [];
    const forbidden = ['auth_codes', 'sessions', 'affiliate_clicks', 'affiliate_transactions'];

    for (const block of policyBlocks) {
      for (const table of forbidden) {
        expect(
          block.includes(`on "${table}"`),
          `a policy exposes ${table}, which holds credentials or revenue data`,
        ).toBe(false);
      }
    }
  });

  it('applies cleanly to plain Postgres, with no Supabase-only calls at the top level', async () => {
    // auth.uid() only exists on Supabase. It must stay inside the guarded
    // block, or migrations break on PGlite and CI loses its database.
    const statements = loadMigrations().flatMap((m) => m.statements);

    for (const statement of statements) {
      if (!statement.includes('auth.uid()')) continue;
      expect(
        statement.includes("nspname = 'auth'"),
        'auth.uid() used outside the guarded block',
      ).toBe(true);
    }
  });
});
