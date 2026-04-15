'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { X, Loader2, TrendingUp, TrendingDown, FileText, Briefcase } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  proyectos: { id: number; nombre: string }[]
  clientes: { id: number; nombre: string }[]
  proveedores: { id: number; nombre: string; rnc: string | null }[]
  onClose: () => void
  onSuccess: () => void
}

export function NuevaTransaccionModal({ proyectos, clientes, proveedores, onClose, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  // Campos base
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('egreso')
  const [fecha, setFecha] = useState(today)
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [observaciones, setObservaciones] = useState('')

  // Flags de qué crear
  const [incluyeFactura, setIncluyeFactura] = useState(true)
  const [incluyeGasto, setIncluyeGasto] = useState(false)

  // Campos de factura
  const [numero, setNumero] = useState('')
  const [ncf, setNcf] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [proveedorTexto, setProveedorTexto] = useState('')
  const [rncProveedor, setRncProveedor] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [subtotal, setSubtotal] = useState('')
  const [impuesto, setImpuesto] = useState('')

  // Campos de gasto / proyecto
  const [proyectoId, setProyectoId] = useState('')
  const [destinoTipo, setDestinoTipo] = useState('proyecto')
  const [metodoPago, setMetodoPago] = useState('Efectivo')
  const [cuentaOrigen, setCuentaOrigen] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Autocálculo: si el usuario pone subtotal + impuesto, monto = suma
  const montoCalculado = useMemo(() => {
    const s = parseFloat(subtotal) || 0
    const i = parseFloat(impuesto) || 0
    if (s > 0) return (s + i).toFixed(2)
    return ''
  }, [subtotal, impuesto])

  function handleSubtotalChange(v: string) {
    setSubtotal(v)
    const s = parseFloat(v) || 0
    const i = parseFloat(impuesto) || 0
    if (s > 0) setMonto((s + i).toFixed(2))
  }
  function handleImpuestoChange(v: string) {
    setImpuesto(v)
    const s = parseFloat(subtotal) || 0
    const i = parseFloat(v) || 0
    if (s > 0) setMonto((s + i).toFixed(2))
  }

  // Cuando el usuario selecciona un proveedor del catálogo, rellena RNC
  function handleProveedorSelect(id: string) {
    setProveedorId(id)
    if (id) {
      const p = proveedores.find(x => String(x.id) === id)
      if (p) {
        setProveedorTexto(p.nombre)
        setRncProveedor(p.rnc ?? '')
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!descripcion.trim()) {
      setError('La descripción es obligatoria')
      return
    }
    const total = parseFloat(monto) || 0
    if (total <= 0) {
      setError('El monto debe ser mayor a 0')
      return
    }
    if (!incluyeFactura && !incluyeGasto) {
      setError('Debes incluir al menos factura o gasto')
      return
    }
    if (incluyeGasto && !proyectoId) {
      setError('Para registrar el gasto de proyecto, selecciona un proyecto')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/contabilidad/transacciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          fecha,
          descripcion: descripcion.trim(),
          monto: total,
          observaciones: observaciones.trim() || null,
          crearFactura: incluyeFactura,
          crearGasto: incluyeGasto,
          numero: numero.trim() || null,
          ncf: ncf.trim() || null,
          fechaVencimiento: fechaVencimiento || null,
          proveedorId: proveedorId ? parseInt(proveedorId) : null,
          proveedor: proveedorTexto.trim() || null,
          rncProveedor: rncProveedor.trim() || null,
          clienteId: clienteId ? parseInt(clienteId) : null,
          subtotal: subtotal ? parseFloat(subtotal) : total,
          impuesto: impuesto ? parseFloat(impuesto) : 0,
          proyectoId: proyectoId ? parseInt(proyectoId) : null,
          destinoTipo,
          metodoPago,
          cuentaOrigen: cuentaOrigen.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error al guardar')
      } else {
        onSuccess()
      }
    } catch {
      setError('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Nueva transacción</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* Tipo + Fecha */}
            <div className="grid grid-cols-[1fr_140px] gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setTipo('egreso'); setIncluyeGasto(!!proyectoId) }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      tipo === 'egreso'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" /> Egreso
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTipo('ingreso'); setIncluyeGasto(false) }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      tipo === 'ingreso'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" /> Ingreso
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha *</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required
                  className="w-full h-9 px-2 text-sm border border-border rounded bg-input" />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción *</label>
              <input value={descripcion} onChange={e => setDescripcion(e.target.value)} required
                placeholder="Ej: Compra de materiales, pago inicial..."
                className="w-full h-9 px-2 text-sm border border-border rounded bg-input" />
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                incluyeFactura ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-border'
              }`}>
                <input
                  type="checkbox"
                  checked={incluyeFactura}
                  onChange={e => setIncluyeFactura(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <FileText className="w-3.5 h-3.5" /> Registrar como factura
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Comprobante fiscal, pagos parciales, vencimiento
                  </p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                tipo === 'ingreso' ? 'opacity-40 cursor-not-allowed' :
                incluyeGasto ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-border'
              }`}>
                <input
                  type="checkbox"
                  checked={incluyeGasto}
                  onChange={e => setIncluyeGasto(e.target.checked)}
                  disabled={tipo === 'ingreso'}
                  className="mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Briefcase className="w-3.5 h-3.5" /> Gasto de proyecto
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tipo === 'ingreso' ? 'Solo aplica a egresos' : 'Vincula a proyecto/partida, rastrea stock'}
                  </p>
                </div>
              </label>
            </div>

            {/* Montos */}
            <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">Subtotal</label>
                  <input type="number" step="0.01" value={subtotal} onChange={e => handleSubtotalChange(e.target.value)}
                    className="w-full h-8 px-2 text-sm border border-border rounded bg-background tabular-nums" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">ITBIS</label>
                  <input type="number" step="0.01" value={impuesto} onChange={e => handleImpuestoChange(e.target.value)}
                    className="w-full h-8 px-2 text-sm border border-border rounded bg-background tabular-nums" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">Total *</label>
                  <input type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} required
                    className="w-full h-8 px-2 text-sm border border-primary rounded bg-background tabular-nums font-bold" />
                </div>
              </div>
              {montoCalculado && (
                <p className="text-[10px] text-muted-foreground">Auto-calculado: {formatCurrency(parseFloat(montoCalculado))}</p>
              )}
            </div>

            {/* Campos de factura */}
            {incluyeFactura && (
              <div className="border border-blue-200 dark:border-blue-900 rounded-lg p-3 space-y-3 bg-blue-50/30 dark:bg-blue-900/10">
                <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-400">Datos de factura</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">Número</label>
                    <input value={numero} onChange={e => setNumero(e.target.value)}
                      placeholder="Auto si vacío"
                      className="w-full h-8 px-2 text-sm border border-border rounded bg-background" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">NCF</label>
                    <input value={ncf} onChange={e => setNcf(e.target.value)}
                      className="w-full h-8 px-2 text-sm border border-border rounded bg-background font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">Vencimiento</label>
                    <input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)}
                      className="w-full h-8 px-2 text-sm border border-border rounded bg-background" />
                  </div>
                  <div>
                    {tipo === 'ingreso' ? (
                      <>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">Cliente</label>
                        <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                          className="w-full h-8 px-2 text-sm border border-border rounded bg-background">
                          <option value="">—</option>
                          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </>
                    ) : (
                      <>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">Proveedor</label>
                        <select value={proveedorId} onChange={e => handleProveedorSelect(e.target.value)}
                          className="w-full h-8 px-2 text-sm border border-border rounded bg-background">
                          <option value="">— Escribir manual —</option>
                          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                </div>
                {tipo === 'egreso' && !proveedorId && (
                  <div className="grid grid-cols-[1fr_140px] gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">Nombre proveedor</label>
                      <input value={proveedorTexto} onChange={e => setProveedorTexto(e.target.value)}
                        className="w-full h-8 px-2 text-sm border border-border rounded bg-background" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">RNC</label>
                      <input value={rncProveedor} onChange={e => setRncProveedor(e.target.value)}
                        className="w-full h-8 px-2 text-sm border border-border rounded bg-background font-mono" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Campos de gasto */}
            {incluyeGasto && tipo === 'egreso' && (
              <div className="border border-amber-200 dark:border-amber-900 rounded-lg p-3 space-y-3 bg-amber-50/30 dark:bg-amber-900/10">
                <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">Datos del gasto</p>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">Proyecto *</label>
                  <select value={proyectoId} onChange={e => setProyectoId(e.target.value)}
                    className="w-full h-8 px-2 text-sm border border-border rounded bg-background">
                    <option value="">— Selecciona —</option>
                    {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">Destino</label>
                    <select value={destinoTipo} onChange={e => setDestinoTipo(e.target.value)}
                      className="w-full h-8 px-2 text-sm border border-border rounded bg-background">
                      <option value="proyecto">Proyecto</option>
                      <option value="oficina">Oficina</option>
                      <option value="taller">Taller</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">Método</label>
                    <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
                      className="w-full h-8 px-2 text-sm border border-border rounded bg-background">
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Tarjeta">Tarjeta</option>
                      <option value="Factura">Factura (a crédito)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">Cta origen</label>
                    <input value={cuentaOrigen} onChange={e => setCuentaOrigen(e.target.value)}
                      placeholder="Opcional"
                      className="w-full h-8 px-2 text-sm border border-border rounded bg-background" />
                  </div>
                </div>
              </div>
            )}

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Observaciones</label>
              <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
                className="w-full px-2 py-1 text-sm border border-border rounded bg-input resize-y" />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-border bg-muted/30 flex justify-end gap-2 sticky bottom-0">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : 'Guardar transacción'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
