import { useState } from 'react'
import DropZone from './components/DropZone.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import ChannelBreakdown from './components/ChannelBreakdown.jsx'
import SalesTable from './components/SalesTable.jsx'
import WorkSection from './components/WorkSection.jsx'
import ExpensesSection from './components/ExpensesSection.jsx'
import CashRegister from './components/CashRegister.jsx'
import HistoryTab from './components/HistoryTab.jsx'
import DashboardTab from './components/DashboardTab.jsx'
import MonthlyTab from './components/MonthlyTab.jsx'
import ChartsTab from './components/ChartsTab.jsx'
import { parseFile } from './utils/parseSales.js'
import { syncFromSheets } from './utils/dataService.js'

const SLOTS = [
  { key: 'продажи',  label: 'Продажи.xlsx' },
  { key: 'работа',   label: 'Работа.xlsx' },
  { key: 'расходы',  label: 'Расходы.xlsx' },
  { key: 'зарплата', label: 'Зарплата.xlsx' },
  { key: 'закупка',  label: 'Закупка.xlsx' },
]

const DRAFT_KEY = 'avsound_cash_draft'

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') } catch { return {} }
}

function saveDraft(draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export default function App() {
  const [data, setData]   = useState({})
  const [error, setError] = useState(null)
  const [tab, setTab]     = useState('отчёт')

  // Касса — единое состояние, живёт здесь, не сбрасывается при смене вкладки
  const [cashDraft, setCashDraft] = useState(loadDraft)

  function updateCash(key, value) {
    const next = { ...cashDraft, [key]: value }
    setCashDraft(next)
    saveDraft(next)
  }

  function clearCash() {
    setCashDraft({})
    localStorage.removeItem(DRAFT_KEY)
  }

  async function handleFile(file) {
    try {
      setError(null)
      const result = await parseFile(file)
      if (result.type === 'unknown') { setError('Неизвестный тип: ' + file.name); return }
      setData(prev => ({ ...prev, [result.type]: result.items }))
    } catch (e) {
      setError('Ошибка: ' + e.message)
    }
  }

  const hasAny = Object.keys(data).length > 0
  const g = key => data[key] || []

  const totals = {
    реализация:    g('продажи').reduce((s, i) => s + i.реализация, 0),
    себестоимость: g('продажи').reduce((s, i) => s + i.закупка, 0),
    работа:        g('работа').reduce((s, i) => s + i.сумма, 0),
    расходы:       g('расходы').reduce((s, i) => s + i.сумма, 0),
    зарплата:      g('зарплата').reduce((s, i) => s + i.сумма, 0),
    закупка:       g('закупка').reduce((s, i) => s + i.сумма, 0),
  }

  // Период отчёта: авто из дат в файлах, можно переопределить в кассе
  const allDates = Object.values(data).flat()
    .map(i => i.date)
    .filter(d => /^\d{2}\.\d{2}\.\d{4}$/.test(d || ''))
    .map(d => { const [dd, mm, yy] = d.split('.'); return `${yy}-${mm}-${dd}` })
    .sort()
  const periodFrom = cashDraft.periodFrom || allDates[0] || null
  const periodTo   = cashDraft.periodTo   || allDates[allDates.length - 1] || null
  let rentDays = 1
  if (periodFrom && periodTo) {
    rentDays = Math.max(1, Math.round((new Date(periodTo) - new Date(periodFrom)) / 86400000) + 1)
  }

  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const { synced } = await syncFromSheets()
      setSyncMsg(synced > 0 ? `✓ Загружено ${synced} дн.` : '✓ Всё актуально')
    } catch {
      setSyncMsg('Ошибка соединения')
    }
    setSyncing(false)
    setTimeout(() => setSyncMsg(null), 4000)
  }

  function reset() { setData({}); setError(null); setTab('отчёт') }

  const tabs = [
    { key: 'отчёт',   label: 'Отчёт' },
    { key: 'касса',   label: 'Касса' },
    { key: 'дашборд', label: 'Дашборд' },
    { key: 'история', label: 'История' },
    { key: 'месяц',   label: 'Месяц' },
    { key: 'графики', label: 'Графики' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">AVSound — Учёт дня</h1>
        <div className="flex items-center gap-3">
          {syncMsg && <span className="text-sm text-gray-500">{syncMsg}</span>}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {syncing ? 'Синхронизация...' : '↓ Синхронизировать из Sheets'}
          </button>
        </div>
      </div>

      {/* Слоты загрузки */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {SLOTS.map(s => (
          <DropZone key={s.key} label={s.label} onFile={handleFile} loaded={!!data[s.key]} />
        ))}
      </div>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      {/* Вкладки */}
      <div className="flex gap-1 mb-6 bg-gray-200 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Отчёт */}
      {tab === 'отчёт' && hasAny && (
        <>
          <SummaryCards
            salesItems={g('продажи')}
            workItems={g('работа')}
            expenseItems={g('расходы')}
            salaryItems={g('зарплата')}
            stockItems={g('закупка')}
            rentDays={rentDays}
          />
          {data.работа   && <WorkSection items={g('работа')} />}
          {data.расходы  && <ExpensesSection items={g('расходы')} title="Расходы" color="red" />}
          {data.зарплата && <ExpensesSection items={g('зарплата')} title="Зарплата (выплачено из кассы)" color="orange" />}
          {data.закупка  && <ExpensesSection items={g('закупка')} title="Закупка (движение кассы)" color="purple" />}
          {data.продажи  && <ChannelBreakdown items={g('продажи')} />}
          {data.продажи  && <SalesTable items={g('продажи')} />}
        </>
      )}

      {/* Касса — ВСЕГДА монтирована, только скрыта когда не активна */}
      <div className={tab === 'касса' ? '' : 'hidden'}>
        <CashRegister
          totals={totals}
          salesItems={g('продажи')}
          workItems={g('работа')}
          expenseItems={g('расходы')}
          salaryItems={g('зарплата')}
          stockItems={g('закупка')}
          cashDraft={cashDraft}
          onUpdateCash={updateCash}
          onClearCash={clearCash}
        />
      </div>

      {tab === 'дашборд' && <DashboardTab />}
      {tab === 'история' && <HistoryTab />}
      {tab === 'месяц'   && <MonthlyTab />}
      {tab === 'графики' && <ChartsTab />}

      {hasAny && (
        <button onClick={reset} className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline">
          Сбросить файлы
        </button>
      )}
    </div>
  )
}
