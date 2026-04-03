'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PRIORIDADES } from '@/lib/produccion'
import { Package, FileText, Plus, Trash2, Loader2 } from 'lucide-react'
import { ImportarModulosModal } from './ImportarModulosModal'

interface Presupuesto {
  id: number
  numero: string
  estado: string
  total: number
  cliente: { id: number; nombre: string }
  proyecto: { id: number; nombre: string } | null
  tieneModulosV2: boolean
}

interface Props {
  presupuestos: Presupuesto[]
  proyectos: { id: number; nombre: string }[]
}

interface ManualItem {
  nombre: string
  tipo: string
  dimensiones: string
  cantidad: number
}

export function OrdenProduccionForm({ presupuestos, proyectos }: Props) {
  const router = useRouter()
  const [modo, setModo] = useState<'importar' | 'manual'>('importar')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Import mode
  const [selectedPresupuesto, setSelectedPresupuesto] = useState<number | ''>('')
  const [showImportModal, setShowImportModal] = useState(false)

  // Common fields
  const [nombre, setNombre] = useState('')
  const [proyectoId, setProyectoId] = useState<number | ''>('')
  const [prioridad, setPrioridad] = useState('Media')

  // Manual mode
  const [items, setItems] = useState<ManualItem[]>([
    { nombre: '', tipo: '', dimensiones: '', cantidad: 1 },
  ])

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
        if (!selectedPresupuesto) {
          setError('Selecciona un presupuesto')
          setSaving(false)
          return
        }
        const res = await fetch('/api/produccion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modo: 'importar',
            presupuestoId: selectedPresupuesto,
            nombre,
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

  const presupuestosV2 = presupuestos.filter(p => p.tieneModulosV2)

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
          <FileText className={`w-5 h-5 ${modo === 'importar' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-left">
            <p className={`text-sm font-medium ${modo === 'importar' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Importar de Presupuesto
            </p>
            <p className="text-xs text-muted-foreground">Trae módulos y calcula materiales</p>
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

      {/* Import mode: select presupuesto */}
      {modo === 'importar' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seleccionar Presupuesto</CardTitle>
          </CardHeader>
          <CardContent>
            {presupuestosV2.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay presupuestos con módulos de melamina V2 disponibles
              </p>
            ) : (
              <div className="space-y-2">
                {presupuestosV2.map(p => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedPresupuesto === p.id
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="presupuesto"
                      value={p.id}
                      checked={selectedPresupuesto === p.id}
                      onChange={() => setSelectedPresupuesto(p.id)}
                      className="accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{p.numero}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          p.estado === 'Aprobado' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' :
                          'bg-muted text-muted-foreground'
                        }`}>{p.estado}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.cliente.nombre}
                        {p.proyecto && ` — ${p.proyecto.nombre}`}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      RD${p.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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

      {showImportModal && selectedPresupuesto && (
        <ImportarModulosModal
          presupuestoId={selectedPresupuesto}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </form>
  )
}
