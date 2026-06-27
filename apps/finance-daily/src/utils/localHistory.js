const KEY = 'avsound_history'

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveToHistory(dayId, дата, payload) {
  const history = getHistory()
  const idx = history.findIndex(h => h.dayId === dayId)
  const entry = { dayId, дата, savedAt: new Date().toISOString(), payload }
  if (idx >= 0) {
    history[idx] = entry
  } else {
    history.unshift(entry)
  }
  // хранить последние 90 дней
  history.splice(90)
  localStorage.setItem(KEY, JSON.stringify(history))
}

export function getDay(dayId) {
  const history = getHistory()
  return history.find(h => h.dayId === dayId) || null
}

export function deleteDay(dayId) {
  const history = getHistory().filter(h => h.dayId !== dayId)
  localStorage.setItem(KEY, JSON.stringify(history))
}
