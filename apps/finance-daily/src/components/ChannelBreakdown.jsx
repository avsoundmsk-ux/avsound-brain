function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

export default function ChannelBreakdown({ items }) {
  const channels = ['Авито', 'Прямые']

  const stats = channels.map(ch => {
    const rows = items.filter(i => i.channel === ch)
    const реализация = rows.reduce((s, i) => s + i.реализация, 0)
    const маржа = rows.reduce((s, i) => s + i.маржа, 0)
    const pct = реализация ? Math.round((маржа / реализация) * 100) : 0
    return { ch, count: rows.length, реализация, маржа, pct }
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        По каналам
      </h2>
      <div className="divide-y divide-gray-100">
        {stats.map(s => (
          <div key={s.ch} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                s.ch === 'Авито'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>{s.ch}</span>
              <span className="text-sm text-gray-400">{s.count} поз.</span>
            </div>
            <div className="flex gap-6 text-sm">
              <span className="text-gray-600">{fmt(s.реализация)}</span>
              <span className={s.маржа >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {fmt(s.маржа)}
              </span>
              <span className="text-gray-400 w-10 text-right">{s.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
