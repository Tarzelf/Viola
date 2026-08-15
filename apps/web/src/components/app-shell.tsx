import Link from 'next/link';
import { getViewer } from '@/lib/identity';
import { getProfileForUser } from '@/lib/queries';
import { AccountMenu } from './account-menu';
import { Wordmark } from './wordmark';

export { Wordmark };

/**
 * App chrome.
 *
 * Restraint is the whole brief here: near-black canvas, hairline borders,
 * generous space, one accent. Everything energetic lives in the content and the
 * motion, never in the frame around it.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const profile = viewer.userId ? await getProfileForUser(viewer.userId) : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1120px] flex-col px-4 sm:px-6">
      <Header handle={profile?.handle ?? null} />
      <main className="flex-1 pt-2">{children}</main>
      <Footer />
      <MobileBar />
    </div>
  );
}

function Header({ handle }: { handle: string | null }) {
  return (
    <header className="sticky top-0 z-[var(--z-header,200)] -mx-4 mb-4 flex items-center justify-between border-b border-[var(--color-hairline)] bg-[rgba(11,10,15,0.72)] px-4 py-3.5 backdrop-blur-xl sm:-mx-6 sm:px-6">
      <Link href="/" aria-label="Viola home">
        <Wordmark />
      </Link>

      <nav className="hidden items-center gap-1 sm:flex">
        <NavLink href="/">Feed</NavLink>
        <NavLink href="/vaults">Vaults</NavLink>
      </nav>

      <div className="flex items-center gap-2">
        <Link
          href="/new"
          className="rounded-full bg-[var(--color-viola)] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-[var(--color-viola-pressed)] active:scale-[0.97]"
        >
          Post a fit
        </Link>
        {handle ? (
          <AccountMenu handle={handle} />
        ) : (
          <Link
            href="/signin"
            className="rounded-full border border-[var(--color-hairline)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[rgba(124,92,252,0.4)] hover:text-white"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

/** Published contact info is a guideline 1.2 requirement, so it is linked
 *  from every page rather than buried. */
function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--color-hairline)] py-7 pb-28 sm:pb-7">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-[12px] text-[var(--color-text-tertiary)]">Viola</span>
        <Link
          href="/contact"
          className="text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-white"
        >
          Contact
        </Link>
        <Link
          href="/privacy"
          className="text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-white"
        >
          Privacy
        </Link>
        <Link
          href="/terms"
          className="text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-white"
        >
          Terms
        </Link>
        <Link
          href="/early"
          className="text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-white"
        >
          Early access
        </Link>
        <Link
          href="/plus"
          className="text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-white"
        >
          Viola Plus
        </Link>
        <span className="text-[12px] text-[var(--color-text-tertiary)]">
          Retailers pay us a commission. It never costs you more.
        </span>
      </div>
    </footer>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3.5 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-white/5 hover:text-white"
    >
      {children}
    </Link>
  );
}

/** 62% of the audience is on a phone, so the mobile bar is not an afterthought. */
function MobileBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[var(--z-header,200)] border-t border-[var(--color-hairline)] bg-[rgba(11,10,15,0.86)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
      <div className="mx-auto flex max-w-[560px] items-center justify-around px-6 py-3">
        <BarLink href="/" label="Feed" />
        <Link
          href="/new"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-viola)] shadow-[var(--shadow-glow)] transition-transform active:scale-[0.94]"
          aria-label="Post a fit"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </Link>
        <BarLink href="/vaults" label="Vaults" />
      </div>
    </nav>
  );
}

function BarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-white"
    >
      {label}
    </Link>
  );
}
