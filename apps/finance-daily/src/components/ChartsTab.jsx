import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { getChartData } from '../utils/dataService.js'

function fmt(n) { return (n || 0).toLocaleString('ru-RU') + ' ₽' }

function fmtTick(v) {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(0) + 'к'
  return v
}

const COLORS = {
  реализация: '#6366f1',
  маржа:      '#22c55e',
  валовая:    '#16a34a',
  расходы:    '#ef4444',
  зарплата:   '#f97316',
  аренда:     '#9ca3af',
  прибыль:    '#15803d',
  касса:      '#3b82f6',
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function ChartsTab({ onRefresh }) {
  const [days, setDays] = useState(30)
  const data = useMemo(() => getChartData(days), [onRefresh, days])

  if (data.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-3">📈</p>
        <p className="text-lg font-medium">Нет данных для графиков</p>
        <p className="text-sm mt-1">Сохрани несколько дней — появятся графики динамики</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Период */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Период:</span>
        {[7, 14, 30, 60].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              days === d ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {d} дн.
          </button>
        ))}
      </div>

      {/* 1. Прибыль по дням */}
      <ChartCard title="Прибыль дня">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="дата" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(0, 5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtTick} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="прибыль" name="Прибыль дня" fill={COLORS.прибыль} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. Реализация и маржа */}
      <ChartCard title="Реализация и маржа">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="дата" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(0, 5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtTick} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line dataKey="реализация" name="Реализация" stroke={COLORS.реализация} dot={false} strokeWidth={2} />
            <Line dataKey="маржа"      name="Маржа"       stroke={COLORS.маржа}      dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3. Расходы, зарплата, аренда */}
      <ChartCard title="Расходы по дням">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="дата" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(0, 5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtTick} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="расходы"  name="Расходы"  fill={COLORS.расходы}  stackId="a" radius={[0,0,0,0]} />
            <Bar dataKey="зарплата" name="Зарплата" fill={COLORS.зарплата} stackId="a" />
            <Bar dataKey="аренда"   name="Аренда"   fill={COLORS.аренда}   stackId="a" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 4. Касса */}
      <ChartCard title="Итого в кассе">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="дата" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(0, 5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtTick} />
            <Tooltip content={<CustomTooltip />} />
            <Line dataKey="касса" name="Касса" stroke={COLORS.касса} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 5. Работа студии */}
      <ChartCard title="Работа студии">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="дата" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(0, 5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtTick} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="работа" name="Работа" fill="#3b82f6" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
