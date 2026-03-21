'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Trash2, HardDrive, RefreshCw, Plus, AlertTriangle, CheckCircle } from 'lucide-react'

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

export function RespaldoPanel() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

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

      {/* Nota de restauración */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
        <p className="font-semibold flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" />
          Para restaurar un backup
        </p>
        <p className="mt-1 text-amber-600 text-xs leading-relaxed">
          Descarga el archivo <code className="bg-amber-100 px-1 rounded">.zip</code>, extráelo y reemplaza manualmente
          el archivo <code className="bg-amber-100 px-1 rounded">prisma/dev.db</code> y la carpeta <code className="bg-amber-100 px-1 rounded">public/uploads/</code> en el servidor.
          Reinicia el sistema después de restaurar.
        </p>
      </div>
    </div>
  )
}
