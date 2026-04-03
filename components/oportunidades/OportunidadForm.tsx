'use client'

import { useState } from 'react'
import { X, Check, Plus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ETAPAS, type Oportunidad, type PresupuestoOpcion, type UsuarioOpcion } from './PipelineClient'
import { formatCurrency } from '@/lib/utils'

interface Props {
  clientes: { id: number; nombre: string }[]
  presupuestos: PresupuestoOpcion[]
  usuarios: UsuarioOpcion[]
  initial: Oportunidad | null
  onClose: () => void
  onSaved: () => void
}

export function OportunidadForm({ clientes: clientesIniciales, presupuestos, usuarios, initial, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [clientes, setClientes] = useState(clientesIniciales)
  const [clienteId, setClienteId]           = useState(String(initial?.clienteId ?? ''))

  // ── Mini-form crear cliente ────────────────────────────────────
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [nuevoCorreo, setNuevoCorreo] = useState('')
  const [savingCliente, setSavingCliente] = useState(false)

  async function handleCrearCliente() {
    if (!nuevoNombre.trim()) return
    setSavingCliente(true)
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoNombre.trim(), telefono: nuevoTelefono || null, correo: nuevoCorreo || null }),
    })
    if (res.ok) {
      const nuevo = await res.json()
      setClientes(prev => [...prev, { id: nuevo.id, nombre: nuevo.nombre }])
      setClienteId(String(nuevo.id))
      setShowNuevoCliente(false)
      setNuevoNombre(''); setNuevoTelefono(''); setNuevoCorreo('')
    }
    setSavingCliente(false)
  }
  const [nombre, setNombre]                 = useState(initial?.nombre ?? '')
  const [etapa, setEtapa]                   = useState(initial?.etapa ?? 'Lead')
  const [valor, setValor]                   = useState(initial?.valor ? String(initial.valor) : '')
  const [probabilidad, setProbabilidad]     = useState(initial?.probabilidad ? String(initial.probabilidad) : '')
  const [fechaCierreEst, setFechaCierreEst] = useState(initial?.fechaCierreEst?.split('T')[0] ?? '')
  const [responsable, setResponsable]       = useState(initial?.responsable ?? '')
  const [notas, setNotas]                   = useState(initial?.notas ?? '')
  const [presupuestosSeleccionados, setPresupuestosSeleccionados] = useState<number[]>([])

  // Presupuestos del cliente seleccionado sin oportunidad (solo al crear)
  const presupuestosCliente = presupuestos.filter(
    (p) => clienteId && p.clienteId === parseInt(clienteId)
  )

  function togglePresupuesto(id: number, total: number) {
    setPresupuestosSeleccionados((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      // Auto-completar valor con el total del primer presupuesto seleccionado
      if (!prev.includes(id) && next.length === 1 && !valor && total > 0) {
        setValor(String(total))
      }
      return next
    })
  }

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
      ...(!initial && presupuestosSeleccionados.length > 0 ? { presupuestoIds: presupuestosSeleccionados } : {}),
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
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-foreground">
            {initial ? 'Editar oportunidad' : 'Nueva oportunidad'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5">
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
              <div className="flex gap-2">
                <select
                  value={clienteId}
                  onChange={(e) => { setClienteId(e.target.value); setPresupuestosSeleccionados([]) }}
                  required
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNuevoCliente(v => !v)}
                  title="Crear nuevo cliente"
                  className={`flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors shrink-0 ${
                    showNuevoCliente
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Nuevo
                </button>
              </div>

              {/* Mini-form crear cliente */}
              {showNuevoCliente && (
                <div className="mt-2 p-3 border border-border rounded-lg bg-muted/20 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Crear nuevo cliente</p>
                  <input
                    autoFocus
                    value={nuevoNombre}
                    onChange={e => setNuevoNombre(e.target.value)}
                    placeholder="Nombre *"
                    className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={nuevoTelefono}
                      onChange={e => setNuevoTelefono(e.target.value)}
                      placeholder="Teléfono"
                      className="px-2.5 py-1.5 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      value={nuevoCorreo}
                      onChange={e => setNuevoCorreo(e.target.value)}
                      placeholder="Correo"
                      type="email"
                      className="px-2.5 py-1.5 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowNuevoCliente(false)}
                      className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                      Cancelar
                    </button>
                    <button type="button" onClick={handleCrearCliente} disabled={!nuevoNombre.trim() || savingCliente}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg disabled:opacity-50 hover:opacity-90">
                      <Plus className="w-3 h-3" />
                      {savingCliente ? 'Guardando...' : 'Crear cliente'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Vincular cotizaciones existentes — solo al crear */}
            {!initial && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Vincular cotizaciones existentes
                  <span className="ml-1 text-muted-foreground/60 font-normal">(opcional)</span>
                </label>
                {!clienteId ? (
                  <p className="text-xs text-muted-foreground py-2">Selecciona un cliente primero.</p>
                ) : presupuestosCliente.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Sin cotizaciones disponibles para este cliente.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto border border-border rounded-lg p-2">
                    {presupuestosCliente.map((p) => {
                      const selected = presupuestosSeleccionados.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePresupuesto(p.id, p.total)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                            selected
                              ? 'bg-primary/10 border border-primary/30 text-foreground'
                              : 'bg-muted/30 border border-transparent hover:bg-muted/60 text-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded flex items-center justify-center border ${selected ? 'bg-primary border-primary' : 'border-border'}`}>
                              {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                            </div>
                            <span className="font-medium">{p.numero}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${p.estado === 'Aprobado' ? 'bg-green-100 text-green-700' : p.estado === 'Enviado' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                              {p.estado}
                            </span>
                          </div>
                          <span className="font-semibold tabular-nums">{formatCurrency(p.total)}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

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
              <select
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sin asignar</option>
                {usuarios.map((u) => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
              </select>
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

          <div className="flex justify-end gap-2 pt-4">
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
