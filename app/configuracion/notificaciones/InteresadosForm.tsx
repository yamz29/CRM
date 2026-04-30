'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Save, Loader2, Check, AlertCircle } from 'lucide-react'

interface Usuario {
  id: number
  nombre: string
  correo: string
  rol: string
  esInteresado: boolean
  dispositivos: number
}

export function InteresadosForm({ usuarios }: { usuarios: Usuario[] }) {
  const router = useRouter()
  const [seleccionados, setSeleccionados] = useState<Set<number>>(
    new Set(usuarios.filter(u => u.esInteresado).map(u => u.id))
  )
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; text: string } | null>(null)

  function toggle(id: number) {
    setMensaje(null)
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function guardar() {
    setGuardando(true); setMensaje(null)
    try {
      const res = await fetch('/api/configuracion/notificaciones-interesados', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interesadosIds: Array.from(seleccionados) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setMensaje({ tipo: 'error', text: err.error || 'No se pudo guardar' })
        return
      }
      setMensaje({ tipo: 'ok', text: 'Lista actualizada' })
      router.refresh()
    } catch (e) {
      setMensaje({ tipo: 'error', text: e instanceof Error ? e.message : 'Error de red' })
    } finally {
      setGuardando(false)
    }
  }

  const cambios = (() => {
    const original = new Set(usuarios.filter(u => u.esInteresado).map(u => u.id))
    if (original.size !== seleccionados.size) return true
    for (const id of seleccionados) if (!original.has(id)) return true
    return false
  })()

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/40 border-b border-border text-left">
            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Recibe</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Usuario</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Rol</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase text-right">Dispositivos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {usuarios.map(u => (
            <tr key={u.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={seleccionados.has(u.id)}
                  onChange={() => toggle(u.id)}
                  className="w-4 h-4"
                />
              </td>
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">{u.nombre}</p>
                <p className="text-xs text-muted-foreground">{u.correo}</p>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{u.rol}</td>
              <td className="px-4 py-3 text-right">
                {u.dispositivos > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                    {u.dispositivos}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">0</span>
                )}
              </td>
            </tr>
          ))}
          {usuarios.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                No hay usuarios activos.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          {seleccionados.size} de {usuarios.length} marcados como interesados
        </div>
        <div className="flex items-center gap-2">
          {mensaje && (
            <span className={`text-xs flex items-center gap-1 ${
              mensaje.tipo === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {mensaje.tipo === 'ok' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {mensaje.text}
            </span>
          )}
          <Button onClick={guardar} disabled={!cambios || guardando} size="sm">
            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  )
}
