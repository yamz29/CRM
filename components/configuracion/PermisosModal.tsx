'use client'

import { useState, useEffect } from 'react'
import { X, Shield, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MODULOS, NIVELES, type NivelPermiso, type PermisosMap, type ModuloKey } from '@/lib/permisos'

interface Props {
  usuario: { id: number; nombre: string; rol: string }
  onClose: () => void
}

const NIVEL_BG: Record<NivelPermiso, string> = {
  ninguno: 'bg-muted text-muted-foreground border-border',
  ver:     'bg-blue-100 text-blue-700 border-blue-200',
  editar:  'bg-green-100 text-green-700 border-green-200',
  admin:   'bg-purple-100 text-purple-700 border-purple-200',
}

const GRUPOS = ['Principal', 'Operaciones', 'Gestión', 'Taller', 'Sistema'] as const

export function PermisosModal({ usuario, onClose }: Props) {
  const [permisos, setPermisos] = useState<PermisosMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const esAdmin = usuario.rol === 'Admin'

  useEffect(() => {
    fetch(`/api/configuracion/permisos/${usuario.id}`)
      .then(r => r.json())
      .then(data => { setPermisos(data); setLoading(false) })
  }, [usuario.id])

  function setNivel(modulo: ModuloKey, nivel: NivelPermiso) {
    setPermisos(prev => ({ ...prev, [modulo]: nivel }))
  }

  function setGrupoNivel(grupo: string, nivel: NivelPermiso) {
    const updates: PermisosMap = {}
    for (const m of MODULOS.filter(m => m.grupo === grupo)) {
      updates[m.key] = nivel
    }
    setPermisos(prev => ({ ...prev, ...updates }))
  }

  function setTodoNivel(nivel: NivelPermiso) {
    const all: PermisosMap = {}
    for (const m of MODULOS) all[m.key] = nivel
    setPermisos(all)
  }

  async function handleSave() {
    setSaving(true)
    // Rellenar módulos sin registro con el default
    const full: Record<string, string> = {}
    for (const m of MODULOS) {
      full[m.key] = permisos[m.key] ?? 'editar'
    }
    await fetch(`/api/configuracion/permisos/${usuario.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(full),
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Permisos de {usuario.nombre}</h2>
            {esAdmin && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                Admin — acceso total
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

            {esAdmin && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-700">
                Los usuarios Admin siempre tienen acceso total, independientemente de los permisos configurados.
                Puedes configurarlos para cuando cambie su rol.
              </div>
            )}

            {/* Accesos rápidos globales */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium mr-1">Aplicar a todos:</span>
              {NIVELES.map(n => (
                <button key={n.value} onClick={() => setTodoNivel(n.value)}
                  className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors hover:opacity-80 ${NIVEL_BG[n.value]}`}>
                  {n.label}
                </button>
              ))}
            </div>

            {/* Matriz por grupo */}
            {GRUPOS.map(grupo => {
              const items = MODULOS.filter(m => m.grupo === grupo)
              if (items.length === 0) return null
              return (
                <div key={grupo}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">{grupo}</h3>
                    <div className="flex gap-1">
                      {NIVELES.map(n => (
                        <button key={n.value} onClick={() => setGrupoNivel(grupo, n.value)}
                          className="px-2 py-0.5 text-xs rounded border text-muted-foreground border-border hover:bg-muted transition-colors">
                          Todo → {n.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden">
                    {items.map((m, i) => {
                      const nivelActual = permisos[m.key] ?? 'editar'
                      return (
                        <div key={m.key}
                          className={`flex items-center justify-between px-4 py-2.5 ${i < items.length - 1 ? 'border-b border-border' : ''} ${esAdmin ? 'opacity-60' : ''}`}>
                          <span className="text-sm text-foreground">{m.label}</span>
                          <div className="flex items-center gap-1">
                            {NIVELES.map(n => (
                              <button
                                key={n.value}
                                disabled={esAdmin}
                                onClick={() => setNivel(m.key, n.value)}
                                className={`px-3 py-1 text-xs rounded-full border font-medium transition-all ${
                                  nivelActual === n.value
                                    ? NIVEL_BG[n.value] + ' ring-2 ring-offset-1 ring-current'
                                    : 'text-muted-foreground border-border hover:bg-muted'
                                }`}
                              >
                                {n.label}
                              </button>
                            ))}
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

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : <><Save className="w-3.5 h-3.5" /> Guardar permisos</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
