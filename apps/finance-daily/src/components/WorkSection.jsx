function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

export default function WorkSection({ items }) {
  const total = items.reduce((s, i) => s + i.сумма, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Работа студии</h2>
        <span className="text-xl font-bold text-blue-600">{fmt(total)}</span>
      </div>
      {items.length > 0 && (
        <div className="divide-y divide-gray-100">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between py-2 text-sm">
              <span className="text-gray-500">{item.date}</span>
              <span className="text-gray-700">{item.comment || '—'}</span>
              <span className="text-gray-800 font-medium">{fmt(item.сумма)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
