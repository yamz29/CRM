'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Folder, FileText, Image, FileSpreadsheet, FileIcon, Presentation,
  ChevronRight, ArrowLeft, Loader2, LogIn, LogOut, Plus, Globe,
  AlertTriangle, Upload, FolderPlus, MoreVertical, Move, Pencil,
  Trash2, X, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  initMsal, loginOneDrive, logoutOneDrive, isLoggedIn,
  formatFileSize, getFileIcon,
  type OneDriveItem,
} from '@/lib/onedrive'
import {
  listSharePointRoot, listSharePointFolder, listSharePointPath,
  getSharePointShareLink,
  createFolder, moveItem, renameItem, deleteItem, uploadToFolder,
  sanitizeFolderName, getRootFolder,
} from '@/lib/sharepoint'

// ── Icon map ─────────────────────────────────────────────────────────────

const FILE_ICONS: Record<string, React.ReactNode> = {
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
  /** Root path relative to SP_ROOT_FOLDER (e.g. "CRM/ClienteName/ProyectoName") */
  rootPath: string
  /** Called when a file is uploaded and registered */
  onFileUploaded?: (item: OneDriveItem, shareUrl: string) => void
}

interface BreadcrumbItem {
  id: string | null
  name: string
}

// ── Component ────────────────────────────────────────────────────────────

export function SharePointFileManager({ rootPath, onFileUploaded }: Props) {
  const rootName = rootPath.split('/').pop() || getRootFolder()
  const [loggedIn, setLoggedIn] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [items, setItems] = useState<OneDriveItem[]>([])
  const [loading, setLoading] = useState(false)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: rootName }])
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ item: OneDriveItem; x: number; y: number } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [movingItem, setMovingItem] = useState<OneDriveItem | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Init MSAL
  useEffect(() => {
    initMsal().then(() => {
      setLoggedIn(isLoggedIn())
      setInitialized(true)
    }).catch(() => setInitialized(true))
  }, [])

  // Load folder
  const currentFolderId = breadcrumb[breadcrumb.length - 1].id

  const loadFolder = useCallback(async (folderId: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const files = folderId
        ? await listSharePointFolder(folderId)
        : await listSharePointPath(rootPath)
      files.sort((a, b) => {
        if (a.folder && !b.folder) return -1
        if (!a.folder && b.folder) return 1
        return a.name.localeCompare(b.name)
      })
      setItems(files)
    } catch {
      setError('Error al cargar archivos')
    }
    setLoading(false)
  }, [rootPath])

  useEffect(() => {
    if (loggedIn) loadFolder(null)
  }, [loggedIn, loadFolder])

  function refresh() {
    loadFolder(currentFolderId)
  }

  // ── Navigation ────────────────────────────────────────────────────
  function navigateToFolder(item: OneDriveItem) {
    setBreadcrumb(prev => [...prev, { id: item.id, name: item.name }])
    loadFolder(item.id)
  }

  function navigateBack() {
    if (breadcrumb.length <= 1) return
    const newBc = breadcrumb.slice(0, -1)
    setBreadcrumb(newBc)
    loadFolder(newBc[newBc.length - 1].id)
  }

  function navigateToBreadcrumb(index: number) {
    const newBc = breadcrumb.slice(0, index + 1)
    setBreadcrumb(newBc)
    loadFolder(newBc[newBc.length - 1].id)
  }

  // ── Auth ──────────────────────────────────────────────────────────
  async function handleLogin() {
    setError(null)
    const ok = await loginOneDrive()
    if (!ok) setError('No se pudo conectar. Permite ventanas emergentes.')
    setLoggedIn(ok)
  }

  async function handleLogout() {
    await logoutOneDrive()
    setLoggedIn(false)
    setItems([])
    setBreadcrumb([{ id: null, name: rootName }])
  }

  // ── Create folder ─────────────────────────────────────────────────
  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    setCreatingFolder(true)

    if (currentFolderId) {
      await createFolder(currentFolderId, newFolderName.trim())
    } else {
      // Root level - need to get the root folder ID first
      const { ensureFolder } = await import('@/lib/sharepoint')
      await ensureFolder(`${rootPath}/${sanitizeFolderName(newFolderName.trim())}`)
    }

    setNewFolderName('')
    setCreatingFolder(false)
    refresh()
  }

  // ── Upload ────────────────────────────────────────────────────────
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploading(true)
    setUploadProgress(0)

    try {
      let result: OneDriveItem | null = null

      if (currentFolderId) {
        result = await uploadToFolder(currentFolderId, file, setUploadProgress)
      } else {
        // Upload to root path
        const { ensureFolder, uploadSmallFile, uploadLargeFile } = await import('@/lib/sharepoint')
        await ensureFolder(rootPath)
        if (file.size < 4 * 1024 * 1024) {
          const buf = await file.arrayBuffer()
          result = await uploadSmallFile(rootPath, file.name, buf)
        } else {
          result = await uploadLargeFile(rootPath, file.name, file, setUploadProgress)
        }
      }

      if (result && onFileUploaded) {
        const shareUrl = await getSharePointShareLink(result.id)
        if (shareUrl) onFileUploaded(result, shareUrl)
      }

      refresh()
    } catch {
      setError('Error al subir archivo')
    }

    setUploading(false)
    setUploadProgress(0)
  }

  // ── Rename ────────────────────────────────────────────────────────
  function startRename(item: OneDriveItem) {
    setRenamingId(item.id)
    setRenameValue(item.name)
    setContextMenu(null)
    setTimeout(() => renameInputRef.current?.select(), 50)
  }

  async function handleRename() {
    if (!renamingId || !renameValue.trim()) return
    await renameItem(renamingId, renameValue.trim())
    setRenamingId(null)
    refresh()
  }

  // ── Delete ────────────────────────────────────────────────────────
  async function handleDelete(item: OneDriveItem) {
    const type = item.folder ? 'carpeta' : 'archivo'
    if (!confirm(`¿Eliminar ${type} "${item.name}"?`)) return
    setContextMenu(null)
    await deleteItem(item.id)
    refresh()
  }

  // ── Move (drag & drop) ────────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, item: OneDriveItem) {
    e.dataTransfer.setData('itemId', item.id)
    e.dataTransfer.setData('itemName', item.name)
    setMovingItem(item)
  }

  function handleDragOver(e: React.DragEvent, targetItem: OneDriveItem) {
    if (!targetItem.folder) return
    if (movingItem?.id === targetItem.id) return
    e.preventDefault()
    setDragOverId(targetItem.id)
  }

  function handleDragLeave() {
    setDragOverId(null)
  }

  async function handleDrop(e: React.DragEvent, targetFolder: OneDriveItem) {
    e.preventDefault()
    setDragOverId(null)
    const itemId = e.dataTransfer.getData('itemId')
    if (!itemId || itemId === targetFolder.id) return
    await moveItem(itemId, targetFolder.id)
    setMovingItem(null)
    refresh()
  }

  // Close context menu on click outside
  useEffect(() => {
    function close() { setContextMenu(null) }
    if (contextMenu) {
      document.addEventListener('click', close)
      return () => document.removeEventListener('click', close)
    }
  }, [contextMenu])

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
        <Globe className="w-10 h-10 text-blue-500/40" />
        <p className="text-xs text-muted-foreground text-center">
          Conecta tu cuenta para gestionar archivos en SharePoint
        </p>
        <Button size="sm" onClick={handleLogin} className="gap-1.5">
          <LogIn className="w-3.5 h-3.5" /> Conectar SharePoint
        </Button>
        {error && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-500">
            <AlertTriangle className="w-3 h-3" /> {error}
          </div>
        )}
      </div>
    )
  }

  // ── File Manager ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-card" style={{ height: 420 }}>
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 shrink-0">
        {breadcrumb.length > 1 && (
          <button onClick={navigateBack} className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-hidden">
          {breadcrumb.map((bc, i) => (
            <span key={i} className="flex items-center gap-0.5 shrink-0">
              {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/50" />}
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={`text-xs px-1 py-0.5 rounded hover:bg-muted transition-colors truncate max-w-28 ${
                  i === breadcrumb.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'
                }`}
              >
                {bc.name}
              </button>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} multiple={false} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
            title="Subir archivo"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setCreatingFolder(v => !v)}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
            title="Nueva carpeta"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleLogout} className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted" title="Desconectar">
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Upload progress */}
      {uploading && uploadProgress > 0 && (
        <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <div className="flex-1 bg-blue-200 dark:bg-blue-900/40 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span>{uploadProgress}%</span>
          </div>
        </div>
      )}

      {/* New folder input */}
      {creatingFolder && (
        <div className="px-3 py-2 border-b border-border bg-muted/20 flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-amber-400 shrink-0" />
          <input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setCreatingFolder(false) }}
            placeholder="Nombre de la carpeta..."
            autoFocus
            className="flex-1 px-2 py-1 text-xs border border-border rounded bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded disabled:opacity-30">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setCreatingFolder(false); setNewFolderName('') }} className="p-1 text-muted-foreground hover:text-foreground rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto relative">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            <Folder className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Carpeta vacía</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3 h-3 mr-1" /> Subir archivo
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCreatingFolder(true)}>
                <FolderPlus className="w-3 h-3 mr-1" /> Nueva carpeta
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {items.map(item => {
              const isFolder = !!item.folder
              const iconType = isFolder ? 'folder' : getFileIcon(item.name, item.file?.mimeType)
              const icon = FILE_ICONS[iconType] || FILE_ICONS.file
              const isRenaming = renamingId === item.id
              const isDragOver = dragOverId === item.id

              return (
                <div
                  key={item.id}
                  draggable={!isRenaming}
                  onDragStart={e => handleDragStart(e, item)}
                  onDragOver={e => handleDragOver(e, item)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, item)}
                  onContextMenu={e => { e.preventDefault(); setContextMenu({ item, x: e.clientX, y: e.clientY }) }}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors group ${
                    isDragOver
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500'
                      : 'hover:bg-muted/30'
                  }`}
                  onClick={() => isFolder && !isRenaming && navigateToFolder(item)}
                >
                  {icon}
                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenamingId(null) }}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                          className="flex-1 px-1.5 py-0.5 text-xs border border-border rounded bg-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button onClick={e => { e.stopPropagation(); handleRename() }} className="p-0.5 text-green-500"><Check className="w-3 h-3" /></button>
                        <button onClick={e => { e.stopPropagation(); setRenamingId(null) }} className="p-0.5 text-muted-foreground"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-foreground truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground/60">
                          {isFolder ? `${item.folder!.childCount} elementos` : formatFileSize(item.size)}
                        </p>
                      </>
                    )}
                  </div>
                  {!isRenaming && (
                    <button
                      onClick={e => { e.stopPropagation(); setContextMenu({ item, x: e.clientX, y: e.clientY }) }}
                      className="p-1 text-muted-foreground hover:text-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Context menu */}
        {contextMenu && (
          <div
            className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-36"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => startRename(contextMenu.item)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="w-3 h-3" /> Renombrar
            </button>
            <button
              onClick={() => handleDelete(contextMenu.item)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Drag hint */}
      {movingItem && (
        <div className="px-3 py-1.5 border-t border-border bg-blue-50 dark:bg-blue-900/10 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
          <Move className="w-3 h-3" />
          Arrastra &quot;{movingItem.name}&quot; a una carpeta para moverlo
        </div>
      )}
    </div>
  )
}
