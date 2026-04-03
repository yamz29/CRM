'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ETAPAS_PRODUCCION, ETAPA_COLORS, ESTADO_COLORS, PRIORIDAD_COLORS,
  PRIORIDADES, ESTADOS_ORDEN,
} from '@/lib/produccion'
import { KanbanProduccion } from './KanbanProduccion'
import { QCChecklistEditor } from './QCChecklistEditor'
import { MaterialesList } from './MaterialesList'
import {
  ArrowLeft, Package, ShoppingCart, Users, Settings, Trash2, Save, Loader2,
} from 'lucide-react'

interface Asignacion {
  id: number
  etapa: string
  usuario: { id: number; nombre: string }
}

interface Item {
  id: number
  nombreModulo: string
  tipoModulo: string | null
  dimensiones: string | null
  cantidad: number
  etapa: string
  prioridad: string
  completado: boolean
  checklistQCProceso: string | null
  checklistQCFinal: string | null
  observaciones: string | null
  fechaInicioEtapa: string | null
  fechaCompletado: string | null
  asignaciones: Asignacion[]
}

interface Material {
  id: number
  nombre: string
  tipo: string | null
  unidad: string
  cantidadRequerida: number
  cantidadComprada: number
  cantidadRecibida: number
  costoUnitario: number
  costoTotal: number
  proveedor: string | null
  estado: string
}

interface Orden {
  id: number
  codigo: string
  nombre: string
  estado: string
  prioridad: string
  clienteNombre: string | null
  notas: string | null
  proyecto: { id: number; nombre: string } | null
  items: Item[]
  materiales: Material[]
  fechaInicio: string | null
  fechaEstimada: string | null
  createdAt: string
}

interface Props {
  orden: Orden
  usuarios: { id: number; nombre: string }[]
}

export function OrdenProduccionDetail({ orden, usuarios }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'pipeline' | 'materiales' | 'config'>('pipeline')
  const [selectedItem, setSelectedItem] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Editable order fields
  const [estado, setEstado] = useState(orden.estado)
  const [prioridad, setPrioridad] = useState(orden.prioridad)
  const [notas, setNotas] = useState(orden.notas || '')

  const progress = orden.items.length > 0
    ? Math.round((orden.items.filter(i => i.completado).length / orden.items.length) * 100)
    : 0

  async function handleSaveConfig() {
    setSaving(true)
    await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, prioridad, notas }),
    })
    router.refresh()
    setSaving(false)
  }

  async function handleDeleteOrder() {
    if (!confirm('¿Eliminar esta orden y todos sus items?')) return
    await fetch(`/api/produccion/${orden.id}`, { method: 'DELETE' })
    router.push('/produccion?msg=eliminado')
  }

  const selectedItemData = selectedItem
    ? orden.items.find(i => i.id === selectedItem)
    : null

  const tabs = [
    { key: 'pipeline' as const,   label: 'Pipeline',   icon: Package },
    { key: 'materiales' as const, label: 'Materiales',  icon: ShoppingCart },
    { key: 'config' as const,     label: 'Configuración', icon: Settings },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/produccion">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{orden.nombre}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[orden.estado] || ''}`}>
                {orden.estado}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{orden.codigo}</span>
              {orden.clienteNombre && <span>• {orden.clienteNombre}</span>}
              {orden.proyecto && (
                <Link href={`/proyectos/${orden.proyecto.id}`} className="hover:text-primary">
                  • {orden.proyecto.nombre}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_COLORS[orden.prioridad] || ''}`}>
            {orden.prioridad}
          </span>
          <span className="text-sm text-muted-foreground">
            {orden.items.length} items • {progress}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm font-medium text-foreground">{progress}%</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.key === 'materiales' && (
              <Badge variant="default">{orden.materiales.length}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'pipeline' && (
        <div className="space-y-6">
          <KanbanProduccion
            ordenId={orden.id}
            items={orden.items}
            onSelectItem={setSelectedItem}
            selectedItemId={selectedItem}
            usuarios={usuarios}
          />

          {/* Selected item detail */}
          {selectedItemData && (
            <ItemDetailPanel
              item={selectedItemData}
              ordenId={orden.id}
              usuarios={usuarios}
              onClose={() => setSelectedItem(null)}
            />
          )}
        </div>
      )}

      {tab === 'materiales' && (
        <MaterialesList ordenId={orden.id} materiales={orden.materiales} />
      )}

      {tab === 'config' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuración de la Orden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
                >
                  {ESTADOS_ORDEN.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Prioridad</label>
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
                >
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Notas</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm resize-none"
              />
            </div>
            <div className="flex gap-3 justify-between">
              <Button variant="danger" onClick={handleDeleteOrder}>
                <Trash2 className="w-4 h-4" /> Eliminar Orden
              </Button>
              <Button onClick={handleSaveConfig} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Item Detail Panel ──────────────────────────────────────────────────

function ItemDetailPanel({
  item,
  ordenId,
  usuarios,
  onClose,
}: {
  item: Item
  ordenId: number
  usuarios: { id: number; nombre: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const [addingUser, setAddingUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState<number | ''>('')

  async function handleAssign() {
    if (!selectedUser) return
    setAddingUser(true)
    await fetch(`/api/produccion/${ordenId}/items/${item.id}/asignaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioId: selectedUser, etapa: item.etapa }),
    })
    setSelectedUser('')
    setAddingUser(false)
    router.refresh()
  }

  async function handleRemoveAssign(usuarioId: number, etapa: string) {
    await fetch(`/api/produccion/${ordenId}/items/${item.id}/asignaciones`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioId, etapa }),
    })
    router.refresh()
  }

  const colors = ETAPA_COLORS[item.etapa]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{item.nombreModulo}</CardTitle>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors?.bg || ''} ${colors?.text || ''}`}>
              {item.etapa}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        {item.dimensiones && (
          <p className="text-sm text-muted-foreground">{item.tipoModulo} — {item.dimensiones} — Cant: {item.cantidad}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assigned workers */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" /> Asignados ({item.etapa})
          </h4>
          <div className="flex flex-wrap gap-2 mb-2">
            {item.asignaciones
              .filter(a => a.etapa === item.etapa)
              .map(a => (
                <span key={a.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-sm">
                  {a.usuario.nombre}
                  <button
                    onClick={() => handleRemoveAssign(a.usuario.id, a.etapa)}
                    className="text-muted-foreground hover:text-red-500 ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
          <div className="flex gap-2">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value ? parseInt(e.target.value) : '')}
              className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm"
            >
              <option value="">Seleccionar usuario...</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
            <Button size="sm" onClick={handleAssign} disabled={!selectedUser || addingUser}>
              Asignar
            </Button>
          </div>
        </div>

        {/* QC Checklists */}
        {(item.etapa === 'QC Proceso' || ETAPAS_PRODUCCION.findIndex(e => e.key === item.etapa) > ETAPAS_PRODUCCION.findIndex(e => e.key === 'QC Proceso')) && (
          <QCChecklistEditor
            title="QC Proceso"
            checklistJson={item.checklistQCProceso}
            ordenId={ordenId}
            itemId={item.id}
            field="checklistQCProceso"
            readOnly={item.etapa !== 'QC Proceso'}
          />
        )}

        {(item.etapa === 'QC Final' || item.completado) && (
          <QCChecklistEditor
            title="QC Final"
            checklistJson={item.checklistQCFinal}
            ordenId={ordenId}
            itemId={item.id}
            field="checklistQCFinal"
            readOnly={item.etapa !== 'QC Final'}
          />
        )}
      </CardContent>
    </Card>
  )
}
