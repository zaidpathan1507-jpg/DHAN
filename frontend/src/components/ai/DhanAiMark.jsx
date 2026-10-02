// DHAN AI mark: a gold tile with a four-point spark, distinct from the DHAN ledger-D logo.
export default function DhanAiMark({ size = 36, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#0B1B2B" />
      <path d="M20 7.5c.9 6.2 3.8 9.1 10 10-6.2.9-9.1 3.8-10 10-.9-6.2-3.8-9.1-10-10 6.2-.9 9.1-3.8 10-10Z" fill="#F0B429" />
      <path d="M30.5 24.5c.4 2.7 1.6 3.9 4.3 4.3-2.7.4-3.9 1.6-4.3 4.3-.4-2.7-1.6-3.9-4.3-4.3 2.7-.4 3.9-1.6 4.3-4.3Z" fill="#FDEBB0" />
    </svg>
  );
}
