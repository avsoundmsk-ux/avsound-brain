# AVSound Finance App — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app that accepts the «Продажи» xlsx file via drag & drop and shows a sales table with реализация, закупка, маржа, and channel breakdown.

**Architecture:** Single-page React app. SheetJS parses xlsx in the browser (no server, no file upload). All state lives in App.jsx. Components are dumb — they receive props only.

**Tech Stack:** Vite, React 18, SheetJS (xlsx), Tailwind CSS v3

## Global Constraints

- Node 18+
- Project root: `C:\Users\avsou\OneDrive\Desktop\claude\apps\finance-daily\`
- No TypeScript — plain JavaScript
- No backend — everything runs in browser
- Tailwind via CDN is NOT ok — use PostCSS plugin
- Russian text in UI is fine

---

## File Map

```
apps/finance-daily/
├── index.html
├── package.json
├── vite.config.js
├── postcss.config.js
├── tailwind.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── utils/
│   │   └── parseSales.js        ← parse xlsx → array of sale items
│   └── components/
│       ├── DropZone.jsx         ← drag & drop file input
│       ├── SummaryCards.jsx     ← 4 top metric cards
│       ├── ChannelBreakdown.jsx ← Авито vs Прямые row
│       └── SalesTable.jsx       ← per-item table
```

---

### Task 1: Scaffold project

**Files:**
- Create: `apps/finance-daily/package.json`
- Create: `apps/finance-daily/index.html`
- Create: `apps/finance-daily/vite.config.js`
- Create: `apps/finance-daily/tailwind.config.js`
- Create: `apps/finance-daily/postcss.config.js`
- Create: `apps/finance-daily/src/main.jsx`
- Create: `apps/finance-daily/src/App.jsx`

**Interfaces:**
- Produces: running dev server at `http://localhost:5173` with blank white page

- [ ] **Step 1: Create project folder and package.json**

```bash
cd "C:\Users\avsou\OneDrive\Desktop\claude"
mkdir -p apps/finance-daily/src/utils apps/finance-daily/src/components
```

Create `apps/finance-daily/package.json`:
```json
{
  "name": "avsound-finance-daily",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "vite": "^5.4.10"
  }
}
```

- [ ] **Step 2: Create config files**

`apps/finance-daily/vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

`apps/finance-daily/tailwind.config.js`:
```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

`apps/finance-daily/postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: Create index.html**

`apps/finance-daily/index.html`:
```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AVSound — Учёт дня</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 5: Create src/index.css**

`apps/finance-daily/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Create placeholder App.jsx**

```jsx
export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <h1 className="text-2xl font-bold text-gray-800">AVSound — Учёт дня</h1>
    </div>
  )
}
```

- [ ] **Step 7: Install deps and verify**

```bash
cd "C:\Users\avsou\OneDrive\Desktop\claude\apps\finance-daily"
npm install
npm run dev
```

Expected: server starts at `http://localhost:5173`, browser shows "AVSound — Учёт дня" centered on gray background. No console errors.

- [ ] **Step 8: Commit**

```bash
cd "C:\Users\avsou\OneDrive\Desktop\claude"
git add apps/finance-daily/
git commit -m "feat: scaffold finance-daily app (Vite + React + Tailwind)"
```

---

### Task 2: parseSales utility

**Files:**
- Create: `apps/finance-daily/src/utils/parseSales.js`

**Interfaces:**
- Consumes: `File` object (xlsx)
- Produces: `parseSalesFile(file) → Promise<SaleItem[]>`
  ```
  SaleItem {
    date: string,        // "19.06.2026"
    name: string,        // "Machete MF-12R D2"
    channel: string,     // "Авито" | "Прямые"
    реализация: number,  // 11990
    закупка: number,     // 7519
    маржа: number        // 4471
  }
  ```

- [ ] **Step 1: Create parseSales.js**

`apps/finance-daily/src/utils/parseSales.js`:
```js
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
    const date = String(r[0] || '').trim()
    const rawAmount = String(r[2] || '0').replace(',', '.')
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
```

- [ ] **Step 2: Manual smoke test in browser console**

After wiring DropZone (Task 3), open DevTools → Console and verify one row:
- Drop the real `Продажи` xlsx
- Check first item: `реализация` matches Сумма column, `закупка` matches number in brackets

- [ ] **Step 3: Commit**

```bash
git add apps/finance-daily/src/utils/parseSales.js
git commit -m "feat: parseSales — extract items from Продажи xlsx"
```

---

### Task 3: DropZone component

**Files:**
- Create: `apps/finance-daily/src/components/DropZone.jsx`
- Modify: `apps/finance-daily/src/App.jsx`

**Interfaces:**
- Consumes: `onFile(file: File) → void` prop
- Produces: `<DropZone onFile={fn} />` — renders a drop area; calls `onFile` with the File object on drop or click-select

- [ ] **Step 1: Create DropZone.jsx**

```jsx
import { useRef, useState } from 'react'

export default function DropZone({ onFile }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) onFile(file)
  }

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
        ${dragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'}
      `}
    >
      <p className="text-lg font-medium text-gray-600">
        Перетащи файл <span className="text-blue-600">Продажи.xlsx</span>
      </p>
      <p className="text-sm text-gray-400 mt-1">или нажми для выбора</p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
```

- [ ] **Step 2: Wire DropZone into App.jsx**

```jsx
import { useState } from 'react'
import DropZone from './components/DropZone.jsx'
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
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">AVSound — Учёт дня</h1>
      <DropZone onFile={handleFile} />
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {items && <p className="mt-4 text-green-600">Загружено строк: {items.length}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Drop the real `Продажи` xlsx. Expected: "Загружено строк: 32" (или сколько реально строк). No red error. Check console — no exceptions.

- [ ] **Step 4: Commit**

```bash
git add apps/finance-daily/src/components/DropZone.jsx apps/finance-daily/src/App.jsx
git commit -m "feat: DropZone — drag & drop xlsx file input"
```

---

### Task 4: SalesTable component

**Files:**
- Create: `apps/finance-daily/src/components/SalesTable.jsx`
- Modify: `apps/finance-daily/src/App.jsx`

**Interfaces:**
- Consumes: `items: SaleItem[]` prop (SaleItem as defined in Task 2)
- Produces: `<SalesTable items={items} />` — renders table with totals row

- [ ] **Step 1: Create SalesTable.jsx**

```jsx
function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function pct(маржа, реализация) {
  if (!реализация) return '—'
  return Math.round((маржа / реализация) * 100) + '%'
}

export default function SalesTable({ items }) {
  const totals = items.reduce(
    (acc, i) => ({
      реализация: acc.реализация + i.реализация,
      закупка: acc.закупка + i.закупка,
      маржа: acc.маржа + i.маржа,
    }),
    { реализация: 0, закупка: 0, маржа: 0 }
  )

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Дата</th>
            <th className="px-4 py-3 text-left">Товар</th>
            <th className="px-4 py-3 text-left">Канал</th>
            <th className="px-4 py-3 text-right">Реализация</th>
            <th className="px-4 py-3 text-right">Закупка</th>
            <th className="px-4 py-3 text-right">Маржа</th>
            <th className="px-4 py-3 text-right">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{item.date}</td>
              <td className="px-4 py-2 text-gray-800">{item.name}</td>
              <td className="px-4 py-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  item.channel === 'Авито'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {item.channel}
                </span>
              </td>
              <td className="px-4 py-2 text-right text-gray-800">{fmt(item.реализация)}</td>
              <td className="px-4 py-2 text-right text-gray-500">{fmt(item.закупка)}</td>
              <td className={`px-4 py-2 text-right font-medium ${
                item.маржа >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>{fmt(item.маржа)}</td>
              <td className="px-4 py-2 text-right text-gray-500">
                {pct(item.маржа, item.реализация)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-200">
          <tr>
            <td colSpan={3} className="px-4 py-3 text-gray-700">Итого</td>
            <td className="px-4 py-3 text-right text-gray-900">{fmt(totals.реализация)}</td>
            <td className="px-4 py-3 text-right text-gray-700">{fmt(totals.закупка)}</td>
            <td className="px-4 py-3 text-right text-green-700">{fmt(totals.маржа)}</td>
            <td className="px-4 py-3 text-right text-gray-700">
              {pct(totals.маржа, totals.реализация)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Add SalesTable to App.jsx**

Replace the `{items && <p>...}` line in App.jsx with:

```jsx
import SalesTable from './components/SalesTable.jsx'

// inside return, replace the green <p>:
{items && <SalesTable items={items} />}
```

Full App.jsx:
```jsx
import { useState } from 'react'
import DropZone from './components/DropZone.jsx'
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
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">AVSound — Учёт дня</h1>
      <DropZone onFile={handleFile} />
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {items && <SalesTable items={items} />}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Drop `Продажи` xlsx. Expected:
- Table renders with all rows
- Totals row at bottom
- Авито rows have orange badge, Прямые have blue
- Маржа column is green for positive values
- Last row totals match manual sum of Сумма column in xlsx

- [ ] **Step 4: Commit**

```bash
git add apps/finance-daily/src/components/SalesTable.jsx apps/finance-daily/src/App.jsx
git commit -m "feat: SalesTable — per-item table with totals row"
```

---

### Task 5: SummaryCards + ChannelBreakdown

**Files:**
- Create: `apps/finance-daily/src/components/SummaryCards.jsx`
- Create: `apps/finance-daily/src/components/ChannelBreakdown.jsx`
- Modify: `apps/finance-daily/src/App.jsx`

**Interfaces:**
- Both consume: `items: SaleItem[]`
- Produces: `<SummaryCards items={items} />` — 4 metric cards
- Produces: `<ChannelBreakdown items={items} />` — 2-row Авито/Прямые breakdown

- [ ] **Step 1: Create SummaryCards.jsx**

```jsx
function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function Card({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function SummaryCards({ items }) {
  const реализация = items.reduce((s, i) => s + i.реализация, 0)
  const закупка = items.reduce((s, i) => s + i.закупка, 0)
  const маржа = реализация - закупка
  const pct = реализация ? Math.round((маржа / реализация) * 100) : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card label="Реализация" value={fmt(реализация)} />
      <Card label="Себестоимость" value={fmt(закупка)} color="text-gray-600" />
      <Card
        label="Валовая маржа"
        value={fmt(маржа)}
        color={маржа >= 0 ? 'text-green-600' : 'text-red-600'}
      />
      <Card
        label="% маржи"
        value={pct + '%'}
        color={pct >= 30 ? 'text-green-600' : pct >= 15 ? 'text-yellow-600' : 'text-red-600'}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create ChannelBreakdown.jsx**

```jsx
function fmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

export default function ChannelBreakdown({ items }) {
  const channels = ['Авито', 'Прямые']

  const stats = channels.map(ch => {
    const rows = items.filter(i => i.channel === ch)
    const реализация = rows.reduce((s, i) => s + i.реализация, 0)
    const маржа = rows.reduce((s, i) => s + i.маржа, 0)
    const pct = реализация ? Math.round((маржа / реализация) * 100) : 0
    return { ch, count: rows.length, реализация, маржа, pct }
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        По каналам
      </h2>
      <div className="divide-y divide-gray-100">
        {stats.map(s => (
          <div key={s.ch} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                s.ch === 'Авито'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>{s.ch}</span>
              <span className="text-sm text-gray-400">{s.count} поз.</span>
            </div>
            <div className="flex gap-6 text-sm">
              <span className="text-gray-600">{fmt(s.реализация)}</span>
              <span className={s.маржа >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {fmt(s.маржа)}
              </span>
              <span className="text-gray-400 w-10 text-right">{s.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add both to App.jsx**

```jsx
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
            onClick={() => setItems(null)}
            className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Загрузить другой файл
          </button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify in browser**

Drop `Продажи` xlsx. Expected:
- 4 cards appear: Реализация, Себестоимость, Маржа, % маржи
- Channel breakdown: Авито row + Прямые row with correct sums
- Table below
- «Загрузить другой файл» link resets to drop zone
- Responsive: works on mobile viewport (toggle in DevTools)

- [ ] **Step 5: Commit**

```bash
git add apps/finance-daily/src/components/SummaryCards.jsx
git add apps/finance-daily/src/components/ChannelBreakdown.jsx
git add apps/finance-daily/src/App.jsx
git commit -m "feat: SummaryCards + ChannelBreakdown — daily metrics and channel split"
```

---

## Verification Checklist (Phase 1 Complete)

After Task 5 done, verify end-to-end with real file `2026_06_20_01_23_13_568743.xlsx`:

- [ ] Drop file → table renders, no errors
- [ ] Row count matches xlsx row count (minus 2 header rows)
- [ ] Pick one row manually: реализация matches column C, закупка matches number in brackets in column H
- [ ] Итого реализация = SUM of column C in xlsx (calculate manually or in Excel)
- [ ] Авито rows: all rows that have "Авито" in column G
- [ ] % маржи итого is correct (маржа / реализация × 100)
- [ ] Works on phone (Chrome DevTools mobile emulation)
