export function DashboardStats({
  stats,
}: {
  stats: { label: string; value: number }[]
}) {
  return (
    <div id="onborda-stats" className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg bg-zinc-900/50 px-4 py-3">
          <span className="text-xs text-zinc-500">{stat.label}</span>
          <p className="text-2xl font-semibold text-zinc-100 mt-1">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}
