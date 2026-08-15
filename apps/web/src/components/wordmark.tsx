/** Brand wordmark — safe for client and server components. */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="display leading-none text-white" style={{ fontSize: size }}>
      Viola
      <span className="text-[var(--color-viola)]">.</span>
    </span>
  );
}
