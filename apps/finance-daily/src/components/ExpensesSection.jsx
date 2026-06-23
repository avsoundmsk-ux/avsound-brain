function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

export default function ExpensesSection({ items }) {
  const total = items.reduce((s, i) => s + i.сумма, 0)

  return (
    <div className="bg-white rounded-xl border border-red-100 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Расходы</h2>
        <span className="text-xl font-bold text-red-500">{fmt(total)}</span>
      </div>
      {items.length > 0 && (
        <div className="divide-y divide-gray-100">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between py-2 text-sm">
              <span className="text-gray-400">{item.date}</span>
              <span className="text-gray-700 flex-1 mx-4">{item.comment || '—'}</span>
              <span className="text-red-500 font-medium">{fmt(item.сумма)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
