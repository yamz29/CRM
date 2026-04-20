'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Upload, X, FileText, ArrowUpCircle, ArrowDownCircle,
  Image, Loader2, ScanLine, CheckCircle2, AlertTriangle, FolderOpen, Building2, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Cliente { id: number; nombre: string }
interface Proyecto { id: number; nombre: string }
interface ProveedorCat { id: number; nombre: string; rnc: string | null; telefono: string | null; condicionesPago: string | null }
interface FacturaData {
  id?: number; numero: string; ncf: string; tipo: string
  fecha: string; fechaVencimiento: string; proveedor: string
  rncProveedor: string; clienteId: string; proveedorId?: string
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
  const [proveedorId, setProveedorId] = useState(factura?.proveedorId || '')
  // Proveedor search
  const [proveedorSearch, setProveedorSearch] = useState('')
  const [proveedorResults, setProveedorResults] = useState<ProveedorCat[]>([])
  const [proveedorSearching, setProveedorSearching] = useState(false)
  const [showProvDropdown, setShowProvDropdown] = useState(false)
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

      // Normaliza fecha a YYYY-MM-DD. Acepta también dd/mm/yyyy, d-m-yyyy, etc.
      // Retorna null si no parsea.
      const normalizaFecha = (s: unknown): string | null => {
        if (!s || typeof s !== 'string') return null
        const txt = s.trim()
        // Ya viene como YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt
        // dd/mm/yyyy o dd-mm-yyyy
        const m = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
        if (m) {
          const d = m[1].padStart(2, '0')
          const mo = m[2].padStart(2, '0')
          return `${m[3]}-${mo}-${d}`
        }
        // yyyy/mm/dd
        const m2 = txt.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
        if (m2) {
          return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`
        }
        // Intento final con Date
        const d = new Date(txt)
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
        return null
      }

      if (ext.ncf && !ncf) { setNcf(String(ext.ncf)); filled++ }
      if (ext.rncProveedor && !rncProveedor) {
        setRncProveedor(String(ext.rncProveedor))
        searchRNC(String(ext.rncProveedor))
        filled++
      }
      if (ext.proveedor && !proveedor) { setProveedor(String(ext.proveedor)); filled++ }
      if (ext.numero && !numero) { setNumero(String(ext.numero)); filled++ }
      if (ext.fecha && !fecha) {
        const f = normalizaFecha(ext.fecha)
        if (f) { setFecha(f); filled++ }
      }
      if (ext.fechaVencimiento && !fechaVencimiento) {
        const f = normalizaFecha(ext.fechaVencimiento)
        if (f) { setFechaVencimiento(f); filled++ }
      }
      if (ext.descripcion && !descripcion) { setDescripcion(String(ext.descripcion)); filled++ }
      if (ext.subtotal && !subtotal) { setSubtotal(String(ext.subtotal)); filled++ }
      if (ext.impuesto && !itbis) { setItbis(String(ext.impuesto)); filled++ }
      // Si OCR trae solo total (sin desglose), intenta calcular subtotal asumiendo ITBIS 18%
      if (ext.total && !subtotal && !ext.subtotal) {
        if (ext.impuesto) {
          setSubtotal((ext.total - ext.impuesto).toString())
        } else {
          // Asume ITBIS 18%: subtotal = total / 1.18, impuesto = total - subtotal
          const sub = ext.total / 1.18
          setSubtotal(sub.toFixed(2))
          setItbis((ext.total - sub).toFixed(2))
        }
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
  }, [ncf, rncProveedor, proveedor, numero, fecha, fechaVencimiento, descripcion, subtotal, itbis])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArchivo(file)
      if (file.type.startsWith('image/')) {
        setArchivoPreview(URL.createObjectURL(file))
      } else {
        setArchivoPreview(file.name)
      }
      // OCR automático solo para egresos (gastos de proveedor).
      // Los ingresos los emite la empresa y ya se conocen los datos.
      if (tipo === 'egreso') {
        runOCR(file)
      }
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

  // Search proveedor catalog
  const searchProveedores = useCallback(async (q: string) => {
    if (q.length < 2) { setProveedorResults([]); return }
    setProveedorSearching(true)
    try {
      const res = await fetch(`/api/proveedores?q=${encodeURIComponent(q)}`)
      if (res.ok) setProveedorResults(await res.json())
    } finally {
      setProveedorSearching(false)
    }
  }, [])

  const selectProveedor = (p: ProveedorCat) => {
    setProveedorId(String(p.id))
    setProveedor(p.nombre)
    setRncProveedor(p.rnc || '')
    setProveedorSearch('')
    setShowProvDropdown(false)
    if (p.rnc && p.rnc.length >= 9) setRncMatch(`Proveedor del catálogo: ${p.nombre}`)
  }

  const clearProveedor = () => {
    setProveedorId('')
    setProveedor('')
    setRncProveedor('')
    setRncMatch(null)
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
      if (proveedorId) formData.append('proveedorId', proveedorId)
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
              <Button type="button" variant="ghost" size="sm" onClick={() => { setArchivo(null); setArchivoPreview(''); setOcrResult(null); if (fileRef.current) fileRef.current.value = ''; }}>
                <X className="w-3.5 h-3.5" /> Quitar archivo
              </Button>
              {tipo === 'egreso' && archivo && !ocrLoading && (
                <Button type="button" variant="ghost" size="sm" onClick={() => runOCR(archivo)}>
                  🔍 Releer con OCR
                </Button>
              )}
            </div>
          )}

          {/* Banner de estado del OCR */}
          {ocrLoading && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <p className="text-xs text-blue-700 dark:text-blue-300">Leyendo factura con IA…</p>
            </div>
          )}
          {!ocrLoading && ocrResult && (
            <div className={`px-3 py-2 rounded-lg text-xs border ${
              ocrResult.startsWith('Error')
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            }`}>
              {ocrResult}
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
            <div className="space-y-3">
              {/* Buscador de catálogo */}
              <div>
                <label className={labelCls}>Buscar proveedor del catálogo</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={proveedorSearch}
                    onChange={(e) => { setProveedorSearch(e.target.value); searchProveedores(e.target.value); setShowProvDropdown(true) }}
                    onFocus={() => { if (proveedorResults.length > 0) setShowProvDropdown(true) }}
                    className={`${inputCls} pl-8`}
                    placeholder="Buscar por nombre o RNC..."
                    autoComplete="off"
                  />
                  {proveedorSearching && <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                  {showProvDropdown && proveedorResults.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {proveedorResults.map((p: ProveedorCat) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectProveedor(p)}
                          className="w-full text-left px-3 py-2 hover:bg-muted/60 text-sm flex items-center justify-between gap-2"
                        >
                          <span className="font-medium text-foreground">{p.nombre}</span>
                          {p.rnc && <span className="text-xs text-muted-foreground font-mono">{p.rnc}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {proveedorId && (
                  <div className="flex items-center gap-2 mt-1.5 px-2.5 py-1.5 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg">
                    <Building2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    <span className="text-xs text-green-700 dark:text-green-300 font-medium flex-1">{proveedor}{rncProveedor ? ` · ${rncProveedor}` : ''}</span>
                    <button type="button" onClick={clearProveedor} className="text-green-600 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              {/* Campos manuales (editables siempre, autocompletados desde catálogo) */}
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
                  {rncMatch && !proveedorId && (
                    <p className={`text-xs mt-1 ${rncMatch.includes('encontrado') || rncMatch.includes('previo') || rncMatch.includes('catálogo') ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {rncMatch}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Proveedor / Suplidor</label>
                  <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={inputCls} placeholder="Nombre del proveedor" />
                </div>
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
