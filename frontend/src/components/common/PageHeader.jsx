export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-[32px] md:leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
