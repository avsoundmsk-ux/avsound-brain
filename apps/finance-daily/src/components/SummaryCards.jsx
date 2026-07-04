function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function Card({ label, value, sub, color, dark, small }) {
  if (dark) return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className={`text-xs text-gray-500 uppercase tracking-wide ${small ? '' : ''}`}>{label}</p>
      <p className={`${small ? 'text-base' : 'text-xl'} font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-1">
      {children}
    </p>
  )
}

export default function SummaryCards({ salesItems, workItems, expenseItems, salaryItems, stockItems, returnItems = [], rentDays = 1, вычет = 0 }) {
  const реализация    = salesItems.reduce((s, i) => s + i.реализация, 0)
  const себестоимость = salesItems.reduce((s, i) => s + i.закупка, 0)
  const маржа         = реализация - себестоимость
  const работа        = workItems.reduce((s, i) => s + i.сумма, 0)
  const расходы       = expenseItems.reduce((s, i) => s + i.сумма, 0)
  // Файл "зарплата" и "закупка" — только кассовые движения, не влияют на прибыль дня
  const выплатаЗарплаты = salaryItems.reduce((s, i) => s + i.сумма, 0)
  const закупкаСклада   = stockItems.reduce((s, i) => s + i.сумма, 0)
  const возвраты        = returnItems.reduce((s, i) => s + i.сумма, 0)
  const pct           = реализация ? Math.round((маржа / реализация) * 100) : 0
  // Аренда/гаражи из файла Расходы — реальная оплата, только касса
  const isПомещение   = c => /аренд|гараж/i.test(c || '')
  const помещенияРасх = expenseItems.filter(i => isПомещение(i.comment)).reduce((s, i) => s + i.сумма, 0)
  const расходыОпер   = расходы - помещенияРасх
  // Авто-аренда 5000/день — откладываем, вычитается из ЗП
  const автоАренда    = 5000 * rentDays

  // Прибыль дня = маржа + работа - операционные расходы - авто-аренда (5000/день)
  // Оплата аренды/гаражей, вычет, зарплата, закупка, возвраты — только касса
  const прибыльДня = маржа + работа - расходыОпер - автоАренда

  return (
    <div className="mb-6 space-y-4">

      {/* ── БЛОК 1: ЗАРАБОТАЛИ ─────────────────────────────────────── */}
      <div>
        <SectionTitle>Заработали за день</SectionTitle>
        <div className="grid grid-cols-6 gap-3">
          <Card label="Реализация"      value={fmt(реализация)} />
          <Card label="Себестоимость"   value={fmt(себестоимость)} color="text-gray-500" />
          <Card label="Маржа продаж"    value={fmt(маржа)}
            color={маржа >= 0 ? 'text-green-600' : 'text-red-500'}
            sub={pct + '% от реализации'} />
          <Card label="Работа студии"   value={fmt(работа)} color="text-blue-600" />
          <Card label="Расходы (опер.)" value={fmt(расходыОпер)} color="text-red-500" />
          <Card label="Аренда (отложение)" value={fmt(автоАренда)} color="text-gray-400" sub={`5000×${rentDays}дн · из зп`} />
        </div>
        <div className="grid grid-cols-6 gap-3 mt-2">
          <div className="col-span-4" />
          {вычет > 0 ? (
            <Card label="Вычет" value={fmt(вычет)} color="text-red-500" sub="только из кассы" small />
          ) : <div />}
          <Card
            label="Зарплата / прибыль дня"
            value={fmt(прибыльДня)}
            sub="маржа + работа − расходы(опер.) − аренда(5000/дн)"
            color={прибыльДня >= 0 ? 'text-green-400' : 'text-red-400'}
            dark
          />
        </div>
      </div>

      {/* ── БЛОК 2: ДВИЖЕНИЕ КАССЫ ─────────────────────────────────── */}
      {(выплатаЗарплаты > 0 || закупкаСклада > 0 || возвраты > 0 || помещенияРасх > 0) && (
        <div>
          <SectionTitle>Движение кассы (не влияет на прибыль дня)</SectionTitle>
          <div className="grid grid-cols-6 gap-3">
            {помещенияРасх > 0 && (
              <Card
                label="Аренда/гаражи опл."
                value={fmt(помещенияРасх)}
                color="text-gray-500"
                sub="выплата из кассы"
                small
              />
            )}
            {выплатаЗарплаты > 0 && (
              <Card
                label="Выплачено зарплаты"
                value={fmt(выплатаЗарплаты)}
                color="text-orange-500"
                sub="выплата из кассы"
                small
              />
            )}
            {закупкаСклада > 0 && (
              <Card
                label="Закупка склада"
                value={fmt(закупкаСклада)}
                color="text-purple-600"
                sub="выплата из кассы"
                small
              />
            )}
            {возвраты > 0 && (
              <Card
                label="Возвраты"
                value={fmt(возвраты)}
                color="text-purple-600"
                sub="выплата из кассы"
                small
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
