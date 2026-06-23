import { useState } from 'react'
import DropZone from './components/DropZone.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import ChannelBreakdown from './components/ChannelBreakdown.jsx'
import SalesTable from './components/SalesTable.jsx'
import WorkSection from './components/WorkSection.jsx'
import ExpensesSection from './components/ExpensesSection.jsx'
import { parseFile } from './utils/parseSales.js'

export default function App() {
  const [salesItems, setSalesItems] = useState(null)
  const [workItems, setWorkItems] = useState(null)
  const [expenseItems, setExpenseItems] = useState(null)
  const [error, setError] = useState(null)

  async function handleFile(file) {
    try {
      setError(null)
      const result = await parseFile(file)
      if (result.type === 'продажи') setSalesItems(result.items)
      else if (result.type === 'работа') setWorkItems(result.items)
      else if (result.type === 'расходы') setExpenseItems(prev =>
        prev ? [...prev, ...result.items] : result.items
      )
      else setError('Неизвестный тип файла: ' + String(file.name))
    } catch (e) {
      setError('Ошибка парсинга: ' + e.message)
    }
  }

  const hasAny = salesItems || workItems || expenseItems
  const s = salesItems || []
  const w = workItems || []
  const e = expenseItems || []

  function reset() { setSalesItems(null); setWorkItems(null); setExpenseItems(null); setError(null) }

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">AVSound — Учёт дня</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <DropZone label="Продажи.xlsx" onFile={handleFile} loaded={!!salesItems} />
        <DropZone label="Работа.xlsx" onFile={handleFile} loaded={!!workItems} />
        <DropZone label="Расходы.xlsx" onFile={handleFile} loaded={!!expenseItems} />
      </div>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      {hasAny && (
        <>
          <SummaryCards salesItems={s} workItems={w} expenseItems={e} />
          {workItems && <WorkSection items={w} />}
          {expenseItems && <ExpensesSection items={e} />}
          {salesItems && <ChannelBreakdown items={s} />}
          {salesItems && <SalesTable items={s} />}
          <button onClick={reset} className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline">
            Сбросить
          </button>
        </>
      )}
    </div>
  )
}
