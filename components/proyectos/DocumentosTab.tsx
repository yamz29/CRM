'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Plus, Search, ExternalLink, Pencil, Trash2, X, FolderOpen,
  FileText, Image, FileCheck, MapPin, Receipt, ClipboardList, File,
  Tag, Calendar, User, Link2, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SharePointUploader, guessCategory } from '@/components/documentos/SharePointUploader'
import { SharePointFileManager } from '@/components/documentos/SharePointFileManager'
import { sanitizeFolderName } from '@/lib/sharepoint'
import { formatFileSize, type OneDriveItem } from '@/lib/onedrive'

// ── Types ────────────────────────────────────────────────────────────────

interface Documento {
  id: number
  proyectoId: number
  nombre: string
  categoria: string
  url: string
  descripcion: string | null
  etiquetas: string | null  // JSON array
  subidoPor: string | null
  fechaDocumento: string | null
  tamanioRef: string | null
  createdAt: string
  updatedAt: string
}

// ── Constants ────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { key: 'Plano',     label: 'Plano',     icon: MapPin,        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { key: 'Contrato',  label: 'Contrato',  icon: FileCheck,     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { key: 'Permiso',   label: 'Permiso',   icon: ClipboardList, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { key: 'Foto',      label: 'Foto',      icon: Image,         color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { key: 'Factura',   label: 'Factura',   icon: Receipt,       color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { key: 'Acta',      label: 'Acta',      icon: FileText,      color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { key: 'General',   label: 'General',   icon: File,          color: 'bg-muted text-muted-foreground' },
]

function getCatConfig(cat: string) {
  return CATEGORIAS.find(c => c.key === cat) ?? CATEGORIAS[CATEGORIAS.length - 1]
}

function parseEtiquetas(json: string | null): string[] {
  if (!json) return []
  try { return JSON.parse(json) } catch { return [] }
}

// ── Empty form ───────────────────────────────────────────────────────────

const emptyForm = {
  nombre: '',
  categoria: 'General',
  url: '',
  descripcion: '',
  etiquetasInput: '',
  subidoPor: '',
  fechaDocumento: '',
  tamanioRef: '',
}

// ── Component ────────────────────────────────────────────────────────────

export function DocumentosTab({ proyectoId, clienteNombre, proyectoNombre }: {
  proyectoId: number
  clienteNombre?: string
  proyectoNombre?: string
}) {
  const spFolderPath = clienteNombre && proyectoNombre
    ? `CRM/${sanitizeFolderName(clienteNombre)}/${sanitizeFolderName(proyectoNombre)}`
    : null
  const [showFileManager, setShowFileManager] = useState(false)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtroCat, setFiltroCat] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  async function load() {
    const res = await fetch(`/api/documentos?proyectoId=${proyectoId}`)
    if (res.ok) setDocumentos(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [proyectoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return documentos.filter(d => {
      if (filtroCat && d.categoria !== filtroCat) return false
      if (q) {
        const lq = q.toLowerCase()
        const tags = parseEtiquetas(d.etiquetas)
        if (
          !d.nombre.toLowerCase().includes(lq) &&
          !(d.descripcion?.toLowerCase().includes(lq)) &&
          !tags.some(t => t.toLowerCase().includes(lq))
        ) return false
      }
      return true
    })
  }, [documentos, q, filtroCat])

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<string, Documento[]> = {}
    for (const d of filtered) {
      if (!map[d.categoria]) map[d.categoria] = []
      map[d.categoria].push(d)
    }
    return CATEGORIAS
      .filter(c => map[c.key])
      .map(c => ({ ...c, docs: map[c.key] }))
  }, [filtered])

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(doc: Documento) {
    setEditingId(doc.id)
    setForm({
      nombre: doc.nombre,
      categoria: doc.categoria,
      url: doc.url,
      descripcion: doc.descripcion ?? '',
      etiquetasInput: parseEtiquetas(doc.etiquetas).join(', '),
      subidoPor: doc.subidoPor ?? '',
      fechaDocumento: doc.fechaDocumento ? doc.fechaDocumento.slice(0, 10) : '',
      tamanioRef: doc.tamanioRef ?? '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.nombre.trim() || !form.url.trim()) return
    setSaving(true)

    const etiquetas = form.etiquetasInput
      ? form.etiquetasInput.split(',').map(t => t.trim()).filter(Boolean)
      : []

    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      url: form.url.trim(),
      descripcion: form.descripcion.trim() || null,
      etiquetas: etiquetas.length > 0 ? etiquetas : null,
      subidoPor: form.subidoPor.trim() || null,
      fechaDocumento: form.fechaDocumento || null,
      tamanioRef: form.tamanioRef.trim() || null,
    }

    if (editingId) {
      await fetch(`/api/documentos/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, proyectoId }),
      })
    }

    setSaving(false)
    setFormOpen(false)
    setEditingId(null)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este registro de documento?')) return
    setDeleting(id)
    await fetch(`/api/documentos/${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, descripción o etiqueta..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filtroCat}
          onChange={(e) => setFiltroCat(e.target.value)}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <Button onClick={openNew} className="h-8 text-xs px-3">
          <Plus className="w-3.5 h-3.5" /> Registrar documento
        </Button>
      </div>

      {/* SharePoint section */}
      {spFolderPath && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SharePointUploader
              folderPath={spFolderPath}
              onUploaded={(item: OneDriveItem, shareUrl: string) => {
                fetch('/api/documentos', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    nombre: item.name.replace(/\.[^.]+$/, ''),
                    url: shareUrl,
                    categoria: guessCategory(item.name),
                    proyectoId,
                    tamanioRef: formatFileSize(item.size),
                  }),
                }).then(() => load())
              }}
            />
          </div>
          <button
            onClick={() => setShowFileManager(v => !v)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <FolderOpen className="w-3 h-3" />
            {showFileManager ? 'Ocultar gestor de archivos' : 'Gestionar archivos en SharePoint'}
          </button>
          {showFileManager && (
            <SharePointFileManager
              rootPath={spFolderPath}
              onFileUploaded={(item, shareUrl) => {
                fetch('/api/documentos', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    nombre: item.name.replace(/\.[^.]+$/, ''),
                    url: shareUrl,
                    categoria: guessCategory(item.name),
                    proyectoId,
                    tamanioRef: formatFileSize(item.size),
                  }),
                }).then(() => load())
              }}
            />
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 flex-wrap">
        {CATEGORIAS.map(cat => {
          const count = documentos.filter(d => d.categoria === cat.key).length
          if (count === 0) return null
          const CatIcon = cat.icon
          return (
            <button
              key={cat.key}
              onClick={() => setFiltroCat(filtroCat === cat.key ? '' : cat.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                filtroCat === cat.key ? cat.color + ' border-current' : 'bg-card border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <CatIcon className="w-3 h-3" />
              {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <FolderOpen className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {documentos.length === 0 ? 'No hay documentos registrados para este proyecto' : 'Sin resultados para esta búsqueda'}
          </p>
          {documentos.length === 0 && (
            <Button onClick={openNew} size="sm" className="mt-3">
              <Plus className="w-3.5 h-3.5" /> Registrar primer documento
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => {
            const GroupIcon = group.icon
            return (
              <div key={group.key} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
                  <GroupIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">{group.label}</span>
                  <span className="text-xs text-muted-foreground">({group.docs.length})</span>
                </div>
                <div className="divide-y divide-border">
                  {group.docs.map(doc => {
                    const tags = parseEtiquetas(doc.etiquetas)
                    return (
                      <div key={doc.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
                            >
                              {doc.nombre}
                            </a>
                            {doc.tamanioRef && (
                              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                {doc.tamanioRef}
                              </span>
                            )}
                          </div>
                          {doc.descripcion && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.descripcion}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            {doc.subidoPor && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="w-2.5 h-2.5" /> {doc.subidoPor}
                              </span>
                            )}
                            {doc.fechaDocumento && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" /> {new Date(doc.fechaDocumento).toLocaleDateString('es-DO')}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground/60">
                              Registrado {new Date(doc.createdAt).toLocaleDateString('es-DO')}
                            </span>
                          </div>
                          {tags.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <Tag className="w-2.5 h-2.5 text-muted-foreground" />
                              {tags.map(t => (
                                <span key={t} className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition-colors"
                            title="Abrir enlace"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => openEdit(doc)}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            disabled={deleting === doc.id}
                            className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                {editingId ? 'Editar documento' : 'Registrar documento'}
              </h3>
              <button onClick={() => { setFormOpen(false); setEditingId(null) }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre del documento *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="ej: Plano arquitectónico v2"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Enlace (SharePoint / Google Drive) *</label>
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://sharepoint.com/... o https://drive.google.com/..."
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Categoría */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Categoría</label>
                  <select
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    className="w-full h-9 text-sm border border-border rounded-lg px-2 bg-input text-foreground"
                  >
                    {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>

                {/* Fecha del documento */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha del documento</label>
                  <input
                    type="date"
                    value={form.fechaDocumento}
                    onChange={(e) => setForm({ ...form, fechaDocumento: e.target.value })}
                    className="w-full h-9 text-sm border border-border rounded-lg px-2 bg-input text-foreground"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Descripción breve del documento..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Subido por */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Registrado por</label>
                  <input
                    value={form.subidoPor}
                    onChange={(e) => setForm({ ...form, subidoPor: e.target.value })}
                    placeholder="Nombre"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Tamaño referencia */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Tamaño aprox.</label>
                  <input
                    value={form.tamanioRef}
                    onChange={(e) => setForm({ ...form, tamanioRef: e.target.value })}
                    placeholder="ej: 15 MB"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Etiquetas */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Etiquetas (separadas por coma)</label>
                <input
                  value={form.etiquetasInput}
                  onChange={(e) => setForm({ ...form, etiquetasInput: e.target.value })}
                  placeholder="ej: cocina, plano, v2"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => { setFormOpen(false); setEditingId(null) }}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving || !form.nombre.trim() || !form.url.trim()}>
                  {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Registrar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
