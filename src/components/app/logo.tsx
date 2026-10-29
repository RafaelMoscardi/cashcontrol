import { cn } from '@/lib/utils'

/** Marca: "C" em arco com a seta de alta. Mesmo desenho de public/favicon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={cn('size-9', className)}>
      <defs>
        <linearGradient id="cc-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d1733" />
          <stop offset="1" stopColor="#0b0a10" />
        </linearGradient>
        <linearGradient id="cc-logo-arc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#cc-logo-bg)" />
      <rect x="1.5" y="1.5" width="509" height="509" rx="114.5" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="3" />
      <path d="M370.9 159.6A150 150 0 1 0 370.9 352.4" fill="none" stroke="url(#cc-logo-arc)" strokeWidth="48" strokeLinecap="round" />
      <path d="M200 312 326 186M250 186h76v76" fill="none" stroke="#f5f3ff" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {!compact && (
        <span className="text-[1.0625rem] font-semibold tracking-tight">
          Cash<span className="text-primary">Control</span>
        </span>
      )}
    </span>
  )
}
