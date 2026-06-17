import { cn } from '@/lib/utils';

/**
 * Essentials Egypt dove mark — a clean, scalable silhouette of the brand's
 * dove in flight (wings spread upward). Pure SVG, fills with `currentColor`,
 * so the same mark works white-on-black (hero) or ink-on-white (nav) just by
 * setting the surrounding text color. Reused at every size.
 */
export function DoveMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="currentColor"
      role="img"
      aria-label="Essentials Egypt"
      className={className}
    >
      {/* right wing */}
      <path d="M99 73 C123 57 157 50 193 27 C175 53 150 66 119 79 C133 83 147 93 151 107 C131 91 111 83 99 87 Z" />
      {/* left wing (mirror of the right around the vertical centre line) */}
      <path
        d="M99 73 C123 57 157 50 193 27 C175 53 150 66 119 79 C133 83 147 93 151 107 C131 91 111 83 99 87 Z"
        transform="translate(200,0) scale(-1,1)"
      />
      {/* head + body + forked tail */}
      <path d="M100 49 C93 49 88 55 88 64 C88 82 92 99 97 112 L90 140 L100 126 L110 140 L103 112 C108 99 112 82 112 64 C112 55 107 49 100 49 Z" />
    </svg>
  );
}

/** Brand mark + wordmark lockup (ESSENTIALS / EGYPT). */
export function Logo({
  className,
  showText = true,
  variant = 'dark',
  subtitle = 'EGYPT',
}: {
  className?: string;
  showText?: boolean;
  /** `dark` = for light backgrounds (ink text); `light` = for dark backgrounds (white text). */
  variant?: 'dark' | 'light';
  subtitle?: string;
}) {
  // `light` is always white (used on the dark hero). `dark` is ink on light
  // backgrounds, but flips to white in dark mode so the dove + wordmark stay
  // visible on dark surfaces (sidebar, cards, etc.).
  const text = variant === 'light' ? 'text-white' : 'text-brand dark:text-white';
  return (
    <div className={cn('flex items-center gap-2.5', text, className)}>
      <DoveMark className="h-7 w-9 shrink-0" />
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold uppercase tracking-[0.14em]">Essentials</span>
          <span
            className={cn(
              'mt-0.5 text-[9px] font-semibold uppercase tracking-[0.32em]',
              variant === 'light' ? 'text-white/60' : 'text-brand/55 dark:text-white/60',
            )}
          >
            {subtitle}
          </span>
        </span>
      )}
    </div>
  );
}
