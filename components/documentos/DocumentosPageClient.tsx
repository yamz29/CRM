'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Plus, Search, ExternalLink, Pencil, Trash2, X, FolderOpen,
  FileText, Image, FileCheck, MapPin, Receipt, ClipboardList, File,
  Tag, Calendar, User, Link2, Eye, Briefcase, TrendingUp,
  ChevronRight, ChevronDown, MessageSquare, Send, Folder, Globe, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SharePointUploader, guessCategory } from './SharePointUploader'
import { sanitizeFolderName } from '@/lib/sharepoint'
import { formatFileSize, type OneDriveItem } from '@/lib/onedrive'

// ── Types ────────────────────────────────────────────────────────────────

interface Documento {
  id: number
  proyectoId: number | null
  oportunidadId: number | null
  nombre: string
  categoria: string
  url: string
  descripcion: string | null
  etiquetas: string | null
  subidoPor: string | null
  fechaDocumento: string | null
  tamanioRef: string | null
  createdAt: string
  updatedAt: string
  proyecto: { id: number; nombre: string } | null
  oportunidad: { id: number; nombre: string } | null
  _count: { comentarios: number }
}

interface Comentario {
  id: number
  documentoId: number
  usuarioId: number | null
  autorNombre: string
  contenido: string
  createdAt: string
}

interface Props {
  proyectos: { id: number; nombre: string; cliente: { nombre: string } }[]
  oportunidades: { id: number; nombre: string; etapa: string; cliente: { nombre: string } }[]
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

const emptyForm = {
  nombre: '', categoria: 'General', url: '', descripcion: '',
  etiquetasInput: '', subidoPor: '', fechaDocumento: '', tamanioRef: '',
  proyectoId: '', oportunidadId: '',
}

// ── Main Component ───────────────────────────────────────────────────────

export function DocumentosPageClient({ proyectos, oportunidades }: Props) {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [treeSearch, setTreeSearch] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [comentariosLoading, setComentariosLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentAuthor, setCommentAuthor] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['oportunidades', 'proyectos', 'sin_vincular']))
  const commentEndRef = useRef<HTMLDivElement>(null)
  const [uploadTarget, setUploadTarget] = useState<{ tipo: 'proyecto' | 'oportunidad'; id: number; nombre: string; clienteNombre: string } | null>(null)

  // ── Load documents ─────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    const res = await fetch('/api/documentos')
    if (res.ok) setDocumentos(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Load comments when doc selected ────────────────────────────────
  async function loadComentarios(docId: number) {
    setComentariosLoading(true)
    const res = await fetch(`/api/documentos/${docId}/comentarios`)
    if (res.ok) setComentarios(await res.json())
    setComentariosLoading(false)
  }

  function selectDoc(doc: Documento) {
    setSelectedDoc(doc)
    loadComentarios(doc.id)
  }

  // ── Tree structure ─────────────────────────────────────────────────
  const tree = useMemo(() => {
    const lq = treeSearch.toLowerCase()
    const filteredDocs = lq
      ? documentos.filter(d =>
          d.nombre.toLowerCase().includes(lq) ||
          d.proyecto?.nombre.toLowerCase().includes(lq) ||
          d.oportunidad?.nombre.toLowerCase().includes(lq) ||
          parseEtiquetas(d.etiquetas).some(t => t.toLowerCase().includes(lq))
        )
      : documentos

    // Group by oportunidad
    const opMap = new Map<number, { nombre: string; docs: Documento[] }>()
    // Group by proyecto
    const projMap = new Map<number, { nombre: string; docs: Documento[] }>()
    const sinVincular: Documento[] = []

    for (const d of filteredDocs) {
      if (d.oportunidadId && d.oportunidad) {
        if (!opMap.has(d.oportunidadId)) opMap.set(d.oportunidadId, { nombre: d.oportunidad.nombre, docs: [] })
        opMap.get(d.oportunidadId)!.docs.push(d)
      }
      if (d.proyectoId && d.proyecto) {
        if (!projMap.has(d.proyectoId)) projMap.set(d.proyectoId, { nombre: d.proyecto.nombre, docs: [] })
        projMap.get(d.proyectoId)!.docs.push(d)
      }
      if (!d.oportunidadId && !d.proyectoId) {
        sinVincular.push(d)
      }
    }

    return { opMap, projMap, sinVincular }
  }, [documentos, treeSearch])

  function toggleExpand(key: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  // ── Comments ───────────────────────────────────────────────────────
  async function handleSendComment() {
    if (!selectedDoc || !newComment.trim() || !commentAuthor.trim()) return
    setSendingComment(true)
    const res = await fetch(`/api/documentos/${selectedDoc.id}/comentarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autorNombre: commentAuthor.trim(), contenido: newComment.trim() }),
    })
    if (res.ok) {
      const c = await res.json()
      setComentarios(prev => [c, ...prev])
      setNewComment('')
      // Update count locally
      setDocumentos(prev => prev.map(d =>
        d.id === selectedDoc.id ? { ...d, _count: { comentarios: d._count.comentarios + 1 } } : d
      ))
    }
    setSendingComment(false)
  }

  async function handleDeleteComment(commentId: number) {
    if (!selectedDoc) return
    await fetch(`/api/documentos/${selectedDoc.id}/comentarios?comentarioId=${commentId}`, { method: 'DELETE' })
    setComentarios(prev => prev.filter(c => c.id !== commentId))
    setDocumentos(prev => prev.map(d =>
      d.id === selectedDoc.id ? { ...d, _count: { comentarios: Math.max(0, d._count.comentarios - 1) } } : d
    ))
  }

  // ── CRUD ───────────────────────────────────────────────────────────
  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(doc: Documento) {
    setEditingId(doc.id)
    setForm({
      nombre: doc.nombre, categoria: doc.categoria, url: doc.url,
      descripcion: doc.descripcion ?? '',
      etiquetasInput: parseEtiquetas(doc.etiquetas).join(', '),
      subidoPor: doc.subidoPor ?? '',
      fechaDocumento: doc.fechaDocumento ? doc.fechaDocumento.slice(0, 10) : '',
      tamanioRef: doc.tamanioRef ?? '',
      proyectoId: doc.proyectoId ? String(doc.proyectoId) : '',
      oportunidadId: doc.oportunidadId ? String(doc.oportunidadId) : '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.nombre.trim() || !form.url.trim()) return
    setSaving(true)
    const etiquetas = form.etiquetasInput ? form.etiquetasInput.split(',').map(t => t.trim()).filter(Boolean) : []
    const payload = {
      nombre: form.nombre.trim(), categoria: form.categoria, url: form.url.trim(),
      descripcion: form.descripcion.trim() || null,
      etiquetas: etiquetas.length > 0 ? etiquetas : null,
      subidoPor: form.subidoPor.trim() || null,
      fechaDocumento: form.fechaDocumento || null,
      tamanioRef: form.tamanioRef.trim() || null,
      proyectoId: form.proyectoId || null,
      oportunidadId: form.oportunidadId || null,
    }
    if (editingId) {
      await fetch(`/api/documentos/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } else {
      await fetch('/api/documentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setSaving(false); setFormOpen(false); setEditingId(null)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este registro de documento?')) return
    await fetch(`/api/documentos/${id}`, { method: 'DELETE' })
    if (selectedDoc?.id === id) setSelectedDoc(null)
    load()
  }

  // ── Loading ────────────────────────────────────────────────────────
  // ── Upload handler ─────────────────────────────────────────────────
  function handleUploaded(item: OneDriveItem, shareUrl: string) {
    if (!uploadTarget) return
    // Auto-register in CRM
    const payload: Record<string, unknown> = {
      nombre: item.name.replace(/\.[^.]+$/, ''),
      url: shareUrl,
      categoria: guessCategory(item.name),
      tamanioRef: formatFileSize(item.size),
    }
    if (uploadTarget.tipo === 'proyecto') payload.proyectoId = uploadTarget.id
    if (uploadTarget.tipo === 'oportunidad') payload.oportunidadId = uploadTarget.id
    fetch('/api/documentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(() => load())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro centralizado de documentos del CRM
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" /> Registrar documento
        </Button>
      </div>

      {/* 3-Panel Layout */}
      <div className="grid grid-cols-[280px_1fr_320px] gap-0 border border-border rounded-xl overflow-hidden bg-card" style={{ height: 'calc(100vh - 180px)' }}>

        {/* ═══ LEFT: Tree Panel ═══ */}
        <div className="border-r border-border flex flex-col">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-border bg-muted/30">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={treeSearch}
                onChange={e => setTreeSearch(e.target.value)}
                placeholder="Buscar documentos..."
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Upload zone */}
          {uploadTarget && (
            <div className="px-3 py-2 border-b border-border bg-blue-50/50 dark:bg-blue-900/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">
                  Subir a: {uploadTarget.nombre}
                </span>
                <button onClick={() => setUploadTarget(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <SharePointUploader
                folderPath={`CRM/${sanitizeFolderName(uploadTarget.clienteNombre)}/${sanitizeFolderName(uploadTarget.nombre)}`}
                onUploaded={handleUploaded}
                label="Arrastra o haz clic para subir"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto text-xs">
            {/* Oportunidades */}
            {tree.opMap.size > 0 && (
              <TreeSection
                title="Oportunidades"
                icon={<TrendingUp className="w-3.5 h-3.5" />}
                expanded={expanded.has('oportunidades')}
                onToggle={() => toggleExpand('oportunidades')}
                count={Array.from(tree.opMap.values()).reduce((s, g) => s + g.docs.length, 0)}
              >
                {Array.from(tree.opMap.entries()).map(([opId, group]) => {
                  const op = oportunidades.find(o => o.id === opId)
                  return (
                    <TreeEntity
                      key={`op-${opId}`}
                      name={group.nombre}
                      icon={<TrendingUp className="w-3 h-3 text-purple-500" />}
                      docs={group.docs}
                      selectedId={selectedDoc?.id ?? null}
                      onSelect={selectDoc}
                      expanded={expanded}
                      expandKey={`op-${opId}`}
                      onToggle={toggleExpand}
                      onUpload={op ? () => setUploadTarget({ tipo: 'oportunidad', id: opId, nombre: group.nombre, clienteNombre: op.cliente.nombre }) : undefined}
                    />
                  )
                })}
              </TreeSection>
            )}

            {/* Proyectos */}
            {tree.projMap.size > 0 && (
              <TreeSection
                title="Proyectos"
                icon={<Briefcase className="w-3.5 h-3.5" />}
                expanded={expanded.has('proyectos')}
                onToggle={() => toggleExpand('proyectos')}
                count={Array.from(tree.projMap.values()).reduce((s, g) => s + g.docs.length, 0)}
              >
                {Array.from(tree.projMap.entries()).map(([pId, group]) => {
                  const proj = proyectos.find(p => p.id === pId)
                  return (
                    <TreeEntity
                      key={`proj-${pId}`}
                      name={group.nombre}
                      icon={<Briefcase className="w-3 h-3 text-blue-500" />}
                      docs={group.docs}
                      selectedId={selectedDoc?.id ?? null}
                      onSelect={selectDoc}
                      expanded={expanded}
                      expandKey={`proj-${pId}`}
                      onToggle={toggleExpand}
                      onUpload={proj ? () => setUploadTarget({ tipo: 'proyecto', id: pId, nombre: group.nombre, clienteNombre: proj.cliente.nombre }) : undefined}
                    />
                  )
                })}
              </TreeSection>
            )}

            {/* Sin vincular */}
            {tree.sinVincular.length > 0 && (
              <TreeSection
                title="Sin vincular"
                icon={<Folder className="w-3.5 h-3.5" />}
                expanded={expanded.has('sin_vincular')}
                onToggle={() => toggleExpand('sin_vincular')}
                count={tree.sinVincular.length}
              >
                {tree.sinVincular.map(d => (
                  <TreeDocItem key={d.id} doc={d} selected={selectedDoc?.id === d.id} onSelect={selectDoc} />
                ))}
              </TreeSection>
            )}

            {documentos.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground">
                <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin documentos</p>
                <button onClick={openNew} className="text-primary text-xs mt-1 hover:underline">+ Registrar primero</button>
              </div>
            )}
          </div>
        </div>

        {/* ═══ CENTER: Preview Panel ═══ */}
        <div className="flex flex-col bg-muted/10">
          {selectedDoc ? (
            <>
              {/* Doc header */}
              <div className="px-4 py-2.5 border-b border-border bg-card flex items-center gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">{selectedDoc.nombre}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCatConfig(selectedDoc.categoria).color}`}>
                      {selectedDoc.categoria}
                    </span>
                    {selectedDoc.tamanioRef && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{selectedDoc.tamanioRef}</span>
                    )}
                  </div>
                  {selectedDoc.descripcion && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedDoc.descripcion}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(selectedDoc)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted" title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <a href={selectedDoc.url} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted" title="Abrir original">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => handleDelete(selectedDoc.id)} className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {/* Meta row */}
              <div className="px-4 py-1.5 border-b border-border bg-card flex items-center gap-4 text-xs text-muted-foreground shrink-0 flex-wrap">
                {selectedDoc.oportunidad && (
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-purple-500" /> {selectedDoc.oportunidad.nombre}</span>
                )}
                {selectedDoc.proyecto && (
                  <a href={`/proyectos/${selectedDoc.proyecto.id}`} className="flex items-center gap-1 hover:text-primary">
                    <Briefcase className="w-3 h-3 text-blue-500" /> {selectedDoc.proyecto.nombre}
                  </a>
                )}
                {selectedDoc.subidoPor && (
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedDoc.subidoPor}</span>
                )}
                {selectedDoc.fechaDocumento && (
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(selectedDoc.fechaDocumento).toLocaleDateString('es-DO')}</span>
                )}
                {parseEtiquetas(selectedDoc.etiquetas).length > 0 && (
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {parseEtiquetas(selectedDoc.etiquetas).map(t => (
                      <span key={t} className="bg-muted px-1.5 py-0.5 rounded-full">{t}</span>
                    ))}
                  </span>
                )}
              </div>
              {/* Preview iframe */}
              <div className="flex-1 min-h-0">
                <PreviewFrame url={selectedDoc.url} nombre={selectedDoc.nombre} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Eye className="w-12 h-12 opacity-20" />
              <p className="text-sm">Selecciona un documento del panel izquierdo</p>
              <p className="text-xs opacity-60">Vista previa de PDFs y documentos registrados</p>
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Comments Panel ═══ */}
        <div className="border-l border-border flex flex-col">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wide">Comentarios</span>
            {selectedDoc && (
              <span className="text-xs text-muted-foreground">({selectedDoc._count.comentarios})</span>
            )}
          </div>

          {selectedDoc ? (
            <>
              {/* Comment input */}
              <div className="p-3 border-b border-border space-y-2 shrink-0">
                <input
                  value={commentAuthor}
                  onChange={e => setCommentAuthor(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-1.5">
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Escribe un comentario..."
                    rows={2}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() } }}
                    className="flex-1 px-2.5 py-1.5 text-xs border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                  <button
                    onClick={handleSendComment}
                    disabled={sendingComment || !newComment.trim() || !commentAuthor.trim()}
                    className="self-end p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    title="Enviar"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Comments list */}
              <div className="flex-1 overflow-y-auto">
                {comentariosLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : comentarios.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground text-xs">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Sin comentarios aún
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {comentarios.map(c => (
                      <div key={c.id} className="px-3 py-3 hover:bg-muted/20 group">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                              {c.autorNombre.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-foreground">{c.autorNombre}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground/60">
                              {new Date(c.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              {' '}
                              {new Date(c.createdAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="p-1 text-muted-foreground hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap pl-8">{c.contenido}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div ref={commentEndRef} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
              <MessageSquare className="w-8 h-8 opacity-20" />
              Selecciona un documento para ver comentarios
            </div>
          )}
        </div>
      </div>

      {/* ═══ Form Modal ═══ */}
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
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre del documento *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="ej: Plano arquitectónico v2"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Enlace (SharePoint / Google Drive) *</label>
                <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://sharepoint.com/... o https://drive.google.com/..."
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Vincular a oportunidad</label>
                  <select value={form.oportunidadId} onChange={e => setForm({ ...form, oportunidadId: e.target.value })}
                    className="w-full h-9 text-sm border border-border rounded-lg px-2 bg-input text-foreground">
                    <option value="">Sin vincular</option>
                    {oportunidades.map(o => <option key={o.id} value={o.id}>{o.nombre} ({o.etapa})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Vincular a proyecto</label>
                  <select value={form.proyectoId} onChange={e => setForm({ ...form, proyectoId: e.target.value })}
                    className="w-full h-9 text-sm border border-border rounded-lg px-2 bg-input text-foreground">
                    <option value="">Sin vincular</option>
                    {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                    className="w-full h-9 text-sm border border-border rounded-lg px-2 bg-input text-foreground">
                    {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha del documento</label>
                  <input type="date" value={form.fechaDocumento} onChange={e => setForm({ ...form, fechaDocumento: e.target.value })}
                    className="w-full h-9 text-sm border border-border rounded-lg px-2 bg-input text-foreground" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción breve..." rows={2}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Registrado por</label>
                  <input value={form.subidoPor} onChange={e => setForm({ ...form, subidoPor: e.target.value })} placeholder="Nombre"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Tamaño aprox.</label>
                  <input value={form.tamanioRef} onChange={e => setForm({ ...form, tamanioRef: e.target.value })} placeholder="ej: 15 MB"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Etiquetas (separadas por coma)</label>
                <input value={form.etiquetasInput} onChange={e => setForm({ ...form, etiquetasInput: e.target.value })} placeholder="ej: cocina, plano, v2"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
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

// ── Tree Sub-components ──────────────────────────────────────────────────

function TreeSection({ title, icon, expanded, onToggle, count, children }: {
  title: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void; count: number; children: React.ReactNode
}) {
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors border-b border-border/50">
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        {icon}
        <span className="font-bold text-foreground uppercase tracking-wide text-xs">{title}</span>
        <span className="text-muted-foreground ml-auto">({count})</span>
      </button>
      {expanded && <div>{children}</div>}
    </div>
  )
}

function TreeEntity({ name, icon, docs, selectedId, onSelect, expanded, expandKey, onToggle, onUpload }: {
  name: string; icon: React.ReactNode; docs: Documento[]; selectedId: number | null
  onSelect: (d: Documento) => void; expanded: Set<string>; expandKey: string; onToggle: (k: string) => void
  onUpload?: () => void
}) {
  const isOpen = expanded.has(expandKey)
  return (
    <div>
      <div className="flex items-center pl-6 pr-3 py-1.5 hover:bg-muted/30 transition-colors group">
        <button onClick={() => onToggle(expandKey)} className="flex items-center gap-2 flex-1 min-w-0">
          {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          {icon}
          <span className="text-foreground truncate flex-1 text-left">{name}</span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {onUpload && (
            <button onClick={onUpload} className="p-0.5 text-muted-foreground hover:text-primary rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Subir archivo">
              <Upload className="w-3 h-3" />
            </button>
          )}
          <span className="text-muted-foreground/60">{docs.length}</span>
        </div>
      </div>
      {isOpen && docs.map(d => (
        <TreeDocItem key={d.id} doc={d} selected={selectedId === d.id} onSelect={onSelect} indent />
      ))}
    </div>
  )
}

function TreeDocItem({ doc, selected, onSelect, indent = false }: {
  doc: Documento; selected: boolean; onSelect: (d: Documento) => void; indent?: boolean
}) {
  const cat = getCatConfig(doc.categoria)
  const CatIcon = cat.icon
  return (
    <button
      onClick={() => onSelect(doc)}
      className={`w-full flex items-center gap-2 py-1.5 pr-3 transition-colors text-left ${
        indent ? 'pl-12' : 'pl-6'
      } ${selected ? 'bg-primary/10 text-primary border-r-2 border-primary' : 'hover:bg-muted/30 text-foreground'}`}
    >
      <CatIcon className="w-3 h-3 shrink-0 opacity-60" />
      <span className="truncate flex-1">{doc.nombre}</span>
      {doc._count.comentarios > 0 && (
        <span className="flex items-center gap-0.5 text-muted-foreground shrink-0">
          <MessageSquare className="w-2.5 h-2.5" />
          <span className="text-[10px]">{doc._count.comentarios}</span>
        </span>
      )}
    </button>
  )
}

// ── Preview Frame ────────────────────────────────────────────────────────

function PreviewFrame({ url, nombre }: { url: string; nombre: string }) {
  const lower = url.toLowerCase()
  const isGDrive = lower.includes('drive.google.com')
  const isSharePoint = lower.includes('sharepoint.com') || lower.includes('1drv.ms')
  const isOfficeOnline = lower.includes('officeapps.live.com')

  // SharePoint share links cannot be embedded (X-Frame-Options: deny)
  // Always open in a new tab
  if (isSharePoint) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Globe className="w-16 h-16 text-blue-500/20" />
        <p className="text-muted-foreground text-sm">Documento almacenado en SharePoint</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs text-center">
          SharePoint no permite vista previa embebida — se abrirá en una nueva pestaña
        </p>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <ExternalLink className="w-4 h-4" /> Abrir en SharePoint
        </a>
      </div>
    )
  }

  if (isOfficeOnline) {
    return <iframe src={url} className="w-full h-full border-0" title={nombre} />
  }

  if (isGDrive) {
    const previewUrl = url.replace('/view', '/preview').replace('/edit', '/preview')
    return <iframe src={previewUrl} className="w-full h-full border-0" title={nombre} sandbox="allow-scripts allow-same-origin" />
  }

  // PDF direct
  if (lower.endsWith('.pdf') || lower.includes('/pdf')) {
    return <iframe src={url} className="w-full h-full border-0" title={nombre} />
  }

  // Fallback
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <FileText className="w-16 h-16 text-muted-foreground/20" />
      <p className="text-muted-foreground text-sm">Vista previa no disponible para este tipo de enlace</p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
        <ExternalLink className="w-4 h-4" /> Abrir en nueva pestaña
      </a>
    </div>
  )
}
