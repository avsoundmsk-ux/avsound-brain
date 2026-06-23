import { useRef, useState } from 'react'

export default function DropZone({ onFile, label, loaded }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) { alert('Нужен файл .xlsx'); return }
    onFile(file)
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
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
        ${loaded
          ? 'border-green-400 bg-green-50'
          : dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'}
      `}
    >
      {loaded
        ? <p className="text-green-600 font-medium">✓ {label} загружен</p>
        : <>
            <p className="text-base font-medium text-gray-600">
              Перетащи <span className="text-blue-600">{label}</span>
            </p>
            <p className="text-sm text-gray-400 mt-1">или нажми для выбора</p>
          </>
      }
      <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={handleChange} />
    </div>
  )
}
