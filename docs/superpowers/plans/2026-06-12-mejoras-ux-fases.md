# Plan de Mejoras UX/Consistencia del CRM (en fases)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la fragilidad percibida en los flujos críticos del CRM (aprobaciones sin confirmación, fallos silenciosos, feedback inconsistente), unificar la "verdad financiera" entre dashboard y control presupuestario, y reducir la carga cognitiva en navegación (terminología, tabs, deep-links).

**Architecture:** Se introducen dos primitivas de UI reutilizables (`ToastProvider` + `ConfirmDialog`) sin dependencias nuevas, y una función compartida `getResumenFinancieroBatch()` en `lib/` como única fuente de cálculo presupuesto-vs-gastado. El resto son cambios localizados en componentes existentes siguiendo los patrones del repo (App Router, server components con client islands).

**Tech Stack:** Next.js 16 App Router + TypeScript + Prisma 5 + Tailwind/shadcn. **Sin dependencias nuevas.**

---

## ⚠️ Reglas de este repo (leer antes de ejecutar)

1. **NO hay suite de tests** (ver CLAUDE.md). La verificación es **manual en navegador** con `npm run dev`. Cada tarea incluye pasos de verificación manual exactos en lugar de tests — NO inventar tests ni instalar frameworks de testing.
2. **Lint como gate mínimo:** correr `npm run lint` antes de cada commit.
3. **Idioma del dominio: español.** Nombres de componentes, props y UI en español. Mensajes de commit en español **sin acentos** (convención del historial: `fix(presupuestos): busqueda insensible a mayusculas`).
4. Login de prueba: arrancar `npm run dev` y entrar con el usuario admin del seed (`npm run db:seed` si la BD está vacía; credenciales en `prisma/seed-admin.ts`).
5. Trabajar en la rama `mejoras-ux` (Task 0). Cada fase es independiente y se puede mergear por separado; las Fases 3-5 dependen solo de que Fase 1 esté mergeada (usan `useToast`).

## Decisiones tomadas (cambiar aquí si el usuario prefiere otra cosa)

- **Terminología:** se unifica **"Presupuesto"** en toda la UI. "Cotización" queda solo como el código de documento (`COT-YYYY-NNN`), que no se toca.
- **Toasts:** implementación propia mínima (~80 líneas) en vez de instalar `sonner`, para no agregar dependencias.
- **Fuera de alcance de este plan** (planes separados futuros): consolidar el menú Finanzas en un solo módulo, roles granulares, registro móvil de gastos con OCR, paginación de `/facturacion`, y la migración de los ~25 `alert()`/`confirm()` restantes (este plan migra los 5 de flujos de dinero y deja el patrón establecido).

---

### Task 0: Crear rama de trabajo

- [ ] **Step 1: Crear la rama**

```bash
git checkout -b mejoras-ux
```

---

## FASE 1 — Confianza en flujos críticos

### Task 1: Sistema de toasts (`ToastProvider` + `useToast`)

**Files:**
- Create: `components/ui/toast.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Crear `components/ui/toast.tsx`**

```tsx
'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

type ToastTipo = 'exito' | 'error'

interface Toast {
  id: number
  tipo: ToastTipo
  mensaje: string
}

interface ToastContextValue {
  exito: (mensaje: string) => void
  error: (mensaje: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((tipo: ToastTipo, mensaje: string) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, tipo, mensaje }])
    // Los errores duran más para que dé tiempo a leerlos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, tipo === 'error' ? 6000 : 3500)
  }, [])

  const exito = useCallback((m: string) => push('exito', m), [push])
  const error = useCallback((m: string) => push('error', m), [push])

  const cerrar = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ exito, error }}>
      {children}
      {/* Contenedor de toasts — esquina superior derecha, sobre todo el shell */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))]">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm animate-in slide-in-from-top-2 ${
              t.tipo === 'exito'
                ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-800 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
            }`}
          >
            {t.tipo === 'exito'
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <p className="flex-1">{t.mensaje}</p>
            <button onClick={() => cerrar(t.id)} className="opacity-60 hover:opacity-100 shrink-0" aria-label="Cerrar">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
```

Nota: si `animate-in slide-in-from-top-2` no existe en la config de Tailwind del repo (es de `tailwindcss-animate`), quitar esas dos clases — el toast funciona igual sin animación. No instalar el plugin.

- [ ] **Step 2: Montar el provider en `app/layout.tsx`**

En `app/layout.tsx`, importar y envolver `AppLayout` (dentro de `ThemeProvider`):

```tsx
import { ToastProvider } from '@/components/ui/toast'
```

```tsx
        <ThemeProvider>
          <ToastProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </ToastProvider>
        </ThemeProvider>
```

- [ ] **Step 3: Verificación manual**

Run: `npm run lint` → sin errores nuevos.
Run: `npm run dev`, abrir `http://localhost:3000` → la app carga igual que antes (el provider es transparente hasta que algo dispare un toast).

- [ ] **Step 4: Commit**

```bash
git add components/ui/toast.tsx app/layout.tsx
git commit -m "feat(ui): sistema de toasts global (exito/error) sin dependencias"
```

---

### Task 2: Componente `ConfirmDialog` reutilizable

**Files:**
- Create: `components/ui/confirm-dialog.tsx`

- [ ] **Step 1: Crear `components/ui/confirm-dialog.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  abierto: boolean
  titulo: string
  descripcion?: string
  textoConfirmar?: string
  variante?: 'peligro' | 'primario'
  cargando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

/**
 * Diálogo de confirmación accesible para reemplazar los confirm() nativos.
 * Controlado: el padre decide cuándo está abierto y qué hacer al confirmar.
 */
export function ConfirmDialog({
  abierto,
  titulo,
  descripcion,
  textoConfirmar = 'Confirmar',
  variante = 'primario',
  cargando = false,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cargando) onCancelar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto, cargando, onCancelar])

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => { if (!cargando) onCancelar() }}
      />
      {/* Panel */}
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-5">
        <div className="flex items-start gap-3">
          {variante === 'peligro' && (
            <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-red-600 dark:text-red-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
            {descripcion && (
              <p className="text-sm text-muted-foreground mt-1.5">{descripcion}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" size="sm" onClick={onCancelar} disabled={cargando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={onConfirmar}
            disabled={cargando}
            className={variante === 'peligro' ? 'bg-red-600 hover:bg-red-700 text-white' : undefined}
          >
            {cargando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {textoConfirmar}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

Nota: si `w-4.5 h-4.5` no compila en la versión de Tailwind del repo, usar `w-5 h-5`.

- [ ] **Step 2: Verificación**

Run: `npm run lint` → sin errores nuevos. (La verificación visual llega en Task 3 al usarlo.)

- [ ] **Step 3: Commit**

```bash
git add components/ui/confirm-dialog.tsx
git commit -m "feat(ui): ConfirmDialog reutilizable para reemplazar confirm() nativo"
```

---

### Task 3: `CambiarEstadoButton` — confirmación al Aprobar/Rechazar + errores visibles

El bug actual: si la API responde error, `if (response.ok)` no hace nada y el usuario cree que aprobó. Además "Aprobar" tiene un efecto secundario fuerte (el proyecto vinculado pasa a "En Ejecución" — ver `app/api/presupuestos/[id]/estado/route.ts`, método `PATCH`) sin pedir confirmación.

**Files:**
- Modify: `app/presupuestos/[id]/CambiarEstadoButton.tsx` (reescritura completa)
- Modify: `app/presupuestos/[id]/page.tsx:196-199` (pasar prop nueva)

- [ ] **Step 1: Reescribir `app/presupuestos/[id]/CambiarEstadoButton.tsx`**

Contenido completo del archivo:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Loader2, Send, CheckCircle, XCircle, FileEdit } from 'lucide-react'

interface CambiarEstadoButtonProps {
  presupuestoId: number
  estadoActual: string
  /** Nombre del proyecto vinculado, para avisar del efecto secundario al aprobar */
  nombreProyecto?: string | null
}

export function CambiarEstadoButton({ presupuestoId, estadoActual, nombreProyecto }: CambiarEstadoButtonProps) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<'Aprobado' | 'Rechazado' | null>(null)

  const cambiarEstado = async (nuevoEstado: string) => {
    setLoading(nuevoEstado)
    try {
      const response = await fetch(`/api/presupuestos/${presupuestoId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (response.ok) {
        toast.exito(`Presupuesto marcado como ${nuevoEstado}`)
        router.refresh()
      } else {
        const data = await response.json().catch(() => null)
        toast.error(data?.error ?? 'No se pudo cambiar el estado del presupuesto')
      }
    } catch {
      toast.error('Error de conexión al cambiar el estado')
    } finally {
      setLoading(null)
      setConfirmando(null)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {estadoActual !== 'Borrador' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => cambiarEstado('Borrador')}
            disabled={!!loading}
          >
            {loading === 'Borrador' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileEdit className="w-3.5 h-3.5" />}
            Volver a Borrador
          </Button>
        )}
        {estadoActual !== 'Enviado' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => cambiarEstado('Enviado')}
            disabled={!!loading}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            {loading === 'Enviado' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Marcar como Enviado
          </Button>
        )}
        {estadoActual !== 'Aprobado' && (
          <Button
            size="sm"
            onClick={() => setConfirmando('Aprobado')}
            disabled={!!loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading === 'Aprobado' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Aprobar
          </Button>
        )}
        {estadoActual !== 'Rechazado' && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmando('Rechazado')}
            disabled={!!loading}
          >
            {loading === 'Rechazado' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Rechazar
          </Button>
        )}
      </div>

      <ConfirmDialog
        abierto={confirmando === 'Aprobado'}
        titulo="¿Aprobar este presupuesto?"
        descripcion={
          nombreProyecto
            ? `Al aprobar, el proyecto "${nombreProyecto}" pasará automáticamente a "En Ejecución".`
            : 'El presupuesto quedará marcado como aprobado por el cliente.'
        }
        textoConfirmar="Sí, aprobar"
        cargando={loading === 'Aprobado'}
        onConfirmar={() => cambiarEstado('Aprobado')}
        onCancelar={() => setConfirmando(null)}
      />

      <ConfirmDialog
        abierto={confirmando === 'Rechazado'}
        titulo="¿Rechazar este presupuesto?"
        descripcion="Podrás volver a ponerlo en Borrador más adelante si el cliente cambia de opinión."
        textoConfirmar="Sí, rechazar"
        variante="peligro"
        cargando={loading === 'Rechazado'}
        onConfirmar={() => cambiarEstado('Rechazado')}
        onCancelar={() => setConfirmando(null)}
      />
    </>
  )
}
```

- [ ] **Step 2: Pasar la prop nueva en `app/presupuestos/[id]/page.tsx`**

En las líneas 196-199, el uso actual es:

```tsx
              <CambiarEstadoButton
                presupuestoId={presupuesto.id}
                estadoActual={presupuesto.estado}
              />
```

Reemplazar por (la página ya incluye `proyecto: true` en la query, línea 30):

```tsx
              <CambiarEstadoButton
                presupuestoId={presupuesto.id}
                estadoActual={presupuesto.estado}
                nombreProyecto={presupuesto.proyecto?.nombre ?? null}
              />
```

- [ ] **Step 3: Verificación manual**

Run: `npm run lint` → sin errores nuevos.
Con `npm run dev`:
1. Abrir un presupuesto en estado Borrador (`/presupuestos` → clic en uno).
2. Clic en **Aprobar** → debe aparecer el diálogo; si tiene proyecto vinculado, el texto menciona que pasará a "En Ejecución".
3. Confirmar → toast verde "Presupuesto marcado como Aprobado" y el badge de estado cambia.
4. Clic en **Rechazar** → diálogo rojo con confirmación.
5. Probar el caso de error: con DevTools en modo offline, clic Aprobar → confirmar → debe salir toast rojo "Error de conexión…" (antes: silencio total).

- [ ] **Step 4: Commit**

```bash
git add "app/presupuestos/[id]/CambiarEstadoButton.tsx" "app/presupuestos/[id]/page.tsx"
git commit -m "fix(presupuestos): confirmacion al aprobar/rechazar y errores visibles con toast"
```

---

### Task 4: Migrar `DeletePresupuestoButton` a ConfirmDialog + toast (patrón de referencia)

**Files:**
- Modify: `app/presupuestos/DeletePresupuestoButton.tsx` (reescritura completa)

- [ ] **Step 1: Reescribir el archivo**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Trash2, Loader2 } from 'lucide-react'

interface DeletePresupuestoButtonProps {
  id: number
  numero: string
}

export function DeletePresupuestoButton({ id, numero }: DeletePresupuestoButtonProps) {
  const router = useRouter()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/presupuestos/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.exito(`Presupuesto ${numero} eliminado`)
        router.refresh()
      } else {
        const data = await response.json().catch(() => null)
        toast.error(data?.error ?? 'No se pudo eliminar el presupuesto')
      }
    } catch {
      toast.error('Error de conexión al eliminar el presupuesto')
    } finally {
      setLoading(false)
      setAbierto(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setAbierto(true)}
        disabled={loading}
        title="Eliminar"
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </Button>

      <ConfirmDialog
        abierto={abierto}
        titulo={`¿Eliminar el presupuesto ${numero}?`}
        descripcion="Esta acción no se puede deshacer. Se eliminarán también sus capítulos, partidas y APUs."
        textoConfirmar="Sí, eliminar"
        variante="peligro"
        cargando={loading}
        onConfirmar={handleDelete}
        onCancelar={() => setAbierto(false)}
      />
    </>
  )
}
```

- [ ] **Step 2: Verificación manual**

Run: `npm run lint`.
En `/presupuestos`, clic en el icono de basura de un presupuesto de prueba → diálogo rojo (ya no el `confirm()` del navegador) → confirmar → toast verde y la fila desaparece.

- [ ] **Step 3: Commit**

```bash
git add app/presupuestos/DeletePresupuestoButton.tsx
git commit -m "refactor(presupuestos): eliminar con ConfirmDialog y toast en vez de confirm/alert nativos"
```

---

### Task 5: Migrar `DuplicarButton` a toast

**Files:**
- Modify: `app/presupuestos/[id]/DuplicarButton.tsx` (reescritura completa)

- [ ] **Step 1: Reescribir el archivo**

(Duplicar no es destructivo — no necesita ConfirmDialog, solo error visible.)

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Loader2, Copy } from 'lucide-react'

export function DuplicarButton({ presupuestoId }: { presupuestoId: number }) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const duplicar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/presupuestos-v2/${presupuestoId}/duplicar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'No se pudo duplicar el presupuesto')
        setLoading(false)
        return
      }
      const { id } = await res.json()
      toast.exito('Presupuesto duplicado como Borrador')
      router.push(`/presupuestos/${id}`)
    } catch {
      toast.error('Error de conexión al duplicar el presupuesto')
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" onClick={duplicar} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
      Duplicar
    </Button>
  )
}
```

- [ ] **Step 2: Verificación manual**

Run: `npm run lint`.
En el detalle de un presupuesto V2, clic en **Duplicar** → toast verde y navega al duplicado (número nuevo, estado Borrador).

- [ ] **Step 3: Commit**

```bash
git add "app/presupuestos/[id]/DuplicarButton.tsx"
git commit -m "refactor(presupuestos): duplicar con feedback de toast en vez de alert"
```

---

## FASE 2 — Una sola verdad financiera

### Task 6: `lib/resumen-financiero.ts` — fuente única de presupuesto vs gastado

Hoy el dashboard calcula alertas con `presupuestoEstimado + adicionales`, mientras el tab Control Presupuestario usa el snapshot (`ProyectoPartida.subtotalPresupuestado`). Pueden divergir. Regla nueva: **si el proyecto tiene snapshot poblado, el snapshot manda**.

**Files:**
- Create: `lib/resumen-financiero.ts`

- [ ] **Step 1: Crear `lib/resumen-financiero.ts`**

```ts
import { prisma } from './prisma'

export interface ResumenFinanciero {
  proyectoId: number
  /** Presupuesto vigente: snapshot de control si existe, si no el estimado inicial. Incluye adicionales aprobados/facturados. */
  presupuesto: number
  /** Total de gastos no anulados asignados al proyecto. */
  gastado: number
  /** De dónde sale el presupuesto: 'control' (snapshot poblado) o 'estimado' (presupuestoEstimado). */
  fuente: 'control' | 'estimado'
}

/**
 * Calcula presupuesto-vs-gastado para varios proyectos en 4 queries
 * (sin N+1). Única fuente de verdad: dashboard, reportes y cron de
 * notificaciones deben usar esto en vez de recalcular por su cuenta.
 */
export async function getResumenFinancieroBatch(
  proyectoIds: number[]
): Promise<Map<number, ResumenFinanciero>> {
  if (proyectoIds.length === 0) return new Map()

  const [snapshots, proyectos, adicionales, gastos] = await Promise.all([
    prisma.proyectoPartida.groupBy({
      by: ['proyectoId'],
      where: { proyectoId: { in: proyectoIds } },
      _sum: { subtotalPresupuestado: true },
    }),
    prisma.proyecto.findMany({
      where: { id: { in: proyectoIds } },
      select: { id: true, presupuestoEstimado: true },
    }),
    prisma.adicionalProyecto.groupBy({
      by: ['proyectoId'],
      where: { proyectoId: { in: proyectoIds }, estado: { in: ['aprobado', 'facturado'] } },
      _sum: { monto: true },
    }),
    prisma.gastoProyecto.groupBy({
      by: ['proyectoId'],
      where: { proyectoId: { in: proyectoIds }, estado: { not: 'Anulado' } },
      _sum: { monto: true },
    }),
  ])

  const snapshotPorProyecto = new Map(snapshots.map(s => [s.proyectoId, s._sum.subtotalPresupuestado ?? 0]))
  const adicionalPorProyecto = new Map(adicionales.map(a => [a.proyectoId, a._sum.monto ?? 0]))
  const gastoPorProyecto = new Map(gastos.map(g => [g.proyectoId as number, g._sum.monto ?? 0]))

  const result = new Map<number, ResumenFinanciero>()
  for (const p of proyectos) {
    const snapshot = snapshotPorProyecto.get(p.id) ?? 0
    const adic = adicionalPorProyecto.get(p.id) ?? 0
    const fuente: ResumenFinanciero['fuente'] = snapshot > 0 ? 'control' : 'estimado'
    const base = fuente === 'control' ? snapshot : (p.presupuestoEstimado ?? 0)
    result.set(p.id, {
      proyectoId: p.id,
      presupuesto: base + adic,
      gastado: gastoPorProyecto.get(p.id) ?? 0,
      fuente,
    })
  }
  return result
}
```

- [ ] **Step 2: Verificación**

Run: `npm run lint` → sin errores. (La verificación funcional llega en Task 7.)

- [ ] **Step 3: Commit**

```bash
git add lib/resumen-financiero.ts
git commit -m "feat(lib): getResumenFinancieroBatch como fuente unica de presupuesto vs gastado"
```

---

### Task 7: El dashboard usa la fuente única y etiqueta el origen

**Files:**
- Modify: `app/page.tsx` (la query de `proyectos` ~líneas 113-131, y el mapeo `enAlerta` ~líneas 228-259)

- [ ] **Step 1: Importar la función en `app/page.tsx`**

```ts
import { getResumenFinancieroBatch } from '@/lib/resumen-financiero'
```

- [ ] **Step 2: Aligerar la query de proyectos**

Dentro del `Promise.all` de `getOperacionData()`, reemplazar la query `prisma.proyecto.findMany({...})` que hoy incluye `gastos` y `adicionales` (líneas ~114-131) por esta versión sin includes pesados:

```ts
    // Proyectos activos para detectar los "en alerta" (sobrecosto)
    prisma.proyecto.findMany({
      where: {
        estado: { in: ['En Ejecución', 'Adjudicado', 'Pausado', 'Completado'] },
        archivada: false,
      },
      select: {
        id: true, codigo: true, nombre: true, estado: true,
        cliente: { select: { nombre: true } },
      },
    }),
```

- [ ] **Step 3: Reemplazar el cálculo de `enAlerta`**

Después del `Promise.all`, reemplazar el bloque completo `const enAlerta: ProyectoEnAlerta[] = proyectos.map(...)...slice(0, 5)` (líneas ~228-259) por:

```ts
  // ── Proyectos en alerta (fuente única: lib/resumen-financiero) ─────────
  const resumenes = await getResumenFinancieroBatch(proyectos.map(p => p.id))
  const enAlerta: ProyectoEnAlerta[] = proyectos
    .map(p => {
      const r = resumenes.get(p.id)
      const presupuesto = r?.presupuesto ?? 0
      const gastado = r?.gastado ?? 0
      const variacionPct = presupuesto > 0
        ? ((gastado - presupuesto) / presupuesto) * 100
        : (gastado > 0 ? Infinity : 0)
      const etiquetaFuente = r?.fuente === 'control' ? 'vs control presupuestario' : 'vs estimado inicial'
      const motivo = variacionPct > 100
        ? `Más del doble del presupuesto · ${etiquetaFuente}`
        : variacionPct > 0
          ? `Excede presupuesto en ${variacionPct.toFixed(1)}% · ${etiquetaFuente}`
          : variacionPct > -10
            ? `Quedan menos del 10% (${(-variacionPct).toFixed(1)}%) · ${etiquetaFuente}`
            : ''
      return {
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        cliente: p.cliente?.nombre ?? null,
        estado: p.estado,
        presupuesto,
        gastado,
        variacionPct,
        motivo,
      }
    })
    .filter(p => p.motivo !== '')
    .sort((a, b) => b.variacionPct - a.variacionPct)
    .slice(0, 5)
```

Nota: la interfaz `ProyectoEnAlerta` (líneas 26-36) no cambia. El campo `presupuestoEstimado` ya no se selecciona en la query — verificar que no quede ninguna otra referencia a `p.presupuestoEstimado`, `p.gastos` o `p.adicionales` dentro de `getOperacionData` (eran exclusivas del bloque reemplazado).

- [ ] **Step 4: Verificación manual**

Run: `npm run lint`.
Con `npm run dev`, abrir el dashboard:
1. La card "Proyectos en alerta" carga sin errores.
2. Para un proyecto **poblado** desde presupuesto, el motivo termina en "vs control presupuestario" y la cifra de presupuesto coincide con el total del tab Control Presupuestario de ese proyecto (abrir `/proyectos/[id]?tab=control` y comparar).
3. Para un proyecto **sin poblar**, el motivo termina en "vs estimado inicial".

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "fix(dashboard): alertas de sobrecosto usan la fuente unica y etiquetan su origen"
```

---

## FASE 3 — Terminología y navegación

### Task 8: Unificar terminología y arreglar iconos del sidebar

**Files:**
- Modify: `app/presupuestos/page.tsx:99` (texto del botón)
- Modify: `components/layout/Sidebar.tsx:38,57,90` (icono Documentos + label Espacios)

- [ ] **Step 1: Botón "Nueva Cotización" → "Nuevo Presupuesto"**

En `app/presupuestos/page.tsx` línea 99, cambiar:

```tsx
            Nueva Cotización
```

por:

```tsx
            Nuevo Presupuesto
```

- [ ] **Step 2: Icono propio para Documentos en el sidebar**

En `components/layout/Sidebar.tsx`, Documentos y Proyectos usan ambos `FolderOpen` (líneas 55 y 57). Agregar `Files` al import de `lucide-react` (bloque líneas 5-38) y cambiar la línea 57:

```tsx
      { href: '/documentos',    label: 'Documentos',    icon: Files,          modulo: 'documentos'    as ModuloKey },
```

- [ ] **Step 3: Label "Espacios (Modulares)" → "Espacios modulares"**

Línea 90 del Sidebar:

```tsx
      { href: '/cocinas',     label: 'Espacios modulares',   icon: ChefHat, modulo: 'cocinas'     as ModuloKey },
```

- [ ] **Step 4: Verificación manual**

Run: `npm run lint`. En el navegador: el botón de `/presupuestos` dice "Nuevo Presupuesto"; en el sidebar, Documentos tiene icono distinto a Proyectos y Taller muestra "Espacios modulares".

- [ ] **Step 5: Commit**

```bash
git add app/presupuestos/page.tsx components/layout/Sidebar.tsx
git commit -m "fix(ux): terminologia unificada (Presupuesto) e iconos/labels del sidebar"
```

---

### Task 9: Deep-link de "adicionales sin decidir" desde el dashboard

Hoy la card del dashboard manda a `/proyectos` genérico y el usuario tiene que adivinar cuál proyecto tiene el adicional pendiente.

**Files:**
- Modify: `app/proyectos/page.tsx` (filtro nuevo por query param)
- Modify: `app/page.tsx:199` (href de la acción)

- [ ] **Step 1: Soportar `?adicionales=propuesto` en `app/proyectos/page.tsx`**

1. En la interfaz `SearchParams` (línea 14), agregar el campo:

```ts
interface SearchParams {
  estado?: string
  msg?: string
  archivados?: string
  adicionales?: string
}
```

(Conservar los campos que ya existan — el bloque de arriba muestra los conocidos; si hay más, no borrarlos.)

2. En `getProyectos` (línea 20), agregar el parámetro y la condición al `where`:

```ts
async function getProyectos(estado?: string, verArchivados = false, soloConAdicionales = false) {
```

y dentro del objeto `where` existente (junto a `...(estado ? { estado } : {})`):

```ts
      ...(soloConAdicionales ? { adicionales: { some: { estado: 'propuesto' } } } : {}),
```

3. En el componente de página, leer el param y pasarlo:

```ts
  const { estado, msg, archivados, adicionales } = await searchParams
  const soloConAdicionales = adicionales === 'propuesto'
```

y en la llamada existente `getProyectos(estado, verArchivados)` → `getProyectos(estado, verArchivados, soloConAdicionales)`.

4. Mostrar un banner cuando el filtro está activo. Insertar justo antes de la Card de filtros (la que contiene los `estadoOptions`):

```tsx
      {soloConAdicionales && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
            Mostrando solo proyectos con adicionales sin decidir.
          </p>
          <Link href="/proyectos" className="text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline shrink-0">
            Quitar filtro
          </Link>
        </div>
      )}
```

(`Link` ya está importado en esa página.)

- [ ] **Step 2: Apuntar la card del dashboard al filtro**

En `app/page.tsx` línea 199, cambiar `href: '/proyectos',` por:

```ts
      href: '/proyectos?adicionales=propuesto',
```

- [ ] **Step 3: Verificación manual**

Run: `npm run lint`.
1. Crear (o tener) un adicional en estado "propuesto" en algún proyecto (tab Adicionales).
2. En el dashboard, clic en la card "N adicional(es) sin decidir" → aterriza en `/proyectos?adicionales=propuesto` mostrando **solo** los proyectos afectados, con el banner ámbar y su botón "Quitar filtro".

- [ ] **Step 4: Commit**

```bash
git add app/proyectos/page.tsx app/page.tsx
git commit -m "feat(proyectos): filtro por adicionales propuestos y deep-link desde dashboard"
```

---

### Task 10: Arreglar truncado de nombres en la tabla de presupuestos

Hoy el cliente se corta a 2 palabras por código (`split(' ').slice(0, 2)`) y el proyecto con `substring(0, 30)` — sin tooltip. "Constructora Hermanos Pérez SRL" se muestra "Constructora Hermanos".

**Files:**
- Modify: `app/presupuestos/page.tsx:176-193`

- [ ] **Step 1: Celda de cliente (líneas ~176-183)**

Reemplazar:

```tsx
                      <td className="px-4 py-3">
                        <Link
                          href={`/clientes/${p.cliente.id}`}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {p.cliente.nombre.split(' ').slice(0, 2).join(' ')}
                        </Link>
                      </td>
```

por:

```tsx
                      <td className="px-4 py-3">
                        <Link
                          href={`/clientes/${p.cliente.id}`}
                          title={p.cliente.nombre}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors block max-w-[200px] truncate"
                        >
                          {p.cliente.nombre}
                        </Link>
                      </td>
```

- [ ] **Step 2: Celda de proyecto (líneas ~184-194)**

Reemplazar el contenido del `<Link>` del proyecto:

```tsx
                          <Link href={`/proyectos/${p.proyecto.id}`} className="hover:text-primary transition-colors">
                            {p.proyecto.nombre.length > 30
                              ? p.proyecto.nombre.substring(0, 30) + '...'
                              : p.proyecto.nombre}
                          </Link>
```

por:

```tsx
                          <Link
                            href={`/proyectos/${p.proyecto.id}`}
                            title={p.proyecto.nombre}
                            className="hover:text-primary transition-colors block max-w-[220px] truncate"
                          >
                            {p.proyecto.nombre}
                          </Link>
```

- [ ] **Step 3: Verificación manual**

Run: `npm run lint`. En `/presupuestos`, nombres largos se cortan con "…" y el nombre completo aparece al pasar el mouse.

- [ ] **Step 4: Commit**

```bash
git add app/presupuestos/page.tsx
git commit -m "fix(presupuestos): truncado CSS con tooltip para nombres largos de cliente y proyecto"
```

---

## FASE 4 — Detalle de proyecto: 10 tabs → 4 grupos

### Task 11: Agrupar tabs con sub-navegación (compatible con deep-links `?tab=`)

Los 10 tabs planos se agrupan en: **Resumen** · **Dinero** (Gastos, Control, Adicionales, EVM) · **Ejecución** (Programación, Punchlist, Bitácora) · **Archivo** (Presupuestos, Documentos). Los valores de `?tab=` NO cambian — todos los deep-links existentes (p.ej. `?tab=gastos` desde el dashboard de hitos, `?tab=control` desde el resumen) siguen funcionando: el grupo activo se deriva del tab.

**Files:**
- Modify: `app/proyectos/[id]/page.tsx:171-182` (definición de tabs) y `:280-298` (tab bar)

- [ ] **Step 1: Reemplazar la definición de `tabs` (líneas 171-182)**

Reemplazar el array `const tabs = [...]` completo por:

```tsx
  type TabDef = { key: string; label: string; icon?: React.ElementType }
  type GrupoDef = { key: string; label: string; icon?: React.ElementType; tabs: TabDef[] }

  const grupos: GrupoDef[] = [
    {
      key: 'resumen', label: 'Resumen',
      tabs: [{ key: 'resumen', label: 'Resumen' }],
    },
    {
      key: 'dinero', label: 'Dinero', icon: BarChart2,
      tabs: [
        { key: 'gastos', label: `Gastos (${cantidadGastos})`, icon: TrendingDownIcon },
        { key: 'control', label: 'Control presupuestario', icon: BarChart2 },
        { key: 'adicionales', label: `Adicionales (${proyecto._count.adicionales})`, icon: FilePlus },
        { key: 'evm', label: 'EVM / Curva S', icon: TrendingUp },
      ],
    },
    {
      key: 'ejecucion', label: 'Ejecución', icon: ListTodo,
      tabs: [
        { key: 'programa', label: 'Programación', icon: ListTodo },
        { key: 'punchlist', label: `Punchlist (${proyecto._count.punchlist})`, icon: ClipboardCheck },
        { key: 'bitacora', label: 'Bitácora', icon: BookOpen },
      ],
    },
    {
      key: 'archivo', label: 'Archivo', icon: FolderOpen,
      tabs: [
        { key: 'presupuestos', label: `Presupuestos (${proyecto.presupuestos.length})` },
        { key: 'documentos', label: `Documentos (${proyecto._count.documentos})`, icon: FolderOpen },
      ],
    },
  ]

  const grupoActivo = grupos.find(g => g.tabs.some(t => t.key === tab)) ?? grupos[0]
```

(Todos los iconos referidos ya están importados en este archivo — son los mismos que usaba el array `tabs` original.)

- [ ] **Step 2: Reemplazar el tab bar (líneas 280-298)**

Reemplazar el bloque `{/* ── Tab bar ── */}` completo (el `<div className="border-b border-border">` con su `<nav>` que itera `tabs.map`) por:

```tsx
      {/* ── Barra de grupos ── */}
      <div className="border-b border-border">
        <nav className="flex gap-1 overflow-x-auto">
          {grupos.map(g => {
            const active = g.key === grupoActivo.key
            return (
              <Link key={g.key} href={`/proyectos/${proyecto.id}?tab=${g.tabs[0].key}`}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}>
                {g.icon && <g.icon className="w-3.5 h-3.5" />}
                {g.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* ── Sub-tabs del grupo activo ── */}
      {grupoActivo.tabs.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {grupoActivo.tabs.map(t => {
            const active = tab === t.key
            return (
              <Link key={t.key} href={`/proyectos/${proyecto.id}?tab=${t.key}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}>
                {t.icon && <t.icon className="w-3.5 h-3.5" />}
                {t.label}
              </Link>
            )
          })}
        </div>
      )}
```

Importante: NO tocar los bloques de contenido (`{tab === 'resumen' && ...}` etc., líneas 300+) — siguen funcionando con los mismos keys. Si el linter marca que la variable `tabs` quedó sin uso, es señal de que el Step 1 quedó bien (el array viejo fue reemplazado, no debe quedar duplicado).

- [ ] **Step 3: Verificación manual**

Run: `npm run lint`.
Con `npm run dev`, abrir un proyecto:
1. Se ven 4 grupos arriba: Resumen / Dinero / Ejecución / Archivo.
2. Clic en "Dinero" → aterriza en Gastos y aparecen los 4 sub-tabs (Gastos, Control, Adicionales, EVM).
3. Deep-link viejo: navegar manualmente a `/proyectos/[id]?tab=control` → grupo "Dinero" activo con sub-tab "Control presupuestario" seleccionado.
4. Los links internos del Resumen ("Ver gastos", "Ver control") siguen funcionando.

- [ ] **Step 4: Commit**

```bash
git add "app/proyectos/[id]/page.tsx"
git commit -m "feat(proyectos): agrupar 10 tabs en 4 grupos con sub-navegacion (deep-links compatibles)"
```

---

## FASE 5 — Notificaciones conectadas a lo que duele

### Task 12: Cron diario notifica sobrecosto de partidas y adicionales estancados

La infraestructura push ya existe (`lib/push.ts`, `lib/notificaciones-cron.ts`, deduplicación por `tag`). Solo se agregan 2 detecciones al job diario existente.

**Files:**
- Modify: `lib/notificaciones-cron.ts` (función `correrNotificacionesDiarias`)

- [ ] **Step 1: Extender la firma de retorno**

Cambiar el tipo de retorno de `correrNotificacionesDiarias` (líneas 21-24):

```ts
export async function correrNotificacionesDiarias(): Promise<{
  facturasVencen: number
  cronogramasAtrasados: number
  partidasSobrecosto: number
  adicionalesEstancados: number
}> {
```

- [ ] **Step 2: Agregar las detecciones 3 y 4**

Insertar después del bloque `// ── 2. Cronogramas atrasados ──` (línea ~82) y **antes** del `return`:

```ts
  // ── 3. Partidas con sobrecosto (gastado > presupuestado en el snapshot) ──
  const gastosPorPartida = await prisma.gastoProyecto.groupBy({
    by: ['partidaId'],
    where: { partidaId: { not: null }, estado: { not: 'Anulado' } },
    _sum: { monto: true },
  })
  const partidaIds = gastosPorPartida
    .map(g => g.partidaId)
    .filter((id): id is number => id != null)
  const partidas = partidaIds.length > 0
    ? await prisma.proyectoPartida.findMany({
        where: {
          id: { in: partidaIds },
          proyecto: { estado: { not: 'Cerrado' }, archivada: false },
        },
        select: { id: true, subtotalPresupuestado: true, proyectoId: true },
      })
    : []
  const gastadoPorPartida = new Map(gastosPorPartida.map(g => [g.partidaId, g._sum.monto ?? 0]))
  const partidasEnRojo = partidas.filter(
    p => p.subtotalPresupuestado > 0 && (gastadoPorPartida.get(p.id) ?? 0) > p.subtotalPresupuestado
  )
  const proyectosConSobrecosto = new Set(partidasEnRojo.map(p => p.proyectoId)).size

  if (partidasEnRojo.length > 0) {
    await enviarNotificacionAInteresados({
      title: 'Partidas sobre presupuesto',
      body: `${partidasEnRojo.length} partida${partidasEnRojo.length > 1 ? 's' : ''} excede${partidasEnRojo.length > 1 ? 'n' : ''} su presupuesto en ${proyectosConSobrecosto} proyecto${proyectosConSobrecosto > 1 ? 's' : ''}. Revisa el control presupuestario.`,
      url: '/proyectos',
      tag: 'partidas-sobrecosto',
    })
  }

  // ── 4. Adicionales propuestos hace más de 7 días sin decidir ──────
  const hace7Dias = new Date(hoy.getTime() - 7 * 86_400_000)
  const adicionalesEstancados = await prisma.adicionalProyecto.count({
    where: {
      estado: 'propuesto',
      fechaPropuesta: { lt: hace7Dias },
      proyecto: { archivada: false },
    },
  })

  if (adicionalesEstancados > 0) {
    await enviarNotificacionAInteresados({
      title: 'Adicionales sin decidir',
      body: `${adicionalesEstancados} adicional${adicionalesEstancados > 1 ? 'es' : ''} lleva${adicionalesEstancados > 1 ? 'n' : ''} más de 7 días propuestos sin aprobar ni rechazar.`,
      url: '/proyectos?adicionales=propuesto',
      tag: 'adicionales-estancados',
    })
  }
```

- [ ] **Step 3: Actualizar el `return`**

```ts
  return {
    facturasVencen: facturasVenciendo + facturasVencidas,
    cronogramasAtrasados: actividadesAtrasadas,
    partidasSobrecosto: partidasEnRojo.length,
    adicionalesEstancados,
  }
```

También actualizar el JSDoc de la función (líneas 4-20) agregando a la lista "Detecta:" las líneas `3. Partidas del snapshot con gasto > presupuestado.` y `4. Adicionales propuestos hace más de 7 días.`

- [ ] **Step 4: Verificación manual**

Run: `npm run lint`.
Con `npm run dev` y sesión Admin, disparar el job manualmente:

```bash
# Desde la consola del navegador logueado como Admin (la cookie va sola):
fetch('/api/notifications/run-cron', { method: 'POST' }).then(r => r.json()).then(console.log)
```

Expected: `{ ok: true, facturasVencen: N, cronogramasAtrasados: N, partidasSobrecosto: N, adicionalesEstancados: N }` — y si hay suscripción push activa (Configuración → Notificaciones), llegan las burbujas nuevas. El deep-link de adicionales requiere que la Task 9 esté mergeada; si no lo está, la URL cae en `/proyectos` sin filtro (aceptable, no rompe).

- [ ] **Step 5: Commit**

```bash
git add lib/notificaciones-cron.ts
git commit -m "feat(notificaciones): cron diario detecta partidas con sobrecosto y adicionales estancados"
```

---

## Cierre

- [ ] **Verificación final de la rama:** `npm run build` debe completar sin errores (es el gate real del repo, no hay tests).
- [ ] Revisar `SISTEMA.md` §5.3: actualizar la mención "4 pestañas" del detalle de proyecto a la nueva estructura de 4 grupos, y §10 agregando toasts/ConfirmDialog a la lista de características de interfaz.
- [ ] Merge a `main` (o PR, según prefiera el usuario).

## Backlog explícito (NO incluido en este plan — pedir plan nuevo)

1. Migrar los ~25 `alert()`/`confirm()` restantes al patrón ConfirmDialog+toast (mecánico, usar Tasks 4-5 como referencia).
2. Consolidar menú Finanzas (Transacciones/Cobros/Contabilidad como sub-tabs de un solo módulo).
3. Roles predefinidos (Contabilidad / Taller / Presupuestos) sobre `lib/permisos.ts` existente.
4. Registro móvil de gastos con foto + OCR (reusar `app/api/contabilidad/ocr`).
5. Paginación server-side en `/facturacion` (hoy `take: 200`).
