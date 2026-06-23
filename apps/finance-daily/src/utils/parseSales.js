import * as XLSX from 'xlsx'

function parseDate(rawDate) {
  if (rawDate instanceof Date) {
    const d = rawDate
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
  }
  if (typeof rawDate === 'number') {
    const d = new Date(new Date(1899, 11, 30).getTime() + rawDate * 86400000)
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
  }
  return String(rawDate || '').trim()
}

function parseAmount(raw) {
  return parseFloat(String(raw || '0').replace(/\s/g, '').replace(',', '.')) || 0
}

// Returns { type: 'продажи'|'работа'|'расходы'|'unknown', items }
export async function parseFile(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const title = String(rows[0]?.[0] || '').toLowerCase()
  const dataRows = rows.slice(2).filter(r => r[2] !== '')

  const simpleItems = () => dataRows.map(r => ({
    date: parseDate(r[0]),
    comment: String(r[7] || '').trim(),
    сумма: parseAmount(r[2]),
  }))

  if (title.includes('установка')) return { type: 'работа', items: simpleItems() }

  if (title.includes('рабочие покупки') || title.includes('зарплата') || title.includes('закупка')) {
    return { type: 'расходы', items: simpleItems() }
  }

  if (title.includes('продажи')) {
    return {
      type: 'продажи',
      items: dataRows.map(r => {
        const реализация = parseAmount(r[2])
        const tags = String(r[6] || '').trim()
        const comment = String(r[7] || '').trim()
        const bracketMatch = comment.match(/\((\d[\d\s]*)\)\s*$/)
        const закупка = bracketMatch ? parseFloat(bracketMatch[1].replace(/\s/g, '')) || 0 : 0
        const name = comment.replace(/\s*\(\d[\d\s]*\)\s*$/, '').trim()
        const channel = tags.toLowerCase().includes('авито') ? 'Авито' : 'Прямые'
        return { date: parseDate(r[0]), name, channel, реализация, закупка, маржа: реализация - закупка }
      })
    }
  }

  return { type: 'unknown', items: [] }
}
