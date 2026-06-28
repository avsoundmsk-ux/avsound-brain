function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function Card({ label, value, sub, color, dark }) {
  if (dark) return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function SummaryCards({ salesItems, workItems, expenseItems, salaryItems, stockItems }) {
  const реализация     = salesItems.reduce((s, i) => s + i.реализация, 0)
  const себестоимость  = salesItems.reduce((s, i) => s + i.закупка, 0)
  const маржа          = реализация - себестоимость
  const работа         = workItems.reduce((s, i) => s + i.сумма, 0)
  const расходы        = expenseItems.reduce((s, i) => s + i.сумма, 0)
  const зарплата       = salaryItems.reduce((s, i) => s + i.сумма, 0)
  const закупка        = stockItems.reduce((s, i) => s + i.сумма, 0)
  const pct            = реализация ? Math.round((маржа / реализация) * 100) : 0
  const аренда         = 5000
  const валоваяПрибыль = маржа + работа
  // Зарплата дня = маржа + работа - расходы - аренда
  // Файл "зарплата" — это выплата из кассы, не влияет на расчёт зарплаты дня
  const зарплатаДня    = валоваяПрибыль - расходы - аренда

  return (
    <div className="mb-6 space-y-3">
      {/* Строка 1: продажи */}
      <div className="grid grid-cols-5 gap-3">
        <Card label="Реализация"   value={fmt(реализация)} />
        <Card label="Себестоимость" value={fmt(себестоимость)} color="text-gray-500" />
        <Card label="Маржа продаж" value={fmt(маржа)}
          color={маржа >= 0 ? 'text-green-600' : 'text-red-500'}
          sub={pct + '%'} />
        <Card label="Работа студии" value={fmt(работа)} color="text-blue-600" />
        <Card label="Валовая прибыль" value={fmt(валоваяПрибыль)}
          color={валоваяПрибыль >= 0 ? 'text-green-700' : 'text-red-500'}
          sub="маржа + работа" />
      </div>
      {/* Строка 2: расходы + итог */}
      <div className="grid grid-cols-5 gap-3">
        <Card label="Расходы"       value={fmt(расходы)}    color="text-red-500" />
        <Card label="Аренда (авто)" value={fmt(аренда)}     color="text-gray-400" />
        <Card label="Закупка склад" value={fmt(закупка)}    color="text-purple-600"
          sub="движение кассы" />
        <Card label="Зарплата выпл." value={fmt(зарплата)} color="text-orange-500"
          sub="движение кассы" />
        <Card label="Зарплата дня"  value={fmt(зарплатаДня)}
          color={зарплатаДня >= 0 ? 'text-green-400' : 'text-red-400'} dark />
      </div>
    </div>
  )
}
