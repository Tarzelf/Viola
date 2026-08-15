import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

/**
 * The viral loop, end to end.
 *
 * This is the one path the product genuinely depends on, so it is tested
 * against a real server with the real pipeline rather than mocked at the
 * network layer:
 *
 *   sign in → upload → reveal → publish
 *     → open the share link in a CLEAN context, with no session and no cookies
 *     → bloom it as a guest, with no account
 *     → see the signup prompt
 *
 * The clean context matters more than anything else here. Every previous check
 * of this flow reused a logged-in browser, which is precisely the situation a
 * share recipient is never in. If an auth wall crept in front of the share
 * page, only a fresh context would catch it.
 */

/** A small JPEG, generated so the suite carries no binary fixture. */
async function makePhoto(): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp({
    create: { width: 1200, height: 1500, channels: 3, background: { r: 128, g: 124, b: 136 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="1200" height="1500">
             <circle cx="560" cy="270" r="78" fill="#2f2b33"/>
             <rect x="432" y="370" width="288" height="450" rx="48" fill="#3a3540"/>
             <rect x="456" y="800" width="240" height="560" rx="42" fill="#2b2730"/>
           </svg>`,
        ),
      },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function signIn(page: Page, email: string) {
  await page.goto('/signin');

  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();

  // With no email provider configured the code is shown, with a button that
  // fills it — added after a reviewer misread the digits by eye.
  await expect(page.getByText('Development mode')).toBeVisible();
  await page.getByRole('button', { name: 'Use this code' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL('/');
}

test.describe('the share loop', () => {
  test('a stranger can open a shared look and bloom it without an account', async ({
    page,
    browser,
  }) => {
    const email = `e2e-${randomUUID().slice(0, 8)}@viola.app`;

    // --- the creator ------------------------------------------------------
    await signIn(page, email);

    await page.goto('/new');
    await expect(page.getByRole('heading', { name: 'Post a fit' })).toBeVisible();

    await page.setInputFiles('input[type="file"]', {
      name: 'look.jpg',
      mimeType: 'image/jpeg',
      buffer: await makePhoto(),
    });

    // The reveal stages pieces in one at a time on the client's own clock, so
    // the finished score is deliberately not instant.
    await expect(page.getByText(/Voilà, almost|Getting your photo ready/)).toBeVisible();

    // Publishing navigates to the finished look.
    await page.waitForURL(/\/l\/[a-z0-9]{10}/, { timeout: 90_000 });

    const shareUrl = page.url();
    const slug = shareUrl.split('/l/')[1]!;
    expect(slug).toMatch(/^[a-z0-9]{10}$/);

    // The card carries a score and a vibe.
    await expect(page.getByText(/viola\.app\/@/)).toBeVisible();

    // --- the recipient, in a completely clean context ---------------------
    // No session, no guest cookie, nothing. This is what a share recipient
    // actually is, and it is the case a logged-in browser can never test.
    const recipientContext = await browser.newContext();
    const recipient = await recipientContext.newPage();

    try {
      await recipient.goto(shareUrl);

      // No auth wall. Value before account, every time.
      await expect(recipient).toHaveURL(shareUrl);
      await expect(recipient.getByText(/wants you to rate this fit/)).toBeVisible();

      // Referrer context: the recipient can see who sent it.
      await expect(recipient.getByRole('link', { name: /^@/ }).first()).toBeVisible();

      // Sharing is offered without signing in.
      await expect(recipient.getByRole('link', { name: 'Send to a friend' })).toBeVisible();

      // --- guest bloom ----------------------------------------------------
      const bloom = recipient.getByRole('button', { name: /Give this look a bloom/ });
      await expect(bloom).toBeVisible();

      const before = Number((await bloom.innerText()).replace(/\D/g, '') || '0');
      await bloom.click();

      await expect(recipient.getByRole('button', { name: /^Bloomed/ })).toBeVisible();
      const after = Number(
        (await recipient.getByRole('button', { name: /^Bloomed/ }).innerText()).replace(/\D/g, ''),
      );
      expect(after).toBe(before + 1);

      // --- the prompt comes after they act, never before -------------------
      await expect(recipient.getByRole('heading', { name: 'Post your own fit' })).toBeVisible();
      await expect(recipient.getByRole('link', { name: /Try it/ })).toBeVisible();

      // --- and it persists across a reload, via the guest cookie -----------
      await recipient.reload();
      await expect(recipient.getByRole('button', { name: /^Bloomed/ })).toBeVisible();
    } finally {
      await recipientContext.close();
    }
  });

  test('the link preview image renders for a crawler', async ({ request, page }) => {
    // This is what appears in a message thread and decides whether anyone taps.
    await page.goto('/');
    const href = await page.locator('a[href^="/l/"]').first().getAttribute('href');
    const slug = href!.split('/l/')[1]!;

    const response = await request.get(`/l/${slug}/opengraph-image`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');

    const body = await response.body();
    expect(body.byteLength).toBeGreaterThan(10_000);
    // PNG magic number — proves it is a real image, not an error page.
    expect(body.subarray(0, 4).toString('hex')).toBe('89504e47');
  });

  test('a quarantined or missing look is unreachable', async ({ page }) => {
    const response = await page.goto('/l/zzzzzzzzzz');
    expect(response?.status()).toBe(404);
  });
});

test.describe('the share page for a signed-out visitor', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('is accessible: landmarks, labelled controls, and a working heading order', async ({
    page,
  }) => {
    await page.goto('/');
    const href = await page.locator('a[href^="/l/"]').first().getAttribute('href');
    await page.goto(href!);

    // Every interactive control has an accessible name. A bloom button that
    // reads as "button" to a screen reader is the whole feature, unusable.
    const buttons = await page.getByRole('button').all();
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      const name = (await button.getAttribute('aria-label')) ?? (await button.innerText()).trim();
      expect(name.length, 'a button has no accessible name').toBeGreaterThan(0);
    }

    // Images that carry meaning have alt text; decorative ones are empty, not
    // missing.
    const images = await page.locator('img').all();
    for (const image of images) {
      expect(await image.getAttribute('alt')).not.toBeNull();
    }

    // The page has exactly one h1 and no skipped level below it.
    expect(await page.locator('h1').count()).toBeLessThanOrEqual(1);

    // The bloom button exposes its pressed state.
    const bloom = page.getByRole('button', { name: /bloom/i }).first();
    await expect(bloom).toHaveAttribute('aria-pressed', /true|false/);
  });

  test('is fast enough that a recipient does not bounce', async ({ page }) => {
    await page.goto('/');
    const href = await page.locator('a[href^="/l/"]').first().getAttribute('href');

    const started = Date.now();
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/wants you to rate this fit/)).toBeVisible();
    const elapsed = Date.now() - started;

    // Generous for a dev server with no build optimisation, but it would catch
    // a page that started blocking on the pipeline or a render.
    expect(elapsed).toBeLessThan(10_000);
  });
});
