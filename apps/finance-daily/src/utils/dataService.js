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
export async function syncFromSheets() {
  // TODO: GET /history → сравнить dayId → загрузить недостающие дни
  return { synced: 0, message: 'sync not yet implemented' }
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
