'use client'

import { useState, useEffect } from 'react'
import { Play, Square } from 'lucide-react'

const KEY = 'horas_timer_start'

/**
 * Timer start/stop para registrar horas (#H31). Persiste el inicio en
 * localStorage (sobrevive navegación). Al detener, entrega la hora de inicio
 * (decimal) y las horas transcurridas para prellenar el formulario.
 */
export function HorasTimer({ onStop }: { onStop: (horaInicio: number, horas: number) => void }) {
  const [startMs, setStartMs] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const raw = localStorage.getItem(KEY)
    if (raw) { setStartMs(parseInt(raw)); setNow(Date.now()) }
  }, [])

  useEffect(() => {
    if (startMs == null) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startMs])

  function start() {
    const m = Date.now()
    localStorage.setItem(KEY, String(m))
    setStartMs(m); setNow(m)
  }

  function stop() {
    if (startMs == null) return
    const inicio = new Date(startMs)
    const horaInicio = inicio.getHours() + inicio.getMinutes() / 60
    const horas = Math.max(0.05, (Date.now() - startMs) / 3_600_000)
    localStorage.removeItem(KEY)
    setStartMs(null)
    onStop(Number(horaInicio.toFixed(2)), Number(horas.toFixed(2)))
  }

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const ss = s % 60
    return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }

  return (
    <div className="fixed bottom-4 right-20 z-[80]">
      {startMs == null ? (
        <button
          onClick={start}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700 transition-colors text-sm font-medium"
          title="Iniciar cronómetro"
        >
          <Play className="w-4 h-4" /> Empezar
        </button>
      ) : (
        <button
          onClick={stop}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transition-colors text-sm font-medium tabular-nums"
          title="Detener y registrar"
        >
          <Square className="w-4 h-4" /> {fmt(now - startMs)}
        </button>
      )}
    </div>
  )
}
