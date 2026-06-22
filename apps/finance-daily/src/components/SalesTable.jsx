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
