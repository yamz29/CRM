'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X, Loader2 } from 'lucide-react'

interface Props {
  proyectoId: number
  avanceActual: number
}

export function AvanceFisicoCard({ proyectoId, avanceActual }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [valor, setValor] = useState(avanceActual)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (valor === avanceActual) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _patch: true, avanceFisico: valor }),
      })
      if (res.ok) {
        setEditing(false)
        router.refresh()
      } else {
        alert('Error al actualizar el avance')
      }
    } catch {
      alert('Error al actualizar el avance')
    } finally {
      setSaving(false)
    }
  }

  const color = avanceActual === 100 ? 'text-green-700' : avanceActual >= 50 ? 'text-blue-700' : 'text-amber-600'
  const barColor = avanceActual === 100 ? '#22c55e' : avanceActual >= 50 ? '#3b82f6' : '#f59e0b'

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avance físico</p>
        {!editing && (
          <button
            onClick={() => { setValor(avanceActual); setEditing(true) }}
            className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
            title="Editar avance"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={valor}
              onChange={e => setValor(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              className="w-16 h-8 px-2 border border-border rounded bg-input text-foreground text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <span className="text-lg font-bold text-foreground">%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={valor}
            onChange={e => setValor(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex gap-1 mt-1">
            {[0, 25, 50, 75, 100].map(v => (
              <button
                key={v}
                onClick={() => setValor(v)}
                className={`flex-1 py-1 text-xs rounded border transition-colors ${
                  valor === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {v}%
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Guardar
            </button>
            <button
              onClick={() => { setEditing(false); setValor(avanceActual) }}
              disabled={saving}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className={`text-2xl font-black tabular-nums ${color}`}>{avanceActual}%</p>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width: `${avanceActual}%`,
              backgroundColor: barColor,
            }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">% obra completada</p>
        </>
      )}
    </div>
  )
}
