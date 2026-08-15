/**
 * The mark.
 *
 * Lives in its own file so client surfaces (the Fold) can render it without
 * pulling the server-only chrome — identity, the database — into the browser.
 */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="display leading-none text-white" style={{ fontSize: size }}>
      Viola
      <span className="text-[var(--color-viola)]">.</span>
    </span>
  );
}
