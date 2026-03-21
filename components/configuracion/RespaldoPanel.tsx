'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Trash2, HardDrive, RefreshCw, Plus, AlertTriangle, CheckCircle, Upload, ShieldAlert, Database } from 'lucide-react'

interface Backup {
  filename: string
  size: number
  createdAt: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Estado para la sección de importación ──────────────────────────────────
type ImportStep = 'idle' | 'validated' | 'importing' | 'done'

interface ImportState {
  step: ImportStep
  file: File | null
  tempFile: string | null
  validatedSize: number | null
  validating: boolean
  mensaje: { tipo: 'ok' | 'error' | 'warn'; texto: string } | null
}

export function RespaldoPanel() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  // Estado de importación
  const [imp, setImp] = useState<ImportState>({
    step: 'idle',
    file: null,
    tempFile: null,
    validatedSize: null,
    validating: false,
    mensaje: null,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  function mostrarMensaje(tipo: 'ok' | 'error', texto: string) {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 4000)
  }

  const cargarBackups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/configuracion/backup')
      const data = await res.json()
      if (res.ok) {
        setBackups(data.backups)
      } else {
        mostrarMensaje('error', data.error ?? 'Error al cargar la lista de backups')
      }
    } catch {
      mostrarMensaje('error', 'No se pudo conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarBackups()
  }, [cargarBackups])

  async function crearBackup() {
    setCreating(true)
    try {
      const res = await fetch('/api/configuracion/backup', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        mostrarMensaje('ok', `Backup creado correctamente: ${data.filename}`)
        await cargarBackups()
      } else {
        mostrarMensaje('error', data.error ?? 'Error al crear el backup')
      }
    } catch {
      mostrarMensaje('error', 'No se pudo crear el backup')
    } finally {
      setCreating(false)
    }
  }

  async function eliminarBackup(filename: string) {
    if (!confirm(`¿Eliminar el backup "${filename}"? Esta acción no se puede deshacer.`)) return
    setDeletingFile(filename)
    try {
      const res = await fetch(`/api/configuracion/backup/${filename}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        mostrarMensaje('ok', 'Backup eliminado correctamente')
        setBackups(prev => prev.filter(b => b.filename !== filename))
      } else {
        mostrarMensaje('error', data.error ?? 'Error al eliminar el backup')
      }
    } catch {
      mostrarMensaje('error', 'No se pudo eliminar el backup')
    } finally {
      setDeletingFile(null)
    }
  }

  // ── Funciones de importación ────────────────────────────────────────────

  function impMensaje(tipo: 'ok' | 'error' | 'warn', texto: string) {
    setImp(prev => ({ ...prev, mensaje: { tipo, texto } }))
  }

  function resetImport() {
    setImp({ step: 'idle', file: null, tempFile: null, validatedSize: null, validating: false, mensaje: null })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function validarArchivo() {
    if (!imp.file) return
    setImp(prev => ({ ...prev, validating: true, mensaje: null }))

    const fd = new FormData()
    fd.append('action', 'validar')
    fd.append('file', imp.file)

    try {
      const res = await fetch('/api/configuracion/importar-db', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setImp(prev => ({
          ...prev,
          step: 'validated',
          tempFile: data.tempFile,
          validatedSize: data.size,
          validating: false,
          mensaje: { tipo: 'ok', texto: data.mensaje },
        }))
      } else {
        setImp(prev => ({ ...prev, validating: false, mensaje: { tipo: 'error', texto: data.error ?? 'Error al validar' } }))
      }
    } catch {
      setImp(prev => ({ ...prev, validating: false, mensaje: { tipo: 'error', texto: 'No se pudo conectar con el servidor' } }))
    }
  }

  async function importarBase() {
    if (!imp.tempFile) return
    setImp(prev => ({ ...prev, step: 'importing', mensaje: null }))

    const fd = new FormData()
    fd.append('action', 'importar')
    fd.append('tempFile', imp.tempFile)

    try {
      const res = await fetch('/api/configuracion/importar-db', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setImp(prev => ({
          ...prev,
          step: 'done',
          mensaje: { tipo: 'ok', texto: `${data.mensaje} Backup de seguridad: ${data.backupCreado}` },
        }))
        // Recargar lista de backups para mostrar el nuevo pre-import
        await cargarBackups()
      } else {
        setImp(prev => ({
          ...prev,
          step: 'validated', // permitir reintentar
          mensaje: { tipo: 'error', texto: data.error ?? 'Error al importar la base de datos' },
        }))
      }
    } catch {
      setImp(prev => ({
        ...prev,
        step: 'validated',
        mensaje: { tipo: 'error', texto: 'No se pudo conectar con el servidor' },
      }))
    }
  }

  function descargarBackup(filename: string) {
    // Crea un enlace invisible y lo activa para forzar la descarga
    const a = document.createElement('a')
    a.href = `/api/configuracion/backup/${filename}`
    a.download = filename
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-500" />
            Respaldo del sistema
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Cada backup incluye la base de datos y los archivos subidos al sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={cargarBackups}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={crearBackup}
            disabled={creating}
          >
            {creating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Creando backup...
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Crear backup ahora
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Mensaje de estado */}
      {mensaje && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
          mensaje.tipo === 'ok'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {mensaje.tipo === 'ok'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {mensaje.texto}
        </div>
      )}

      {/* Info de qué incluye el backup */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 space-y-1">
        <p className="font-semibold">Cada backup incluye:</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-600">
          <li>Base de datos completa (clientes, proyectos, presupuestos, gastos, etc.)</li>
          <li>Archivos subidos al sistema (logos, adjuntos)</li>
        </ul>
        <p className="text-xs text-blue-500 mt-1">
          Los archivos se guardan en la carpeta <code className="bg-blue-100 px-1 rounded">/backups/</code> del servidor.
        </p>
      </div>

      {/* Tabla de backups */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Backups disponibles
          </h3>
          {!loading && (
            <span className="text-xs text-slate-400">
              {backups.length} {backups.length === 1 ? 'archivo' : 'archivos'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Cargando backups...
          </div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <HardDrive className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-slate-500 text-sm font-medium">No hay backups todavía</p>
            <p className="text-slate-400 text-xs mt-1">
              Haz clic en "Crear backup ahora" para generar el primero.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Archivo
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Fecha
                </th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Tamaño
                </th>
                <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {backups.map((b) => (
                <tr key={b.filename} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <span className="text-sm font-mono text-slate-700">{b.filename}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">
                    {formatDate(b.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-slate-500 tabular-nums">
                    {formatBytes(b.size)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => descargarBackup(b.filename)}
                        title="Descargar backup"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Descargar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => eliminarBackup(b.filename)}
                        disabled={deletingFile === b.filename}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        title="Eliminar backup"
                      >
                        {deletingFile === b.filename
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Sección: Importar base de datos ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-400" />
            Importar base de datos
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Reemplaza la base de datos actual con un archivo <code className="bg-slate-100 px-1 rounded">.db</code> o <code className="bg-slate-100 px-1 rounded">.sqlite</code> externo.
            Se crea un backup automático antes de cualquier cambio.
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* Paso 1 — Seleccionar y validar */}
          {imp.step !== 'done' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".db,.sqlite"
                  disabled={imp.step === 'importing'}
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null
                    setImp({ step: 'idle', file: f, tempFile: null, validatedSize: null, validating: false, mensaje: null })
                  }}
                  className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!imp.file || imp.step === 'validated' || imp.validating || imp.step === 'importing'}
                  onClick={validarArchivo}
                >
                  {imp.validating
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Validando...</>
                    : <><CheckCircle className="w-3.5 h-3.5" /> Validar archivo</>}
                </Button>
                {imp.step !== 'idle' && (
                  <button onClick={resetImport} className="text-xs text-slate-400 hover:text-slate-600 underline">
                    Cancelar
                  </button>
                )}
              </div>

              {/* Mensaje de validación */}
              {imp.mensaje && (
                <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm ${
                  imp.mensaje.tipo === 'ok'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : imp.mensaje.tipo === 'warn'
                    ? 'bg-amber-50 border border-amber-200 text-amber-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {imp.mensaje.tipo === 'ok'
                    ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  <span>{imp.mensaje.texto}</span>
                </div>
              )}
            </div>
          )}

          {/* Paso 2 — Confirmación antes de importar */}
          {imp.step === 'validated' && imp.tempFile && (
            <div className="border border-amber-200 rounded-xl overflow-hidden">
              <div className="bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  Confirmar importación
                </p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  Esta acción <strong>reemplazará la base de datos actual</strong> con el archivo que subiste
                  ({imp.validatedSize !== null ? formatBytes(imp.validatedSize) : ''}).
                  Antes de continuar se creará un <strong>backup automático</strong> de la base actual.
                </p>
              </div>
              <div className="px-4 py-3 bg-white flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={importarBase}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Sí, importar base de datos
                </Button>
                <button onClick={resetImport} className="text-xs text-slate-400 hover:text-slate-600 underline">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Paso 3 — Importando */}
          {imp.step === 'importing' && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
              Creando backup y reemplazando base de datos...
            </div>
          )}

          {/* Paso 4 — Éxito */}
          {imp.step === 'done' && imp.mensaje && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{imp.mensaje.texto}</span>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
                <p className="font-semibold">Recomendación</p>
                <p className="text-xs mt-0.5">
                  Reinicia la aplicación con <code className="bg-blue-100 px-1 rounded">pm2 restart crm</code> en el servidor
                  para asegurar que Prisma se reconecte correctamente con la nueva base de datos.
                </p>
              </div>
              <button onClick={resetImport} className="text-xs text-slate-400 hover:text-slate-600 underline">
                Importar otro archivo
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
