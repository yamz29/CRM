'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Save, Loader2, GripVertical } from 'lucide-react'

interface Props {
  initialTipos: string[]
}

export function TiposModuloPanel({ initialTipos }: Props) {
  const router = useRouter()
  const [tipos, setTipos] = useState(initialTipos)
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function addTipo() {
    const t = nuevoTipo.trim()
    if (!t || tipos.includes(t)) return
    setTipos([...tipos, t])
    setNuevoTipo('')
    setSaved(false)
  }

  function removeTipo(idx: number) {
    setTipos(tipos.filter((_, i) => i !== idx))
    setSaved(false)
  }

  async function handleSave() {
    if (tipos.length === 0) return
    setSaving(true)
    await fetch('/api/configuracion/tipos-modulo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipos }),
    })
    setSaving(false)
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de Módulo Melamina</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configura los tipos disponibles al crear módulos de melamina. Estos tipos también se usan como filtro en el listado.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current tipos */}
          <div className="space-y-1.5">
            {tipos.map((tipo, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20 group"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                <span className="flex-1 text-sm text-foreground">{tipo}</span>
                <button
                  onClick={() => removeTipo(idx)}
                  className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add new tipo */}
          <div className="flex gap-2">
            <input
              type="text"
              value={nuevoTipo}
              onChange={(e) => setNuevoTipo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTipo() } }}
              placeholder="Nuevo tipo de módulo..."
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button variant="secondary" onClick={addTipo} disabled={!nuevoTipo.trim()}>
              <Plus className="w-4 h-4" /> Agregar
            </Button>
          </div>

          {/* Save */}
          <div className="flex items-center justify-between pt-2">
            {saved && (
              <span className="text-sm text-green-600 dark:text-green-400">Guardado correctamente</span>
            )}
            <div className="ml-auto">
              <Button onClick={handleSave} disabled={saving || tipos.length === 0}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Tipos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
