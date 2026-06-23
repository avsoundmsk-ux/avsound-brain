import { useState } from 'react'
import DropZone from './components/DropZone.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import ChannelBreakdown from './components/ChannelBreakdown.jsx'
import SalesTable from './components/SalesTable.jsx'
import WorkSection from './components/WorkSection.jsx'
import ExpensesSection from './components/ExpensesSection.jsx'
import { parseFile } from './utils/parseSales.js'

const SLOTS = [
  { key: 'продажи',  label: 'Продажи.xlsx' },
  { key: 'работа',   label: 'Работа.xlsx' },
  { key: 'расходы',  label: 'Расходы.xlsx' },
  { key: 'зарплата', label: 'Зарплата.xlsx' },
  { key: 'закупка',  label: 'Закупка.xlsx' },
]

export default function App() {
  const [data, setData] = useState({})
  const [error, setError] = useState(null)

  async function handleFile(file) {
    try {
      setError(null)
      const result = await parseFile(file)
      if (result.type === 'unknown') {
        setError('Неизвестный тип файла: ' + file.name)
        return
      }
      setData(prev => ({ ...prev, [result.type]: result.items }))
    } catch (e) {
      setError('Ошибка парсинга: ' + e.message)
    }
  }

  const hasAny = Object.keys(data).length > 0
  const g = key => data[key] || []

  function reset() { setData({}); setError(null) }

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">AVSound — Учёт дня</h1>

      <div className="grid grid-cols-5 gap-3 mb-6">
        {SLOTS.map(s => (
          <DropZone key={s.key} label={s.label} onFile={handleFile} loaded={!!data[s.key]} />
        ))}
      </div>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      {hasAny && (
        <>
          <SummaryCards
            salesItems={g('продажи')}
            workItems={g('работа')}
            expenseItems={g('расходы')}
            salaryItems={g('зарплата')}
            stockItems={g('закупка')}
          />
          {data.работа   && <WorkSection items={g('работа')} />}
          {data.расходы  && <ExpensesSection items={g('расходы')} title="Расходы" color="red" />}
          {data.зарплата && <ExpensesSection items={g('зарплата')} title="Зарплата" color="orange" />}
          {data.закупка  && <ExpensesSection items={g('закупка')} title="Закупка оборудования" color="purple" />}
          {data.продажи  && <ChannelBreakdown items={g('продажи')} />}
          {data.продажи  && <SalesTable items={g('продажи')} />}
          <button onClick={reset} className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline">
            Сбросить
          </button>
        </>
      )}
    </div>
  )
}
