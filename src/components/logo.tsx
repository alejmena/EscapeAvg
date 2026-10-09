export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" className="fill-text" />
        <path d="M14 44 L28 30 L36 38 L50 20" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="50" cy="20" r="5" fill="var(--success)" />
      </svg>
      {!compact && <span>Escape Average</span>}
    </span>
  );
}
