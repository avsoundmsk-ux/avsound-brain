/**
 * dataService — единственный источник данных для всех вкладок.
 * Google Sheets = источник правды / архив.
 * localStorage = кэш для быстрого UI.
 *
 * Структура localStorage:
 *   avsound_days   — массив {dayId, дата, savedAt, summary, продажи, работа, расходы, зарплата, закупка, касса}
 *   avsound_rent   — {начислено, оплачено, записи: [{dayId, начислено, оплачено}]}
 */

import { saveDay as sheetsSave, getHistory as sheetsHistory, getDayDetail } from './sheetsApi.js'

const KEYS = {
  DAYS: 'avsound_days',
  RENT: 'avsound_rent',
}

const RENT_PER_DAY = 5000

// ─── localStorage helpers ───────────────────────────────────────────────────

function loadDays() {
  try { return JSON.parse(localStorage.getItem(KEYS.DAYS) || '[]') } catch { return [] }
}

function saveDays(days) {
  localStorage.setItem(KEYS.DAYS, JSON.stringify(days))
}

function loadRent() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.RENT) || '{"начислено":0,"оплачено":0,"записи":[]}')
  } catch {
    return { начислено: 0, оплачено: 0, записи: [] }
  }
}

function saveRent(rent) {
  localStorage.setItem(KEYS.RENT, JSON.stringify(rent))
}

// ─── saveDay ─────────────────────────────────────────────────────────────────

/**
 * Сохранить день.
 * @param {object} payload  — полный payload (дата, summary, продажи, работа, расходы, зарплата, закупка, касса)
 * @param {boolean} force   — перезаписать если уже есть
 * @returns {{ ok, existed, dayId, error }}
 */
export async function saveDay(payload, force = false) {
  const dayId = dateToDayId(payload.дата)

  // 1. Проверка дубля в кэше
  const days = loadDays()
  const existing = days.findIndex(d => d.dayId === dayId)
  if (existing >= 0 && !force) {
    return { existed: true, dayId }
  }

  // 2. Запись в Google Sheets (источник правды)
  let sheetsResult = { ok: true }
  try {
    sheetsResult = await sheetsSave(payload, force)
  } catch (e) {
    sheetsResult = { error: e.message }
    // не прерываем — пишем в кэш даже если Sheets недоступен
  }

  // 3. Запись в localStorage
  const entry = {
    dayId,
    дата: payload.дата,
    savedAt: new Date().toISOString(),
    summary: payload.summary || {},
    продажи: payload.продажи || [],
    работа: payload.работа || [],
    расходы: payload.расходы || [],
    зарплата: payload.зарплата || [],
    закупка: payload.закупка || [],
    возвраты: payload.возвраты || [],
    касса: payload.касса || {},
  }

  if (existing >= 0) {
    days[existing] = entry
  } else {
    days.unshift(entry)
  }
  days.splice(365) // хранить максимум год
  saveDays(days)

  // 4. Обновить аренду
  _upsertRent(dayId, RENT_PER_DAY, payload.аренда?.оплачено || 0)

  return { ok: true, dayId, sheetsError: sheetsResult.error }
}

// ─── getHistory ──────────────────────────────────────────────────────────────

/**
 * Все сохранённые дни, от новых к старым.
 */
export function getHistory() {
  return loadDays()
}

// ─── getDailySummary ─────────────────────────────────────────────────────────

/**
 * Итог за конкретный день (dayId = 'YYYY-MM-DD').
 * Если не указан — сегодня.
 */
export function getDailySummary(dayId) {
  const days = loadDays()
  const target = dayId || todayId()
  return days.find(d => d.dayId === target) || null
}

// ─── getMonthlyReport ────────────────────────────────────────────────────────

/**
 * Массив месячных итогов, от новых к старым.
 * [{month: '2026-06', реализация, себестоимость, маржа, работа,
 *   валоваяПрибыль, расходы, зарплата, аренда, прибыльДня,
 *   кол_продаж, кол_работ, средний_чек, дней}]
 */
export function getMonthlyReport() {
  const days = loadDays()
  const map = {}

  days.forEach(d => {
    const month = d.dayId.slice(0, 7) // 'YYYY-MM'
    if (!map[month]) {
      map[month] = {
        month,
        реализация: 0, себестоимость: 0, маржа: 0,
        работа: 0, валоваяПрибыль: 0,
        расходы: 0, зарплата: 0, аренда: 0, прибыльДня: 0,
        кол_продаж: 0, кол_работ: 0, дней: 0,
      }
    }
    const m = map[month]
    const s = d.summary || {}
    m.реализация    += s.реализация    || 0
    m.себестоимость += s.себестоимость || 0
    m.маржа         += s.маржа         || 0
    m.работа        += s.работа        || 0
    m.валоваяПрибыль+= s.валоваяПрибыль|| ((s.маржа||0) + (s.работа||0))
    m.расходы       += s.расходы       || 0
    m.зарплата      += s.зарплата      || 0
    m.аренда        += s.аренда        || RENT_PER_DAY
    // Пересчитываем налету — не доверяем сохранённому значению (старая формула могла включать зарплату)
    m.прибыльДня    += (s.маржа||0) + (s.работа||0) - (s.расходы||0) - (s.аренда || RENT_PER_DAY)
    m.кол_продаж    += (d.продажи || []).length
    m.кол_работ     += (d.работа  || []).length
    m.дней          += 1
  })

  return Object.values(map)
    .sort((a, b) => b.month.localeCompare(a.month))
    .map(m => ({
      ...m,
      средний_чек: m.кол_продаж ? Math.round(m.реализация / m.кол_продаж) : 0,
    }))
}

// ─── getRentState ─────────────────────────────────────────────────────────────

/**
 * Состояние аренды.
 * { начислено, оплачено, остаток, записи }
 */
export function getRentState() {
  const rent = loadRent()
  return {
    начислено: rent.начислено,
    оплачено:  rent.оплачено,
    остаток:   rent.начислено - rent.оплачено,
    записи:    rent.записи || [],
  }
}

/**
 * Зафиксировать оплату аренды (сверх автоматического начисления).
 */
export function payRent(amount) {
  const rent = loadRent()
  rent.оплачено += amount
  saveRent(rent)
  return getRentState()
}

// ─── getChartData ─────────────────────────────────────────────────────────────

/**
 * Данные для графиков — массив дней от старых к новым.
 * Каждый элемент: { dayId, дата, реализация, маржа, работа, расходы, зарплата, аренда, прибыльДня, итогоКасса }
 */
export function getChartData(limitDays = 60) {
  const days = loadDays().slice(0, limitDays).reverse()
  return days.map(d => {
    const s = d.summary || {}
    const к = d.касса || {}
    return {
      dayId:       d.dayId,
      дата:        d.дата,
      реализация:  s.реализация    || 0,
      маржа:       s.маржа         || 0,
      работа:      s.работа        || 0,
      валовая:     s.валоваяПрибыль|| ((s.маржа||0)+(s.работа||0)),
      расходы:     s.расходы       || 0,
      зарплата:    s.зарплата      || 0,
      аренда:      s.аренда        || RENT_PER_DAY,
      // Пересчитываем налету по правильной формуле
      прибыль:     (s.маржа||0) + (s.работа||0) - (s.расходы||0) - (s.аренда || RENT_PER_DAY),
      закупка:     s.закупка       || 0,
      касса:       к.итогоВКассе   || 0,
    }
  })
}

// ─── syncFromSheets ───────────────────────────────────────────────────────────

/**
 * Синхронизация из Google Sheets в localStorage.
 * Пока — заглушка. Реализовать когда накопится история.
 */
// Google Sheets auto-converts date strings — normalize back to YYYY-MM-DD
function normalizeDayId(raw) {
  const s = String(raw || '')
  if (s.match(/^\d{4}-\d{2}-\d{2}T/)) {
    // ISO с таймзоной — берём ЛОКАЛЬНУЮ дату (Sheets отдаёт полночь по Москве как 21:00 UTC накануне)
    const dt = new Date(s)
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
  }
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s
  if (s.match(/^\d{2}\.\d{2}\.\d{4}$/)) { const [d,m,y] = s.split('.'); return `${y}-${m}-${d}` }
  return s
}

// Normalize дата to DD.MM.YYYY
function normalizeDата(raw) {
  const s = String(raw || '')
  if (s.match(/^\d{4}-\d{2}-\d{2}T/)) {
    const dt = new Date(s)
    return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`
  }
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y,m,d] = s.split('-'); return `${d}.${m}.${y}`
  }
  return s
}

export async function syncFromSheets() {
  // 1. Получить список дней из Sheets
  const { history } = await sheetsHistory()
  if (!history || history.length === 0) return { synced: 0 }

  const localDays = loadDays()
  const localIds = new Set(localDays.map(d => d.dayId))

  // 2. Найти дни которых нет в localStorage (мусорные строки пропускаем)
  const missing = history.filter(h => {
    const id = normalizeDayId(h.dayId)
    return /^\d{4}-\d{2}-\d{2}$/.test(id) && !localIds.has(id)
  })
  if (missing.length === 0) return { synced: 0 }

  // 3. Загрузить детализацию каждого отсутствующего дня
  const fetched = []
  for (const h of missing) {
    try {
      const dayId = normalizeDayId(h.dayId)
      const detail = await getDayDetail(dayId)
      const ds = (detail.daily_summary || [])[0] || {}
      fetched.push({
        dayId,
        дата: normalizeDата(h.дата || ds.дата),
        savedAt: new Date().toISOString(),
        summary: {
          реализация:    ds.реализация    || 0,
          себестоимость: ds.себестоимость || 0,
          маржа:         ds.маржа         || 0,
          работа:        ds.работа        || 0,
          расходы:       ds.расходы       || 0,
          зарплата:      ds.зарплата      || 0,
          закупка:       ds.закупка       || 0,
          возвраты:      ds.возвраты      || 0,
          вычет:         ds.вычет         || 0,
          аренда:        ds.аренда        || RENT_PER_DAY,
          прибыльДня:    (ds.маржа||0) + (ds.работа||0) - (ds.расходы||0) - (ds.аренда||RENT_PER_DAY) - (ds.вычет||0),
        },
        продажи:  (detail.sales          || []).map(r => ({ name: r.товар, channel: r.канал, реализация: r.реализация, закупка: r.закупка, маржа: r.маржа })),
        работа:   (detail.studio_work    || []).map(r => ({ comment: r.описание, сумма: r.сумма })),
        расходы:  (detail.expenses       || []).map(r => ({ comment: r.описание, сумма: r.сумма })),
        зарплата: (detail.salary         || []).map(r => ({ comment: r.описание, сумма: r.сумма })),
        закупка:  (detail.purchases      || []).map(r => ({ comment: r.описание, сумма: r.сумма })),
        касса:    (detail.cashbox        || [])[0] || {},
      })
    } catch { /* пропустить сломанный день */ }
  }

  // 4. Дописать в localStorage (новые в начало)
  saveDays([...fetched.reverse(), ...localDays])
  return { synced: fetched.length }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function dateToDayId(dateStr) {
  // DD.MM.YYYY → YYYY-MM-DD
  const [d, m, y] = String(dateStr).split('.')
  return `${y}-${m}-${d}`
}

function todayId() {
  return new Date().toISOString().slice(0, 10)
}

function _upsertRent(dayId, начислено, оплачено) {
  const rent = loadRent()
  const idx = rent.записи.findIndex(r => r.dayId === dayId)
  if (idx >= 0) {
    // перезапись: откатить старые значения
    rent.начислено -= rent.записи[idx].начислено
    rent.оплачено  -= rent.записи[idx].оплачено
    rent.записи.splice(idx, 1)
  }
  rent.записи.push({ dayId, начислено, оплачено })
  rent.начислено += начислено
  rent.оплачено  += оплачено
  saveRent(rent)
}
