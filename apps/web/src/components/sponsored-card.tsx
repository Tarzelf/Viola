import { mediaUrl } from '@/lib/media';

/**
 * The sponsored unit.
 *
 * The brief asked for advertising that is "incredibly clean, very premium". No
 * third-party ad network can deliver that: the creative is out of our control,
 * and the SDK drags in an ATT prompt and a privacy manifest for good measure.
 *
 * So this is a real look card served from our own table — same proportions,
 * same typography, same restraint as everything around it. Marked Sponsored
 * plainly, because a native unit that hides what it is erodes exactly the trust
 * the aesthetic is buying. Shown to free accounts only.
 */
export function SponsoredCard({
  placement,
}: {
  placement: {
    id: string;
    brandName: string;
    headline: string;
    body: string | null;
    imagePath: string;
    ctaLabel: string;
    targetUrl: string;
  };
}) {
  return (
    <article className="group">
      <a
        href={placement.targetUrl}
        target="_blank"
        rel="noopener noreferrer nofollow sponsored"
        className="block"
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)]">
          <img
            src={mediaUrl(placement.imagePath)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent to-[rgba(11,10,15,0.92)]" />

          <span className="absolute top-3 left-3 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-white/75 uppercase backdrop-blur-sm">
            Sponsored
          </span>

          <div className="absolute inset-x-4 bottom-4">
            <p className="label-caps text-white">{placement.brandName}</p>
            <p className="mt-1 text-[15px] leading-snug font-semibold text-white">
              {placement.headline}
            </p>
            {placement.body && (
              <p className="mt-1 text-[13px] leading-snug text-white/65">{placement.body}</p>
            )}
            <span className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-ink)]">
              {placement.ctaLabel}
            </span>
          </div>
        </div>
      </a>
    </article>
  );
}
