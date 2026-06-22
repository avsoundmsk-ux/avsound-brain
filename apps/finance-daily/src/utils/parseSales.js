import * as XLSX from 'xlsx'

/**
 * Parse "Продажи" xlsx file exported from the accounting app.
 * Row 0: title  ("Список доходов по категории "Продажи"")
 * Row 1: headers (Дата | Счет | Сумма | Валюта | ... | Теги | Комментарий)
 * Row 2+: data
 *
 * Comment format: "Товар Название (7519)" — purchase price in last brackets.
 */
export async function parseSalesFile(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // header:1 → raw arrays; defval:'' prevents undefined cells
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // Skip title row (0) and header row (1)
  const dataRows = rows.slice(2).filter(r => r[2] !== '')

  return dataRows.map(r => {
    const rawDate = r[0]
    let date = ''
    if (rawDate instanceof Date) {
      const d = rawDate
      date = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
    } else if (typeof rawDate === 'number') {
      // Excel serial date: days since 1900-01-01 (with Lotus bug: +1900-01-00 offset)
      const excelEpoch = new Date(1899, 11, 30)
      const d = new Date(excelEpoch.getTime() + rawDate * 86400000)
      date = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
    } else {
      date = String(rawDate || '').trim()
    }
    const rawAmount = String(r[2] || '0').replace(/\s/g, '').replace(',', '.')
    const реализация = parseFloat(rawAmount) || 0
    const tags = String(r[6] || '').trim()
    const comment = String(r[7] || '').trim()

    // Extract cost from last bracket group: "Товар (7 519)" or "Товар (7519)"
    const bracketMatch = comment.match(/\((\d[\d\s]*)\)\s*$/)
    const закупка = bracketMatch
      ? parseFloat(bracketMatch[1].replace(/\s/g, '')) || 0
      : 0

    // Name = comment text before the last bracket group
    const name = comment.replace(/\s*\(\d[\d\s]*\)\s*$/, '').trim()

    const channel = tags.toLowerCase().includes('авито') ? 'Авито' : 'Прямые'

    return {
      date,
      name,
      channel,
      реализация,
      закупка,
      маржа: реализация - закупка,
    }
  })
}
