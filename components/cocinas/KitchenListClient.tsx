'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChefHat, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KitchenProjectSummary {
  id: number
  nombre: string
  layoutType: string
  alturaMm: number
  profBase: number
  profAlto: number
  createdAt: Date
  updatedAt: Date
  paredesCount: number
  placementsCount: number
}

interface Props {
  initialProjects: KitchenProjectSummary[]
}

interface NewWallInput {
  nombre: string
  longitud: string
}

const LAYOUT_LABELS: Record<string, string> = {
  lineal: 'Lineal',
  L: 'En L',
  U: 'En U',
}

export function KitchenListClient({ initialProjects }: Props) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // New project form state
  const [nombre, setNombre] = useState('')
  const [layoutType, setLayoutType] = useState('lineal')
  const [alturaMm, setAlturaMm] = useState('2400')
  const [walls, setWalls] = useState<NewWallInput[]>([
    { nombre: 'A', longitud: '3000' },
    { nombre: 'B', longitud: '2500' },
  ])
  const [formError, setFormError] = useState('')

  function openModal() {
    setNombre('')
    setLayoutType('lineal')
    setAlturaMm('2400')
    setWalls([
      { nombre: 'A', longitud: '3000' },
      { nombre: 'B', longitud: '2500' },
    ])
    setFormError('')
    setShowModal(true)
  }

  function addWall() {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F']
    const nextLabel = labels[walls.length] ?? `Pared ${walls.length + 1}`
    setWalls([...walls, { nombre: nextLabel, longitud: '2400' }])
  }

  function removeWall(idx: number) {
    setWalls(walls.filter((_, i) => i !== idx))
  }

  function updateWall(idx: number, field: keyof NewWallInput, value: string) {
    const updated = [...walls]
    updated[idx] = { ...updated[idx], [field]: value }
    setWalls(updated)
  }

  async function handleCreate() {
    setFormError('')
    if (!nombre.trim()) {
      setFormError('El nombre es requerido')
      return
    }
    if (walls.length === 0) {
      setFormError('Agrega al menos una pared')
      return
    }
    for (const w of walls) {
      if (!w.nombre.trim() || !w.longitud || isNaN(parseFloat(w.longitud))) {
        setFormError('Completa correctamente todas las paredes')
        return
      }
    }

    setSaving(true)
    try {
      const res = await fetch('/api/cocinas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          layoutType,
          alturaMm: parseFloat(alturaMm) || 2400,
          paredes: walls.map((w, i) => ({
            nombre: w.nombre.trim(),
            longitud: parseFloat(w.longitud),
            orden: i,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setFormError(err.error ?? 'Error al crear proyecto')
        return
      }
      const created = await res.json() as KitchenProjectSummary & { paredes: unknown[]; placements: unknown[] }
      setProjects([
        {
          ...created,
          paredesCount: Array.isArray(created.paredes) ? created.paredes.length : 0,
          placementsCount: Array.isArray(created.placements) ? created.placements.length : 0,
        },
        ...projects,
      ])
      setShowModal(false)
      router.push(`/cocinas/${created.id}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(projectId: number) {
    if (!confirm('¿Eliminar este proyecto de cocina? Se borrarán todas las paredes y módulos colocados.')) return
    setDeleting(projectId)
    try {
      await fetch(`/api/cocinas/${projectId}`, { method: 'DELETE' })
      setProjects(projects.filter((p) => p.id !== projectId))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{projects.length} proyecto{projects.length !== 1 ? 's' : ''}</p>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl bg-card">
          <ChefHat className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">No hay proyectos de cocina</p>
          <p className="text-muted-foreground text-sm mt-1">Crea tu primer proyecto para empezar</p>
          <button
            onClick={openModal}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Crear proyecto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <h3 className="text-foreground font-semibold truncate">{p.nombre}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                      {LAYOUT_LABELS[p.layoutType] ?? p.layoutType}
                    </span>
                    <span className="text-xs text-muted-foreground">{p.paredesCount} pared{p.paredesCount !== 1 ? 'es' : ''}</span>
                    <span className="text-xs text-muted-foreground">{p.placementsCount} módulo{p.placementsCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deleting === p.id}
                  className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                  title="Eliminar proyecto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => router.push(`/cocinas/${p.id}`)}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium transition-colors"
              >
                Abrir configurador
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-foreground font-semibold text-lg">Nuevo proyecto de cocina</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-muted-foreground text-sm font-medium mb-1">Nombre del proyecto</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Cocina principal"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-muted-foreground text-sm font-medium mb-1">Distribución</label>
                <div className="flex gap-2">
                  {(['lineal', 'L', 'U'] as const).map((lt) => (
                    <button
                      key={lt}
                      onClick={() => setLayoutType(lt)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                        layoutType === lt
                          ? 'bg-blue-600 text-white'
                          : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                      )}
                    >
                      {LAYOUT_LABELS[lt]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground text-sm font-medium mb-1">Altura de cocina (mm)</label>
                <input
                  type="number"
                  value={alturaMm}
                  onChange={(e) => setAlturaMm(e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-muted-foreground text-sm font-medium">Paredes</label>
                  <button
                    onClick={addWall}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Agregar pared
                  </button>
                </div>
                <div className="space-y-2">
                  {walls.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={w.nombre}
                        onChange={(e) => updateWall(i, 'nombre', e.target.value)}
                        placeholder="A"
                        className="w-16 px-2 py-1.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring text-center"
                      />
                      <input
                        type="number"
                        value={w.longitud}
                        onChange={(e) => updateWall(i, 'longitud', e.target.value)}
                        placeholder="3000"
                        className="flex-1 px-2 py-1.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <span className="text-muted-foreground text-xs">mm</span>
                      <button
                        onClick={() => removeWall(i)}
                        disabled={walls.length <= 1}
                        className="text-muted-foreground hover:text-red-500 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-red-500 text-sm">{formError}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? 'Creando...' : 'Crear proyecto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
