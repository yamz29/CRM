'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PRIORIDADES } from '@/lib/produccion'
import { Package, LayoutGrid, Plus, Trash2, Loader2, CheckSquare } from 'lucide-react'

interface ModuloInfo {
  placementId: number
  moduloId: number
  nivel: string
  nombre: string
  tipoModulo: string
  ancho: number
  alto: number
  profundidad: number
  cantidad: number
}

interface Espacio {
  id: number
  nombre: string
  layoutType: string
  moduloCount: number
  modulos: ModuloInfo[]
  createdAt: string
}

interface Props {
  espacios: Espacio[]
  proyectos: { id: number; nombre: string }[]
}

interface ManualItem {
  nombre: string
  tipo: string
  dimensiones: string
  cantidad: number
}

export function OrdenProduccionForm({ espacios, proyectos }: Props) {
  const router = useRouter()
  const [modo, setModo] = useState<'importar' | 'manual'>('importar')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Import mode
  const [selectedEspacio, setSelectedEspacio] = useState<number | ''>('')
  const [selectedModulos, setSelectedModulos] = useState<Set<number>>(new Set())

  // Common fields
  const [nombre, setNombre] = useState('')
  const [proyectoId, setProyectoId] = useState<number | ''>('')
  const [prioridad, setPrioridad] = useState('Media')

  // Manual mode
  const [items, setItems] = useState<ManualItem[]>([
    { nombre: '', tipo: '', dimensiones: '', cantidad: 1 },
  ])

  const espacioData = selectedEspacio ? espacios.find(e => e.id === selectedEspacio) : null

  function handleSelectEspacio(id: number) {
    setSelectedEspacio(id)
    const esp = espacios.find(e => e.id === id)
    if (esp) {
      setSelectedModulos(new Set(esp.modulos.map(m => m.moduloId)))
    }
  }

  function toggleModulo(moduloId: number) {
    const next = new Set(selectedModulos)
    if (next.has(moduloId)) next.delete(moduloId)
    else next.add(moduloId)
    setSelectedModulos(next)
  }

  function toggleAllModulos() {
    if (!espacioData) return
    if (selectedModulos.size === espacioData.modulos.length) {
      setSelectedModulos(new Set())
    } else {
      setSelectedModulos(new Set(espacioData.modulos.map(m => m.moduloId)))
    }
  }

  function addItem() {
    setItems([...items, { nombre: '', tipo: '', dimensiones: '', cantidad: 1 }])
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ManualItem, value: string | number) {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (modo === 'importar') {
        if (!selectedEspacio || selectedModulos.size === 0) {
          setError('Selecciona un espacio y al menos un módulo')
          setSaving(false)
          return
        }

        const moduloIds = Array.from(selectedModulos)
        const res = await fetch('/api/produccion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modo: 'importar-espacio',
            espacioId: selectedEspacio,
            moduloIds,
            nombre: nombre || `Producción - ${espacioData?.nombre || ''}`,
            proyectoId: proyectoId || null,
            prioridad,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al crear orden')
        router.push('/produccion?msg=creado')
      } else {
        const validItems = items.filter(i => i.nombre.trim())
        if (validItems.length === 0) {
          setError('Agrega al menos un item')
          setSaving(false)
          return
        }
        const res = await fetch('/api/produccion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modo: 'manual',
            nombre: nombre || 'Orden manual',
            proyectoId: proyectoId || null,
            prioridad,
            items: validItems,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al crear orden')
        router.push('/produccion?msg=creado')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mode selector */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setModo('importar')}
          className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
            modo === 'importar'
              ? 'border-primary bg-primary/5 dark:bg-primary/10'
              : 'border-border hover:border-primary/30'
          }`}
        >
          <LayoutGrid className={`w-5 h-5 ${modo === 'importar' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-left">
            <p className={`text-sm font-medium ${modo === 'importar' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Importar de Espacio
            </p>
            <p className="text-xs text-muted-foreground">Trae módulos de un proyecto de cocina/espacio</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setModo('manual')}
          className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
            modo === 'manual'
              ? 'border-primary bg-primary/5 dark:bg-primary/10'
              : 'border-border hover:border-primary/30'
          }`}
        >
          <Package className={`w-5 h-5 ${modo === 'manual' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-left">
            <p className={`text-sm font-medium ${modo === 'manual' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Crear Manualmente
            </p>
            <p className="text-xs text-muted-foreground">Agrega items a mano</p>
          </div>
        </button>
      </div>

      {/* Common fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos Generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre de la orden</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Se genera automáticamente si se deja vacío"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Proyecto (opcional)</label>
              <select
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
              >
                <option value="">Sin proyecto</option>
                {proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Prioridad</label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
              >
                {PRIORIDADES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import mode: select espacio + modules */}
      {modo === 'importar' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seleccionar Espacio</CardTitle>
            </CardHeader>
            <CardContent>
              {espacios.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No hay espacios/cocinas creados
                </p>
              ) : (
                <div className="space-y-2">
                  {espacios.map(esp => (
                    <label
                      key={esp.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedEspacio === esp.id
                          ? 'border-primary bg-primary/5 dark:bg-primary/10'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="espacio"
                        value={esp.id}
                        checked={selectedEspacio === esp.id}
                        onChange={() => handleSelectEspacio(esp.id)}
                        className="accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{esp.nombre}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                            {esp.layoutType}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {esp.moduloCount} módulos colocados
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Module selection within espacio */}
          {espacioData && espacioData.modulos.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Módulos a Producir</CardTitle>
                  <button
                    type="button"
                    onClick={toggleAllModulos}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedModulos.size === espacioData.modulos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {espacioData.modulos.map(m => (
                    <label
                      key={m.moduloId}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedModulos.has(m.moduloId)
                          ? 'border-primary/50 bg-primary/5 dark:bg-primary/10'
                          : 'border-border'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModulos.has(m.moduloId)}
                        onChange={() => toggleModulo(m.moduloId)}
                        className="accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{m.nombre}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            m.nivel === 'alto' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                            : m.nivel === 'isla' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                          }`}>{m.nivel}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.tipoModulo} — {m.ancho}×{m.alto}×{m.profundidad} mm — Cant: {m.cantidad}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  <CheckSquare className="w-3 h-3 inline mr-1" />
                  {selectedModulos.size} de {espacioData.modulos.length} módulos seleccionados
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Manual mode: add items */}
      {modo === 'manual' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Items de Producción</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4" /> Agregar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={item.nombre}
                      onChange={(e) => updateItem(idx, 'nombre', e.target.value)}
                      placeholder="Nombre del módulo"
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    value={item.dimensiones}
                    onChange={(e) => updateItem(idx, 'dimensiones', e.target.value)}
                    placeholder="Dimensiones"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => updateItem(idx, 'cantidad', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm"
                  />
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-600 mt-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.push('/produccion')}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Crear Orden
        </Button>
      </div>
    </form>
  )
}
