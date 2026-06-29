import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { getChartData } from '../utils/dataService.js'

function fmt(n) { return (n || 0).toLocaleString('ru-RU') + ' ₽' }
function fmtTick(v) { return Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'к' : v }

function ChartCard({ title, sub, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
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

const H = 200

export default function ChartsTab() {
  const [days, setDays] = useState(30)
  const data = useMemo(() => getChartData(days), [days])

  if (data.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-3">📈</p>
        <p className="text-lg font-medium">Нет данных для графиков</p>
        <p className="text-sm mt-1">Сохрани несколько дней — появятся графики динамики</p>
      </div>
    )
  }

  const tick  = { fontSize: 11 }
  const grid  = <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
  const xAxis = <XAxis dataKey="дата" tick={tick} tickFormatter={d => d.slice(0, 5)} />

  return (
    <div className="space-y-5">
      {/* Период */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Период:</span>
        {[7, 14, 30, 60].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              days === d ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {d} дн.
          </button>
        ))}
      </div>

      {/* 2 колонки */}
      <div className="grid grid-cols-2 gap-5">

        <ChartCard title="Реализация" sub="выручка за день">
          <ResponsiveContainer width="100%" height={H}>
            <BarChart data={data}>
              {grid}{xAxis}<YAxis tick={tick} tickFormatter={fmtTick} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="реализация" name="Реализация" fill="#6366f1" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Маржа продаж" sub="реализация − себестоимость">
          <ResponsiveContainer width="100%" height={H}>
            <BarChart data={data}>
              {grid}{xAxis}<YAxis tick={tick} tickFormatter={fmtTick} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="маржа" name="Маржа" fill="#22c55e" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Работа студии" sub="установки, сервис">
          <ResponsiveContainer width="100%" height={H}>
            <BarChart data={data}>
              {grid}{xAxis}<YAxis tick={tick} tickFormatter={fmtTick} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="работа" name="Работа" fill="#3b82f6" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Расходы" sub="операционные расходы дня">
          <ResponsiveContainer width="100%" height={H}>
            <BarChart data={data}>
              {grid}{xAxis}<YAxis tick={tick} tickFormatter={fmtTick} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="расходы" name="Расходы" fill="#ef4444" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Закупка склада" sub="движение кассы, не влияет на прибыль">
          <ResponsiveContainer width="100%" height={H}>
            <BarChart data={data}>
              {grid}{xAxis}<YAxis tick={tick} tickFormatter={fmtTick} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="закупка" name="Закупка" fill="#a855f7" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Выплачено зарплаты" sub="движение кассы, не влияет на прибыль">
          <ResponsiveContainer width="100%" height={H}>
            <BarChart data={data}>
              {grid}{xAxis}<YAxis tick={tick} tickFormatter={fmtTick} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="зарплата" name="Зарплата выпл." fill="#f97316" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* Прибыль дня — широкий */}
      <ChartCard title="Зарплата / прибыль дня" sub="маржа + работа − расходы − аренда (зарплатные выплаты не вычитаются)">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            {grid}{xAxis}<YAxis tick={tick} tickFormatter={fmtTick} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="прибыль" name="Прибыль дня" fill="#15803d" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Реализация + Маржа линейный */}
      <ChartCard title="Реализация и маржа — динамика">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            {grid}{xAxis}<YAxis tick={tick} tickFormatter={fmtTick} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line dataKey="реализация" name="Реализация" stroke="#6366f1" dot={false} strokeWidth={2} />
            <Line dataKey="маржа"      name="Маржа"       stroke="#22c55e" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Касса на конец дня */}
      <ChartCard title="Касса на конец дня" sub="итого по всем счетам">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            {grid}{xAxis}<YAxis tick={tick} tickFormatter={fmtTick} />
            <Tooltip content={<CustomTooltip />} />
            <Line dataKey="касса" name="Касса" stroke="#3b82f6" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

    </div>
  )
}
