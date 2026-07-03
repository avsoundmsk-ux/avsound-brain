// Замени SCRIPT_URL на новый URL после переустановки Apps Script v2
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1aMF8pM0UQN_UAy18J3CDgHad5GlB7BE8fRQkJcZV9BsxzjNLVvo9L5KKp5Sy6IM5/exec'

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
