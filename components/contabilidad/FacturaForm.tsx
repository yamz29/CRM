'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Upload, X, FileText, ArrowUpCircle, ArrowDownCircle,
  Image, Loader2, ScanLine, CheckCircle2, AlertTriangle, FolderOpen, Building2, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { compressImage, enhanceForOCR } from '@/lib/compress-image'
import { carpetaFactura, nombreArchivoFactura } from '@/lib/factura-sp-path'
import { initMsal, isLoggedIn, loginOneDrive } from '@/lib/onedrive'
import { ensureFolder, uploadSmallFile, uploadLargeFile, getSharePointShareLink } from '@/lib/sharepoint'

interface Cliente { id: number; nombre: string }
interface Proyecto { id: number; nombre: string }
interface ProveedorCat { id: number; nombre: string; rnc: string | null; telefono: string | null; condicionesPago: string | null }
interface FacturaData {
  id?: number; numero: string; ncf: string; tipo: string
  fecha: string; fechaVencimiento: string; proveedor: string
  rncProveedor: string; clienteId: string; proveedorId?: string
  destinoTipo: string; proyectoId: string
  descripcion: string
  subtotal: number; tasaItbis?: number; impuesto: number
  propinaLegal?: number; otrosImpuestos?: number
  total: number
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
  const [tasaItbis, setTasaItbis] = useState<number>(factura?.tasaItbis ?? 18)
  const [itbis, setItbis] = useState(factura?.impuesto?.toString() || '')
  const [propinaLegal, setPropinaLegal] = useState(factura?.propinaLegal?.toString() || '')
  const [otrosImpuestos, setOtrosImpuestos] = useState(factura?.otrosImpuestos?.toString() || '')
  const [showPropinaLegal, setShowPropinaLegal] = useState(!!factura?.propinaLegal && factura.propinaLegal > 0)
  const [showOtrosImpuestos, setShowOtrosImpuestos] = useState(!!factura?.otrosImpuestos && factura.otrosImpuestos > 0)
  const [observaciones, setObservaciones] = useState(factura?.observaciones || '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [archivoPreview, setArchivoPreview] = useState(factura?.archivoUrl || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<string | null>(null)
  // SharePoint upload state
  const [spState, setSpState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [spMessage, setSpMessage] = useState<string | null>(null)
  // RNC match state
  const [rncMatch, setRncMatch] = useState<string | null>(null)
  const [rncSearching, setRncSearching] = useState(false)

  const subtotalNum = parseFloat(subtotal) || 0
  const itbisNum = parseFloat(itbis) || 0
  const propinaLegalNum = parseFloat(propinaLegal) || 0
  const otrosImpuestosNum = parseFloat(otrosImpuestos) || 0
  const total = subtotalNum + itbisNum + propinaLegalNum + otrosImpuestosNum

  // Recalcula ITBIS al cambiar subtotal o tasa (solo si el usuario no lo tocó manualmente)
  // Si el ITBIS actual coincide con subtotal × tasa anterior, lo actualizamos.
  const recalcItbis = (nuevoSubtotal: string, nuevaTasa?: number) => {
    const s = parseFloat(nuevoSubtotal) || 0
    const t = nuevaTasa ?? tasaItbis
    const nuevo = +((s * t) / 100).toFixed(2)
    setItbis(nuevo > 0 ? nuevo.toString() : '')
  }

  // ── OCR multi-provider (server-side: Claude o Gemini) ──
  const runOCR = useCallback(async (file: File, forceProvider?: 'claude' | 'gemini') => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      setOcrResult('OCR solo funciona con imágenes o PDF')
      return
    }

    setOcrLoading(true)
    setOcrResult(null)

    try {
      // Pre-procesa la imagen para OCR (corrige EXIF, aumenta contraste,
      // enfoca texto). PDFs se mandan tal cual.
      let fileForOcr = file
      try { fileForOcr = await enhanceForOCR(file) }
      catch (e) { console.warn('enhanceForOCR falló, usando original:', e) }

      const formData = new FormData()
      formData.append('archivo', fileForOcr)

      const ocrUrl = forceProvider
        ? `/api/contabilidad/ocr?provider=${forceProvider}`
        : '/api/contabilidad/ocr'
      const res = await fetch(ocrUrl, { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setOcrResult(`Error OCR: ${data.error}`)
        return
      }

      const ext = data.extracted
      let filled = 0

      // Normaliza fecha a YYYY-MM-DD estricto. iOS Safari rechaza cualquier
      // otro formato con DOMException, por eso validamos año/mes/día.
      const normalizaFecha = (s: unknown): string | null => {
        if (!s || typeof s !== 'string') return null
        let txt = s.trim()

        let y = 0, mo = 0, d = 0
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(txt)) {
          const [ys, ms, ds] = txt.split('-')
          y = +ys; mo = +ms; d = +ds
        } else {
          // dd/mm/yyyy o dd-mm-yyyy
          const m = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
          if (m) { d = +m[1]; mo = +m[2]; y = +m[3] }
          else {
            // yyyy/mm/dd
            const m2 = txt.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
            if (m2) { y = +m2[1]; mo = +m2[2]; d = +m2[3] }
            else {
              // Último intento: parser nativo
              const dt = new Date(txt)
              if (!isNaN(dt.getTime())) {
                y = dt.getFullYear(); mo = dt.getMonth() + 1; d = dt.getDate()
              }
            }
          }
        }

        // Validación estricta de rangos
        if (y < 2000 || y > 2100) return null
        if (mo < 1 || mo > 12) return null
        if (d < 1 || d > 31) return null

        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }

      // Aisla cada setState en try/catch. iOS Safari es muy estricto con
      // <input type=date> y puede lanzar DOMException sincrónicamente; sin
      // este aislamiento, un fallo en cualquier campo aborta todo el OCR.
      const safeSet = <T,>(setter: (v: T) => void, value: T, fieldName: string) => {
        try { setter(value); filled++ }
        catch (e) { console.warn(`No se pudo setear ${fieldName}:`, e) }
      }

      if (ext.ncf && !ncf) safeSet(setNcf, String(ext.ncf), 'ncf')
      if (ext.rncProveedor && !rncProveedor) {
        safeSet(setRncProveedor, String(ext.rncProveedor), 'rncProveedor')
        try { searchRNC(String(ext.rncProveedor)) } catch { /* no-op */ }
      }
      if (ext.proveedor && !proveedor) safeSet(setProveedor, String(ext.proveedor), 'proveedor')
      if (ext.numero && !numero) safeSet(setNumero, String(ext.numero), 'numero')
      if (ext.fecha && !fecha) {
        const f = normalizaFecha(ext.fecha)
        if (f) safeSet(setFecha, f, 'fecha')
      }
      if (ext.fechaVencimiento && !fechaVencimiento) {
        const f = normalizaFecha(ext.fechaVencimiento)
        if (f) safeSet(setFechaVencimiento, f, 'fechaVencimiento')
      }
      if (ext.descripcion && !descripcion) safeSet(setDescripcion, String(ext.descripcion), 'descripcion')
      if (ext.subtotal && !subtotal) safeSet(setSubtotal, String(ext.subtotal), 'subtotal')
      if (ext.impuesto && !itbis) safeSet(setItbis, String(ext.impuesto), 'impuesto')

      // Tasa ITBIS explícita del OCR (18/16/0)
      if (ext.tasaItbis != null && [0, 16, 18].includes(Number(ext.tasaItbis))) {
        safeSet(setTasaItbis, Number(ext.tasaItbis), 'tasaItbis')
      }

      // Propina Legal 10% (restaurantes/hoteles — Ley 228)
      if (ext.propinaLegal && Number(ext.propinaLegal) > 0) {
        safeSet(setPropinaLegal, String(ext.propinaLegal), 'propinaLegal')
        try { setShowPropinaLegal(true) } catch { /* no-op */ }
      }

      // Otros impuestos (ISC, CDT, selectivo)
      if (ext.otrosImpuestos && Number(ext.otrosImpuestos) > 0) {
        safeSet(setOtrosImpuestos, String(ext.otrosImpuestos), 'otrosImpuestos')
        try { setShowOtrosImpuestos(true) } catch { /* no-op */ }
      }

      // Si OCR trae solo total (sin desglose), calcula subtotal asumiendo ITBIS 18%
      if (ext.total && !subtotal && !ext.subtotal) {
        try {
          if (ext.impuesto) {
            setSubtotal(String(ext.total - ext.impuesto))
          } else {
            const sub = Number(ext.total) / 1.18
            setSubtotal(sub.toFixed(2))
            setItbis((Number(ext.total) - sub).toFixed(2))
          }
          filled++
        } catch (e) { console.warn('No se pudo calcular subtotal:', e) }
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
  }, [ncf, rncProveedor, proveedor, numero, fecha, fechaVencimiento, descripcion, subtotal, itbis, tasaItbis, propinaLegal, otrosImpuestos])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0]
    if (!raw) return

    // Comprime imágenes grandes (fotos de iPhone/Android pesan 5–10MB y
    // generan HTTP 413 en el servidor). PDFs pasan sin tocar.
    let file = raw
    try {
      file = await compressImage(raw)
      if (file !== raw) {
        console.log(`Comprimido: ${(raw.size / 1024).toFixed(0)}KB → ${(file.size / 1024).toFixed(0)}KB`)
      }
    } catch (err) {
      console.warn('Compresión falló, usando original:', err)
      file = raw
    }

    setArchivo(file)
    if (file.type.startsWith('image/')) {
      try { setArchivoPreview(URL.createObjectURL(file)) }
      catch { setArchivoPreview(file.name) }
    } else {
      setArchivoPreview(file.name)
    }
    // OCR automático solo para egresos (gastos de proveedor).
    // Los ingresos los emite la empresa y ya se conocen los datos.
    if (tipo === 'egreso') {
      runOCR(file)
    }
  }

  // ── RNC search ──
  // Prioridad: Proveedor del catálogo → Cliente → Factura previa → DGII oficial.
  const searchRNC = useCallback(async (rnc: string) => {
    if (rnc.length < 9) { setRncMatch(null); return }
    setRncSearching(true)
    try {
      const res = await fetch(`/api/contabilidad/rnc-search?rnc=${encodeURIComponent(rnc)}`)
      const data = await res.json()

      if (data.proveedor) {
        setRncMatch(`Proveedor del catálogo: ${data.proveedor.nombre}`)
        if (!proveedor) setProveedor(data.proveedor.nombre)
        if (!proveedorId) setProveedorId(String(data.proveedor.id))
      } else if (data.cliente) {
        setRncMatch(`Cliente encontrado: ${data.cliente.nombre}`)
        if (!proveedor) setProveedor(data.cliente.nombre)
      } else if (data.proveedorPrevio) {
        setRncMatch(`Proveedor previo: ${data.proveedorPrevio.nombre}`)
        if (!proveedor) setProveedor(data.proveedorPrevio.nombre)
      } else if (data.dgii) {
        // Nombre oficial DGII. Si el estado no es ACTIVO, avisamos.
        const estadoMark = data.dgii.estado && data.dgii.estado !== 'ACTIVO'
          ? ` (${data.dgii.estado})`
          : ''
        const nombreDgii = data.dgii.nombreComercial || data.dgii.nombre
        setRncMatch(`DGII: ${nombreDgii}${estadoMark}`)
        if (!proveedor) setProveedor(nombreDgii)
      } else {
        setRncMatch('RNC no encontrado — se creará nuevo proveedor')
      }
    } catch {
      setRncMatch(null)
    } finally {
      setRncSearching(false)
    }
  }, [proveedor, proveedorId])

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

  // ── Subida best-effort a SharePoint ───────────────────────────────
  // Estructura: /<SP_ROOT>/Facturas/YYYY/MM/Proveedor-FAC-NNNN.ext
  // Se corre DESPUÉS de guardar la factura. Si falla, no revierte nada
  // — la factura queda guardada solo con archivoUrl local.
  async function subirASharepoint(facturaId: number, file: File) {
    setSpState('uploading')
    setSpMessage('Subiendo a SharePoint…')
    try {
      // Asegurar sesión MSAL
      try {
        await initMsal()
        if (!isLoggedIn()) {
          const ok = await loginOneDrive()
          if (!ok) throw new Error('No se pudo iniciar sesión en SharePoint')
        }
      } catch (e) {
        setSpState('error')
        setSpMessage('No hay sesión de SharePoint (se guardó solo local).')
        throw e
      }

      const folderPath = carpetaFactura(fecha || new Date())
      const fileName = nombreArchivoFactura(proveedor, numero, file.name, facturaId)

      await ensureFolder(folderPath)

      const FOUR_MB = 4 * 1024 * 1024
      const item = file.size < FOUR_MB
        ? await uploadSmallFile(folderPath, fileName, await file.arrayBuffer())
        : await uploadLargeFile(folderPath, fileName, file)

      if (!item) throw new Error('Upload no devolvió resultado')

      const shareUrl = await getSharePointShareLink(item.id)

      // Persistir la URL en la factura (no crítico — si falla solo queda local)
      try {
        await fetch(`/api/contabilidad/facturas/${facturaId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sharepointUrl: shareUrl }),
        })
      } catch (patchErr) {
        console.warn('No se pudo guardar sharepointUrl en la factura:', patchErr)
      }

      setSpState('success')
      setSpMessage(`Subida a SharePoint (${folderPath}/${fileName}).`)
    } catch (e) {
      console.error('SP upload error:', e)
      if (spState !== 'error') setSpState('error')
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setSpMessage(`Subida a SP falló: ${msg}`)
    }
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
    formData.append('tasaItbis', tasaItbis.toString())
    formData.append('impuesto', itbisNum.toString())
    formData.append('propinaLegal', propinaLegalNum.toString())
    formData.append('otrosImpuestos', otrosImpuestosNum.toString())
    formData.append('total', total.toString())
    formData.append('observaciones', observaciones)
    if (archivo) formData.append('archivo', archivo)

    const url = isEdit ? `/api/contabilidad/facturas/${factura!.id}` : '/api/contabilidad/facturas'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      let res: Response
      try {
        res = await fetch(url, { method, body: formData })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        throw new Error(`Red: ${msg}`)
      }

      if (!res.ok) {
        let errText = 'Error al guardar'
        try {
          const d = await res.json()
          errText = d.error || errText
        } catch {
          errText = `Servidor respondió ${res.status}`
        }
        throw new Error(errText)
      }

      let data: { id?: number }
      try {
        data = await res.json()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        throw new Error(`Respuesta inválida del servidor: ${msg}`)
      }

      // Subida a SharePoint (best-effort). Si falla, la factura ya está
      // guardada localmente — solo registramos warning.
      if (archivo && data?.id) {
        try { await subirASharepoint(data.id, archivo) }
        catch (spErr) { console.warn('SP upload falló:', spErr) }
      }

      // Navegación envuelta en try/catch por si iOS Safari rechaza la URL.
      try {
        if (data?.id) {
          router.push(`/contabilidad/facturas/${data.id}`)
        } else {
          router.push('/contabilidad/facturas')
        }
      } catch (navErr) {
        console.error('Router.push falló, usando window.location:', navErr)
        window.location.href = data?.id
          ? `/contabilidad/facturas/${data.id}`
          : '/contabilidad/facturas'
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Error al guardar factura:', err)
      setError(msg)
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
                <>
                  <Button type="button" variant="ghost" size="sm" onClick={() => runOCR(archivo, 'claude')}>
                    🔍 Claude
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => runOCR(archivo, 'gemini')}>
                    🔍 Gemini
                  </Button>
                </>
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

          {/* Banner SharePoint */}
          {spState === 'uploading' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <p className="text-xs text-blue-700 dark:text-blue-300">{spMessage || 'Subiendo a SharePoint…'}</p>
            </div>
          )}
          {spState === 'success' && spMessage && (
            <div className="px-3 py-2 rounded-lg text-xs border bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
              ✓ {spMessage}
            </div>
          )}
          {spState === 'error' && spMessage && (
            <div className="px-3 py-2 rounded-lg text-xs border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
              ⚠ {spMessage}
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

          {/* Fila 1: Subtotal + ITBIS (con selector de tasa) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Subtotal</label>
              <input
                type="number"
                step="0.01"
                value={subtotal}
                onChange={(e) => { setSubtotal(e.target.value); recalcItbis(e.target.value) }}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelCls}>
                ITBIS
                <select
                  value={tasaItbis}
                  onChange={(e) => { const v = Number(e.target.value); setTasaItbis(v); recalcItbis(subtotal, v) }}
                  className="ml-2 text-[10px] border border-border rounded bg-card px-1 py-0.5"
                  title="Tasa ITBIS"
                >
                  <option value={18}>18%</option>
                  <option value={16}>16%</option>
                  <option value={0}>0% (exento)</option>
                </select>
              </label>
              <input
                type="number"
                step="0.01"
                value={itbis}
                onChange={(e) => setItbis(e.target.value)}
                className={inputCls}
                placeholder="0.00"
                disabled={tasaItbis === 0}
              />
            </div>
            <div>
              <label className={labelCls}>Total</label>
              <div className="px-2.5 py-1.5 text-sm border border-border rounded-md bg-muted/40 font-bold tabular-nums">
                RD$ {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Fila 2: Propina Legal y Otros Impuestos (opcionales) */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPropinaLegal}
                  onChange={(e) => { setShowPropinaLegal(e.target.checked); if (!e.target.checked) setPropinaLegal('') }}
                  className="rounded border-border"
                />
                Propina Legal 10% (Ley 228 — restaurantes/hoteles)
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOtrosImpuestos}
                  onChange={(e) => { setShowOtrosImpuestos(e.target.checked); if (!e.target.checked) setOtrosImpuestos('') }}
                  className="rounded border-border"
                />
                Otros impuestos (ISC / CDT)
              </label>
            </div>

            {(showPropinaLegal || showOtrosImpuestos) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {showPropinaLegal && (
                  <div>
                    <label className={labelCls}>
                      Propina Legal
                      <button
                        type="button"
                        onClick={() => setPropinaLegal(((subtotalNum) * 0.10).toFixed(2))}
                        className="ml-2 text-primary text-[10px] hover:underline"
                      >
                        Calc. 10%
                      </button>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={propinaLegal}
                      onChange={(e) => setPropinaLegal(e.target.value)}
                      className={inputCls}
                      placeholder="0.00"
                    />
                  </div>
                )}
                {showOtrosImpuestos && (
                  <div>
                    <label className={labelCls}>Otros impuestos</label>
                    <input
                      type="number"
                      step="0.01"
                      value={otrosImpuestos}
                      onChange={(e) => setOtrosImpuestos(e.target.value)}
                      className={inputCls}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            )}
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
