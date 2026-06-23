function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function Card({ label, value, color, small }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`font-bold mt-1 ${small ? 'text-xl' : 'text-2xl'} ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

export default function SummaryCards({ salesItems, workItems }) {
  const реализация = salesItems.reduce((s, i) => s + i.реализация, 0)
  const закупка = salesItems.reduce((s, i) => s + i.закупка, 0)
  const маржаПродаж = реализация - закупка
  const работа = workItems.reduce((s, i) => s + i.сумма, 0)
  const итого = маржаПродаж + работа
  const pct = реализация ? Math.round((маржаПродаж / реализация) * 100) : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <Card label="Реализация" value={fmt(реализация)} />
      <Card label="Себестоимость" value={fmt(закупка)} color="text-gray-500" />
      <Card label="Маржа продаж" value={fmt(маржаПродаж)} color={маржаПродаж >= 0 ? 'text-green-600' : 'text-red-600'} />
      <Card label="% маржи" value={pct + '%'} color={pct >= 30 ? 'text-green-600' : pct >= 15 ? 'text-yellow-600' : 'text-red-600'} />
      <Card label="Работа" value={fmt(работа)} color="text-blue-600" />
      <Card label="Итого доход" value={fmt(итого)} color={итого >= 0 ? 'text-green-700' : 'text-red-600'} />
    </div>
  )
}
