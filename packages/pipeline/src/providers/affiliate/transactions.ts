import { z } from 'zod';

/**
 * Reconciliation — pulling revenue events back from the affiliate network.
 *
 * Clicks are recorded when they happen; commission arrives days or weeks later,
 * and only the network knows about it. Without this the product knows how many
 * people tapped Shop and nothing at all about whether it made any money, which
 * is a strange position for something whose entire business model is affiliate
 * commission.
 *
 * The join key is the tracking id we minted on the click and handed to the
 * network, which is why every outbound tap goes through our own redirector.
 * That is what lets commission be attributed to a specific look and item rather
 * than landing as an undifferentiated monthly total.
 */

export const affiliateTransactionSchema = z.object({
  /** The network's own id. Used to make ingestion idempotent. */
  providerTransactionId: z.string().min(1),
  /** Our id, echoed back. Null when the network could not carry it. */
  trackingId: z.string().nullable(),
  merchant: z.string().nullable(),
  orderValueCents: z.number().int().nullable(),
  commissionCents: z.number().int().nullable(),
  currency: z.string().length(3).default('USD'),
  /** pending | confirmed | reversed */
  status: z.enum(['pending', 'confirmed', 'reversed']),
  occurredAt: z.date().nullable(),
  raw: z.unknown().optional(),
});

export type AffiliateTransaction = z.infer<typeof affiliateTransactionSchema>;

export interface TransactionQuery {
  since: Date;
  until?: Date;
}

export interface AffiliateTransactionSource {
  readonly name: string;
  fetchTransactions(query: TransactionQuery): Promise<AffiliateTransaction[]>;
}

/**
 * Sovrn's Transactions API.
 *
 * Returns a revenue event per commissionable action, carrying back the `cuid`
 * we set when wrapping the link. Payouts are net-90, so a transaction can sit
 * in `pending` for a long time and later flip to `reversed` on a return — the
 * ingestion path has to handle a status changing after first sight, which is
 * why it upserts rather than inserts.
 */
export class SovrnTransactionSource implements AffiliateTransactionSource {
  readonly name = 'sovrn';

  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly apiKey: string,
    options: { fetchImpl?: typeof fetch } = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetchTransactions(query: TransactionQuery): Promise<AffiliateTransaction[]> {
    const params = new URLSearchParams({
      key: this.apiKey,
      startDate: query.since.toISOString().slice(0, 10),
      endDate: (query.until ?? new Date()).toISOString().slice(0, 10),
    });

    const response = await this.fetchImpl(
      `https://api.viglink.com/api/transaction?${params.toString()}`,
      { headers: { accept: 'application/json' } },
    );

    if (!response.ok) {
      throw new Error(`sovrn transactions ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as {
      transactions?: Array<Record<string, unknown>>;
    };

    return (payload.transactions ?? []).flatMap((row) => {
      const parsed = affiliateTransactionSchema.safeParse({
        providerTransactionId: String(row.id ?? row.transactionId ?? ''),
        trackingId: (row.cuid as string | undefined) ?? null,
        merchant: (row.merchantName as string | undefined) ?? null,
        orderValueCents: toCents(row.orderAmount),
        commissionCents: toCents(row.commissionAmount ?? row.earnings),
        currency: (row.currency as string | undefined) ?? 'USD',
        status: normaliseStatus(row.status),
        occurredAt: row.date ? new Date(String(row.date)) : null,
        raw: row,
      });

      // Skip a malformed row rather than failing the whole reconciliation run.
      // One bad record should not stop the rest of the month's revenue landing.
      return parsed.success ? [parsed.data] : [];
    });
  }
}

function toCents(value: unknown): number | null {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) : null;
}

function normaliseStatus(value: unknown): 'pending' | 'confirmed' | 'reversed' {
  const s = String(value ?? '').toLowerCase();
  if (s.includes('revers') || s.includes('cancel') || s.includes('declin')) return 'reversed';
  if (s.includes('confirm') || s.includes('paid') || s.includes('approv')) return 'confirmed';
  return 'pending';
}

/**
 * Deterministic fake revenue.
 *
 * Reconciliation is otherwise impossible to exercise without a live affiliate
 * account and a real purchase, which would mean the matching logic ships
 * untested. This derives plausible transactions from tracking ids so the whole
 * path can run offline.
 */
export class MockTransactionSource implements AffiliateTransactionSource {
  readonly name = 'mock';

  constructor(private readonly trackingIds: string[] = []) {}

  async fetchTransactions(): Promise<AffiliateTransaction[]> {
    return this.trackingIds.map((trackingId, index) => {
      // A realistic mix: most pending, some confirmed, the occasional return.
      const status = index % 5 === 4 ? 'reversed' : index % 3 === 0 ? 'confirmed' : 'pending';
      const orderValueCents = 4500 + index * 1750;

      return affiliateTransactionSchema.parse({
        providerTransactionId: `mock_txn_${trackingId}`,
        trackingId,
        merchant: ['adidas', 'Aritzia', 'Uniqlo', "Levi's"][index % 4]!,
        orderValueCents,
        // ~8% is a plausible apparel rate.
        commissionCents: Math.round(orderValueCents * 0.08),
        currency: 'USD',
        status,
        occurredAt: new Date(Date.now() - index * 3_600_000),
        raw: { source: 'mock' },
      });
    });
  }
}

export function resolveTransactionSource(
  env: NodeJS.ProcessEnv = process.env,
): AffiliateTransactionSource | null {
  const mode = (env.VIOLA_AFFILIATE_PROVIDER ?? env.VIOLA_PROVIDERS ?? 'mock').toLowerCase();
  if (mode !== 'live') return null;
  if (!env.SOVRN_API_KEY) return null;
  return new SovrnTransactionSource(env.SOVRN_API_KEY);
}
