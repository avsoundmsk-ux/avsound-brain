// AVSound Finance — Google Apps Script v2
// Этап 1: полная структура листов, проверка дублей, история
//
// КАК УСТАНОВИТЬ:
// 1. Открой script.google.com → найди скрипт таблицы
// 2. Вставь весь этот код вместо старого
// 3. Нажми "Выполнить" → setupSheets() — создаст все листы с заголовками
// 4. Развернуть → Управление развёртываниями → ⚙️ → Изменить → Новая версия → Сохранить
// 5. Скопируй новый URL развёртывания в sheetsApi.js

const SPREADSHEET_NAME = 'AVSound Finance'

const SHEET = {
  DAILY:     'daily_summary',
  SALES:     'sales',
  WORK:      'studio_work',
  EXPENSES:  'expenses',
  SALARY:    'salary',
  PURCHASES: 'purchases',
  CASHBOX:   'cashbox',
  MONTHLY:   'monthly_report',
  SETTINGS:  'settings',
}

const HEADERS = {
  daily_summary: [
    'day_id','дата','реализация','себестоимость','маржа','%маржи',
    'работа','расходы','зарплата','закупка','аренда','прибыль_дня',
    'остаток_вчера','приход_озон','приход_яндекс','расчётный','итого_касса','расхождение',
  ],
  sales: [
    'record_id','day_id','дата','товар','канал',
    'реализация','закупка','маржа','%маржи',
  ],
  studio_work:  ['record_id','day_id','дата','описание','сумма'],
  expenses:     ['record_id','day_id','дата','описание','сумма'],
  salary:       ['record_id','day_id','дата','описание','сумма'],
  purchases:    ['record_id','day_id','дата','описание','сумма'],
  cashbox: [
    'record_id','day_id','дата',
    'наличные','тБизнес','тинькофф','тБизнес2','тЯндекс','другое',
    'итого','остаток_вчера','приход_озон','приход_яндекс','расчётный','расхождение',
  ],
}

// ---------- helpers ----------

// Получить или создать таблицу (работает в standalone-скрипте)
function ss() {
  const props = PropertiesService.getScriptProperties()
  let id = props.getProperty('SPREADSHEET_ID')
  if (id) {
    try { return SpreadsheetApp.openById(id) } catch(e) { /* удалён — пересоздадим */ }
  }
  // Создаём новую таблицу
  const spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME)
  props.setProperty('SPREADSHEET_ID', spreadsheet.getId())
  return spreadsheet
}

function getOrCreate(name) {
  return ss().getSheetByName(name) || ss().insertSheet(name)
}

// Конвертация DD.MM.YYYY → YYYY-MM-DD (day_id)
function toDayId(dateStr) {
  const [d, m, y] = String(dateStr).split('.')
  return `${y}-${m}-${d}`
}

// Найти строки по значению в колонке col (1-based) листа sheet
function findRows(sheet, col, value) {
  const data = sheet.getDataRange().getValues()
  const result = []
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col - 1]) === String(value)) result.push(i + 1) // 1-based row
  }
  return result
}

// Удалить все строки с day_id из листа (снизу вверх чтобы не сбивать индексы)
function deleteByDayId(sheet, dayId) {
  const rows = findRows(sheet, 2, dayId) // col 2 = day_id
  rows.reverse().forEach(r => sheet.deleteRow(r))
}

// ---------- setup ----------

function setupSheets() {
  const s = ss()

  // Структурные листы
  Object.entries(HEADERS).forEach(([name, headers]) => {
    const sheet = getOrCreate(name)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers)
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#1a237e').setFontColor('#ffffff').setFontWeight('bold')
      sheet.setFrozenRows(1)
    }
  })

  // monthly_report — формулы QUERY
  const monthly = getOrCreate(SHEET.MONTHLY)
  if (monthly.getLastRow() === 0) {
    // Заголовки вручную — QUERY с LABEL и кириллицей даёт #VALUE в некоторых локалях
    monthly.appendRow(['месяц','реализация','себестоимость','маржа','%маржи','работа','расходы','зарплата','закупка','аренда','прибыль_дня'])
    monthly.getRange(1,1,1,11).setBackground('#1a237e').setFontColor('#ffffff').setFontWeight('bold')
    monthly.setFrozenRows(1)
  }

  // settings — справочники
  const settings = getOrCreate(SHEET.SETTINGS)
  if (settings.getLastRow() === 0) {
    settings.getRange('A1:E1').setValues([['каналы_продаж','статьи_расходов','счета_кассы','сотрудники','типы_операций']])
      .setBackground('#263238').setFontColor('#ffffff').setFontWeight('bold')
    settings.getRange('A2:E6').setValues([
      ['Авито',    'Расходники',  'Наличные',   'Миша',   'Продажа'],
      ['Прямые',   'Инструмент',  'Т-Бизнес',   'Гера',   'Установка'],
      ['Озон',     'Реклама',     'Тинькофф',   'Кедий',  'Закупка'],
      ['Яндекс',   'Хоз-во',      'Т-Бизнес 2', 'Даша',   'Расход'],
      ['',         'Транспорт',   'Т-Яндекс',   'Мастер', 'Зарплата'],
    ])
    settings.setFrozenRows(1)
  }

  return 'Setup complete'
}

// ---------- doGet — история ----------

function doGet(e) {
  const action = e && e.parameter && e.parameter.action

  if (action === 'history') {
    const sheet = ss().getSheetByName(SHEET.DAILY)
    if (!sheet || sheet.getLastRow() < 2) {
      return json({ history: [] })
    }
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues()
    const history = data
      .filter(r => r[0])
      .map(r => ({ dayId: r[0], дата: r[1] }))
      .reverse()
    return json({ history })
  }

  if (action === 'day') {
    const dayId = e.parameter.dayId
    const result = {}
    const sheets = [SHEET.DAILY, SHEET.SALES, SHEET.WORK, SHEET.EXPENSES, SHEET.SALARY, SHEET.PURCHASES, SHEET.CASHBOX]
    sheets.forEach(name => {
      const sheet = ss().getSheetByName(name)
      if (!sheet) return
      const all = sheet.getDataRange().getValues()
      const headers = all[0]
      const dayCol = headers.indexOf('day_id')
      if (dayCol === -1) return
      const rows = all.slice(1).filter(r => r[dayCol] === dayId)
      result[name] = rows.map(r => {
        const obj = {}
        headers.forEach((h, i) => { obj[h] = r[i] })
        return obj
      })
    })
    return json(result)
  }

  return json({ error: 'unknown action' })
}

// ---------- doPost — сохранение ----------

function doPost(e) {
  const payload = JSON.parse(e.postData.contents)
  const { дата, forceOverwrite, summary, продажи, работа, расходы, зарплата, закупка, касса } = payload

  const dayId = toDayId(дата)
  const dailySheet = getOrCreate(SHEET.DAILY)

  // Проверка дубля
  const existingRows = findRows(dailySheet, 1, dayId)
  if (existingRows.length > 0 && !forceOverwrite) {
    return json({ existed: true, dayId })
  }

  // Если перезапись — удалить старые данные по day_id из всех листов
  if (forceOverwrite) {
    [SHEET.DAILY, SHEET.SALES, SHEET.WORK, SHEET.EXPENSES, SHEET.SALARY, SHEET.PURCHASES, SHEET.CASHBOX]
      .forEach(name => {
        const sh = getOrCreate(name)
        // daily_summary: day_id в col 1
        if (name === SHEET.DAILY) {
          findRows(sh, 1, dayId).reverse().forEach(r => sh.deleteRow(r))
        } else {
          deleteByDayId(sh, dayId)
        }
      })
  }

  const s = summary || {}
  const k = касса || {}
  const n = v => (v !== undefined && v !== null) ? v : 0

  // --- daily_summary (1 строка) ---
  dailySheet.appendRow([
    dayId, дата,
    n(s.реализация), n(s.себестоимость), n(s.маржа), n(s.pct),
    n(s.работа), n(s.расходы), n(s.зарплата), n(s.закупка), 5000, n(s.прибыльДня),
    n(k.остатокВчера), n(k.приходОзон), n(k.приходЯндекс),
    n(k.расчётный), n(k.итогоВКассе), n(k.расхождение),
  ])

  // --- sales ---
  const salesSheet = getOrCreate(SHEET.SALES)
  ;(продажи || []).forEach((item, i) => {
    const pct = item.реализация ? Math.round((item.маржа / item.реализация) * 100) : 0
    salesSheet.appendRow([
      `${dayId}_sl_${i + 1}`, dayId, дата,
      item.name, item.channel,
      n(item.реализация), n(item.закупка), n(item.маржа), pct,
    ])
  })

  // --- studio_work ---
  const workSheet = getOrCreate(SHEET.WORK)
  ;(работа || []).forEach((item, i) => {
    workSheet.appendRow([`${dayId}_wk_${i + 1}`, dayId, дата, item.comment || '', n(item.сумма)])
  })

  // --- expenses ---
  const expSheet = getOrCreate(SHEET.EXPENSES)
  ;(расходы || []).forEach((item, i) => {
    expSheet.appendRow([`${dayId}_ex_${i + 1}`, dayId, дата, item.comment || '', n(item.сумма)])
  })

  // --- salary ---
  const salSheet = getOrCreate(SHEET.SALARY)
  ;(зарплата || []).forEach((item, i) => {
    salSheet.appendRow([`${dayId}_sa_${i + 1}`, dayId, дата, item.comment || '', n(item.сумма)])
  })

  // --- purchases ---
  const purSheet = getOrCreate(SHEET.PURCHASES)
  ;(закупка || []).forEach((item, i) => {
    purSheet.appendRow([`${dayId}_pu_${i + 1}`, dayId, дата, item.comment || '', n(item.сумма)])
  })

  // --- cashbox (1 строка) ---
  const cashSheet = getOrCreate(SHEET.CASHBOX)
  cashSheet.appendRow([
    `${dayId}_cb_1`, dayId, дата,
    n(k.наличные), n(k.тБизнес), n(k.тинькофф), n(k.тБизнес2), n(k.тЯндекс), n(k.другое),
    n(k.итогоВКассе), n(k.остатокВчера), n(k.приходОзон), n(k.приходЯндекс),
    n(k.расчётный), n(k.расхождение),
  ])

  return json({ success: true, dayId, existed: false })
}

// ---------- util ----------

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}
