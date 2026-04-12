'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, CheckCircle, AlertTriangle, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  initMsal, loginOneDrive, isLoggedIn,
  formatFileSize,
  type OneDriveItem,
} from '@/lib/onedrive'
import {
  uploadSmallFile, uploadLargeFile, ensureFolder,
  getSharePointShareLink, sanitizeFolderName,
} from '@/lib/sharepoint'

// ── Types ────────────────────────────────────────────────────────────────

interface Props {
  /** Folder path relative to SP_ROOT_FOLDER, e.g. "CRM/ClienteName/ProyectoName" */
  folderPath: string
  /** Called after successful upload + share link generation */
  onUploaded?: (item: OneDriveItem, shareUrl: string) => void
  /** Compact mode label */
  label?: string
}

// ── Auto-categorize from filename ────────────────────────────────────────

export function guessCategory(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.includes('plano') || lower.includes('dwg') || lower.includes('cad')) return 'Plano'
  if (lower.includes('contrato') || lower.includes('acuerdo')) return 'Contrato'
  if (lower.includes('permiso') || lower.includes('licencia')) return 'Permiso'
  if (lower.includes('factura') || lower.includes('invoice')) return 'Factura'
  if (lower.includes('acta')) return 'Acta'
  if (/\.(jpg|jpeg|png|gif|webp|bmp|heic)$/i.test(lower)) return 'Foto'
  return 'General'
}

// ── Component ────────────────────────────────────────────────────────────

export function SharePointUploader({ folderPath, onUploaded, label }: Props) {
  const [loggedIn, setLoggedIn] = useState(() => {
    try { return isLoggedIn() } catch { return false }
  })
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [lastFile, setLastFile] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogin = useCallback(async () => {
    await initMsal()
    const ok = await loginOneDrive()
    setLoggedIn(ok)
    if (!ok) setError('No se pudo conectar. Permite ventanas emergentes.')
  }, [])

  async function doUpload(file: File) {
    setUploading(true)
    setProgress(0)
    setError(null)
    setLastFile(null)

    try {
      // Ensure folder exists
      await ensureFolder(folderPath)

      const FOUR_MB = 4 * 1024 * 1024
      let result: OneDriveItem | null = null

      if (file.size < FOUR_MB) {
        const buffer = await file.arrayBuffer()
        result = await uploadSmallFile(folderPath, file.name, buffer)
        setProgress(100)
      } else {
        result = await uploadLargeFile(folderPath, file.name, file, setProgress)
      }

      if (result) {
        const shareUrl = await getSharePointShareLink(result.id)
        if (shareUrl && onUploaded) {
          onUploaded(result, shareUrl)
        }
        setLastFile(result.name)
      } else {
        setError('Error al subir el archivo')
      }
    } catch {
      setError('Error al subir el archivo')
    }

    setUploading(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) doUpload(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) doUpload(file)
  }

  // ── Not logged in ─────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <button
        onClick={handleLogin}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        <Globe className="w-4 h-4" />
        Conectar SharePoint para subir archivos
      </button>
    )
  }

  // ── Upload zone ───────────────────────────────────────────────────
  return (
    <div className="space-y-1.5">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`w-full flex flex-col items-center justify-center gap-1.5 px-3 py-3 border-2 border-dashed rounded-lg text-xs cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10 text-blue-500'
            : uploading
            ? 'border-blue-300 bg-blue-50/30 dark:bg-blue-900/10 text-blue-500 cursor-wait'
            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
        }`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Subiendo... {progress}%</span>
            <div className="w-full max-w-32 bg-blue-200 dark:bg-blue-900/40 rounded-full h-1">
              <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            <span>{label || 'Arrastra un archivo o haz clic para subir'}</span>
            <span className="text-[10px] text-muted-foreground/60">Se guarda en SharePoint/{folderPath}</span>
          </>
        )}
      </div>

      {lastFile && !uploading && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
          <CheckCircle className="w-3 h-3" /> {lastFile} subido correctamente
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-amber-500">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}
    </div>
  )
}
