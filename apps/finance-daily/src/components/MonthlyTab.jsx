import { useMemo } from 'react'
import { getMonthlyReport } from '../utils/dataService.js'

function fmt(n) { return (n || 0).toLocaleString('ru-RU') + ' ₽' }
function pct(a, b) { return b ? Math.round((a / b) * 100) + '%' : '—' }

function fmtMonth(m) {
  const [y, mo] = m.split('-')
  const names = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
  return `${names[parseInt(mo) - 1]} ${y}`
}

const COL = [
  { key: 'реализация',    label: 'Реализация',     color: '' },
  { key: 'себестоимость', label: 'Себест.',         color: 'text-gray-400' },
  { key: 'маржа',         label: 'Маржа',           color: 'text-green-600' },
  { key: 'работа',        label: 'Работа',          color: 'text-blue-600' },
  { key: 'валоваяПрибыль',label: 'Валовая',         color: 'text-green-700' },
  { key: 'расходы',       label: 'Расходы',         color: 'text-red-500' },
  { key: 'зарплата',      label: 'Зарплата',        color: 'text-orange-500' },
  { key: 'аренда',        label: 'Аренда',          color: 'text-gray-400' },
  { key: 'прибыльДня',    label: 'Прибыль',         color: 'text-green-700' },
  { key: 'кол_продаж',    label: '# продаж',        color: '', fmt: n => n },
  { key: 'средний_чек',   label: 'Ср. чек',         color: '' },
  { key: 'кол_работ',     label: '# работ',         color: 'text-blue-600', fmt: n => n },
  { key: 'дней',          label: 'Дней',            color: '', fmt: n => n },
]

export default function MonthlyTab({ onRefresh }) {
  const data = useMemo(() => getMonthlyReport(), [onRefresh])

  if (data.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-3">📅</p>
        <p className="text-lg font-medium">Нет данных</p>
        <p className="text-sm mt-1">Накопится хотя бы один день — появится месячный отчёт</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Месячный отчёт — {data.length} {data.length === 1 ? 'месяц' : 'месяцев'}
      </h2>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left sticky left-0 bg-gray-50 z-10">Месяц</th>
              {COL.map(c => (
                <th key={c.key} className="px-3 py-3 text-right">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, idx) => (
              <tr key={row.month} className={idx % 2 === 0 ? '' : 'bg-gray-50/50'}>
                <td className="px-4 py-2.5 font-semibold text-gray-700 sticky left-0 bg-white">
                  {fmtMonth(row.month)}
                </td>
                {COL.map(c => {
                  const val = row[c.key] || 0
                  const display = c.fmt ? c.fmt(val) : fmt(val)
                  let color = c.color
                  if (c.key === 'прибыльДня') color = val >= 0 ? 'text-green-700' : 'text-red-500'
                  if (c.key === 'маржа')      color = val >= 0 ? 'text-green-600' : 'text-red-500'
                  return (
                    <td key={c.key} className={`px-3 py-2.5 text-right font-medium ${color}`}>
                      {display}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          {/* Итого */}
          {data.length > 1 && (
            <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-bold text-xs">
              <tr>
                <td className="px-4 py-3 text-gray-700 sticky left-0 bg-gray-50">Итого</td>
                {COL.map(c => {
                  const total = data.reduce((s, r) => s + (r[c.key] || 0), 0)
                  const display = c.fmt ? c.fmt(total) : fmt(total)
                  return (
                    <td key={c.key} className={`px-3 py-3 text-right ${c.color}`}>
                      {c.key === 'средний_чек'
                        ? fmt(Math.round(data.reduce((s,r)=>s+(r.реализация||0),0) / Math.max(data.reduce((s,r)=>s+(r.кол_продаж||0),0),1)))
                        : display}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* % маржи по месяцам */}
      <div className="grid grid-cols-4 gap-3 mt-2">
        {data.slice(0, 4).map(row => (
          <div key={row.month} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{fmtMonth(row.month)}</p>
            <p className={`text-2xl font-bold mt-1 ${(row.прибыльДня||0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {fmt(row.прибыльДня)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              маржа {pct(row.маржа, row.реализация)} · {row.дней} дн.
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
