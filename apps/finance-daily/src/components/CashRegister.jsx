import { useState } from 'react'

function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function NumInput({ label, value, onChange, color }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <label className={`text-sm ${color || 'text-gray-700'}`}>{label}</label>
      <input
        type="number"
        value={value || ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        placeholder="0"
        className="w-36 text-right border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
      />
    </div>
  )
}

const CASH_FIELDS = [
  { key: 'наличные',  label: 'Наличные' },
  { key: 'тБизнес',  label: 'Т-Бизнес' },
  { key: 'тинькофф', label: 'Тинькофф' },
  { key: 'тБизнес2', label: 'Т-Бизнес 2' },
  { key: 'тЯндекс',  label: 'Т-Яндекс' },
  { key: 'другое',   label: 'Другое' },
]

export default function CashRegister({ totals }) {
  const { реализация = 0, работа = 0, расходы = 0, зарплата = 0, закупка = 0 } = totals

  const [cash, setCash] = useState({})
  const [остатокВчера, setОстатокВчера] = useState(0)
  const [приходОзон, setПриходОзон] = useState(0)
  const [приходЯндекс, setПриходЯндекс] = useState(0)

  const set = key => val => setCash(p => ({ ...p, [key]: val }))

  const итогоВКассе = CASH_FIELDS.reduce((s, f) => s + (cash[f.key] || 0), 0)

  const аренда = 5000
  const расчётный = остатокВчера + реализация + работа + приходОзон + приходЯндекс
                  - расходы - зарплата - закупка - аренда
  const расхождение = итогоВКассе - расчётный
  const сходится = Math.abs(расхождение) < 1

  const Row = ({ label, value, sign, color }) => (
    <div className={`flex justify-between py-1.5 text-sm ${color || 'text-gray-700'}`}>
      <span>{sign && <span className="text-gray-400 mr-1">{sign}</span>}{label}</span>
      <span className="font-medium">{fmt(value)}</span>
    </div>
  )

  return (
    <div className="grid grid-cols-2 gap-6">

      {/* Левая: суммы в кассе */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Суммы в кассе на вечер
        </h2>
        {CASH_FIELDS.map(f => (
          <NumInput key={f.key} label={f.label} value={cash[f.key]} onChange={set(f.key)} />
        ))}
        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
          <span className="font-semibold text-gray-700">Итого в кассе</span>
          <span className="text-xl font-bold text-gray-900">{fmt(итогоВКассе)}</span>
        </div>
      </div>

      {/* Правая: сверка */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Сверка кассы
        </h2>

        <NumInput label="Остаток на начало дня" value={остатокВчера} onChange={setОстатокВчера} />
        <NumInput label="Приход Озон" value={приходОзон} onChange={setПриходОзон} />
        <NumInput label="Приход Яндекс" value={приходЯндекс} onChange={setПриходЯндекс} />

        <div className="mt-4 space-y-0.5 border-t border-gray-100 pt-3">
          <Row label="Остаток вчера" value={остатокВчера} sign="+" color="text-gray-500" />
          <Row label="Реализация" value={реализация} sign="+" color="text-green-600" />
          <Row label="Работа студии" value={работа} sign="+" color="text-blue-600" />
          <Row label="Приход Озон" value={приходОзон} sign="+" color="text-green-600" />
          <Row label="Приход Яндекс" value={приходЯндекс} sign="+" color="text-green-600" />
          <Row label="Расходы" value={расходы} sign="−" color="text-red-500" />
          <Row label="Зарплата" value={зарплата} sign="−" color="text-orange-500" />
          <Row label="Закупка" value={закупка} sign="−" color="text-purple-600" />
          <Row label="Аренда (авто)" value={аренда} sign="−" color="text-gray-400" />
        </div>

        <div className="mt-3 pt-3 border-t-2 border-gray-200 flex justify-between items-center">
          <span className="font-semibold text-gray-700">Расчётный остаток</span>
          <span className="text-xl font-bold text-gray-900">{fmt(расчётный)}</span>
        </div>

        {/* Результат сверки */}
        <div className={`mt-4 rounded-lg p-4 text-center ${сходится ? 'bg-green-50' : 'bg-red-50'}`}>
          {сходится ? (
            <p className="text-green-700 font-semibold text-lg">✓ Касса сходится</p>
          ) : (
            <>
              <p className="text-red-600 font-semibold text-lg">✗ Расхождение</p>
              <p className="text-red-500 text-sm mt-1">
                {расхождение > 0 ? '+' : ''}{fmt(расхождение)}
                {расхождение > 0 ? ' — в кассе больше расчётного' : ' — в кассе меньше расчётного'}
              </p>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
