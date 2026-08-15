/**
 * End-to-end pipeline demo, entirely offline.
 *
 *   pnpm --filter @viola/pipeline demo
 *
 * Runs a synthetic photo through all stages with mock providers and prints what
 * the user would see. Proves the whole path works with no API keys and no
 * network, which is the acceptance criterion for this phase.
 */
import { getArchetype, scoreHeadline, formatPrice, formatItemLabel } from '@viola/core';
import { MemoryProductCache, runPipeline } from '../src/orchestrator';
import {
  createFixtureFetch,
  mockProviders,
  MockProductSearchProvider,
} from '../src/providers/index';
import { solidImage } from '../src/imagery';

const products = new MockProductSearchProvider();
const providers = mockProviders({ products });
const cache = new MemoryProductCache();

// Serves the fixture catalogue images the mock provider points at.
const fetchImpl = createFixtureFetch();

// A stand-in for a mirror selfie. The mock vision provider keys off the image
// bytes, so this deterministically selects one of the outfit fixtures.
const photo = await solidImage(1200, 1500, { r: 92, g: 88, b: 104 });

const started = Date.now();
const result = await runPipeline({
  lookId: 'demo-look-0001',
  image: photo,
  providers,
  cache,
  fetchImpl,
  onStage: (stage, { ok, ms }) => {
    console.log(`  ${ok ? '·' : '!'} ${stage.padEnd(8)} ${ms}ms`);
  },
});
const elapsed = Date.now() - started;

const archetype = getArchetype(result.archetypeId);

console.log('\n─────────────────────────────────────────────');
console.log(`  ${scoreHeadline(archetype?.name ?? result.archetypeId, result.score.overall)}`);
console.log(`  ${archetype?.blurb ?? ''}`);
console.log(`  ${result.score.band.name}`);
console.log('─────────────────────────────────────────────\n');

for (const item of result.items) {
  const slot = result.layout.slots.find((s) => s.itemIndex === item.index);
  const side = slot ? slot.side.toUpperCase().padEnd(5) : 'RAIL ';
  const label = formatItemLabel(item);
  const price = item.product?.priceCents != null ? formatPrice(item.product.priceCents) : '—';
  const where = item.product?.source ?? item.resolutionNote ?? 'unresolved';

  console.log(`  ${side} ${label.brand}`);
  console.log(`        ${label.name}`);
  console.log(`        ${price.padEnd(10)} ${where}${item.product?.imagePath ? '  [cutout]' : ''}`);
  if (item.secondhand.length > 0) {
    const cheapest = item.secondhand[0]!;
    console.log(
      `        also ${formatPrice(cheapest.priceCents ?? 0)} secondhand at ${cheapest.source}`,
    );
  }
  console.log('');
}

const left = result.layout.slots.filter((s) => s.side === 'left').length;
const right = result.layout.slots.filter((s) => s.side === 'right').length;

console.log('─────────────────────────────────────────────');
console.log(
  `  subject band   ${result.layout.subject.x0.toFixed(3)} – ${result.layout.subject.x1.toFixed(3)}`,
);
console.log(
  `  placement      ${left} left · ${right} right · ${result.layout.unplaced.length} in rail`,
);
console.log(
  `  searches       ${products.calls.length} (cache ${cache.hits} hit / ${cache.misses} miss)`,
);
console.log(`  total          ${elapsed}ms`);
if (result.warnings.length > 0) {
  console.log(`  warnings       ${result.warnings.length}`);
  for (const w of result.warnings) console.log(`                 ${w}`);
}
console.log('─────────────────────────────────────────────');

// Second run proves the cache eliminates repeat searches.
const before = products.calls.length;
await runPipeline({ lookId: 'demo-look-0002', image: photo, providers, cache, fetchImpl });
console.log(
  `\n  re-running the same outfit cost ${products.calls.length - before} new searches ` +
    `(cache ${cache.hits} hits)\n`,
);
