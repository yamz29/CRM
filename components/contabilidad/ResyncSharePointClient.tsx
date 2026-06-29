'use client'

import { useState, useCallback } from 'react'
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { initMsal, isLoggedIn, loginOneDrive } from '@/lib/onedrive'
import { ensureFolder, uploadSmallFile, uploadLargeFile, getSharePointShareLink } from '@/lib/sharepoint'
import { carpetaFactura, nombreArchivoFactura } from '@/lib/factura-sp-path'

interface FacturaPendiente {
  id: number
  numero: string
  proveedor: string | null
  fecha: string
  archivoUrl: string
}

type ItemStatus = 'pendiente' | 'subiendo' | 'ok' | 'error'
interface ItemResult {
  id: number
  numero: string
  status: ItemStatus
  error?: string
}

const FOUR_MB = 4 * 1024 * 1024

export function ResyncSharePointClient() {
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<FacturaPendiente[] | null>(null)
  const [results, setResults] = useState<Record<number, ItemResult>>({})
  const [running, setRunning] = useState(false)
  const [currentLabel, setCurrentLabel] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)

  // ── Cargar el listado de pendientes ────────────────────────────────
  const cargarPendientes = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    setFinished(false)
    setResults({})
    try {
      const res = await fetch('/api/contabilidad/facturas/sin-sharepoint')
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Servidor respondió ${res.status}`)
      }
      const data = await res.json()
      setPendientes(data.facturas as FacturaPendiente[])
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e))
      setPendientes(null)
    } finally {
      setLoadingList(false)
    }
  }, [])

  // ── Subir una factura a SharePoint (misma lógica que FacturaForm) ───
  async function subirUna(
    f: FacturaPendiente,
    ensuredFolders: Set<string>,
  ): Promise<void> {
    // 1. Bajar el archivo local desde el VPS
    const res = await fetch(`/api${f.archivoUrl}`)
    if (!res.ok) throw new Error(`Archivo no encontrado (HTTP ${res.status})`)
    const blob = await res.blob()

    const originalName = f.archivoUrl.split('/').pop() || `factura-${f.id}`
    const file = new File([blob], originalName, { type: blob.type || 'application/octet-stream' })

    // 2. Ruta y nombre destino (idéntico al upload automático)
    const folderPath = carpetaFactura(f.fecha)
    const fileName = nombreArchivoFactura(f.proveedor, f.numero, originalName, f.id)

    // 3. Asegurar la carpeta del mes (una sola vez por corrida)
    if (!ensuredFolders.has(folderPath)) {
      await ensureFolder(folderPath)
      ensuredFolders.add(folderPath)
    }

    // 4. Subir
    const item = file.size < FOUR_MB
      ? await uploadSmallFile(folderPath, fileName, await file.arrayBuffer())
      : await uploadLargeFile(folderPath, fileName, file)
    if (!item) throw new Error('La subida no devolvió resultado')

    // 5. Link para compartir (fallback a webUrl si no se pudo crear)
    const shareUrl = (await getSharePointShareLink(item.id)) || item.webUrl

    // 6. Persistir el sharepointUrl en la factura (marca como sincronizada)
    const put = await fetch(`/api/contabilidad/facturas/${f.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sharepointUrl: shareUrl }),
    })
    if (!put.ok) throw new Error('Subió pero no se pudo guardar el enlace en la factura')
  }

  // ── Ejecutar el lote ───────────────────────────────────────────────
  const iniciarSubida = useCallback(async () => {
    if (!pendientes || pendientes.length === 0) return
    setRunning(true)
    setFinished(false)
    setListError(null)

    // Asegurar sesión MSAL una sola vez
    try {
      await initMsal()
      if (!isLoggedIn()) {
        const ok = await loginOneDrive()
        if (!ok) throw new Error('No se pudo iniciar sesión en SharePoint')
      }
    } catch (e) {
      setListError(
        'No hay sesión de SharePoint. Inicia sesión con tu cuenta Microsoft e inténtalo de nuevo. ' +
        (e instanceof Error ? `(${e.message})` : '')
      )
      setRunning(false)
      return
    }

    const ensuredFolders = new Set<string>()

    for (const f of pendientes) {
      // Saltar las que ya quedaron OK en una corrida anterior de esta sesión
      if (results[f.id]?.status === 'ok') continue

      setCurrentLabel(`FAC ${f.numero}${f.proveedor ? ` · ${f.proveedor}` : ''}`)
      setResults((prev) => ({ ...prev, [f.id]: { id: f.id, numero: f.numero, status: 'subiendo' } }))

      try {
        await subirUna(f, ensuredFolders)
        setResults((prev) => ({ ...prev, [f.id]: { id: f.id, numero: f.numero, status: 'ok' } }))
      } catch (e) {
        setResults((prev) => ({
          ...prev,
          [f.id]: { id: f.id, numero: f.numero, status: 'error', error: e instanceof Error ? e.message : String(e) },
        }))
      }
    }

    setCurrentLabel(null)
    setRunning(false)
    setFinished(true)
  }, [pendientes, results])

  const total = pendientes?.length ?? 0
  const okCount = Object.values(results).filter((r) => r.status === 'ok').length
  const errCount = Object.values(results).filter((r) => r.status === 'error').length
  const procesadas = okCount + errCount
  const pct = total > 0 ? Math.round((procesadas / total) * 100) : 0
  const fallidas = Object.values(results).filter((r) => r.status === 'error')

  return (
    <div className="space-y-5">
      {/* Aviso informativo */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <UploadCloud className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Esta herramienta sube a SharePoint las facturas que tienen archivo en el servidor pero
          que nunca se sincronizaron. Usa tu sesión de Microsoft (la misma del módulo Documentos).
          Es seguro re-ejecutarla: solo procesa las que aún están pendientes.
        </p>
      </div>

      {/* Paso 1: cargar pendientes */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-foreground">1. Pendientes de sincronizar</h3>
            <p className="text-xs text-muted-foreground">Facturas con archivo local sin subir a SharePoint</p>
          </div>
          <Button variant="secondary" onClick={cargarPendientes} disabled={loadingList || running}>
            {loadingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {pendientes === null ? 'Cargar pendientes' : 'Recargar'}
          </Button>
        </div>

        {listError && (
          <div className="px-3 py-2 rounded-lg text-xs border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
            ⚠ {listError}
          </div>
        )}

        {pendientes !== null && (
          <div className="text-sm text-foreground">
            {total === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">✓ No hay facturas pendientes — todo está sincronizado.</span>
            ) : (
              <span><strong>{total}</strong> factura{total > 1 ? 's' : ''} pendiente{total > 1 ? 's' : ''} de subir.</span>
            )}
          </div>
        )}
      </div>

      {/* Paso 2: ejecutar */}
      {pendientes !== null && total > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-foreground">2. Subir a SharePoint</h3>
              <p className="text-xs text-muted-foreground">Mantén esta pestaña abierta hasta que termine</p>
            </div>
            <Button onClick={iniciarSubida} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {running ? 'Subiendo…' : 'Iniciar subida'}
            </Button>
          </div>

          {(running || procesadas > 0) && (
            <div className="space-y-2">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{procesadas} / {total} procesadas</span>
                <span className="flex items-center gap-3">
                  <span className="text-emerald-600 dark:text-emerald-400">{okCount} subidas</span>
                  {errCount > 0 && <span className="text-amber-600 dark:text-amber-400">{errCount} fallidas</span>}
                </span>
              </div>
              {currentLabel && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Subiendo: {currentLabel}
                </p>
              )}
            </div>
          )}

          {finished && (
            <div className={`px-3 py-2 rounded-lg text-xs border flex items-center gap-2 ${
              errCount === 0
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            }`}>
              {errCount === 0
                ? <><CheckCircle2 className="w-4 h-4" /> Listo — {okCount} factura{okCount !== 1 ? 's' : ''} subida{okCount !== 1 ? 's' : ''} a SharePoint.</>
                : <><AlertTriangle className="w-4 h-4" /> Terminó con {okCount} subidas y {errCount} fallidas. Revisa abajo y vuelve a ejecutar para reintentar.</>}
            </div>
          )}

          {fallidas.length > 0 && (
            <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
              <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-xs font-medium text-amber-700 dark:text-amber-300">
                Facturas con error ({fallidas.length})
              </div>
              <ul className="divide-y divide-border">
                {fallidas.map((r) => (
                  <li key={r.id} className="px-3 py-2 text-xs flex items-start justify-between gap-3">
                    <span className="font-mono shrink-0">FAC {r.numero}</span>
                    <span className="text-muted-foreground text-right">{r.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
