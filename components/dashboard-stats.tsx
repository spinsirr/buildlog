export function DashboardStats({ stats }: { stats: { label: string; value: number }[] }) {
  // Pull out the primary stat (first one) for emphasis, rest become secondary
  const [primary, ...rest] = stats

  if (!primary) return null

  return (
    <div id="onborda-stats" className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {/* Primary stat — larger, left-aligned */}
      <div className="shrink-0">
        <span className="text-xs font-mono-ui tracking-wide uppercase text-zinc-500">
          {primary.label}
        </span>
        <p className="text-4xl font-semibold text-zinc-50 tabular-nums -mt-0.5">{primary.value}</p>
      </div>

      {/* Secondary stats — inline, compact */}
      {rest.length > 0 && (
        <div className="flex items-baseline gap-5 sm:gap-6 sm:ml-6 pb-0.5">
          {rest.map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-1.5">
              <span className="text-lg font-medium text-zinc-300 tabular-nums">{stat.value}</span>
              <span className="text-xs text-zinc-500 font-mono-ui">{stat.label.toLowerCase()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
