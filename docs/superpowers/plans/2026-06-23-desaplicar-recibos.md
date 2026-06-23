# Desaplicar recibos (Fase 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir quitar una aplicación individual de un recibo a una factura, sin tocar el monto recibido, liberando saldo del recibo y recalculando la factura.

**Architecture:** Un endpoint `DELETE` borra la fila `AplicacionRecibo` dentro de una transacción y reusa los helpers `recalcularFactura`/`recalcularRecibo` de `lib/recibos.ts`. Dos puntos de UI (detalle de factura y modal de aplicar del recibo) llaman al endpoint con `ConfirmDialog` + `useToast`.

**Tech Stack:** Next.js 16 App Router (route handlers), Prisma 5 + PostgreSQL, React client components, Tailwind/shadcn, lucide-react.

**Nota sobre pruebas:** Este repo **no tiene tests de rutas API ni E2E** (ver `CLAUDE.md`); los unit tests existen solo para utilidades puras en `lib/__tests__/`, y la lógica de recálculo que toca este plan (`recalcularFactura`, `recalcularRecibo`, `estadoFactura`, `estadoRecibo`) **ya está cubierta**. No se añade lógica pura nueva, así que la verificación es: gates (`tsc`/`lint`/`build`) + prueba manual en navegador. No se inventan tests de ruta que la infra no puede correr.

**Gates de verificación (correr al final de cada tarea con cambios de código):**
```bash
npx tsc --noEmit        # 0 errores
npm run lint            # 0 errores (warnings = deuda conocida)
npm run build           # ignorar el error de Prisma en prerender (conocido)
```

---

## File Structure

- **Create:** `app/api/cobros/recibos/[id]/aplicaciones/[aplicacionId]/route.ts` — endpoint `DELETE` para quitar una aplicación.
- **Modify:** `components/contabilidad/FacturaDetalle.tsx` — botón "Quitar" por aplicación en la sección "Cobros registrados".
- **Modify:** `components/contabilidad/RecibosTab.tsx` — `AplicarModal` lista las aplicaciones actuales del recibo, cada una con botón "Quitar".

---

## Task 1: Endpoint DELETE para quitar una aplicación

**Files:**
- Create: `app/api/cobros/recibos/[id]/aplicaciones/[aplicacionId]/route.ts`

Patrón espejo de `app/api/cobros/recibos/[id]/aplicar/route.ts` y `.../anular/route.ts`.

- [ ] **Step 1: Crear el route handler**

Crear `app/api/cobros/recibos/[id]/aplicaciones/[aplicacionId]/route.ts` con este contenido completo:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'
import { recalcularFactura, recalcularRecibo } from '@/lib/recibos'

type Ctx = { params: Promise<{ id: string; aplicacionId: string }> }

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  const { id: idStr, aplicacionId: aplStr } = await params
  const id = parseInt(idStr)
  const aplicacionId = parseInt(aplStr)
  if (isNaN(id) || isNaN(aplicacionId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  // Cargar la aplicación junto con el recibo y el proyecto de la factura.
  const aplicacion = await prisma.aplicacionRecibo.findUnique({
    where: { id: aplicacionId },
    include: {
      recibo: { select: { id: true, estado: true } },
      factura: { select: { id: true, proyectoId: true } },
    },
  })
  if (!aplicacion) {
    return NextResponse.json({ error: 'Aplicación no encontrada' }, { status: 404 })
  }
  // Defensa: la aplicación debe pertenecer al recibo de la URL.
  if (aplicacion.reciboId !== id) {
    return NextResponse.json({ error: 'La aplicación no pertenece a este recibo' }, { status: 400 })
  }
  if (aplicacion.recibo.estado === 'anulado') {
    return NextResponse.json({ error: 'Recibo anulado' }, { status: 400 })
  }

  // Misma guarda que aplicar: no mover dinero en proyecto cerrado.
  const cerrado = await validarProyectoNoCerrado(aplicacion.factura.proyectoId)
  if (cerrado) return cerrado

  await prisma.$transaction(async (tx) => {
    await tx.aplicacionRecibo.delete({ where: { id: aplicacionId } })
    await recalcularFactura(tx, aplicacion.facturaId)
    await recalcularRecibo(tx, id)
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verificar gates**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: 0 errores en ambos. (`npm run build` se corre al final del plan.)

- [ ] **Step 3: Commit**

```bash
git add "app/api/cobros/recibos/[id]/aplicaciones/[aplicacionId]/route.ts"
git commit -m "feat(recibos): endpoint DELETE para quitar una aplicacion de un recibo"
```

---

## Task 2: Botón "Quitar" en el detalle de factura

**Files:**
- Modify: `components/contabilidad/FacturaDetalle.tsx`

El componente ya tiene `useToast` (`toast`), `ConfirmDialog`, el estado `confirmacion` (objeto `{ titulo, descripcion?, textoConfirmar?, onConfirmar }`), `refreshFactura()`, y el ícono `Trash2` importado (línea 9). La sección "Cobros registrados" mapea `factura.aplicaciones` (líneas ~306-326); cada fila tiene un `<div className="flex items-center gap-2 shrink-0">` con un `CheckCircle2`.

- [ ] **Step 1: Agregar el handler de desaplicar**

En `FacturaDetalle.tsx`, justo después de la función `refreshFactura` (que termina en la línea ~138, antes de `return (`), agregar:

```typescript
  const handleDesaplicar = (aplicacionId: number, reciboNumero: string) => {
    setConfirmacion({
      titulo: '¿Quitar este cobro de la factura?',
      descripcion: `Se desaplicará el recibo ${reciboNumero}. El dinero del recibo no se elimina: queda disponible para aplicarlo a otra factura.`,
      textoConfirmar: 'Sí, quitar',
      onConfirmar: async () => {
        setConfirmacion(null)
        const apl = (factura.aplicaciones ?? []).find(a => a.id === aplicacionId)
        if (!apl) return
        const res = await fetch(`/api/cobros/recibos/${apl.reciboId}/aplicaciones/${aplicacionId}`, {
          method: 'DELETE',
        })
        if (res.ok) {
          toast.exito('Cobro desaplicado')
          refreshFactura()
        } else {
          const data = await res.json().catch(() => null)
          toast.error(data?.error ?? 'No se pudo desaplicar el cobro')
        }
      },
    })
  }
```

- [ ] **Step 2: Agregar el botón en la fila de aplicación**

En la sección INGRESO, localizar el `<div className="flex items-center gap-2 shrink-0">` que contiene `<CheckCircle2 className="w-4 h-4 text-green-500" />` (línea ~322-324). Reemplazar ese bloque por:

```tsx
                      <div className="flex items-center gap-2 shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        {factura.estado !== 'anulada' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-red-600"
                            onClick={() => handleDesaplicar(a.id, a.recibo.numero)}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Quitar
                          </Button>
                        )}
                      </div>
```

- [ ] **Step 3: Verificar gates**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add components/contabilidad/FacturaDetalle.tsx
git commit -m "feat(recibos): boton Quitar para desaplicar cobro desde detalle de factura"
```

---

## Task 3: Listar y quitar aplicaciones desde el modal del recibo

**Files:**
- Modify: `components/contabilidad/RecibosTab.tsx`

`AplicarModal` (línea ~136) recibe `{ recibo, onClose, onDone }`. Hoy solo muestra el formulario para aplicar. Hay que agregar: (a) fetch de las aplicaciones actuales del recibo vía `GET /api/cobros/recibos/[id]` (devuelve `aplicaciones[].factura` con `numero`), (b) una lista de esas aplicaciones con botón "Quitar" cada una, (c) `ConfirmDialog` local para confirmar. Los íconos `Trash2` y `CheckCircle2` y `ConfirmDialog` deben estar disponibles: `CheckCircle2` y `ConfirmDialog` ya se importan; **falta `Trash2`**.

- [ ] **Step 1: Importar el ícono Trash2**

En la línea 4 de `RecibosTab.tsx`, agregar `Trash2` a la lista de imports de `lucide-react`:

```tsx
import { Plus, X, Receipt, CheckCircle2, Clock, Ban, AlertCircle, RefreshCw, CreditCard, Printer, Search, Trash2 } from 'lucide-react'
```

- [ ] **Step 2: Agregar estado y tipos para las aplicaciones actuales dentro de `AplicarModal`**

Dentro de `function AplicarModal({ recibo, onClose, onDone })`, justo después de la línea `const [submitting, setSubmitting] = useState(false)` (~línea 143), agregar:

```tsx
  // Aplicaciones ya existentes del recibo (para poder quitarlas).
  type AplicacionActual = { id: number; facturaId: number; monto: number; factura: { id: number; numero: string } }
  const [actuales, setActuales] = useState<AplicacionActual[]>([])
  const [confirmQuitar, setConfirmQuitar] = useState<AplicacionActual | null>(null)

  const cargarActuales = useCallback(() => {
    fetch(`/api/cobros/recibos/${recibo.id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setActuales(data?.aplicaciones ?? []))
      .catch(() => setActuales([]))
  }, [recibo.id])

  useEffect(() => { cargarActuales() }, [cargarActuales])
```

> `useCallback` ya está importado (línea 3). `useEffect` también.

- [ ] **Step 3: Agregar el handler para quitar una aplicación**

Dentro de `AplicarModal`, después de la función `handleAplicar` (~línea 203), agregar:

```tsx
  const handleQuitar = async (apl: AplicacionActual) => {
    setConfirmQuitar(null)
    try {
      const res = await fetch(`/api/cobros/recibos/${recibo.id}/aplicaciones/${apl.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.exito(`Aplicación a ${apl.factura.numero} quitada`)
        cargarActuales()
        onDone()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'No se pudo quitar la aplicación')
      }
    } catch {
      toast.error('Error de red al quitar la aplicación')
    }
  }
```

> Nota: `onDone()` cierra el modal y refresca la lista (`() => { setReciboAplicar(null); fetchRecibos() }`). Quitar una aplicación cierra el modal y refleja el nuevo disponible en la lista; reabrir el modal para más cambios es aceptable (mismo patrón que aplicar).

- [ ] **Step 4: Renderizar la lista de aplicaciones actuales**

En el JSX de `AplicarModal`, justo **antes** del bloque `{/* Pending invoices */}` (el `<div className="border border-border rounded-lg p-4 space-y-3">` de la línea ~242), insertar:

```tsx
        {/* Aplicaciones actuales del recibo */}
        {actuales.length > 0 && (
          <div className="border border-border rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Aplicado actualmente</h4>
            {actuales.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {a.factura.numero} — <span className="tabular-nums">{formatCurrency(a.monto)}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-red-600"
                  onClick={() => setConfirmQuitar(a)}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Quitar
                </Button>
              </div>
            ))}
          </div>
        )}
```

- [ ] **Step 5: Renderizar el ConfirmDialog dentro del modal**

`ConfirmDialog` es **controlado**: requiere la prop `abierto` y devuelve `null` cuando es `false` (firma en `components/ui/confirm-dialog.tsx`: `abierto`, `titulo`, `descripcion?`, `textoConfirmar?`, `variante?`, `cargando?`, `onConfirmar`, `onCancelar`). Se renderiza **siempre** (no condicional) con acceso null-safe a los campos, igual que el `ConfirmDialog` de "Anular" en este archivo (~línea 563).

Justo **antes** del cierre del componente `AplicarModal` (antes del `</div>` que cierra el overlay `fixed inset-0`, ~línea 287-289), insertar:

```tsx
        <ConfirmDialog
          abierto={confirmQuitar !== null}
          titulo="¿Quitar esta aplicación?"
          descripcion={confirmQuitar
            ? `Se desaplicará ${formatCurrency(confirmQuitar.monto)} de la factura ${confirmQuitar.factura.numero}. El monto del recibo no se modifica.`
            : ''}
          textoConfirmar="Sí, quitar"
          variante="peligro"
          onConfirmar={() => { if (confirmQuitar) handleQuitar(confirmQuitar) }}
          onCancelar={() => setConfirmQuitar(null)}
        />
```

- [ ] **Step 6: Verificar gates**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: 0 errores.

- [ ] **Step 7: Commit**

```bash
git add components/contabilidad/RecibosTab.tsx
git commit -m "feat(recibos): listar y quitar aplicaciones desde el modal del recibo"
```

---

## Task 4: Verificación final (gates + manual en navegador)

**Files:** ninguno (verificación).

- [ ] **Step 1: Build completo**

Run:
```bash
npm run build
```
Expected: build exitoso. **Ignorar** el error conocido de Prisma en prerender (documentado en la memoria de gates).

- [ ] **Step 2: Prueba manual en navegador**

Requiere una BD Postgres alcanzable (ver mismatch SQLite/Postgres en `CLAUDE.md`). Con `npm run dev`:

1. Crear/usar un recibo y aplicarlo a **2 facturas** del mismo cliente.
2. En el **detalle de una de esas facturas** (`/contabilidad/facturas/[id]`), sección "Cobros registrados", pulsar **Quitar** → confirmar.
   - Esperado: la factura vuelve a `pendiente`/`parcial`, baja su "Cobrado"; toast "Cobro desaplicado".
3. En la **pestaña de recibos**, abrir el modal **Aplicar** de ese recibo.
   - Esperado: aparece "Aplicado actualmente" con la aplicación restante; el **Disponible** subió.
   - Pulsar **Quitar** → confirmar. Esperado: el recibo queda `sin_aplicar` con todo el monto disponible.
4. Confirmar que el **monto del recibo** y su **movimiento bancario** no cambiaron en ningún momento.
5. (Si aplica) Intentar quitar una aplicación de una factura cuyo **proyecto esté cerrado** → esperado: error 423 con mensaje de proyecto cerrado; la aplicación no se borra.

- [ ] **Step 3: Marcar el plan como ejecutado**

No requiere commit de código. Opcional: anotar en la memoria del proyecto que la Fase 4 quedó implementada (sin push), siguiendo la convención de las notas previas de recibos.

---

## Notas de despliegue

- **Sin migración de datos** y **sin cambios de schema** → no requiere `db:push`. Deploy normal en el VPS.
- Link roto detectado fuera de alcance: `FacturaDetalle.tsx` (~línea 317) enlaza a `/cobros/recibos/{id}`, página que no existe (solo `/imprimir`). Abordar por separado.
