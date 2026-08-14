import Link from 'next/link';

/**
 * App chrome.
 *
 * Restraint is the whole brief here: near-black canvas, hairline borders,
 * generous space, one accent. Everything energetic lives in the content and the
 * motion, never in the frame around it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1120px] flex-col px-4 sm:px-6">
      <Header />
      <main className="flex-1 pt-2 pb-28">{children}</main>
      <MobileBar />
    </div>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="display leading-none text-white" style={{ fontSize: size }}>
      Viola
      <span className="text-[var(--color-viola)]">.</span>
    </span>
  );
}

function Header() {
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
      </div>
    </header>
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
