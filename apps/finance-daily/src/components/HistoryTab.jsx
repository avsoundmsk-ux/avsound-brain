import { useState, useEffect } from 'react'
import { getHistory, getDay, deleteDay } from '../utils/localHistory.js'

function fmt(n) {
  return (n || 0).toLocaleString('ru-RU') + ' ₽'
}

function DayDetail({ entry }) {
  const p = entry.payload
  const s = p.summary || {}
  const sales = p.продажи || []
  const work = p.работа || []
  const expenses = p.расходы || []
  const salary = p.зарплата || []
  const purchases = p.закупка || []
  const k = p.касса || {}

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      {/* Итоги — полная цепочка */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: 'Реализация',      value: s.реализация,      color: 'text-gray-900' },
          { label: 'Себестоимость',   value: s.себестоимость,   color: 'text-gray-500' },
          { label: 'Маржа продаж',    value: s.маржа,            color: (s.маржа||0) >= 0 ? 'text-green-600' : 'text-red-500' },
          { label: 'Работа студии',   value: s.работа,           color: 'text-blue-600' },
        ].map(c => (
          <div key={c.label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${c.color}`}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Валовая прибыль', value: s.валоваяПрибыль ?? ((s.маржа||0)+(s.работа||0)), color: 'text-green-700' },
          { label: 'Расходы',         value: s.расходы,          color: 'text-red-500' },
          { label: 'Зарплата',        value: s.зарплата,         color: 'text-orange-500' },
          { label: 'Аренда',          value: s.аренда ?? 5000,   color: 'text-gray-400' },
          { label: 'Прибыль дня',     value: s.прибыльДня,       color: (s.прибыльДня||0) >= 0 ? 'text-green-700' : 'text-red-500' },
        ].map(c => (
          <div key={c.label} className={`rounded-lg p-3 ${c.label === 'Прибыль дня' ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <p className={`text-xs uppercase tracking-wide ${c.label === 'Прибыль дня' ? 'text-gray-400' : 'text-gray-500'}`}>{c.label}</p>
            <p className={`text-base font-bold mt-0.5 ${c.color}`}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Итого в кассе</p>
          <p className="text-lg font-bold">{fmt(k.итогоВКассе)}</p>
        </div>
        <div className={`rounded-lg p-3 ${Math.abs(k.расхождение||0) < 1 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Расхождение</p>
          <p className={`text-lg font-bold ${Math.abs(k.расхождение||0) < 1 ? 'text-green-600' : 'text-red-500'}`}>
            {Math.abs(k.расхождение||0) < 1 ? '✓ Касса сходится' : fmt(k.расхождение)}
          </p>
        </div>
      </div>
      {/* Продажи */}
      {sales.length > 0 && (
        <Section title="Продажи">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Товар</th>
                <th className="px-3 py-2 text-left">Канал</th>
                <th className="px-3 py-2 text-right">Реализация</th>
                <th className="px-3 py-2 text-right">Закупка</th>
                <th className="px-3 py-2 text-right">Маржа</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sales.map((i, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-1.5 text-gray-800">{i.name}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      i.channel === 'Авито' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>{i.channel}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmt(i.реализация)}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500">{fmt(i.закупка)}</td>
                  <td className={`px-3 py-1.5 text-right font-medium ${i.маржа >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(i.маржа)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Работа, Расходы, Зарплата, Закупка */}
      <div className="grid grid-cols-2 gap-4">
        {work.length > 0 && (
          <SimpleList title="Работа студии" items={work} color="text-blue-600" />
        )}
        {expenses.length > 0 && (
          <SimpleList title="Расходы" items={expenses} color="text-red-500" />
        )}
        {salary.length > 0 && (
          <SimpleList title="Зарплата" items={salary} color="text-orange-500" />
        )}
        {purchases.length > 0 && (
          <SimpleList title="Закупка" items={purchases} color="text-purple-600" />
        )}
      </div>

      {/* Детализация кассы по счетам */}
      {(k.наличные || k.тБизнес || k.тинькофф || k.тБизнес2 || k.тЯндекс || k.другое) > 0 && (
        <Section title="Касса по счетам">
          <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
            {[
              ['Наличные', k.наличные],
              ['Т-Бизнес', k.тБизнес],
              ['Тинькофф', k.тинькофф],
              ['Т-Бизнес 2', k.тБизнес2],
              ['Т-Яндекс', k.тЯндекс],
              ['Другое', k.другое],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium">{fmt(val)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function SimpleList({ title, items, color }) {
  const total = items.reduce((s, i) => s + (i.сумма || 0), 0)
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        <span className={`text-sm font-bold ${color}`}>{fmt(total)}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {items.map((i, idx) => (
          <div key={idx} className="px-4 py-2 flex justify-between text-sm">
            <span className="text-gray-600 truncate mr-2">{i.comment || '—'}</span>
            <span className={`font-medium shrink-0 ${color}`}>{fmt(i.сумма)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HistoryTab() {
  const [history, setHistory] = useState([])
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  function handleDelete(dayId, e) {
    e.stopPropagation()
    if (!confirm(`Удалить запись за ${dayId} из истории?`)) return
    deleteDay(dayId)
    setHistory(getHistory())
    if (openId === dayId) setOpenId(null)
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-3">📂</p>
        <p className="text-lg font-medium">История пуста</p>
        <p className="text-sm mt-1">Сохрани отчёт за день — он появится здесь</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        История — {history.length} {history.length === 1 ? 'день' : history.length < 5 ? 'дня' : 'дней'}
      </h2>

      {history.map(entry => {
        const s = entry.payload?.summary || {}
        const isOpen = openId === entry.dayId
        return (
          <div
            key={entry.dayId}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* Строка дня */}
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setOpenId(isOpen ? null : entry.dayId)}
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-gray-700 w-24">{entry.дата}</span>
                <div className="flex gap-6 text-sm">
                  <span className="text-gray-500">Реализация: <b className="text-gray-800">{fmt(s.реализация)}</b></span>
                  <span className="text-gray-500">Маржа: <b className={(s.маржа||0) >= 0 ? 'text-green-600' : 'text-red-500'}>{fmt(s.маржа)}</b></span>
                  <span className="text-gray-500">Работа: <b className="text-blue-600">{fmt(s.работа)}</b></span>
                  <span className="text-gray-500">Прибыль дня: <b className={(s.прибыльДня||0) >= 0 ? 'text-green-700' : 'text-red-500'}>{fmt(s.прибыльДня)}</b></span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-300">
                  {new Date(entry.savedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={e => handleDelete(entry.dayId, e)}
                  className="text-gray-300 hover:text-red-400 text-lg transition-colors"
                  title="Удалить из истории"
                >
                  ×
                </button>
                <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Детализация */}
            {isOpen && (
              <div className="px-5 pb-5">
                <DayDetail entry={entry} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
