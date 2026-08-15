import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import type { Database } from './client';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, 'migrations');

/**
 * A deliberately small migration runner.
 *
 * Drizzle ships its own, but it is driver-specific and we need the identical
 * code path to work against both PGlite and postgres-js — otherwise the schema
 * CI validates is not the schema production runs. Reading the generated `.sql`
 * files and applying them in order is a few lines and removes that divergence.
 */

export interface MigrationFile {
  name: string;
  statements: string[];
}

export function loadMigrations(dir: string = MIGRATIONS_DIR): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => {
      const raw = readFileSync(join(dir, name), 'utf8');
      const statements = raw
        .split('--> statement-breakpoint')
        .map(stripLeadingComments)
        .filter((s) => s.length > 0);
      return { name, statements };
    });
}

/**
 * The two drivers disagree on the shape of a raw `execute` result: PGlite
 * returns `{ rows: [...] }` while postgres-js returns the array directly.
 * Normalising here keeps every caller driver-agnostic, which is the whole point
 * of running the same migration code in CI and production.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

/**
 * Removes leading comment lines from a statement chunk.
 *
 * The original implementation discarded any chunk that *started* with `--`,
 * which was fine for drizzle's generated output but silently dropped every
 * hand-written migration that opens with an explanatory comment. The RLS
 * migration lost all twenty-two of its ALTER statements that way, and
 * reported success while doing it — the worst possible failure mode for a
 * security control.
 */
function stripLeadingComments(chunk: string): string {
  const lines = chunk.split('\n');
  let start = 0;
  while (start < lines.length) {
    const line = lines[start]!.trim();
    if (line.length === 0 || line.startsWith('--')) start++;
    else break;
  }
  return lines.slice(start).join('\n').trim();
}

const JOURNAL = `
  create table if not exists _viola_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  );
`;

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

export async function migrate(db: Database, dir: string = MIGRATIONS_DIR): Promise<MigrateResult> {
  await db.execute(sql.raw(JOURNAL));

  const result = await db.execute(sql.raw('select name from _viola_migrations'));
  const done = new Set(rowsOf<{ name: string }>(result).map((r) => r.name));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of loadMigrations(dir)) {
    if (done.has(migration.name)) {
      skipped.push(migration.name);
      continue;
    }
    for (const statement of migration.statements) {
      await db.execute(sql.raw(statement));
    }
    await db.execute(
      sql.raw(
        `insert into _viola_migrations (name) values ('${migration.name.replace(/'/g, "''")}')`,
      ),
    );
    applied.push(migration.name);
  }

  return { applied, skipped };
}
