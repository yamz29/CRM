# Cronograma: fecha de fin proyectada y avance real — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar la fecha de fin proyectada (auto) y el avance real (esperado vs real, desviación y tiempo) en el cronograma, y permitir editar el cronograma (nombre, estado, fechas, meta, proyecto, presupuesto, notas).

**Architecture:** Un helper puro (`lib/cronograma-resumen.ts`) calcula todo el resumen a partir de las actividades; se testea con Vitest. La página server del detalle calcula el resumen y lo pasa a un componente client `ResumenAvance`, que muestra el panel y aloja el modal `EditarCronogramaModal`. No hay cambios de schema ni de API — las rutas POST/PUT de cronograma ya aceptan todos los campos.

**Tech Stack:** Next.js 16 (App Router, server + client components), TypeScript, Prisma, Tailwind + shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-25-cronograma-fecha-fin-avance-design.md`

---

## Estructura de archivos

- **Crear** `lib/cronograma-resumen.ts` — funciones puras del resumen (fin proyectado, avance esperado, desviación días, transcurridos/restantes).
- **Crear** `lib/__tests__/cronograma-resumen.test.ts` — tests del helper.
- **Crear** `components/cronograma/EditarCronogramaModal.tsx` — modal de edición (usa `PUT` existente).
- **Crear** `components/cronograma/ResumenAvance.tsx` — panel de avance + botón editar + aloja el modal.
- **Modificar** `app/cronograma/[id]/page.tsx` — calcular resumen, cargar proyectos, renderizar `ResumenAvance`.
- **Modificar** `components/cronograma/NuevoCronogramaForm.tsx` — campo opcional "Meta de entrega".
- **Modificar** `app/cronograma/[id]/imprimir/page.tsx` — fin proyectado + meta + avance esperado en el encabezado.

---

## Task 1: Helper puro de resumen (`lib/cronograma-resumen.ts`)

**Files:**
- Create: `lib/cronograma-resumen.ts`
- Test: `lib/__tests__/cronograma-resumen.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/__tests__/cronograma-resumen.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { avanceEsperadoActividad, calcularResumen, type ActividadResumen } from '../cronograma-resumen'

function actividad(overrides: Partial<ActividadResumen> = {}): ActividadResumen {
  return {
    fechaInicio: new Date('2026-01-10'),
    fechaFin: new Date('2026-01-20'),
    pctAvance: 0,
    tipo: 'tarea',
    ...overrides,
  }
}

describe('avanceEsperadoActividad', () => {
  it('devuelve 0 antes del inicio', () => {
    expect(avanceEsperadoActividad(actividad(), new Date('2026-01-05'))).toBe(0)
  })

  it('devuelve 100 después del fin', () => {
    expect(avanceEsperadoActividad(actividad(), new Date('2026-01-25'))).toBe(100)
  })

  it('interpola linealmente a mitad de la ventana', () => {
    // inicio 10, fin 20 → 10 días de ventana; el día 15 = 50%
    expect(avanceEsperadoActividad(actividad(), new Date('2026-01-15'))).toBeCloseTo(50, 5)
  })

  it('un hito (inicio===fin) es 100 si ya llegó la fecha, si no 0', () => {
    const hito = actividad({ fechaInicio: new Date('2026-01-15'), fechaFin: new Date('2026-01-15'), tipo: 'hito' })
    expect(avanceEsperadoActividad(hito, new Date('2026-01-14'))).toBe(0)
    expect(avanceEsperadoActividad(hito, new Date('2026-01-15'))).toBe(100)
  })
})

describe('calcularResumen', () => {
  it('sin actividades devuelve finProyectado null y avances en 0', () => {
    const r = calcularResumen([], new Date('2026-01-10'), null, new Date('2026-01-12'))
    expect(r.finProyectado).toBeNull()
    expect(r.avanceReal).toBe(0)
    expect(r.avanceEsperado).toBe(0)
    expect(r.diasDesviacion).toBeNull()
  })

  it('fin proyectado = la fecha de fin más tardía', () => {
    const acts = [
      actividad({ fechaFin: new Date('2026-01-20') }),
      actividad({ fechaFin: new Date('2026-02-05') }),
    ]
    const r = calcularResumen(acts, new Date('2026-01-10'), null, new Date('2026-01-15'))
    expect(r.finProyectado?.toISOString().slice(0, 10)).toBe('2026-02-05')
  })

  it('avance real = promedio simple de pctAvance', () => {
    const acts = [actividad({ pctAvance: 100 }), actividad({ pctAvance: 0 })]
    const r = calcularResumen(acts, new Date('2026-01-10'), null, new Date('2026-01-15'))
    expect(r.avanceReal).toBe(50)
  })

  it('delta avance = real - esperado', () => {
    // actividad 10→20; al día 15 esperado=50. Avance real 30 → delta -20.
    const acts = [actividad({ pctAvance: 30 })]
    const r = calcularResumen(acts, new Date('2026-01-10'), null, new Date('2026-01-15'))
    expect(r.avanceEsperado).toBe(50)
    expect(r.deltaAvance).toBe(-20)
  })

  it('desviación en días = fin proyectado - meta (positivo = atrasado)', () => {
    const acts = [actividad({ fechaFin: new Date('2026-01-24') })]
    const r = calcularResumen(acts, new Date('2026-01-10'), new Date('2026-01-20'), new Date('2026-01-15'))
    expect(r.diasDesviacion).toBe(4)
  })

  it('días transcurridos y restantes', () => {
    const acts = [actividad({ fechaFin: new Date('2026-01-20') })]
    const r = calcularResumen(acts, new Date('2026-01-10'), null, new Date('2026-01-15'))
    expect(r.diasTranscurridos).toBe(5)
    expect(r.diasRestantes).toBe(5)
  })

  it('días restantes negativo cuando el fin proyectado ya pasó', () => {
    const acts = [actividad({ fechaFin: new Date('2026-01-12') })]
    const r = calcularResumen(acts, new Date('2026-01-10'), null, new Date('2026-01-15'))
    expect(r.diasRestantes).toBe(-3)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run lib/__tests__/cronograma-resumen.test.ts`
Expected: FAIL — `Cannot find module '../cronograma-resumen'`.

- [ ] **Step 3: Implementar el helper**

Crear `lib/cronograma-resumen.ts`:

```ts
// Cálculo puro del "resumen de avance" de un cronograma.
// Todas las fechas de calendario se normalizan a UTC midnight (mismo criterio
// que el resto del cronograma: ver components/cronograma/tipos.ts -> aFecha).

const MS_DIA = 86_400_000

export interface ActividadResumen {
  fechaInicio: string | Date
  fechaFin: string | Date
  pctAvance: number
  tipo: string
}

export interface ResumenAvance {
  finProyectado: Date | null
  avanceReal: number       // 0-100, redondeado
  avanceEsperado: number   // 0-100, redondeado
  deltaAvance: number      // real - esperado, redondeado
  diasDesviacion: number | null // finProyectado - meta (días calendario); null si falta meta o no hay actividades
  diasTranscurridos: number     // desde fechaInicio hasta hoy (>= 0)
  diasRestantes: number         // hoy hasta finProyectado (puede ser negativo = vencido); 0 si no hay actividades
}

/** Convierte una fecha a su timestamp UTC midnight. */
function aUTC(v: string | Date): number {
  const d = new Date(v)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** % esperado hoy de una actividad según su ventana de fechas (0-100). */
export function avanceEsperadoActividad(act: ActividadResumen, hoy: Date): number {
  const inicio = aUTC(act.fechaInicio)
  const fin = aUTC(act.fechaFin)
  const t = aUTC(hoy)
  if (inicio === fin) return t >= inicio ? 100 : 0 // hito o duración 0
  if (t <= inicio) return 0
  if (t >= fin) return 100
  return ((t - inicio) / (fin - inicio)) * 100
}

/** Calcula el resumen de avance del cronograma. `hoy` se inyecta para testear. */
export function calcularResumen(
  actividades: ActividadResumen[],
  fechaInicio: string | Date,
  meta: string | Date | null,
  hoy: Date = new Date(),
): ResumenAvance {
  const t = aUTC(hoy)
  const inicioT = aUTC(fechaInicio)
  const hayActs = actividades.length > 0

  const finProyectadoT = hayActs
    ? Math.max(...actividades.map(a => aUTC(a.fechaFin)))
    : null

  const avanceReal = hayActs
    ? Math.round(actividades.reduce((s, a) => s + a.pctAvance, 0) / actividades.length)
    : 0

  const avanceEsperado = hayActs
    ? Math.round(actividades.reduce((s, a) => s + avanceEsperadoActividad(a, hoy), 0) / actividades.length)
    : 0

  const metaT = meta ? aUTC(meta) : null
  const diasDesviacion = (finProyectadoT !== null && metaT !== null)
    ? Math.round((finProyectadoT - metaT) / MS_DIA)
    : null

  const diasTranscurridos = Math.max(0, Math.round((t - inicioT) / MS_DIA))
  const diasRestantes = finProyectadoT !== null
    ? Math.round((finProyectadoT - t) / MS_DIA)
    : 0

  return {
    finProyectado: finProyectadoT !== null ? new Date(finProyectadoT) : null,
    avanceReal,
    avanceEsperado,
    deltaAvance: avanceReal - avanceEsperado,
    diasDesviacion,
    diasTranscurridos,
    diasRestantes,
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run lib/__tests__/cronograma-resumen.test.ts`
Expected: PASS (todos los casos).

- [ ] **Step 5: Commit**

```bash
git add lib/cronograma-resumen.ts lib/__tests__/cronograma-resumen.test.ts
git commit -m "feat(cronograma): helper puro de resumen de avance + tests"
```

---

## Task 2: Modal de edición (`EditarCronogramaModal.tsx`)

**Files:**
- Create: `components/cronograma/EditarCronogramaModal.tsx`

> Componente UI: no hay test runner de componentes en este repo (solo utils puros). Se verifica con tsc/lint y prueba manual.

- [ ] **Step 1: Crear el componente**

Crear `components/cronograma/EditarCronogramaModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { X, CalendarRange } from 'lucide-react'

export interface CronogramaEditable {
  id: number
  nombre: string
  estado: string
  fechaInicio: string | Date
  fechaFinEstimado: string | Date | null
  proyectoId: number | null
  presupuestoId: number | null
  notas: string | null
}

interface Props {
  cronograma: CronogramaEditable
  proyectos: { id: number; nombre: string }[]
  presupuestos: { id: number; numero: string }[]
  onClose: () => void
}

const ESTADOS = ['Planificado', 'En Ejecución', 'Terminado', 'Pausado']

/** Fecha (UTC midnight) -> 'YYYY-MM-DD' para <input type="date">. */
function aInputDate(v: string | Date | null): string {
  if (!v) return ''
  const d = new Date(v)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function EditarCronogramaModal({ cronograma, proyectos, presupuestos, onClose }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre: cronograma.nombre,
    estado: cronograma.estado,
    fechaInicio: aInputDate(cronograma.fechaInicio),
    fechaFinEstimado: aInputDate(cronograma.fechaFinEstimado),
    proyectoId: cronograma.proyectoId ? String(cronograma.proyectoId) : '',
    presupuestoId: cronograma.presupuestoId ? String(cronograma.presupuestoId) : '',
    notas: cronograma.notas ?? '',
  })

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/cronograma/${cronograma.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          estado: form.estado,
          fechaInicio: form.fechaInicio,
          fechaFinEstimado: form.fechaFinEstimado || null,
          proyectoId: form.proyectoId || null,
          presupuestoId: form.presupuestoId || null,
          notas: form.notas,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Error al guardar el cronograma')
        return
      }
      toast.exito('Cronograma actualizado')
      onClose()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-foreground">Editar cronograma</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={guardar} className="space-y-4">
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input value={form.nombre} required onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Estado</Label>
              <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}
                className="w-full h-10 border border-border rounded-md px-3 text-sm bg-background">
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Proyecto</Label>
              <select value={form.proyectoId} onChange={e => setForm(p => ({ ...p, proyectoId: e.target.value }))}
                className="w-full h-10 border border-border rounded-md px-3 text-sm bg-background">
                <option value="">Sin proyecto</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Fecha de inicio *</Label>
              <Input type="date" value={form.fechaInicio} required onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Meta de entrega</Label>
              <Input type="date" value={form.fechaFinEstimado} onChange={e => setForm(p => ({ ...p, fechaFinEstimado: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Presupuesto</Label>
            <select value={form.presupuestoId} onChange={e => setForm(p => ({ ...p, presupuestoId: e.target.value }))}
              className="w-full h-10 border border-border rounded-md px-3 text-sm bg-background">
              <option value="">Sin presupuesto</option>
              {presupuestos.map(p => <option key={p.id} value={p.id}>{p.numero}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Notas</Label>
            <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              rows={2}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Guardando…' : 'Guardar cambios'}</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add components/cronograma/EditarCronogramaModal.tsx
git commit -m "feat(cronograma): modal para editar datos del cronograma"
```

---

## Task 3: Panel de avance (`ResumenAvance.tsx`)

**Files:**
- Create: `components/cronograma/ResumenAvance.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/cronograma/ResumenAvance.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { CalendarCheck, TrendingUp, Clock, Pencil } from 'lucide-react'
import { EditarCronogramaModal, type CronogramaEditable } from './EditarCronogramaModal'
import type { ResumenAvance as ResumenData } from '@/lib/cronograma-resumen'

interface Props {
  cronograma: CronogramaEditable
  resumen: ResumenData
  proyectos: { id: number; nombre: string }[]
  presupuestos: { id: number; numero: string }[]
  readOnly?: boolean
}

function plural(n: number, sing: string, plur: string) {
  return `${n} ${Math.abs(n) === 1 ? sing : plur}`
}

export function ResumenAvance({ cronograma, resumen, proyectos, presupuestos, readOnly = false }: Props) {
  const [editando, setEditando] = useState(false)
  const {
    finProyectado, avanceReal, avanceEsperado, deltaAvance,
    diasDesviacion, diasTranscurridos, diasRestantes,
  } = resumen

  const sinActividades = finProyectado === null

  // Plan vs proyección
  let desviacion: { label: string; cls: string } | null = null
  if (diasDesviacion !== null) {
    if (diasDesviacion > 0) desviacion = { label: `${plural(diasDesviacion, 'día', 'días')} atrasado`, cls: 'text-red-600 dark:text-red-400' }
    else if (diasDesviacion < 0) desviacion = { label: `${plural(Math.abs(diasDesviacion), 'día', 'días')} adelantado`, cls: 'text-green-600 dark:text-green-400' }
    else desviacion = { label: 'En fecha', cls: 'text-green-600 dark:text-green-400' }
  }

  // Delta avance
  let delta: { label: string; cls: string }
  if (avanceReal >= 100) delta = { label: 'Completado', cls: 'text-teal-600 dark:text-teal-400' }
  else if (deltaAvance > 0) delta = { label: `${deltaAvance}% por encima del plan`, cls: 'text-green-600 dark:text-green-400' }
  else if (deltaAvance < 0) delta = { label: `${Math.abs(deltaAvance)}% por debajo del plan`, cls: 'text-red-600 dark:text-red-400' }
  else delta = { label: 'Al día', cls: 'text-green-600 dark:text-green-400' }

  // Tiempo
  let tiempo = '—'
  if (!sinActividades) {
    tiempo = diasRestantes < 0
      ? `Vencido hace ${plural(Math.abs(diasRestantes), 'día', 'días')}`
      : `${plural(diasRestantes, 'día', 'días')} restantes`
  }

  return (
    <div className="border border-border rounded-xl bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Resumen de avance</h2>
        {!readOnly && (
          <button onClick={() => setEditando(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Editar cronograma
          </button>
        )}
      </div>

      {sinActividades ? (
        <p className="text-sm text-muted-foreground">
          Sin actividades aún. Agrega actividades para ver la proyección de fin y el avance real.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Plan vs proyección */}
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarCheck className="w-3.5 h-3.5" /> Fin proyectado
            </p>
            <p className="text-base font-semibold text-foreground">{formatDate(finProyectado)}</p>
            {cronograma.fechaFinEstimado ? (
              <p className="text-xs text-muted-foreground">
                Meta: {formatDate(cronograma.fechaFinEstimado)}
                {desviacion && <> · <span className={`font-medium ${desviacion.cls}`}>{desviacion.label}</span></>}
              </p>
            ) : (
              !readOnly && (
                <button onClick={() => setEditando(true)} className="text-xs text-primary hover:underline">
                  Definir meta
                </button>
              )
            )}
          </div>

          {/* Avance esperado vs real */}
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" /> Avance real vs esperado
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-12 shrink-0">Real</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, avanceReal)}%` }} />
                </div>
                <span className="text-xs font-semibold text-foreground w-9 text-right">{avanceReal}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-12 shrink-0">Esperado</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 dark:bg-slate-500" style={{ width: `${Math.min(100, avanceEsperado)}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-9 text-right">{avanceEsperado}%</span>
              </div>
            </div>
            <p className={`text-xs font-medium ${delta.cls}`}>{delta.label}</p>
          </div>

          {/* Tiempo */}
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" /> Tiempo
            </p>
            <p className="text-base font-semibold text-foreground">{tiempo}</p>
            <p className="text-xs text-muted-foreground">{plural(diasTranscurridos, 'día transcurrido', 'días transcurridos')}</p>
          </div>
        </div>
      )}

      {editando && (
        <EditarCronogramaModal
          cronograma={cronograma}
          proyectos={proyectos}
          presupuestos={presupuestos}
          onClose={() => setEditando(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add components/cronograma/ResumenAvance.tsx
git commit -m "feat(cronograma): panel de resumen de avance (esperado vs real)"
```

---

## Task 4: Integrar en la página de detalle (`app/cronograma/[id]/page.tsx`)

**Files:**
- Modify: `app/cronograma/[id]/page.tsx`

- [ ] **Step 1: Añadir imports**

En `app/cronograma/[id]/page.tsx`, tras la línea `import { CronogramaView } from '@/components/cronograma/CronogramaView'` (línea 7), añadir:

```tsx
import { ResumenAvance } from '@/components/cronograma/ResumenAvance'
import { calcularResumen } from '@/lib/cronograma-resumen'
```

- [ ] **Step 2: Cargar lista de proyectos y calcular el resumen**

En el mismo archivo, justo después del bloque que calcula `stats` (termina en la línea con `: 0,` y `}` del objeto `stats`, alrededor de la línea 86), añadir:

```tsx
  // Lista liviana de proyectos para el modal de edición
  const proyectos = await prisma.proyecto.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  // Resumen de avance (fin proyectado, esperado vs real, tiempo)
  const resumen = calcularResumen(
    actividades,
    cronograma.fechaInicio,
    cronograma.fechaFinEstimado,
    hoy,
  )

  const cronogramaEditable = {
    id: cronograma.id,
    nombre: cronograma.nombre,
    estado: cronograma.estado,
    fechaInicio: cronograma.fechaInicio,
    fechaFinEstimado: cronograma.fechaFinEstimado,
    proyectoId: cronograma.proyectoId,
    presupuestoId: cronograma.presupuestoId,
    notas: cronograma.notas,
  }
```

- [ ] **Step 3: Renderizar el panel tras el encabezado**

En el JSX, justo después del cierre del bloque `{/* Header */}` (el `</div>` que cierra en la línea ~120, antes del comentario `{/* Aviso de desbordamiento de fecha del proyecto */}`), insertar:

```tsx
      {/* Resumen de avance + edición del cronograma */}
      <ResumenAvance
        cronograma={cronogramaEditable}
        resumen={resumen}
        proyectos={proyectos}
        presupuestos={presupuestosDisponibles}
        readOnly={readOnly}
      />
```

> `presupuestosDisponibles` ya tiene forma `{ id, numero, total }`, compatible con el prop `{ id, numero }` del panel.

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errores (warnings preexistentes permitidos).

- [ ] **Step 5: Commit**

```bash
git add app/cronograma/[id]/page.tsx
git commit -m "feat(cronograma): mostrar resumen de avance y edición en el detalle"
```

---

## Task 5: Capturar meta en la creación (`NuevoCronogramaForm.tsx`)

**Files:**
- Modify: `components/cronograma/NuevoCronogramaForm.tsx`

- [ ] **Step 1: Añadir el campo al estado del formulario**

En `components/cronograma/NuevoCronogramaForm.tsx`, en el `useState` de `form` (línea ~25), añadir `fechaFinEstimado: ''` después de `fechaInicio`:

```tsx
  const [form, setForm] = useState({
    nombre: '',
    proyectoId: defaultProyectoId ? String(defaultProyectoId) : '',
    presupuestoId: defaultPresupuestoId ? String(defaultPresupuestoId) : '',
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFinEstimado: '',
    estado: 'Planificado',
    notas: '',
  })
```

- [ ] **Step 2: Enviar el campo en el POST**

En el `body: JSON.stringify({ ... })` de la creación (línea ~44), añadir `fechaFinEstimado` tras `fechaInicio`:

```tsx
        body: JSON.stringify({
          nombre: form.nombre,
          proyectoId: form.proyectoId || null,
          presupuestoId: form.presupuestoId || null,
          fechaInicio: form.fechaInicio,
          fechaFinEstimado: form.fechaFinEstimado || null,
          estado: form.estado,
          notas: form.notas,
        }),
```

- [ ] **Step 3: Añadir el input en el formulario**

En el grid `grid-cols-2` que contiene "Proyecto" y "Fecha de inicio" (línea ~102), añadir un tercer campo después del `</div>` de "Fecha de inicio" (cierra ~línea 115), dentro del mismo grid:

```tsx
            <div className="space-y-1">
              <Label>Meta de entrega (opcional)</Label>
              <Input type="date" value={form.fechaFinEstimado}
                onChange={e => setForm(p => ({ ...p, fechaFinEstimado: e.target.value }))} />
            </div>
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add components/cronograma/NuevoCronogramaForm.tsx
git commit -m "feat(cronograma): capturar meta de entrega al crear el cronograma"
```

---

## Task 6: Resumen en la vista de impresión (`imprimir/page.tsx`)

**Files:**
- Modify: `app/cronograma/[id]/imprimir/page.tsx`

- [ ] **Step 1: Importar el helper y calcular el resumen**

En `app/cronograma/[id]/imprimir/page.tsx`, tras `import { PrintButton } from './PrintButton'` (línea 4), añadir:

```tsx
import { calcularResumen } from '@/lib/cronograma-resumen'
```

Y después del cálculo de `pctGeneral` (línea ~27), añadir:

```tsx
  const resumen = calcularResumen(acts, cronograma.fechaInicio, cronograma.fechaFinEstimado)
```

- [ ] **Step 2: Actualizar el encabezado**

Reemplazar el bloque de fechas del encabezado (líneas ~88-94, el `<div className="flex flex-wrap gap-x-8 ...">` con Inicio / Fin estimado / Avance general) por:

```tsx
        <div className="flex flex-wrap gap-x-8 gap-y-1 mt-3 text-sm">
          <span>Inicio: <strong>{formatDate(cronograma.fechaInicio)}</strong></span>
          {resumen.finProyectado && (
            <span>Fin proyectado: <strong>{formatDate(resumen.finProyectado)}</strong></span>
          )}
          {cronograma.fechaFinEstimado && (
            <span>Meta de entrega: <strong>{formatDate(cronograma.fechaFinEstimado)}</strong></span>
          )}
          <span>Avance general: <strong>{pctGeneral}%</strong> (esperado {resumen.avanceEsperado}%)</span>
        </div>
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add app/cronograma/[id]/imprimir/page.tsx
git commit -m "feat(cronograma): fin proyectado y avance esperado en impresión"
```

---

## Task 7: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Suite de tests**

Run: `npm test`
Expected: PASS, incluyendo `cronograma-resumen`.

- [ ] **Step 2: Tipos + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errores (warnings preexistentes permitidos).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso. (Ignorar el error conocido de prerender de Prisma documentado en la memoria de gates de verificación.)

- [ ] **Step 4: Verificación manual en navegador**

Con `npm run dev`, abrir un cronograma y confirmar:
- El panel "Resumen de avance" muestra fin proyectado, barras real/esperado con su delta, y días transcurridos/restantes.
- "Editar cronograma" abre el modal; guardar nombre/estado/fechas/meta/proyecto/presupuesto/notas refresca la vista.
- Sin meta → aparece "Definir meta"; con meta → aparece la desviación en días.
- Cronograma sin actividades → "Sin actividades aún".
- Crear cronograma nuevo con "Meta de entrega" la persiste.
- Vista de impresión muestra fin proyectado + meta + avance esperado.
- Proyecto cerrado (readOnly) → no aparece "Editar cronograma" ni "Definir meta".

---

## Self-review (cobertura del spec)

- Fin proyectado auto → Task 1 (helper) + Task 4 (panel) + Task 6 (impresión). ✓
- Meta editable → Task 2 (modal) + Task 5 (creación). ✓
- Plan vs proyección (días desviación) → Task 1 + Task 3. ✓
- Avance esperado vs real + delta → Task 1 + Task 3 + Task 6. ✓
- Días transcurridos/restantes → Task 1 + Task 3. ✓
- Editar cronograma completo → Task 2 + Task 4. ✓
- Casos borde (sin actividades, antes de inicio, completado, vencido, readOnly, sin meta) → Task 1 (tests) + Task 3 (UI). ✓
- Sin cambios de schema/API → confirmado (rutas POST/PUT ya aceptan los campos). ✓
