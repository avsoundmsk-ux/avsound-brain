import { useMemo } from 'react'
import { getHistory, getMonthlyReport, getRentState, payRent } from '../utils/dataService.js'

function fmt(n) { return (n || 0).toLocaleString('ru-RU') + ' ₽' }

function KPI({ label, value, sub, color = 'text-gray-900', dark }) {
  return (
    <div className={`rounded-xl p-4 ${dark ? 'bg-gray-900' : 'bg-white border border-gray-200'}`}>
      <p className={`text-xs uppercase tracking-wide font-semibold ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </div>
  )
}

export default function DashboardTab({ onRefresh }) {
  const history  = useMemo(() => getHistory(), [onRefresh])
  const monthly  = useMemo(() => getMonthlyReport(), [onRefresh])
  const rent     = useMemo(() => getRentState(), [onRefresh])

  const today    = history[0] || null
  const todayS   = today?.summary || {}
  const todayK   = today?.касса   || {}

  const curMonth = new Date().toISOString().slice(0, 7)
  const monthData = monthly.find(m => m.month === curMonth) || {}

  const prevMonth = monthly.find(m => m.month < curMonth) || {}

  const yearData = useMemo(() => monthly.reduce((acc, m) => {
    if (m.month.slice(0, 4) === new Date().getFullYear().toString()) {
      acc.реализация  += m.реализация  || 0
      acc.прибыльДня  += m.прибыльДня  || 0
    }
    return acc
  }, { реализация: 0, прибыльДня: 0 }), [monthly])

  const monthTrend = monthData.прибыльДня > prevMonth.прибыльДня ? '↑' : monthData.прибыльДня < prevMonth.прибыльДня ? '↓' : '—'

  if (history.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-3">📊</p>
        <p className="text-lg font-medium">Нет данных</p>
        <p className="text-sm mt-1">Сохрани хотя бы один день — дашборд заполнится</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Последний день */}
      <Section title={`Последний день — ${today?.дата || '—'}`}>
        <div className="grid grid-cols-5 gap-3">
          <KPI label="Реализация"    value={fmt(todayS.реализация)}   />
          <KPI label="Маржа продаж"  value={fmt(todayS.маржа)}        color="text-green-600" />
          <KPI label="Работа студии" value={fmt(todayS.работа)}       color="text-blue-600" />
          <KPI label="Расходы"       value={fmt(todayS.расходы)}      color="text-red-500" />
          <KPI label="Прибыль дня"   value={fmt(todayS.прибыльДня)}
            color={(todayS.прибыльДня || 0) >= 0 ? 'text-green-400' : 'text-red-400'} dark />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <KPI label="Касса"         value={fmt(todayK.итогоВКассе)} />
          <KPI label="Зарплата (выпл)" value={fmt(todayS.зарплата)} color="text-orange-500" />
          <KPI label="Расхождение"   value={
            Math.abs(todayK.расхождение || 0) < 1 ? '✓ Сходится' : fmt(todayK.расхождение)
          } color={Math.abs(todayK.расхождение || 0) < 1 ? 'text-green-600' : 'text-red-500'} />
        </div>
      </Section>

      {/* Текущий месяц */}
      <Section title={`Месяц — ${fmtMonth(curMonth)} · ${monthData.дней || 0} дн. · ${monthTrend} vs прошлый`}>
        <div className="grid grid-cols-5 gap-3">
          <KPI label="Реализация"    value={fmt(monthData.реализация)} />
          <KPI label="Маржа"         value={fmt(monthData.маржа)}         color="text-green-600" />
          <KPI label="Работа"        value={fmt(monthData.работа)}        color="text-blue-600" />
          <KPI label="Расходы"       value={fmt(monthData.расходы)}       color="text-red-500" />
          <KPI label="Прибыль месяца" value={fmt(monthData.прибыльДня)}
            color={(monthData.прибыльДня||0) >= 0 ? 'text-green-400' : 'text-red-400'} dark />
        </div>
        <div className="grid grid-cols-4 gap-3 mt-3">
          <KPI label="Зарплата"      value={fmt(monthData.зарплата)}    color="text-orange-500" />
          <KPI label="Кол-во продаж" value={monthData.кол_продаж || 0} />
          <KPI label="Средний чек"   value={fmt(monthData.средний_чек)} />
          <KPI label="Кол-во работ"  value={monthData.кол_работ || 0}   color="text-blue-600" />
        </div>
      </Section>

      {/* Год */}
      <Section title={`Год — ${new Date().getFullYear()}`}>
        <div className="grid grid-cols-2 gap-3">
          <KPI label="Реализация за год" value={fmt(yearData.реализация)} />
          <KPI label="Прибыль за год"    value={fmt(yearData.прибыльДня)}
            color={(yearData.прибыльДня||0) >= 0 ? 'text-green-400' : 'text-red-400'} dark />
        </div>
      </Section>

      {/* Аренда */}
      <Section title="Аренда">
        <div className="grid grid-cols-3 gap-3">
          <KPI label="Начислено"  value={fmt(rent.начислено)} color="text-gray-700" />
          <KPI label="Оплачено"   value={fmt(rent.оплачено)}  color="text-green-600" />
          <KPI label="Остаток долга" value={fmt(rent.остаток)}
            color={rent.остаток <= 0 ? 'text-green-600' : 'text-red-500'} dark />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Начисляется автоматически 5 000 ₽ за каждый сохранённый день.
          Оплату аренды фиксируй отдельно.
        </p>
      </Section>

    </div>
  )
}

function fmtMonth(m) {
  const [y, mo] = m.split('-')
  const names = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  return `${names[parseInt(mo) - 1]} ${y}`
}
