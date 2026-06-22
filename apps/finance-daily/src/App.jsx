import { useState } from 'react'
import DropZone from './components/DropZone.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import ChannelBreakdown from './components/ChannelBreakdown.jsx'
import SalesTable from './components/SalesTable.jsx'
import { parseSalesFile } from './utils/parseSales.js'

export default function App() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  async function handleFile(file) {
    try {
      setError(null)
      const parsed = await parseSalesFile(file)
      setItems(parsed)
    } catch (e) {
      setError('Ошибка парсинга файла: ' + e.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">AVSound — Учёт дня</h1>
      {!items && <DropZone onFile={handleFile} />}
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {items && (
        <>
          <SummaryCards items={items} />
          <ChannelBreakdown items={items} />
          <SalesTable items={items} />
          <button
            onClick={() => { setItems(null); setError(null) }}
            className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Загрузить другой файл
          </button>
        </>
      )}
    </div>
  )
}