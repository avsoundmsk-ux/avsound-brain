// Замени SCRIPT_URL на новый URL после переустановки Apps Script v2
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw4_tjMTMuqIoY6rkxjb86Kh-L40CD6tIFkBX3sKoYF17EMJkrixdBO03jUKvDFFvCZ/exec'

async function call(method, data) {
  if (method === 'GET') {
    const params = new URLSearchParams(data)
    const res = await fetch(`${SCRIPT_URL}?${params}`)
    return res.json()
  }
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.json()
}

// Сохранить день. Возвращает {success, dayId} или {existed, dayId}
export async function saveDay(payload, forceOverwrite = false) {
  return call('POST', { ...payload, forceOverwrite })
}

// Получить список дней из daily_summary
export async function getHistory() {
  return call('GET', { action: 'history' })
}

// Получить детализацию дня по dayId
export async function getDayDetail(dayId) {
  return call('GET', { action: 'day', dayId })
}
