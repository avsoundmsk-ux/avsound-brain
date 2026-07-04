import { useState } from 'react'
import { saveDay } from '../utils/dataService.js'

function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function NumInput({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <label className="text-sm text-gray-700">{label}</label>
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

export default function CashRegister({
  totals, salesItems = [], workItems = [], expenseItems = [], salaryItems = [], stockItems = [], returnItems = [],
  cashDraft = {}, onUpdateCash, onClearCash,
  rentDays = 1, periodFrom = null, periodTo = null,
}) {
  const { реализация = 0, работа = 0, расходы = 0, зарплата = 0, закупка = 0, возвраты = 0, себестоимость = 0 } = totals

  const [saveStatus, setSaveStatus] = useState(null)
  const [pendingPayload, setPendingPayload] = useState(null)

  const today = new Date()
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  // These auxiliary fields also live in cashDraft so they survive tab switches
  const остатокВчера = cashDraft.остатокВчера || 0
  const приходОзон   = cashDraft.приходОзон   || 0
  const приходЯндекс = cashDraft.приходЯндекс || 0
  const вычет        = cashDraft.вычет        || 0
  const selectedDate = cashDraft.selectedDate || defaultDate

  const cash = cashDraft.cash || {}

  function setCashField(key, val) { onUpdateCash('cash', { ...cash, [key]: val }) }
  function setAux(key, val)       { onUpdateCash(key, val) }

  const итогоВКассе = CASH_FIELDS.reduce((s, f) => s + (cash[f.key] || 0), 0)

  // Аренда / гаражи — берём из файла Расходы, вычитаем ТОЛЬКО из кассы, не из зарплаты дня
  const isПомещение = c => /аренд|гараж/i.test(c || '')
  const аренда = expenseItems.filter(i => isПомещение(i.comment)).reduce((s, i) => s + i.сумма, 0)
  const расходыОпер = расходы - аренда

  // Расчётный остаток — движение кассы (включает всё: зарплату, закупку, возвраты, вычет, аренду)
  const расчётный = остатокВчера + реализация + работа + приходОзон + приходЯндекс
                  - расходы - зарплата - закупка - возвраты - вычет
  const расхождение = итогоВКассе - расчётный
  const сходится = Math.abs(расхождение) < 1

  const маржа = реализация - себестоимость
  const pct = реализация ? Math.round((маржа / реализация) * 100) : 0
  const валоваяПрибыль = маржа + работа
  // Зарплата дня = маржа + работа - операционные расходы - вычет (аренда/гараж, закупка, возвраты = только касса)
  const зарплатаДня = валоваяПрибыль - расходыОпер - вычет

  function buildPayload() {
    const [y, m, d] = selectedDate.split('-')
    const дата = `${d}.${m}.${y}`
    return {
      дата,
      summary: {
        реализация, себестоимость, маржа, pct,
        работа, валоваяПрибыль, расходы, зарплата, закупка, возвраты, вычет, аренда,
        прибыльДня: зарплатаДня,
      },
      продажи: salesItems.map(i => ({ name: i.name, channel: i.channel, реализация: i.реализация, закупка: i.закупка, маржа: i.маржа })),
      работа:  workItems.map(i => ({ comment: i.comment, сумма: i.сумма })),
      расходы: expenseItems.map(i => ({ comment: i.comment, сумма: i.сумма })),
      зарплата: salaryItems.map(i => ({ comment: i.comment, сумма: i.сумма })),
      закупка:  stockItems.map(i => ({ comment: i.comment, сумма: i.сумма })),
      возвраты: returnItems.map(i => ({ comment: i.comment, сумма: i.сумма })),
      касса: {
        наличные: cash.наличные || 0, тБизнес: cash.тБизнес || 0,
        тинькофф: cash.тинькофф || 0, тБизнес2: cash.тБизнес2 || 0,
        тЯндекс:  cash.тЯндекс  || 0, другое:   cash.другое   || 0,
        итогоВКассе, остатокВчера, приходОзон, приходЯндекс, расчётный, расхождение,
      },
    }
  }

  async function saveToSheets(force = false) {
    setSaveStatus('saving')
    const payload = pendingPayload || buildPayload()
    try {
      const result = await saveDay(payload, force)
      if (result.existed && !force) {
        setPendingPayload(payload)
        setSaveStatus('confirm')
        return
      }
      setPendingPayload(null)
      setSaveStatus('ok')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch {
      setSaveStatus('error')
    }
  }

  const Row = ({ label, value, sign, color }) => (
    <div className={`flex justify-between py-1.5 text-sm ${color || 'text-gray-700'}`}>
      <span>{sign && <span className="text-gray-400 mr-1">{sign}</span>}{label}</span>
      <span className="font-medium">{fmt(value)}</span>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Период отчёта — аренда считается за все дни периода */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-end gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Период с</label>
          <input type="date" value={periodFrom || ''}
            onChange={e => setAux('periodFrom', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 uppercase tracking-wide">по</label>
          <input type="date" value={periodTo || ''}
            onChange={e => setAux('periodTo', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div className="pb-2 text-sm text-gray-600">
          <b>{rentDays}</b> {rentDays === 1 ? 'день' : rentDays < 5 ? 'дня' : 'дней'} · аренда <b>{fmt(аренда)}</b>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Левая: суммы в кассе */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Суммы в кассе на вечер
          </h2>
          {CASH_FIELDS.map(f => (
            <NumInput key={f.key} label={f.label} value={cash[f.key]} onChange={v => setCashField(f.key, v)} />
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
          <NumInput label="Остаток на начало дня" value={остатокВчера} onChange={v => setAux('остатокВчера', v)} />
          <NumInput label="Приход Озон"            value={приходОзон}   onChange={v => setAux('приходОзон', v)} />
          <NumInput label="Приход Яндекс"          value={приходЯндекс} onChange={v => setAux('приходЯндекс', v)} />
          <NumInput label="Вычет (минус из зарплаты и кассы)" value={вычет} onChange={v => setAux('вычет', v)} />

          <div className="mt-4 space-y-0.5 border-t border-gray-100 pt-3">
            <Row label="Остаток вчера"  value={остатокВчера} sign="+" color="text-gray-500" />
            <Row label="Реализация"     value={реализация}   sign="+" color="text-green-600" />
            <Row label="Работа студии"  value={работа}        sign="+" color="text-blue-600" />
            <Row label="Приход Озон"    value={приходОзон}    sign="+" color="text-green-600" />
            <Row label="Приход Яндекс" value={приходЯндекс}  sign="+" color="text-green-600" />
            <Row label="Расходы (опер.)" value={расходыОпер}  sign="−" color="text-red-500" />
            {аренда > 0 && <Row label="Аренда / гаражи" value={аренда} sign="−" color="text-gray-400" />}
            <Row label="Зарплата выпл." value={зарплата}      sign="−" color="text-orange-500" />
            <Row label="Закупка склад"  value={закупка}       sign="−" color="text-purple-600" />
            {возвраты > 0 && <Row label="Возвраты" value={возвраты} sign="−" color="text-purple-600" />}
            {вычет > 0 && <Row label="Вычет" value={вычет} sign="−" color="text-red-500" />}
          </div>

          <div className="mt-3 pt-3 border-t-2 border-gray-200 flex justify-between items-center">
            <span className="font-semibold text-gray-700">Расчётный остаток</span>
            <span className="text-xl font-bold text-gray-900">{fmt(расчётный)}</span>
          </div>

          <div className={`mt-4 rounded-lg p-4 text-center ${сходится ? 'bg-green-50' : 'bg-red-50'}`}>
            {сходится ? (
              <p className="text-green-700 font-semibold text-lg">✓ Касса сходится</p>
            ) : (
              <>
                <p className="text-red-600 font-semibold text-lg">✗ Расхождение</p>
                <p className="text-red-500 text-sm mt-1">
                  {расхождение > 0 ? '+' : ''}{fmt(расхождение)}
                  {расхождение > 0 ? ' — в кассе больше' : ' — в кассе меньше'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Дата + кнопки */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Дата отчёта</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setAux('selectedDate', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>

        {saveStatus !== 'confirm' && (
          <button
            onClick={() => saveToSheets(false)}
            disabled={saveStatus === 'saving'}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors"
          >
            {saveStatus === 'saving' ? 'Сохраняю...' : 'Сохранить в Google Sheets'}
          </button>
        )}

        <button
          onClick={onClearCash}
          className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-xl transition-colors text-sm"
        >
          Очистить
        </button>

        {saveStatus === 'ok'    && <span className="text-green-600 font-medium">✓ Сохранено</span>}
        {saveStatus === 'error' && <span className="text-red-500">Ошибка соединения с Sheets</span>}

        {saveStatus === 'confirm' && (
          <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3">
            <span className="text-yellow-800 text-sm font-medium">
              ⚠️ Этот день уже сохранён. Перезаписать?
            </span>
            <button onClick={() => saveToSheets(true)}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold rounded-lg">
              Перезаписать
            </button>
            <button onClick={() => { setSaveStatus(null); setPendingPayload(null) }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold rounded-lg">
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
