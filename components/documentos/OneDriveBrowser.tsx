'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Folder, FileText, Image, FileSpreadsheet, FileIcon, Presentation,
  ChevronRight, ArrowLeft, Loader2, LogIn, LogOut, Plus, Cloud, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  initMsal, loginOneDrive, logoutOneDrive, isLoggedIn,
  listRootFiles, listFolderFiles, getEmbedUrl, getItemShareLink,
  formatFileSize, getFileIcon,
  type OneDriveItem,
} from '@/lib/onedrive'

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
  onSelectFile: (item: OneDriveItem, embedUrl: string | null, shareUrl: string | null) => void
  onRegisterFile: (item: OneDriveItem, shareUrl: string) => void
}

interface BreadcrumbItem {
  id: string | null  // null = root
  name: string
}

// ── Component ────────────────────────────────────────────────────────────

export function OneDriveBrowser({ onSelectFile, onRegisterFile }: Props) {
  const [loggedIn, setLoggedIn] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [items, setItems] = useState<OneDriveItem[]>([])
  const [loading, setLoading] = useState(false)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: 'OneDrive' }])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [registering, setRegistering] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Init MSAL on mount so loginPopup is instant on button click
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

  // Load files when logged in
  const loadFolder = useCallback(async (folderId: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const files = folderId ? await listFolderFiles(folderId) : await listRootFiles()
      console.log('OneDrive files loaded:', files.length)
      // Sort: folders first, then files
      files.sort((a, b) => {
        if (a.folder && !b.folder) return -1
        if (!a.folder && b.folder) return 1
        return a.name.localeCompare(b.name)
      })
      setItems(files)
      if (files.length === 0) {
        setError('No se pudieron cargar los archivos. Revisa la consola (F12) para más detalles.')
      }
    } catch (e) {
      console.error('OneDrive loadFolder error:', e)
      setError('Error al cargar archivos de OneDrive')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (loggedIn) {
      loadFolder(null)
    }
  }, [loggedIn, loadFolder])

  async function handleLogin() {
    setError(null)
    const success = await loginOneDrive()
    console.log('OneDrive login result:', success)
    if (!success) {
      setError('No se pudo conectar a OneDrive. Permite ventanas emergentes e intenta de nuevo.')
    }
    setLoggedIn(success)
  }

  async function handleLogout() {
    await logoutOneDrive()
    setLoggedIn(false)
    setItems([])
    setBreadcrumb([{ id: null, name: 'OneDrive' }])
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
    const parentId = newBc[newBc.length - 1].id
    loadFolder(parentId)
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
    const embedUrl = await getEmbedUrl(item.id)
    onSelectFile(item, embedUrl, item.webUrl)
  }

  async function handleRegister(item: OneDriveItem) {
    setRegistering(item.id)
    const shareUrl = await getItemShareLink(item.id)
    if (shareUrl) {
      onRegisterFile(item, shareUrl)
    }
    setRegistering(null)
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
      <div className="flex flex-col items-center justify-center py-8 px-4 gap-3">
        <Cloud className="w-10 h-10 text-blue-500/40" />
        <p className="text-xs text-muted-foreground text-center">
          Conecta tu cuenta de OneDrive para navegar archivos
        </p>
        <Button size="sm" onClick={handleLogin} className="gap-1.5">
          <LogIn className="w-3.5 h-3.5" /> Conectar OneDrive
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
      {/* Breadcrumb + logout */}
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
        <button onClick={handleLogout} className="ml-auto p-1 text-muted-foreground hover:text-foreground rounded" title="Desconectar">
          <LogOut className="w-3 h-3" />
        </button>
      </div>

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
            ) : 'Carpeta vacía'}
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
                  {!isFolder && (
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
