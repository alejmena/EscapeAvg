import { useId } from "react";

export function Logo({ compact = false }: { compact?: boolean }) {
  const gid = `lg${useId().replace(/:/g, "")}`;
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden className="shrink-0 drop-shadow-[0_6px_12px_rgb(108_76_255/0.35)]">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="60%" stopColor="var(--accent-2)" />
            <stop offset="100%" stopColor="var(--accent-3)" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill={`url(#${gid})`} />
        <rect x="1" y="1" width="62" height="62" rx="17" fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth="2" />
        <path d="M15 44 L28 31 L36 39 L49 22" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M40 21 H50 V31" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <span className="font-display text-[17px] font-bold leading-none tracking-tight">
          Escape <span className="text-gradient">Average</span>
        </span>
      )}
    </span>
  );
}
