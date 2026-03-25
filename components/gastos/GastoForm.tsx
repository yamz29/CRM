'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Paperclip, Trash2 } from 'lucide-react'

export interface GastoData {
  id?: number
  fecha: string
  tipoGasto: string
  referencia: string
  descripcion: string
  suplidor: string
  categoria: string
  subcategoria: string
  monto: string
  moneda: string
  metodoPago: string
  cuentaOrigen: string
  observaciones: string
  estado: string
  archivoUrl?: string | null
  destinoTipo?: string           // proyecto | oficina | taller | general | sin_asignar
  proyectoIdSeleccionado?: number | null  // usado en modo general
  partidaId?: number | null
  recursoId?: number | null
  cantidadRecurso?: string
  movimientoStock?: string | null
}

const DESTINOS = [
  { value: 'proyecto',    label: 'Proyecto',           color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'oficina',     label: 'Oficina',             color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'taller',      label: 'Taller',              color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'general',     label: 'General / Admin',     color: 'bg-slate-100 text-slate-600 border-slate-300' },
  { value: 'sin_asignar', label: 'Sin asignar',         color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
]

interface PartidaOption {
  id: number
  descripcion: string
  codigo: string | null
  capituloNombre: string | null
  subtotalPresupuestado: number
}

const TIPOS_GASTO = ['Factura', 'Gasto menor', 'Transferencia', 'Caja chica', 'Compra de materiales', 'Mano de obra', 'Transporte', 'Subcontrato', 'Servicio', 'Otro']
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque', 'Caja chica', 'Otro']
const ESTADOS = ['Registrado', 'Revisado', 'Anulado']
const MONEDAS = ['RD$', 'USD', 'EUR']

const ESTADO_STYLES: Record<string, string> = {
  Registrado: 'bg-blue-100 text-blue-700 border-blue-300',
  Revisado:   'bg-green-100 text-green-700 border-green-300',
  Anulado:    'bg-red-100 text-red-700 border-red-300',
}

const emptyForm: GastoData = {
  fecha: new Date().toISOString().split('T')[0],
  tipoGasto: 'Gasto menor',
  referencia: '', descripcion: '', suplidor: '',
  categoria: '', subcategoria: '', monto: '',
  moneda: 'RD$', metodoPago: 'Efectivo', cuentaOrigen: '',
  observaciones: '', estado: 'Registrado',
  destinoTipo: 'sin_asignar', proyectoIdSeleccionado: null,
  partidaId: null, recursoId: null, cantidadRecurso: '', movimientoStock: null,
}

export function GastoForm({
  proyectoId,
  proyectos,
  initial,
  onClose,
  onSaved,
}: {
  proyectoId?: number | null
  proyectos?: { id: number; nombre: string }[]
  initial?: GastoData | null
  onClose: () => void
  onSaved: () => void
}) {
  // In project context: destinoTipo defaults to 'proyecto'
  const defaultForm: GastoData = proyectoId
    ? { ...emptyForm, destinoTipo: 'proyecto' }
    : emptyForm
  const [form, setForm] = useState<GastoData>(initial ?? defaultForm)
  const modoGeneral = !proyectoId  // true = sin proyecto fijo
  const [archivo, setArchivo] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partidas, setPartidas] = useState<PartidaOption[]>([])
  const [recursosStock, setRecursosStock] = useState<{ id: number; nombre: string; unidad: string; stock: number; tipo: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const isEdit = Boolean(initial?.id)

  useEffect(() => {
    // Fetch partidas only in project context
    const pid = proyectoId ?? (form.destinoTipo === 'proyecto' ? form.proyectoIdSeleccionado : null)
    if (pid) {
      fetch(`/api/proyectos/${pid}/partidas`)
        .then(r => r.ok ? r.json() : [])
        .then(d => setPartidas(Array.isArray(d) ? d : []))
        .catch(() => {})
    } else {
      setPartidas([])
    }
    fetch('/api/recursos?controlarStock=true&activo=true')
      .then(r => r.ok ? r.json() : [])
      .then(d => setRecursosStock(Array.isArray(d) ? d : []))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, form.proyectoIdSeleccionado, form.destinoTipo])

  function set(key: keyof GastoData, value: string) {
    setForm(p => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.descripcion.trim()) { setError('La descripción es requerida'); return }
    if (!form.fecha) { setError('La fecha es requerida'); return }
    if (!form.monto || isNaN(parseFloat(form.monto))) { setError('El monto debe ser un número válido'); return }
    if (parseFloat(form.monto) < 0) { setError('El monto no puede ser negativo'); return }

    setLoading(true)
    try {
      // Determine endpoint: project context uses project API, general uses /api/gastos
      const baseUrl = proyectoId
        ? (isEdit ? `/api/proyectos/${proyectoId}/gastos/${initial!.id}` : `/api/proyectos/${proyectoId}/gastos`)
        : (isEdit ? `/api/gastos/${initial!.id}` : `/api/gastos`)
      const method = isEdit ? 'PUT' : 'POST'

      // Build payload — include destinoTipo and proyectoId for general mode
      const payload = {
        ...form,
        ...(modoGeneral && {
          destinoTipo: form.destinoTipo || 'sin_asignar',
          proyectoId: form.destinoTipo === 'proyecto' ? form.proyectoIdSeleccionado : null,
        }),
      }

      let res: Response
      if (archivo) {
        const fd = new FormData()
        Object.entries(payload).forEach(([k, v]) => { if (v != null) fd.append(k, String(v)) })
        if (payload.partidaId != null) fd.set('partidaId', String(payload.partidaId))
        fd.append('archivo', archivo)
        res = await fetch(baseUrl, { method, body: fd })
      } else {
        res = await fetch(baseUrl, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al guardar'); return }
      onSaved(); onClose()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  // Group partidas by chapter for optgroup
  const gruposPartidas = partidas.reduce((acc, p) => {
    const g = p.capituloNombre ?? 'Sin capítulo'
    if (!acc.find(x => x.nombre === g)) acc.push({ nombre: g, items: [] })
    acc.find(x => x.nombre === g)!.items.push(p)
    return acc
  }, [] as { nombre: string; items: PartidaOption[] }[])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-800">
            {isEdit ? 'Editar gasto' : 'Registrar nuevo gasto'}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
          )}

          {/* Destino / Centro de costo — solo en modo general */}
          {modoGeneral && (
            <div className="space-y-2">
              <Label className="text-xs">Destino / Centro de costo *</Label>
              <div className="flex flex-wrap gap-1.5">
                {DESTINOS.map(d => (
                  <button key={d.value} type="button"
                    onClick={() => setForm(p => ({ ...p, destinoTipo: d.value, proyectoIdSeleccionado: d.value === 'proyecto' ? p.proyectoIdSeleccionado : null }))}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      form.destinoTipo === d.value ? d.color : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {form.destinoTipo === 'proyecto' && proyectos && (
                <div className="space-y-1">
                  <Label className="text-xs">Proyecto *</Label>
                  <select
                    value={form.proyectoIdSeleccionado ?? ''}
                    onChange={e => setForm(p => ({ ...p, proyectoIdSeleccionado: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white"
                  >
                    <option value="">— Seleccionar proyecto —</option>
                    {proyectos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Row 1: fecha | tipo | método pago */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} required className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <select value={form.tipoGasto} onChange={e => set('tipoGasto', e.target.value)}
                className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white">
                {TIPOS_GASTO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Método pago</Label>
              <select value={form.metodoPago} onChange={e => set('metodoPago', e.target.value)}
                className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white">
                {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: descripción */}
          <div className="space-y-1">
            <Label className="text-xs">Descripción *</Label>
            <Input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} required
              className="h-8 text-xs" placeholder="Ej: Compra de cemento 50 sacos" />
          </div>

          {/* Row 3: referencia | suplidor | categoría */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Referencia</Label>
              <Input value={form.referencia} onChange={e => set('referencia', e.target.value)}
                className="h-8 text-xs" placeholder="FAC-001" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Suplidor</Label>
              <Input value={form.suplidor} onChange={e => set('suplidor', e.target.value)}
                className="h-8 text-xs" placeholder="Ferretería El Toro" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoría</Label>
              <Input value={form.categoria} onChange={e => set('categoria', e.target.value)}
                className="h-8 text-xs" placeholder="Materiales" />
            </div>
          </div>

          {/* Row 4: monto | moneda | subcategoría */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Monto *</Label>
              <Input type="number" step="0.01" min="0" value={form.monto} onChange={e => set('monto', e.target.value)} required
                className="h-8 text-xs" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Moneda</Label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
                className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white">
                {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subcategoría</Label>
              <Input value={form.subcategoria} onChange={e => set('subcategoria', e.target.value)}
                className="h-8 text-xs" placeholder="Cemento" />
            </div>
          </div>

          {/* Row 5: partida | cuenta origen */}
          <div className="grid grid-cols-2 gap-3">
            {partidas.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Partida presupuestaria <span className="text-slate-400">(opcional)</span></Label>
                <select
                  value={form.partidaId ?? ''}
                  onChange={e => setForm(p => ({ ...p, partidaId: e.target.value ? parseInt(e.target.value) : null }))}
                  className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white"
                >
                  <option value="">— Sin asignar —</option>
                  {gruposPartidas.map(grupo => (
                    <optgroup key={grupo.nombre} label={grupo.nombre}>
                      {grupo.items.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.codigo ? `[${p.codigo}] ` : ''}{p.descripcion}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Cuenta / Caja origen</Label>
              <Input value={form.cuentaOrigen} onChange={e => set('cuentaOrigen', e.target.value)}
                className="h-8 text-xs" placeholder="Cuenta Principal" />
            </div>
          </div>

          {/* Row 5b: recurso de inventario (opcional) */}
          {recursosStock.length > 0 && (
            <div className="space-y-2 border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Movimiento de inventario <span className="font-normal text-slate-400">(opcional)</span></p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs">Recurso</Label>
                  <select
                    value={form.recursoId ?? ''}
                    onChange={e => setForm(p => ({
                      ...p,
                      recursoId: e.target.value ? parseInt(e.target.value) : null,
                      movimientoStock: e.target.value ? (p.movimientoStock || 'salida') : null,
                    }))}
                    className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white"
                  >
                    <option value="">— Sin recurso —</option>
                    {recursosStock.map(r => (
                      <option key={r.id} value={r.id}>{r.nombre} (stock: {r.stock} {r.unidad})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" step="0.01" min="0"
                    value={form.cantidadRecurso ?? ''}
                    onChange={e => set('cantidadRecurso', e.target.value)}
                    disabled={!form.recursoId}
                    className="h-8 text-xs" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Movimiento</Label>
                  <select
                    value={form.movimientoStock ?? 'salida'}
                    onChange={e => setForm(p => ({ ...p, movimientoStock: e.target.value || null }))}
                    disabled={!form.recursoId}
                    className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white disabled:opacity-50"
                  >
                    <option value="salida">Salida (consumo)</option>
                    <option value="entrada">Entrada (compra)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Row 6: estado */}
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <div className="flex gap-1.5">
              {ESTADOS.map(est => (
                <button key={est} type="button"
                  onClick={() => set('estado', est)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    form.estado === est ? ESTADO_STYLES[est] : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>
          </div>

          {/* Row 7: observaciones | adjunto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Observaciones</Label>
              <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2}
                className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Notas adicionales..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Paperclip className="w-3 h-3" /> Soporte</Label>
              {form.archivoUrl && !archivo && (
                <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 rounded px-2 py-1.5 border border-slate-200">
                  <Paperclip className="w-3 h-3 text-blue-500 flex-shrink-0" />
                  <a href={form.archivoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                    Ver adjunto
                  </a>
                  <button type="button" onClick={() => set('archivoUrl', '')} className="ml-auto text-red-400 hover:text-red-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              {archivo ? (
                <div className="flex items-center gap-1 text-xs text-slate-700 bg-blue-50 rounded px-2 py-1.5 border border-blue-200">
                  <Paperclip className="w-3 h-3 text-blue-500 flex-shrink-0" />
                  <span className="truncate">{archivo.name}</span>
                  <button type="button" onClick={() => setArchivo(null)} className="ml-auto text-red-400 hover:text-red-600 flex-shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ) : !form.archivoUrl && (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-slate-500 border border-dashed border-slate-300 rounded-md px-2 py-1.5 w-full hover:border-blue-400 hover:text-blue-600 transition-colors">
                  <Paperclip className="w-3 h-3" />
                  Adjuntar (PDF, JPG, PNG)
                </button>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden" onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button type="submit" disabled={loading} size="sm">
              {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Registrar gasto'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
