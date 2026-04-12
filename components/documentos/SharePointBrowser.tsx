'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Folder, FileText, Image, FileSpreadsheet, FileIcon, Presentation,
  ChevronRight, ArrowLeft, Loader2, LogIn, LogOut, Plus, Globe, AlertTriangle,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  initMsal, loginOneDrive, logoutOneDrive, isLoggedIn,
  formatFileSize, getFileIcon,
  type OneDriveItem,
} from '@/lib/onedrive'
import {
  listSharePointRoot, listSharePointFolder, listSharePointPath,
  getSharePointEmbedUrl, getSharePointShareLink,
  uploadSmallFile, uploadLargeFile, ensureFolder, sanitizeFolderName,
  getRootFolder,
} from '@/lib/sharepoint'

// ── Icon map ─────────────────────────────────────────────────────────────

const FILE_ICONS = {
  pdf:    <FileText className="w-4 h-4 text-red-500" />,
  image:  <Image className="w-4 h-4 text-amber-500" />,
  excel:  <FileSpreadsheet className="w-4 h-4 text-green-600" />,
  word:   <FileText className="w-4 h-4 text-blue-600" />,
  ppt:    <Presentation className="w-4 h-4 text-orange-500" />,
  folder: <Folder className="w-4 h-4 text-amber-400" />,
  file:   <FileIcon className="w-4 h-4 text-muted-foreground" />,
}

// ── Types ────────────────────────────────────────────────────────────────

interface Props {
  onSelectFile?: (item: OneDriveItem, embedUrl: string | null, shareUrl: string | null) => void
  onRegisterFile?: (item: OneDriveItem, shareUrl: string) => void
  /** Allow file upload in this browser */
  allowUpload?: boolean
  /** Root path relative to SP_ROOT_FOLDER for scoped browsing (e.g. "ClienteName") */
  rootPath?: string
  /** Compact mode for embedding in drawers */
  compact?: boolean
  /** Oportunidad ID — auto-register uploaded files */
  oportunidadId?: number
}

interface BreadcrumbItem {
  id: string | null  // null = root
  name: string
}

// ── Component ────────────────────────────────────────────────────────────

export function SharePointBrowser({
  onSelectFile,
  onRegisterFile,
  allowUpload = false,
  rootPath,
  compact = false,
  oportunidadId,
}: Props) {
  const [loggedIn, setLoggedIn] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [items, setItems] = useState<OneDriveItem[]>([])
  const [loading, setLoading] = useState(false)
  const rootName = rootPath ? rootPath.split('/').pop() || getRootFolder() : getRootFolder()
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: rootName }])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [registering, setRegistering] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Init MSAL on mount
  useEffect(() => {
    async function init() {
      try {
        await initMsal()
        setLoggedIn(isLoggedIn())
      } catch (e) {
        console.error('MSAL init error:', e)
      }
      setInitialized(true)
    }
    init()
  }, [])

  // Load files
  const loadFolder = useCallback(async (folderId: string | null) => {
    setLoading(true)
    setError(null)
    try {
      let files: OneDriveItem[]
      if (folderId) {
        files = await listSharePointFolder(folderId)
      } else if (rootPath) {
        files = await listSharePointPath(rootPath)
      } else {
        files = await listSharePointRoot()
      }
      // Sort: folders first, then files
      files.sort((a, b) => {
        if (a.folder && !b.folder) return -1
        if (!a.folder && b.folder) return 1
        return a.name.localeCompare(b.name)
      })
      setItems(files)
    } catch (e) {
      console.error('SharePoint loadFolder error:', e)
      setError('Error al cargar archivos de SharePoint')
    }
    setLoading(false)
  }, [rootPath])

  useEffect(() => {
    if (loggedIn) {
      loadFolder(null)
    }
  }, [loggedIn, loadFolder])

  async function handleLogin() {
    setError(null)
    const success = await loginOneDrive()
    if (!success) {
      setError('No se pudo conectar a SharePoint. Permite ventanas emergentes e intenta de nuevo.')
    }
    setLoggedIn(success)
  }

  async function handleLogout() {
    await logoutOneDrive()
    setLoggedIn(false)
    setItems([])
    setBreadcrumb([{ id: null, name: rootName }])
  }

  function navigateToFolder(item: OneDriveItem) {
    setBreadcrumb(prev => [...prev, { id: item.id, name: item.name }])
    loadFolder(item.id)
    setSelectedId(null)
  }

  function navigateBack() {
    if (breadcrumb.length <= 1) return
    const newBc = breadcrumb.slice(0, -1)
    setBreadcrumb(newBc)
    loadFolder(newBc[newBc.length - 1].id)
    setSelectedId(null)
  }

  function navigateToBreadcrumb(index: number) {
    const newBc = breadcrumb.slice(0, index + 1)
    setBreadcrumb(newBc)
    loadFolder(newBc[newBc.length - 1].id)
    setSelectedId(null)
  }

  async function handleSelectFile(item: OneDriveItem) {
    if (item.folder) {
      navigateToFolder(item)
      return
    }
    setSelectedId(item.id)
    if (onSelectFile) {
      const embedUrl = await getSharePointEmbedUrl(item.id)
      onSelectFile(item, embedUrl, item.webUrl)
    }
  }

  async function handleRegister(item: OneDriveItem) {
    setRegistering(item.id)
    const shareUrl = await getSharePointShareLink(item.id)
    if (shareUrl && onRegisterFile) {
      onRegisterFile(item, shareUrl)
    }
    setRegistering(null)
  }

  // ── Upload handler ────────────────────────────────────────────────
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset input

    setUploading(true)
    setUploadProgress(0)

    // Determine the relative path for upload
    // If we're in a subfolder (breadcrumb > 1), we need the current folder ID
    // For root-level or rootPath, build the relative path
    let relativePath = rootPath || ''

    // If browsing deeper via breadcrumb, we use the folder ID approach
    const currentFolderId = breadcrumb[breadcrumb.length - 1].id

    try {
      // Ensure the folder exists (for rootPath scenarios)
      if (relativePath && !currentFolderId) {
        await ensureFolder(relativePath)
      }

      let result: OneDriveItem | null = null
      const FOUR_MB = 4 * 1024 * 1024

      if (file.size < FOUR_MB) {
        const buffer = await file.arrayBuffer()
        if (currentFolderId) {
          // Upload directly to the folder by ID — use Graph API directly
          result = await uploadSmallFileToFolder(currentFolderId, file.name, buffer)
        } else {
          result = await uploadSmallFile(relativePath, file.name, buffer)
        }
      } else {
        if (currentFolderId) {
          result = await uploadLargeFileToFolder(currentFolderId, file, setUploadProgress)
        } else {
          result = await uploadLargeFile(relativePath, file.name, file, setUploadProgress)
        }
      }

      if (result) {
        // Refresh current folder
        loadFolder(currentFolderId)

        // Auto-register if oportunidadId is set
        if (oportunidadId && onRegisterFile) {
          const shareUrl = await getSharePointShareLink(result.id)
          if (shareUrl) {
            onRegisterFile(result, shareUrl)
          }
        }
      } else {
        setError('Error al subir el archivo')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('Error al subir el archivo')
    }

    setUploading(false)
    setUploadProgress(0)
  }

  // ── Not initialized ───────────────────────────────────────────────
  if (!initialized) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Not logged in ─────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 px-4 ${compact ? 'py-6' : 'py-8'}`}>
        <Globe className="w-10 h-10 text-blue-500/40" />
        <p className="text-xs text-muted-foreground text-center">
          Conecta tu cuenta de Microsoft para navegar SharePoint
        </p>
        <Button size="sm" onClick={handleLogin} className="gap-1.5">
          <LogIn className="w-3.5 h-3.5" /> Conectar SharePoint
        </Button>
        {error && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-500 text-center">
            <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
          </div>
        )}
      </div>
    )
  }

  // ── Logged in — file browser ──────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb + actions */}
      <div className="px-2 py-1.5 border-b border-border/50 flex items-center gap-1 flex-wrap shrink-0">
        {breadcrumb.length > 1 && (
          <button onClick={navigateBack} className="p-1 text-muted-foreground hover:text-foreground rounded">
            <ArrowLeft className="w-3 h-3" />
          </button>
        )}
        {breadcrumb.map((bc, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/50" />}
            <button
              onClick={() => navigateToBreadcrumb(i)}
              className={`text-xs px-1 py-0.5 rounded hover:bg-muted transition-colors truncate max-w-24 ${
                i === breadcrumb.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
            >
              {bc.name}
            </button>
          </span>
        ))}
        <div className="ml-auto flex items-center gap-0.5">
          {allowUpload && (
            <>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
                title="Subir archivo"
              >
                {uploading
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Upload className="w-3 h-3" />}
              </button>
            </>
          )}
          <button onClick={handleLogout} className="p-1 text-muted-foreground hover:text-foreground rounded" title="Desconectar">
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Upload progress */}
      {uploading && uploadProgress > 0 && (
        <div className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <div className="flex-1 bg-blue-200 dark:bg-blue-900/40 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span>{uploadProgress}%</span>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            {error ? (
              <div className="flex flex-col items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <p className="text-amber-500">{error}</p>
                <Button size="sm" variant="outline" onClick={() => loadFolder(breadcrumb[breadcrumb.length - 1].id)}>
                  Reintentar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p>Carpeta vacía</p>
                {allowUpload && (
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-3 h-3 mr-1" /> Subir archivo
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            {items.map(item => {
              const isFolder = !!item.folder
              const iconType = isFolder ? 'folder' : getFileIcon(item.name, item.file?.mimeType)
              const icon = FILE_ICONS[iconType]

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors group ${
                    selectedId === item.id
                      ? 'bg-primary/10 border-r-2 border-primary'
                      : 'hover:bg-muted/30'
                  }`}
                  onClick={() => handleSelectFile(item)}
                >
                  {icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {isFolder
                        ? `${item.folder!.childCount} elementos`
                        : formatFileSize(item.size)}
                    </p>
                  </div>
                  {!isFolder && onRegisterFile && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRegister(item) }}
                      disabled={registering === item.id}
                      className="p-1 text-muted-foreground hover:text-primary rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Registrar en CRM"
                    >
                      {registering === item.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Plus className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helper: upload to a specific folder by ID ───────────────────────────

import { getAccessToken } from '@/lib/onedrive'
import { getSiteDriveId } from '@/lib/sharepoint'

async function uploadSmallFileToFolder(
  folderId: string,
  fileName: string,
  content: ArrayBuffer,
): Promise<OneDriveItem | null> {
  const driveId = await getSiteDriveId()
  const token = await getAccessToken()
  if (!driveId || !token) return null

  const safeName = sanitizeFolderName(fileName) || 'archivo'
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}:/${safeName}:/content`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: content,
    },
  )
  if (!res.ok) return null
  return (await res.json()) as OneDriveItem
}

async function uploadLargeFileToFolder(
  folderId: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<OneDriveItem | null> {
  const driveId = await getSiteDriveId()
  const token = await getAccessToken()
  if (!driveId || !token) return null

  const safeName = sanitizeFolderName(file.name) || 'archivo'
  const sessionRes = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}:/${safeName}:/createUploadSession`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
    },
  )
  if (!sessionRes.ok) return null
  const session = await sessionRes.json()
  const uploadUrl = session.uploadUrl as string

  const CHUNK_SIZE = 5 * 1024 * 1024
  const totalSize = file.size
  let offset = 0
  let result: OneDriveItem | null = null

  while (offset < totalSize) {
    const end = Math.min(offset + CHUNK_SIZE, totalSize)
    const chunk = file.slice(offset, end)
    const buffer = await chunk.arrayBuffer()

    const chunkRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': `${end - offset}`,
        'Content-Range': `bytes ${offset}-${end - 1}/${totalSize}`,
      },
      body: buffer,
    })

    if (chunkRes.status === 200 || chunkRes.status === 201) {
      result = (await chunkRes.json()) as OneDriveItem
    } else if (!chunkRes.ok) {
      return null
    }

    offset = end
    onProgress(Math.round((offset / totalSize) * 100))
  }

  return result
}
