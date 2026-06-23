function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

const colors = {
  red:    { border: 'border-red-100',    total: 'text-red-500',    dot: 'bg-red-400' },
  orange: { border: 'border-orange-100', total: 'text-orange-500', dot: 'bg-orange-400' },
  purple: { border: 'border-purple-100', total: 'text-purple-600', dot: 'bg-purple-400' },
}

export default function ExpensesSection({ items, title = 'Расходы', color = 'red' }) {
  const c = colors[color] || colors.red
  const total = items.reduce((s, i) => s + i.сумма, 0)

  return (
    <div className={`bg-white rounded-xl border ${c.border} p-5 mb-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
        </div>
        <span className={`text-xl font-bold ${c.total}`}>{fmt(total)}</span>
      </div>
      <div className="divide-y divide-gray-100">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between py-2 text-sm">
            <span className="text-gray-400 w-24 shrink-0">{item.date}</span>
            <span className="text-gray-700 flex-1 mx-3">{item.comment || '—'}</span>
            <span className={`${c.total} font-medium`}>{fmt(item.сумма)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
