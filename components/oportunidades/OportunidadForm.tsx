'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ETAPAS, type Oportunidad } from './PipelineClient'

interface Props {
  clientes: { id: number; nombre: string }[]
  initial: Oportunidad | null
  onClose: () => void
  onSaved: () => void
}

export function OportunidadForm({ clientes, initial, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [clienteId, setClienteId]           = useState(String(initial?.clienteId ?? ''))
  const [nombre, setNombre]                 = useState(initial?.nombre ?? '')
  const [etapa, setEtapa]                   = useState(initial?.etapa ?? 'Lead')
  const [valor, setValor]                   = useState(initial?.valor ? String(initial.valor) : '')
  const [probabilidad, setProbabilidad]     = useState(initial?.probabilidad ? String(initial.probabilidad) : '')
  const [fechaCierreEst, setFechaCierreEst] = useState(initial?.fechaCierreEst?.split('T')[0] ?? '')
  const [responsable, setResponsable]       = useState(initial?.responsable ?? '')
  const [notas, setNotas]                   = useState(initial?.notas ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteId || !nombre) return
    setSaving(true)

    const body = {
      clienteId,
      nombre,
      etapa,
      valor: valor || null,
      probabilidad: probabilidad || null,
      fechaCierreEst: fechaCierreEst || null,
      responsable: responsable || null,
      notas: notas || null,
    }

    const url = initial ? `/api/oportunidades/${initial.id}` : '/api/oportunidades'
    const method = initial ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSaving(false)
    if (res.ok) onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">
            {initial ? 'Editar oportunidad' : 'Nueva oportunidad'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre de la oportunidad *</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="ej: Cocina Principal - Casa González"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cliente *</label>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Etapa</label>
              <select
                value={etapa}
                onChange={(e) => setEtapa(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ETAPAS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Valor estimado (DOP)</label>
              <input
                type="number"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                min="0"
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Probabilidad (%)</label>
              <input
                type="number"
                value={probabilidad}
                onChange={(e) => setProbabilidad(e.target.value)}
                min="0"
                max="100"
                placeholder="—"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cierre estimado</label>
              <input
                type="date"
                value={fechaCierreEst}
                onChange={(e) => setFechaCierreEst(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Responsable</label>
              <input
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="Nombre del responsable"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notas</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Observaciones adicionales..."
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear oportunidad'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
