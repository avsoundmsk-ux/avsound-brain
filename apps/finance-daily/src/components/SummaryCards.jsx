function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function Card({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function SummaryCards({ items }) {
  const реализация = items.reduce((s, i) => s + i.реализация, 0)
  const закупка = items.reduce((s, i) => s + i.закупка, 0)
  const маржа = реализация - закупка
  const pct = реализация ? Math.round((маржа / реализация) * 100) : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card label="Реализация" value={fmt(реализация)} />
      <Card label="Себестоимость" value={fmt(закупка)} color="text-gray-600" />
      <Card
        label="Валовая маржа"
        value={fmt(маржа)}
        color={маржа >= 0 ? 'text-green-600' : 'text-red-600'}
      />
      <Card
        label="% маржи"
        value={pct + '%'}
        color={pct >= 30 ? 'text-green-600' : pct >= 15 ? 'text-yellow-600' : 'text-red-600'}
      />
    </div>
  )
}
