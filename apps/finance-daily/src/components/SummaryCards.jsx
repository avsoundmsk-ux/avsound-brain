function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function Card({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

export default function SummaryCards({ salesItems, workItems, expenseItems }) {
  const реализация = salesItems.reduce((s, i) => s + i.реализация, 0)
  const закупка = salesItems.reduce((s, i) => s + i.закупка, 0)
  const маржаПродаж = реализация - закупка
  const работа = workItems.reduce((s, i) => s + i.сумма, 0)
  const расходы = expenseItems.reduce((s, i) => s + i.сумма, 0)
  const чистая = маржаПродаж + работа - расходы
  const pct = реализация ? Math.round((маржаПродаж / реализация) * 100) : 0

  return (
    <div className="mb-6 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Реализация" value={fmt(реализация)} />
        <Card label="Себестоимость" value={fmt(закупка)} color="text-gray-500" />
        <Card label="Маржа продаж" value={fmt(маржаПродаж)} color={маржаПродаж >= 0 ? 'text-green-600' : 'text-red-500'} />
        <Card label="% маржи" value={pct + '%'} color={pct >= 30 ? 'text-green-600' : pct >= 15 ? 'text-yellow-600' : 'text-red-500'} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card label="Работа студии" value={fmt(работа)} color="text-blue-600" />
        <Card label="Расходы" value={fmt(расходы)} color="text-red-500" />
        <div className="bg-gray-900 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Чистая прибыль</p>
          <p className={`text-2xl font-bold mt-1 ${чистая >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(чистая)}</p>
        </div>
      </div>
    </div>
  )
}
