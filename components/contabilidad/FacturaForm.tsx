'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Upload, X, FileText, ArrowUpCircle, ArrowDownCircle,
  Image, Loader2, ScanLine, CheckCircle2, AlertTriangle, FolderOpen, Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Cliente { id: number; nombre: string }
interface Proyecto { id: number; nombre: string }
interface FacturaData {
  id?: number; numero: string; ncf: string; tipo: string
  fecha: string; fechaVencimiento: string; proveedor: string
  rncProveedor: string; clienteId: string
  destinoTipo: string; proyectoId: string
  descripcion: string; subtotal: number; impuesto: number; total: number
  observaciones: string; archivoUrl: string | null
}

interface Props {
  clientes: Cliente[]
  proyectos: Proyecto[]
  factura?: FacturaData
}


const DESTINOS = [
  { value: 'general', label: 'General' },
  { value: 'proyecto', label: 'Proyecto' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'taller', label: 'Taller' },
]

export function FacturaForm({ clientes, proyectos, factura }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const isEdit = !!factura?.id

  const [numero, setNumero] = useState(factura?.numero || '')
  const [ncf, setNcf] = useState(factura?.ncf || '')
  const [tipo, setTipo] = useState(factura?.tipo || 'egreso')
  const [fecha, setFecha] = useState(factura?.fecha || new Date().toISOString().slice(0, 10))
  const [fechaVencimiento, setFechaVencimiento] = useState(factura?.fechaVencimiento || '')
  const [proveedor, setProveedor] = useState(factura?.proveedor || '')
  const [rncProveedor, setRncProveedor] = useState(factura?.rncProveedor || '')
  const [clienteId, setClienteId] = useState(factura?.clienteId || '')
  const [destinoTipo, setDestinoTipo] = useState(factura?.destinoTipo || 'general')
  const [proyectoId, setProyectoId] = useState(factura?.proyectoId || '')
  const [descripcion, setDescripcion] = useState(factura?.descripcion || '')
  const [subtotal, setSubtotal] = useState(factura?.subtotal?.toString() || '')
  const [itbis, setItbis] = useState(factura?.impuesto?.toString() || '')
  const [observaciones, setObservaciones] = useState(factura?.observaciones || '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [archivoPreview, setArchivoPreview] = useState(factura?.archivoUrl || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<string | null>(null)
  // RNC match state
  const [rncMatch, setRncMatch] = useState<string | null>(null)
  const [rncSearching, setRncSearching] = useState(false)

  const subtotalNum = parseFloat(subtotal) || 0
  const itbisNum = parseFloat(itbis) || 0
  const total = subtotalNum + itbisNum

  // ── OCR via Gemini Vision API (server-side) ──
  const runOCR = useCallback(async (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      setOcrResult('OCR solo funciona con imágenes o PDF')
      return
    }

    setOcrLoading(true)
    setOcrResult(null)

    try {
      const formData = new FormData()
      formData.append('archivo', file)

      const res = await fetch('/api/contabilidad/ocr', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setOcrResult(`Error OCR: ${data.error}`)
        return
      }

      const ext = data.extracted
      let filled = 0

      if (ext.ncf && !ncf) { setNcf(ext.ncf); filled++ }
      if (ext.rncProveedor && !rncProveedor) {
        setRncProveedor(ext.rncProveedor)
        searchRNC(ext.rncProveedor)
        filled++
      }
      if (ext.proveedor && !proveedor) { setProveedor(ext.proveedor); filled++ }
      if (ext.numero && !numero) { setNumero(ext.numero); filled++ }
      if (ext.fecha && !fecha) { setFecha(ext.fecha); filled++ }
      if (ext.descripcion && !descripcion) { setDescripcion(ext.descripcion); filled++ }
      if (ext.subtotal && !subtotal) { setSubtotal(ext.subtotal.toString()); filled++ }
      if (ext.impuesto && !itbis) { setItbis(ext.impuesto.toString()); filled++ }
      if (ext.total && !subtotal && !ext.subtotal && ext.impuesto) {
        setSubtotal((ext.total - ext.impuesto).toString())
        filled++
      }

      setOcrResult(
        filled > 0
          ? `OCR completado — ${filled} campo${filled > 1 ? 's' : ''} autocompletado${filled > 1 ? 's' : ''}. Verifica los datos.`
          : 'OCR completado — no se detectaron datos nuevos.'
      )
    } catch (err: any) {
      console.error('OCR error:', err)
      setOcrResult(`Error OCR: ${err.message}`)
    } finally {
      setOcrLoading(false)
    }
  }, [ncf, rncProveedor, proveedor, numero, fecha, descripcion, subtotal, itbis])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArchivo(file)
      if (file.type.startsWith('image/')) {
        setArchivoPreview(URL.createObjectURL(file))
      } else {
        setArchivoPreview(file.name)
      }
      // OCR disabled — manual entry preferred
      // runOCR(file)
    }
  }

  // ── RNC search ──
  const searchRNC = useCallback(async (rnc: string) => {
    if (rnc.length < 9) { setRncMatch(null); return }
    setRncSearching(true)
    try {
      const res = await fetch(`/api/contabilidad/rnc-search?rnc=${encodeURIComponent(rnc)}`)
      const data = await res.json()

      if (data.cliente) {
        setRncMatch(`Cliente encontrado: ${data.cliente.nombre}`)
        if (!proveedor) setProveedor(data.cliente.nombre)
      } else if (data.proveedorPrevio) {
        setRncMatch(`Proveedor previo: ${data.proveedorPrevio.nombre}`)
        if (!proveedor) setProveedor(data.proveedorPrevio.nombre)
      } else {
        setRncMatch('RNC no encontrado en el sistema')
      }
    } catch {
      setRncMatch(null)
    } finally {
      setRncSearching(false)
    }
  }, [proveedor])

  const handleRncBlur = () => {
    if (rncProveedor.length >= 9) searchRNC(rncProveedor)
  }

  const calcITBIS = () => {
    setItbis((subtotalNum * 0.18).toFixed(2))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!numero.trim()) { setError('Número de factura es requerido'); return }
    setLoading(true); setError('')

    const formData = new FormData()
    formData.append('numero', numero.trim())
    formData.append('ncf', ncf)
    formData.append('tipo', tipo)
    formData.append('fecha', fecha)
    if (fechaVencimiento) formData.append('fechaVencimiento', fechaVencimiento)
    if (tipo === 'egreso') {
      formData.append('proveedor', proveedor)
      formData.append('rncProveedor', rncProveedor)
    }
    if (tipo === 'ingreso' && clienteId) formData.append('clienteId', clienteId)
    formData.append('destinoTipo', destinoTipo)
    if (destinoTipo === 'proyecto' && proyectoId) formData.append('proyectoId', proyectoId)
    formData.append('descripcion', descripcion)
    formData.append('subtotal', subtotalNum.toString())
    formData.append('impuesto', itbisNum.toString())
    formData.append('total', total.toString())
    formData.append('observaciones', observaciones)
    if (archivo) formData.append('archivo', archivo)

    const url = isEdit ? `/api/contabilidad/facturas/${factura!.id}` : '/api/contabilidad/facturas'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, { method, body: formData })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error al guardar')
      }
      const data = await res.json()
      router.push(`/contabilidad/facturas/${data.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/contabilidad" className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted/40">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{isEdit ? 'Editar Factura' : 'Nueva Factura'}</h1>
          <p className="text-sm text-muted-foreground">Registra una factura de ingreso o egreso</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Upload ── */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Upload className="w-4 h-4" /> Foto / Archivo de Factura
          </h3>
          <p className="text-xs text-muted-foreground">Sube una foto o PDF de la factura</p>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
          >
            {archivoPreview && (archivoPreview.startsWith('blob:') || archivoPreview.startsWith('/uploads')) ? (
              <div className="space-y-2">
                {archivoPreview.match(/\.(jpg|jpeg|png|webp)$/i) || archivoPreview.startsWith('blob:') ? (
                  <img src={archivoPreview.startsWith('/uploads') ? `/api${archivoPreview}` : archivoPreview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                ) : (
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
                )}
                <p className="text-xs text-muted-foreground">{archivo?.name || 'Archivo actual'}</p>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click para subir foto o PDF</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP, PDF — Máx. 10MB</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />

          {(archivo || archivoPreview) && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setArchivo(null); setArchivoPreview(''); if (fileRef.current) fileRef.current.value = ''; }}>
                <X className="w-3.5 h-3.5" /> Quitar archivo
              </Button>
            </div>
          )}

        </div>

        {/* ── Tipo ── */}
        <div className="flex gap-3">
          <button type="button" onClick={() => setTipo('egreso')}
            className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-colors ${
              tipo === 'egreso' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-border bg-card hover:bg-muted/40'
            }`}
          >
            <ArrowDownCircle className={`w-5 h-5 ${tipo === 'egreso' ? 'text-red-500' : 'text-muted-foreground'}`} />
            <span className={`font-medium ${tipo === 'egreso' ? 'text-red-700 dark:text-red-400' : ''}`}>Egreso (Gasto)</span>
          </button>
          <button type="button" onClick={() => setTipo('ingreso')}
            className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-colors ${
              tipo === 'ingreso' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-border bg-card hover:bg-muted/40'
            }`}
          >
            <ArrowUpCircle className={`w-5 h-5 ${tipo === 'ingreso' ? 'text-green-500' : 'text-muted-foreground'}`} />
            <span className={`font-medium ${tipo === 'ingreso' ? 'text-green-700 dark:text-green-400' : ''}`}>Ingreso (Cobro)</span>
          </button>
        </div>

        {/* ── Main fields ── */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Número de Factura *</label>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} className={inputCls} placeholder="FAC-001" required />
            </div>
            <div>
              <label className={labelCls}>NCF / e-CF</label>
              <input value={ncf} onChange={(e) => setNcf(e.target.value)} className={inputCls} placeholder="B0100000001" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Fecha Vencimiento</label>
              <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Proveedor / Cliente */}
          {tipo === 'egreso' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>RNC Proveedor</label>
                <div className="relative">
                  <input
                    value={rncProveedor}
                    onChange={(e) => setRncProveedor(e.target.value)}
                    onBlur={handleRncBlur}
                    className={inputCls}
                    placeholder="123456789"
                  />
                  {rncSearching && <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                </div>
                {rncMatch && (
                  <p className={`text-xs mt-1 ${rncMatch.includes('encontrado') || rncMatch.includes('previo') ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {rncMatch}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Proveedor / Suplidor</label>
                <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={inputCls} placeholder="Nombre del proveedor" />
              </div>
            </div>
          ) : (
            <div>
              <label className={labelCls}>Cliente</label>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Descripción</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} rows={2} placeholder="Detalle de la factura..." />
          </div>
        </div>

        {/* ── Destino / Proyecto ── */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FolderOpen className="w-4 h-4" /> Asignar a
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Destino</label>
              <select value={destinoTipo} onChange={(e) => setDestinoTipo(e.target.value)} className={inputCls}>
                {DESTINOS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            {destinoTipo === 'proyecto' && (
              <div>
                <label className={labelCls}>Proyecto</label>
                <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar proyecto...</option>
                  {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── Montos ── */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Montos</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Subtotal</label>
              <input type="number" step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>
                ITBIS
                <button type="button" onClick={calcITBIS} className="ml-2 text-primary text-[10px] hover:underline">Calc. 18%</button>
              </label>
              <input type="number" step="0.01" value={itbis} onChange={(e) => setItbis(e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Total</label>
              <div className="px-2.5 py-1.5 text-sm border border-border rounded-md bg-muted/40 font-bold tabular-nums">
                RD$ {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Observaciones ── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <label className={labelCls}>Observaciones</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={inputCls} rows={2} />
        </div>

        {/* ── Submit ── */}
        <div className="flex justify-end gap-3">
          <Link href="/contabilidad"><Button type="button" variant="outline">Cancelar</Button></Link>
          <Button type="submit" disabled={loading}>
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Factura')}
          </Button>
        </div>
      </form>
    </div>
  )
}
