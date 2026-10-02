// A ledger "D" in turmeric gold with a rising tick cut into it: the book, and the growth.
export function LogoMark({ size = 36, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#0B1B2B" />
      <path d="M12 9.5h7.2a10.5 10.5 0 0 1 0 21H12z" fill="#F0B429" />
      <path
        d="M15.5 25.5l4-5.2 3 2.6 4.2-6"
        stroke="#0B1B2B"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({ size = 36, tone = "dark", className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span
        className={`text-xl font-extrabold tracking-[0.08em] ${tone === "light" ? "text-white" : "text-ink"}`}
        style={{ lineHeight: 1 }}
      >
        DHAN
      </span>
    </span>
  );
}
