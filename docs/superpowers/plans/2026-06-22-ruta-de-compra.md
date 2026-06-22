# Ruta de Compra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un módulo "Ruta de compra": lista manual de materiales (multi-proyecto, multi-suplidor, con urgencia por línea) que se agrupa por suplidor para que el comprador recorra las paradas, marque comprado y anote precio real en vivo, con versión imprimible.

**Architecture:** Modelo nuevo `RutaCompra` + `ItemRutaCompra` (independiente de `OrdenCompra`), reusando el catálogo `Proveedor` y el modelo `Proyecto`. API REST bajo `/api/compras/rutas`. Pantallas bajo `/compras/rutas` integradas en `FinanzasNav`. Es solo informativo: no toca gastos ni facturación.

**Tech Stack:** Next.js 16 (App Router, server + client components), Prisma 5 + SQLite, TypeScript, Tailwind + shadcn/ui, lucide-react, toast existente (`@/components/ui/toast`).

**Convenciones del repo aplicadas:**
- Sin suite de tests automatizados → cada tarea se verifica **manualmente en navegador** + gates `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Permisos: se **reusa el módulo `compras`** existente vía `checkPermiso(req, 'compras', 'ver'|'editar')` inline (mismo patrón que `app/api/compras/route.ts`). No se crea un módulo de permiso nuevo.
- Numeración `RC-YYYY-NNNN` con `findFirst` + `orderBy desc` sobre el prefijo del año (mismo patrón que `OC-`).
- Idioma español en modelos/rutas/UI. Moneda RD$.

---

## File Structure

**Crear:**
- `app/api/compras/rutas/route.ts` — GET lista + POST crear ruta.
- `app/api/compras/rutas/[id]/route.ts` — GET detalle + PUT (cabecera+items) + DELETE.
- `app/api/compras/rutas/[id]/items/[itemId]/route.ts` — PATCH marcar comprado / precio real.
- `app/compras/rutas/page.tsx` — server: carga rutas, renderiza lista.
- `app/compras/rutas/RutasCompraPageClient.tsx` — client: tabla + filtros + botón nueva.
- `app/compras/rutas/nueva/page.tsx` — server: carga proveedores+proyectos, renderiza builder.
- `app/compras/rutas/nueva/RutaCompraBuilder.tsx` — client: cabecera + tabla de líneas.
- `app/compras/rutas/[id]/page.tsx` — server: carga ruta con items.
- `app/compras/rutas/[id]/RutaCompraDetail.tsx` — client: vista agrupada por suplidor, modo en vivo.
- `app/compras/rutas/[id]/imprimir/page.tsx` — server: hoja A4 sin shell.
- `app/compras/rutas/[id]/imprimir/PrintButton.tsx` — client: botón window.print().

**Modificar:**
- `prisma/schema.prisma` — modelos `RutaCompra` + `ItemRutaCompra`; relaciones inversas en `Proveedor` y `Proyecto`.
- `components/contabilidad/FinanzasNav.tsx` — añadir item "Rutas de compra".

---

## Task 1: Esquema de datos

**Files:**
- Modify: `prisma/schema.prisma` (modelos nuevos al final de la sección de compras, ~línea 1433; relaciones inversas en `Proyecto` ~línea 84 y `Proveedor` ~línea 1227)

- [ ] **Step 1: Añadir los dos modelos nuevos**

En `prisma/schema.prisma`, inmediatamente después del modelo `ItemOrdenCompra` (después de su `@@map("item_orden_compra")` y la llave de cierre, ~línea 1433), pegar:

```prisma
// ── RUTA DE COMPRA ───────────────────────────────────────────────────
// Lista manual de materiales que el comprador sale a comprar. Multi-proyecto
// y multi-suplidor. Solo informativo: no genera gastos ni órdenes de compra.

model RutaCompra {
  id          Int      @id @default(autoincrement())
  codigo      String   @unique          // RC-2026-0001
  titulo      String?                    // ej. "Compras martes AM"
  fecha       DateTime @default(now())
  estado      String   @default("borrador") // borrador | en_proceso | completada | cancelada
  comprador   String?                    // nombre del chofer/comprador (texto libre)
  notas       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items       ItemRutaCompra[]

  @@index([estado])
  @@map("ruta_compra")
}

model ItemRutaCompra {
  id             Int      @id @default(autoincrement())
  rutaCompraId   Int
  descripcion    String                   // material a comprar
  cantidad       Float    @default(1)
  unidad         String   @default("ud")
  proyectoId     Int?                     // a qué proyecto va (opcional)
  proveedorId    Int?                     // suplidor (catálogo)
  proveedorTexto String?                  // fallback si el suplidor no está en catálogo
  urgencia       String   @default("media") // alta | media | baja
  precioEstimado Float?
  comprado       Boolean  @default(false)
  precioReal     Float?
  notas          String?
  orden          Int      @default(0)

  rutaCompra  RutaCompra @relation(fields: [rutaCompraId], references: [id], onDelete: Cascade)
  proyecto    Proyecto?  @relation(fields: [proyectoId], references: [id], onDelete: SetNull)
  proveedor   Proveedor? @relation(fields: [proveedorId], references: [id], onDelete: SetNull)

  @@index([rutaCompraId])
  @@map("item_ruta_compra")
}
```

- [ ] **Step 2: Añadir relación inversa en `Proyecto`**

En el modelo `Proyecto`, justo después de la línea `distribucionesOverhead DistribucionOverhead[]` (~línea 84), añadir:

```prisma
  itemsRutaCompra   ItemRutaCompra[]
```

- [ ] **Step 3: Añadir relación inversa en `Proveedor`**

En el modelo `Proveedor`, justo después de la línea `ordenesCompra    OrdenCompra[]` (~línea 1227), añadir:

```prisma
  itemsRutaCompra  ItemRutaCompra[]
```

- [ ] **Step 4: Sincronizar el schema con la base de datos**

Run: `npm run db:push`
Expected: termina con "Your database is now in sync with your Prisma schema" y regenera el cliente Prisma sin errores.

- [ ] **Step 5: Verificar que el cliente compila con los nuevos tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores (los tipos `RutaCompra` / `ItemRutaCompra` ya existen en `@prisma/client`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(ruta-compra): modelos RutaCompra e ItemRutaCompra"
```

---

## Task 2: API — listar y crear rutas

**Files:**
- Create: `app/api/compras/rutas/route.ts`

- [ ] **Step 1: Crear el route handler GET + POST**

Crear `app/api/compras/rutas/route.ts` con:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// GET /api/compras/rutas — lista de rutas de compra
export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'compras', 'ver')
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')

  const where: Record<string, unknown> = {}
  if (estado) where.estado = estado

  const rutas = await prisma.rutaCompra.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        select: { proveedorId: true, proveedorTexto: true, precioEstimado: true, precioReal: true },
      },
    },
  })

  // Derivar métricas por ruta: # paradas (suplidores distintos), # items, totales
  const data = rutas.map((r) => {
    const paradas = new Set(
      r.items.map((i) => (i.proveedorId ? `id:${i.proveedorId}` : i.proveedorTexto ? `t:${i.proveedorTexto}` : 'sin'))
    )
    const totalEstimado = r.items.reduce((s, i) => s + (i.precioEstimado ?? 0), 0)
    const totalReal = r.items.reduce((s, i) => s + (i.precioReal ?? 0), 0)
    return {
      id: r.id,
      codigo: r.codigo,
      titulo: r.titulo,
      fecha: r.fecha,
      estado: r.estado,
      comprador: r.comprador,
      numParadas: paradas.size,
      numItems: r.items.length,
      totalEstimado,
      totalReal,
    }
  })

  return NextResponse.json(data)
}

// POST /api/compras/rutas — crear ruta (cabecera + items opcionales)
export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  try {
    const body = await request.json()

    // Generar código secuencial RC-YYYY-NNNN
    const year = new Date().getFullYear()
    const prefix = `RC-${year}-`
    const last = await prisma.rutaCompra.findFirst({
      where: { codigo: { startsWith: prefix } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    })
    const seq = last ? parseInt(last.codigo.slice(prefix.length)) + 1 : 1
    const codigo = `${prefix}${String(seq).padStart(4, '0')}`

    const items = Array.isArray(body.items) ? body.items : []

    const ruta = await prisma.rutaCompra.create({
      data: {
        codigo,
        titulo: body.titulo?.toString().trim() || null,
        comprador: body.comprador?.toString().trim() || null,
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        notas: body.notas?.toString().trim() || null,
        items: {
          create: items.map((it: Record<string, unknown>, idx: number) => ({
            descripcion: String(it.descripcion ?? '').trim() || 'Material',
            cantidad: parseFloat(String(it.cantidad)) || 1,
            unidad: String(it.unidad ?? 'ud').trim() || 'ud',
            proyectoId: it.proyectoId ? parseInt(String(it.proyectoId)) : null,
            proveedorId: it.proveedorId ? parseInt(String(it.proveedorId)) : null,
            proveedorTexto: it.proveedorTexto ? String(it.proveedorTexto).trim() : null,
            urgencia: ['alta', 'media', 'baja'].includes(String(it.urgencia)) ? String(it.urgencia) : 'media',
            precioEstimado: it.precioEstimado != null && it.precioEstimado !== '' ? parseFloat(String(it.precioEstimado)) : null,
            notas: it.notas ? String(it.notas).trim() : null,
            orden: idx,
          })),
        },
      },
      select: { id: true, codigo: true },
    })

    return NextResponse.json(ruta)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Probar POST manualmente (con el servidor corriendo)**

Con `npm run dev` activo y sesión iniciada en el navegador, abrir la consola del navegador (en cualquier página del CRM, para usar la cookie de sesión) y ejecutar:

```js
await fetch('/api/compras/rutas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ titulo: 'Prueba', items: [{ descripcion: 'Tablero', cantidad: 2, unidad: 'ud', urgencia: 'alta' }] }),
}).then(r => r.json())
```
Expected: devuelve `{ id: <n>, codigo: "RC-2026-0001" }`.

Luego:
```js
await fetch('/api/compras/rutas').then(r => r.json())
```
Expected: array con la ruta creada, `numItems: 1`, `numParadas: 1`.

- [ ] **Step 4: Commit**

```bash
git add app/api/compras/rutas/route.ts
git commit -m "feat(ruta-compra): API listar y crear rutas"
```

---

## Task 3: API — detalle, actualizar y eliminar ruta

**Files:**
- Create: `app/api/compras/rutas/[id]/route.ts`

- [ ] **Step 1: Crear el route handler GET + PUT + DELETE**

Crear `app/api/compras/rutas/[id]/route.ts` con:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// GET /api/compras/rutas/[id] — detalle con items, proveedor y proyecto
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'ver')
  if (denied) return denied

  const { id } = await params
  const rutaId = parseInt(id)
  if (isNaN(rutaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const ruta = await prisma.rutaCompra.findUnique({
    where: { id: rutaId },
    include: {
      items: {
        orderBy: { orden: 'asc' },
        include: {
          proveedor: { select: { id: true, nombre: true, direccion: true, telefono: true } },
          proyecto: { select: { id: true, nombre: true } },
        },
      },
    },
  })

  if (!ruta) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(ruta)
}

// PUT /api/compras/rutas/[id] — actualizar cabecera + reemplazar items
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  const { id } = await params
  const rutaId = parseInt(id)
  if (isNaN(rutaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : []

    // Reemplazo total de líneas dentro de una transacción
    await prisma.$transaction([
      prisma.rutaCompra.update({
        where: { id: rutaId },
        data: {
          titulo: body.titulo !== undefined ? (body.titulo?.toString().trim() || null) : undefined,
          comprador: body.comprador !== undefined ? (body.comprador?.toString().trim() || null) : undefined,
          fecha: body.fecha ? new Date(body.fecha) : undefined,
          estado: ['borrador', 'en_proceso', 'completada', 'cancelada'].includes(body.estado) ? body.estado : undefined,
          notas: body.notas !== undefined ? (body.notas?.toString().trim() || null) : undefined,
        },
      }),
      prisma.itemRutaCompra.deleteMany({ where: { rutaCompraId: rutaId } }),
      prisma.itemRutaCompra.createMany({
        data: items.map((it: Record<string, unknown>, idx: number) => ({
          rutaCompraId: rutaId,
          descripcion: String(it.descripcion ?? '').trim() || 'Material',
          cantidad: parseFloat(String(it.cantidad)) || 1,
          unidad: String(it.unidad ?? 'ud').trim() || 'ud',
          proyectoId: it.proyectoId ? parseInt(String(it.proyectoId)) : null,
          proveedorId: it.proveedorId ? parseInt(String(it.proveedorId)) : null,
          proveedorTexto: it.proveedorTexto ? String(it.proveedorTexto).trim() : null,
          urgencia: ['alta', 'media', 'baja'].includes(String(it.urgencia)) ? String(it.urgencia) : 'media',
          precioEstimado: it.precioEstimado != null && it.precioEstimado !== '' ? parseFloat(String(it.precioEstimado)) : null,
          precioReal: it.precioReal != null && it.precioReal !== '' ? parseFloat(String(it.precioReal)) : null,
          comprado: Boolean(it.comprado),
          notas: it.notas ? String(it.notas).trim() : null,
          orden: idx,
        })),
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/compras/rutas/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  const { id } = await params
  const rutaId = parseInt(id)
  if (isNaN(rutaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  await prisma.rutaCompra.delete({ where: { id: rutaId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Probar GET manualmente**

En la consola del navegador (usando el `id` devuelto en Task 2):
```js
await fetch('/api/compras/rutas/1').then(r => r.json())
```
Expected: objeto ruta con `items` (cada uno con `proveedor` y `proyecto`, posiblemente null).

- [ ] **Step 4: Commit**

```bash
git add app/api/compras/rutas/[id]/route.ts
git commit -m "feat(ruta-compra): API detalle, actualizar y eliminar ruta"
```

---

## Task 4: API — marcar comprado / precio real (línea)

**Files:**
- Create: `app/api/compras/rutas/[id]/items/[itemId]/route.ts`

- [ ] **Step 1: Crear el route handler PATCH**

Crear `app/api/compras/rutas/[id]/items/[itemId]/route.ts` con:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// PATCH /api/compras/rutas/[id]/items/[itemId]
// Endpoint ligero para el modo en vivo: marcar comprado / fijar precio real.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  const { itemId: itemIdStr } = await params
  const itemId = parseInt(itemIdStr)
  if (isNaN(itemId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.comprado !== undefined) data.comprado = Boolean(body.comprado)
    if (body.precioReal !== undefined) {
      data.precioReal = body.precioReal === null || body.precioReal === '' ? null : parseFloat(String(body.precioReal))
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const item = await prisma.itemRutaCompra.update({ where: { id: itemId }, data })
    return NextResponse.json(item)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Probar PATCH manualmente**

En la consola del navegador (usar un `itemId` real de la ruta creada):
```js
await fetch('/api/compras/rutas/1/items/1', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ comprado: true, precioReal: 350.50 }),
}).then(r => r.json())
```
Expected: el item devuelto con `comprado: true` y `precioReal: 350.5`.

- [ ] **Step 4: Commit**

```bash
git add app/api/compras/rutas/[id]/items/[itemId]/route.ts
git commit -m "feat(ruta-compra): API marcar comprado y precio real por línea"
```

---

## Task 5: Navegación — añadir "Rutas de compra" a FinanzasNav

**Files:**
- Modify: `components/contabilidad/FinanzasNav.tsx:3-9`

- [ ] **Step 1: Añadir el item al array `ITEMS`**

En `components/contabilidad/FinanzasNav.tsx`, reemplazar el array `ITEMS` por:

```typescript
const ITEMS = [
  { key: 'contabilidad', href: '/contabilidad', label: 'Contabilidad' },
  { key: 'cobros', href: '/facturacion', label: 'Cobros' },
  { key: 'transacciones', href: '/contabilidad/transacciones', label: 'Transacciones' },
  { key: 'compras', href: '/compras', label: 'Compras' },
  { key: 'rutas', href: '/compras/rutas', label: 'Rutas de compra' },
  { key: 'proveedores', href: '/proveedores', label: 'Proveedores' },
] as const
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores (el tipo `FinanzasSeccion` ahora incluye `'rutas'`).

- [ ] **Step 3: Commit**

```bash
git add components/contabilidad/FinanzasNav.tsx
git commit -m "feat(ruta-compra): enlace en FinanzasNav"
```

---

## Task 6: Página de lista de rutas

**Files:**
- Create: `app/compras/rutas/page.tsx`
- Create: `app/compras/rutas/RutasCompraPageClient.tsx`

- [ ] **Step 1: Crear el server component de lista**

Crear `app/compras/rutas/page.tsx` con:

```tsx
import { prisma } from '@/lib/prisma'
import { FinanzasNav } from '@/components/contabilidad/FinanzasNav'
import { RutasCompraPageClient } from './RutasCompraPageClient'

export default async function RutasCompraPage() {
  const rutas = await prisma.rutaCompra.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      items: { select: { proveedorId: true, proveedorTexto: true, precioEstimado: true, precioReal: true } },
    },
  })

  const data = rutas.map((r) => {
    const paradas = new Set(
      r.items.map((i) => (i.proveedorId ? `id:${i.proveedorId}` : i.proveedorTexto ? `t:${i.proveedorTexto}` : 'sin'))
    )
    return {
      id: r.id,
      codigo: r.codigo,
      titulo: r.titulo,
      fecha: r.fecha.toISOString(),
      estado: r.estado,
      comprador: r.comprador,
      numParadas: paradas.size,
      numItems: r.items.length,
      totalEstimado: r.items.reduce((s, i) => s + (i.precioEstimado ?? 0), 0),
      totalReal: r.items.reduce((s, i) => s + (i.precioReal ?? 0), 0),
    }
  })

  return (
    <div className="space-y-4">
      <FinanzasNav activo="rutas" />
      <RutasCompraPageClient rutasIniciales={data} />
    </div>
  )
}
```

- [ ] **Step 2: Crear el client component de lista**

Crear `app/compras/rutas/RutasCompraPageClient.tsx` con:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Route, Plus, Search, MapPin, Package } from 'lucide-react'

interface Ruta {
  id: number
  codigo: string
  titulo: string | null
  fecha: string
  estado: string
  comprador: string | null
  numParadas: number
  numItems: number
  totalEstimado: number
  totalReal: number
}

const ESTADOS_BADGE: Record<string, { label: string; color: string }> = {
  borrador:   { label: 'Borrador',   color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  en_proceso: { label: 'En proceso', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  completada: { label: 'Completada', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  cancelada:  { label: 'Cancelada',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

const FILTROS = ['todos', 'borrador', 'en_proceso', 'completada', 'cancelada']

function fmt(v: number) {
  return `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function RutasCompraPageClient({ rutasIniciales }: { rutasIniciales: Ruta[] }) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')

  const filtradas = rutasIniciales.filter((r) => {
    if (filtro !== 'todos' && r.estado !== filtro) return false
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return r.codigo.toLowerCase().includes(q) || (r.titulo ?? '').toLowerCase().includes(q) || (r.comprador ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Route className="w-6 h-6 text-blue-600" />
            Rutas de Compra
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Lista de materiales a comprar, agrupada por suplidor</p>
        </div>
        <Link href="/compras/rutas/nueva">
          <Button size="sm"><Plus className="w-4 h-4" /> Nueva ruta</Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por código, título, comprador..." className="pl-9 h-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTROS.map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filtro === f ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {f === 'todos' ? 'Todos' : ESTADOS_BADGE[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <Route className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">Sin rutas de compra</p>
          <p className="text-xs text-muted-foreground mt-1">Crea tu primera ruta para organizar las compras del comprador</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Código</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Título</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Fecha</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Paradas</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Items</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Estimado</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Real</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map((r) => {
                const badge = ESTADOS_BADGE[r.estado] || { label: r.estado, color: 'bg-slate-100 text-slate-700' }
                return (
                  <tr key={r.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => router.push(`/compras/rutas/${r.id}`)}>
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{r.codigo}</td>
                    <td className="px-4 py-3 text-foreground">{r.titulo || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.fecha).toLocaleDateString('es-DO')}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground"><span className="inline-flex items-center gap-1 justify-end"><MapPin className="w-3.5 h-3.5" />{r.numParadas}</span></td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground"><span className="inline-flex items-center gap-1 justify-end"><Package className="w-3.5 h-3.5" />{r.numItems}</span></td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt(r.totalEstimado)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">{fmt(r.totalReal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar compilación + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errores.

- [ ] **Step 4: Verificar en navegador**

Con `npm run dev`, navegar a `/compras/rutas`. Expected: se ve el FinanzasNav con "Rutas de compra" activo, la tabla muestra la ruta de prueba creada en Task 2 (o el estado vacío si se borró). Clic en una fila navega a `/compras/rutas/<id>` (404 esperado hasta Task 8).

- [ ] **Step 5: Commit**

```bash
git add app/compras/rutas/page.tsx app/compras/rutas/RutasCompraPageClient.tsx
git commit -m "feat(ruta-compra): página de lista de rutas"
```

---

## Task 7: Builder — crear nueva ruta

**Files:**
- Create: `app/compras/rutas/nueva/page.tsx`
- Create: `app/compras/rutas/nueva/RutaCompraBuilder.tsx`

- [ ] **Step 1: Crear el server component que carga catálogos**

Crear `app/compras/rutas/nueva/page.tsx` con:

```tsx
import { prisma } from '@/lib/prisma'
import { RutaCompraBuilder } from './RutaCompraBuilder'

export default async function NuevaRutaPage() {
  const [proveedores, proyectos] = await Promise.all([
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    prisma.proyecto.findMany({ where: { estado: { notIn: ['Cancelado', 'Completado'] } }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
  ])

  return <RutaCompraBuilder proveedores={proveedores} proyectos={proyectos} />
}
```

- [ ] **Step 2: Crear el client component builder**

Crear `app/compras/rutas/nueva/RutaCompraBuilder.tsx` con:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { Plus, Trash2, Check, X, Route } from 'lucide-react'

interface Opt { id: number; nombre: string }

interface Linea {
  descripcion: string
  cantidad: string
  unidad: string
  proyectoId: string
  proveedorId: string
  proveedorTexto: string
  urgencia: string
  precioEstimado: string
}

function lineaVacia(): Linea {
  return { descripcion: '', cantidad: '1', unidad: 'ud', proyectoId: '', proveedorId: '', proveedorTexto: '', urgencia: 'media', precioEstimado: '' }
}

export function RutaCompraBuilder({ proveedores, proyectos }: { proveedores: Opt[]; proyectos: Opt[] }) {
  const router = useRouter()
  const toast = useToast()
  const [titulo, setTitulo] = useState('')
  const [comprador, setComprador] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [lineas, setLineas] = useState<Linea[]>([lineaVacia()])
  const [submitting, setSubmitting] = useState(false)

  function updateLinea(i: number, patch: Partial<Linea>) {
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function addLinea() { setLineas((ls) => [...ls, lineaVacia()]) }
  function removeLinea(i: number) { setLineas((ls) => ls.filter((_, idx) => idx !== i)) }

  async function handleSave() {
    const items = lineas
      .filter((l) => l.descripcion.trim())
      .map((l) => ({
        descripcion: l.descripcion.trim(),
        cantidad: l.cantidad,
        unidad: l.unidad,
        proyectoId: l.proyectoId || null,
        proveedorId: l.proveedorId || null,
        proveedorTexto: l.proveedorId ? '' : l.proveedorTexto.trim(),
        urgencia: l.urgencia,
        precioEstimado: l.precioEstimado || null,
      }))

    if (items.length === 0) { toast.error('Agrega al menos un material'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/compras/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, comprador, fecha, items }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error')
      const { id } = await res.json()
      router.push(`/compras/rutas/${id}`)
    } catch {
      toast.error('Error al crear la ruta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Route className="w-6 h-6 text-blue-600" /> Nueva Ruta de Compra
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border border-border rounded-xl bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">Título (opcional)</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ej: Compras martes AM" className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Comprador</Label>
          <Input value={comprador} onChange={(e) => setComprador(e.target.value)} placeholder="Nombre del chofer/comprador" className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Material</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-20">Cant.</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-20">Unidad</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-40">Proyecto</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-44">Suplidor</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-28">Urgencia</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground w-28">Precio est.</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lineas.map((l, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><Input value={l.descripcion} onChange={(e) => updateLinea(i, { descripcion: e.target.value })} placeholder="Material" className="h-8 text-sm" /></td>
                <td className="px-3 py-2"><Input type="number" step="0.01" value={l.cantidad} onChange={(e) => updateLinea(i, { cantidad: e.target.value })} className="h-8 text-sm" /></td>
                <td className="px-3 py-2"><Input value={l.unidad} onChange={(e) => updateLinea(i, { unidad: e.target.value })} className="h-8 text-sm" /></td>
                <td className="px-3 py-2">
                  <select value={l.proyectoId} onChange={(e) => updateLinea(i, { proyectoId: e.target.value })} className="w-full h-8 text-sm border border-border rounded-md px-2 bg-card">
                    <option value="">— Ninguno —</option>
                    {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select value={l.proveedorId} onChange={(e) => updateLinea(i, { proveedorId: e.target.value })} className="w-full h-8 text-sm border border-border rounded-md px-2 bg-card">
                    <option value="">— Texto libre —</option>
                    {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  {!l.proveedorId && (
                    <Input value={l.proveedorTexto} onChange={(e) => updateLinea(i, { proveedorTexto: e.target.value })} placeholder="Suplidor..." className="h-8 text-sm mt-1" />
                  )}
                </td>
                <td className="px-3 py-2">
                  <select value={l.urgencia} onChange={(e) => updateLinea(i, { urgencia: e.target.value })} className="w-full h-8 text-sm border border-border rounded-md px-2 bg-card">
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </td>
                <td className="px-3 py-2"><Input type="number" step="0.01" value={l.precioEstimado} onChange={(e) => updateLinea(i, { precioEstimado: e.target.value })} className="h-8 text-sm text-right" /></td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => removeLinea(i)} className="p-1 text-muted-foreground hover:text-red-600" title="Eliminar línea"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={addLinea}><Plus className="w-4 h-4" /> Agregar línea</Button>
        <div className="flex-1" />
        <Button size="sm" onClick={handleSave} disabled={submitting}><Check className="w-4 h-4" /> {submitting ? 'Guardando...' : 'Guardar ruta'}</Button>
        <Button variant="secondary" size="sm" onClick={() => router.push('/compras/rutas')}><X className="w-4 h-4" /> Cancelar</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar compilación + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errores.

- [ ] **Step 4: Verificar en navegador**

Navegar a `/compras/rutas/nueva`. Llenar título, agregar 2-3 líneas (una con proveedor del catálogo, otra con texto libre, distintos proyectos/urgencias) y guardar. Expected: redirige a `/compras/rutas/<id>` (mostrará el detalle al completar Task 8). Verificar que la ruta aparece en `/compras/rutas`.

- [ ] **Step 5: Commit**

```bash
git add app/compras/rutas/nueva/page.tsx app/compras/rutas/nueva/RutaCompraBuilder.tsx
git commit -m "feat(ruta-compra): builder para crear rutas"
```

---

## Task 8: Detalle en vivo (agrupado por suplidor)

**Files:**
- Create: `app/compras/rutas/[id]/page.tsx`
- Create: `app/compras/rutas/[id]/RutaCompraDetail.tsx`

- [ ] **Step 1: Crear el server component de detalle**

Crear `app/compras/rutas/[id]/page.tsx` con:

```tsx
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { RutaCompraDetail } from './RutaCompraDetail'

export default async function RutaCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rutaId = parseInt(id)
  if (isNaN(rutaId)) notFound()

  const ruta = await prisma.rutaCompra.findUnique({
    where: { id: rutaId },
    include: {
      items: {
        orderBy: { orden: 'asc' },
        include: {
          proveedor: { select: { id: true, nombre: true, direccion: true, telefono: true } },
          proyecto: { select: { id: true, nombre: true } },
        },
      },
    },
  })

  if (!ruta) notFound()

  return <RutaCompraDetail rutaInicial={JSON.parse(JSON.stringify(ruta))} />
}
```

- [ ] **Step 2: Crear el client component de detalle**

Crear `app/compras/rutas/[id]/RutaCompraDetail.tsx` con:

```tsx
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Route, MapPin, Phone, Printer, Building2, Check } from 'lucide-react'

interface Item {
  id: number
  descripcion: string
  cantidad: number
  unidad: string
  urgencia: string
  precioEstimado: number | null
  precioReal: number | null
  comprado: boolean
  proveedorId: number | null
  proveedorTexto: string | null
  proveedor: { id: number; nombre: string; direccion: string | null; telefono: string | null } | null
  proyecto: { id: number; nombre: string } | null
}

interface Ruta {
  id: number
  codigo: string
  titulo: string | null
  fecha: string
  estado: string
  comprador: string | null
  notas: string | null
  items: Item[]
}

const URGENCIA_BADGE: Record<string, string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  baja: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

const ESTADOS = ['borrador', 'en_proceso', 'completada', 'cancelada']
const ESTADO_LABEL: Record<string, string> = { borrador: 'Borrador', en_proceso: 'En proceso', completada: 'Completada', cancelada: 'Cancelada' }

function fmt(v: number) {
  return `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function paradaKey(it: Item) {
  if (it.proveedorId) return `id:${it.proveedorId}`
  if (it.proveedorTexto) return `t:${it.proveedorTexto}`
  return 'sin'
}

export function RutaCompraDetail({ rutaInicial }: { rutaInicial: Ruta }) {
  const router = useRouter()
  const toast = useToast()
  const [items, setItems] = useState<Item[]>(rutaInicial.items)
  const [estado, setEstado] = useState(rutaInicial.estado)

  // Agrupar items por suplidor (parada)
  const paradas = useMemo(() => {
    const map = new Map<string, { nombre: string; direccion: string | null; telefono: string | null; items: Item[] }>()
    for (const it of items) {
      const key = paradaKey(it)
      if (!map.has(key)) {
        map.set(key, {
          nombre: it.proveedor?.nombre || it.proveedorTexto || 'Sin suplidor asignado',
          direccion: it.proveedor?.direccion || null,
          telefono: it.proveedor?.telefono || null,
          items: [],
        })
      }
      map.get(key)!.items.push(it)
    }
    return Array.from(map.values())
  }, [items])

  const totalEstimado = items.reduce((s, i) => s + (i.precioEstimado ?? 0), 0)
  const totalReal = items.reduce((s, i) => s + (i.precioReal ?? 0), 0)
  const comprados = items.filter((i) => i.comprado).length

  async function patchItem(itemId: number, patch: { comprado?: boolean; precioReal?: number | null }) {
    setItems((its) => its.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))
    try {
      const res = await fetch(`/api/compras/rutas/${rutaInicial.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('No se pudo guardar el cambio')
    }
  }

  async function cambiarEstado(nuevo: string) {
    setEstado(nuevo)
    try {
      const res = await fetch(`/api/compras/rutas/${rutaInicial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevo, items: items.map((i) => ({ ...i, proyectoId: i.proyecto?.id ?? null })) }),
      })
      if (!res.ok) throw new Error()
      toast.success('Estado actualizado')
    } catch {
      toast.error('No se pudo cambiar el estado')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Route className="w-6 h-6 text-blue-600" /> {rutaInicial.codigo}
          </h1>
          {rutaInicial.titulo && <p className="text-sm text-muted-foreground mt-1">{rutaInicial.titulo}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(rutaInicial.fecha).toLocaleDateString('es-DO')}
            {rutaInicial.comprador && ` · Comprador: ${rutaInicial.comprador}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={estado} onChange={(e) => cambiarEstado(e.target.value)} className="h-9 text-sm border border-border rounded-md px-3 bg-card">
            {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
          </select>
          <Button variant="secondary" size="sm" onClick={() => window.open(`/compras/rutas/${rutaInicial.id}/imprimir`, '_blank')}>
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-border rounded-xl p-3 bg-card"><p className="text-xs text-muted-foreground">Paradas</p><p className="text-xl font-bold text-foreground">{paradas.length}</p></div>
        <div className="border border-border rounded-xl p-3 bg-card"><p className="text-xs text-muted-foreground">Comprados</p><p className="text-xl font-bold text-foreground">{comprados}/{items.length}</p></div>
        <div className="border border-border rounded-xl p-3 bg-card"><p className="text-xs text-muted-foreground">Estimado</p><p className="text-xl font-bold text-muted-foreground">{fmt(totalEstimado)}</p></div>
        <div className="border border-border rounded-xl p-3 bg-card"><p className="text-xs text-muted-foreground">Real</p><p className="text-xl font-bold text-green-600">{fmt(totalReal)}</p></div>
      </div>

      {paradas.map((parada, pi) => {
        const subEst = parada.items.reduce((s, i) => s + (i.precioEstimado ?? 0), 0)
        const subReal = parada.items.reduce((s, i) => s + (i.precioReal ?? 0), 0)
        return (
          <div key={pi} className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 font-semibold text-foreground"><MapPin className="w-4 h-4 text-blue-600" /> {parada.nombre}</div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                {parada.direccion && <span>{parada.direccion}</span>}
                {parada.telefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {parada.telefono}</span>}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-center w-10">✓</th>
                  <th className="px-3 py-2 text-left">Material</th>
                  <th className="px-3 py-2 text-left w-36">Proyecto</th>
                  <th className="px-3 py-2 text-center w-20">Cant.</th>
                  <th className="px-3 py-2 text-center w-20">Urgencia</th>
                  <th className="px-3 py-2 text-right w-28">Estimado</th>
                  <th className="px-3 py-2 text-right w-32">Precio real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parada.items.map((it) => (
                  <tr key={it.id} className={it.comprado ? 'bg-green-50/50 dark:bg-green-900/10' : ''}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={it.comprado} onChange={(e) => patchItem(it.id, { comprado: e.target.checked })} className="w-4 h-4 accent-green-600" />
                    </td>
                    <td className="px-3 py-2 text-foreground font-medium">{it.descripcion}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{it.proyecto ? <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{it.proyecto.nombre}</span> : '—'}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{it.cantidad} {it.unidad}</td>
                    <td className="px-3 py-2 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${URGENCIA_BADGE[it.urgencia] || URGENCIA_BADGE.media}`}>{it.urgencia}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{it.precioEstimado != null ? fmt(it.precioEstimado) : '—'}</td>
                    <td className="px-3 py-2">
                      <Input type="number" step="0.01" defaultValue={it.precioReal ?? ''} onBlur={(e) => patchItem(it.id, { precioReal: e.target.value === '' ? null : parseFloat(e.target.value) })} className="h-8 text-sm text-right" placeholder="0.00" />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border text-xs">
                  <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground font-medium">Subtotal parada:</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmt(subEst)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">{fmt(subReal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      })}

      <div className="flex">
        <Button variant="secondary" size="sm" onClick={() => router.push('/compras/rutas')}>Volver a rutas</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar compilación + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errores.

- [ ] **Step 4: Verificar en navegador**

Abrir la ruta creada en Task 7. Expected: los materiales aparecen **agrupados por suplidor**, con dirección/teléfono cuando el suplidor es del catálogo. Marcar un checkbox "comprado" → la fila se resalta y persiste (recargar la página y sigue marcado). Escribir un precio real y hacer blur → persiste. Cambiar el estado en el `select` → toast de confirmación. Las KPIs de arriba reflejan paradas/comprados/totales.

- [ ] **Step 5: Commit**

```bash
git add app/compras/rutas/[id]/page.tsx app/compras/rutas/[id]/RutaCompraDetail.tsx
git commit -m "feat(ruta-compra): detalle en vivo agrupado por suplidor"
```

---

## Task 9: Vista imprimible (A4, sin shell)

**Files:**
- Create: `app/compras/rutas/[id]/imprimir/page.tsx`
- Create: `app/compras/rutas/[id]/imprimir/PrintButton.tsx`

Nota: las rutas `*/imprimir` se renderizan sin sidebar gracias a `AppLayout` (ver CLAUDE.md → "Rutas shell-free"). No requiere configuración extra.

- [ ] **Step 1: Crear el PrintButton (client)**

Crear `app/compras/rutas/[id]/imprimir/PrintButton.tsx` con:

```tsx
'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
      <Printer className="w-4 h-4" /> Imprimir
    </button>
  )
}
```

- [ ] **Step 2: Crear el server component imprimible**

Crear `app/compras/rutas/[id]/imprimir/page.tsx` con:

```tsx
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PrintButton } from './PrintButton'

interface ItemImpr {
  id: number
  descripcion: string
  cantidad: number
  unidad: string
  urgencia: string
  precioEstimado: number | null
  proveedorId: number | null
  proveedorTexto: string | null
  proveedor: { nombre: string; direccion: string | null; telefono: string | null } | null
  proyecto: { nombre: string } | null
}

function fmt(v: number) {
  return `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
}

export default async function ImprimirRutaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rutaId = parseInt(id)
  if (isNaN(rutaId)) notFound()

  const ruta = await prisma.rutaCompra.findUnique({
    where: { id: rutaId },
    include: {
      items: {
        orderBy: { orden: 'asc' },
        include: {
          proveedor: { select: { nombre: true, direccion: true, telefono: true } },
          proyecto: { select: { nombre: true } },
        },
      },
    },
  })

  if (!ruta) notFound()

  // Agrupar por suplidor
  const map = new Map<string, { nombre: string; direccion: string | null; telefono: string | null; items: ItemImpr[] }>()
  for (const it of ruta.items as ItemImpr[]) {
    const key = it.proveedorId ? `id:${it.proveedorId}` : it.proveedorTexto ? `t:${it.proveedorTexto}` : 'sin'
    if (!map.has(key)) {
      map.set(key, { nombre: it.proveedor?.nombre || it.proveedorTexto || 'Sin suplidor asignado', direccion: it.proveedor?.direccion || null, telefono: it.proveedor?.telefono || null, items: [] })
    }
    map.get(key)!.items.push(it)
  }
  const paradas = Array.from(map.values())
  const totalEstimado = (ruta.items as ItemImpr[]).reduce((s, i) => s + (i.precioEstimado ?? 0), 0)
  const fecha = new Date(ruta.fecha).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-3">
        <PrintButton />
        <a href={`/compras/rutas/${ruta.id}`} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors shadow-sm">Volver</a>
      </div>

      <div className="max-w-[800px] mx-auto p-8 print:p-4 print:max-w-none">
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ruta de Compra</h1>
              {ruta.titulo && <p className="text-gray-600 mt-1">{ruta.titulo}</p>}
            </div>
            <div className="text-right text-sm text-gray-600">
              <p className="font-mono font-bold text-gray-900">{ruta.codigo}</p>
              <p>Fecha: {fecha}</p>
              {ruta.comprador && <p>Comprador: {ruta.comprador}</p>}
            </div>
          </div>
        </div>

        {paradas.map((parada, pi) => {
          const sub = parada.items.reduce((s, i) => s + (i.precioEstimado ?? 0), 0)
          return (
            <div key={pi} className="mb-6">
              <div className="border-b border-gray-300 pb-1 mb-2">
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{pi + 1}. {parada.nombre}</h2>
                <p className="text-xs text-gray-500">{[parada.direccion, parada.telefono].filter(Boolean).join(' · ')}</p>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-600">
                    <th className="text-center py-1.5 font-medium w-8">✓</th>
                    <th className="text-left py-1.5 font-medium">Material</th>
                    <th className="text-left py-1.5 font-medium">Proyecto</th>
                    <th className="text-center py-1.5 font-medium">Urg.</th>
                    <th className="text-center py-1.5 font-medium">Cant.</th>
                    <th className="text-right py-1.5 font-medium">Estimado</th>
                    <th className="text-right py-1.5 font-medium w-28">Precio real</th>
                  </tr>
                </thead>
                <tbody>
                  {parada.items.map((it) => (
                    <tr key={it.id} className="border-b border-gray-100">
                      <td className="py-1.5 text-center"><div className="w-4 h-4 border border-gray-400 rounded mx-auto" /></td>
                      <td className="py-1.5 text-gray-800 font-medium">{it.descripcion}</td>
                      <td className="py-1.5 text-gray-500">{it.proyecto?.nombre || '-'}</td>
                      <td className="py-1.5 text-center text-gray-500">{it.urgencia}</td>
                      <td className="py-1.5 text-center text-gray-800">{it.cantidad} {it.unidad}</td>
                      <td className="py-1.5 text-right text-gray-500">{it.precioEstimado != null ? fmt(it.precioEstimado) : '-'}</td>
                      <td className="py-1.5 text-right text-gray-300">_________</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-300">
                    <td colSpan={5} className="py-1.5 text-right text-gray-500 text-xs font-medium">Subtotal estimado:</td>
                    <td className="py-1.5 text-right font-bold text-gray-800">{fmt(sub)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })}

        <div className="border-t-2 border-gray-800 mt-6 pt-4 flex justify-between items-center">
          <span className="text-sm text-gray-600">{ruta.items.length} materiales · {paradas.length} paradas</span>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase">Total Estimado</p>
            <p className="text-xl font-bold text-gray-900">{fmt(totalEstimado)}</p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8">
          <div><div className="border-b border-gray-400 mb-1 h-8" /><p className="text-xs text-gray-500 text-center">Firma del Comprador</p></div>
          <div><div className="border-b border-gray-400 mb-1 h-8" /><p className="text-xs text-gray-500 text-center">Recibido</p></div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 15mm; size: letter; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 3: Verificar compilación + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errores.

- [ ] **Step 4: Verificar en navegador**

Abrir `/compras/rutas/<id>/imprimir` (o el botón "Imprimir" del detalle). Expected: hoja A4 **sin sidebar**, materiales agrupados por suplidor con checkboxes vacíos, columna "Precio real" en blanco para llenar a mano, subtotales por parada, total estimado y líneas de firma. El botón "Imprimir" abre el diálogo de impresión; los botones flotantes no salen en el PDF (`print:hidden`).

- [ ] **Step 5: Commit**

```bash
git add app/compras/rutas/[id]/imprimir/page.tsx app/compras/rutas/[id]/imprimir/PrintButton.tsx
git commit -m "feat(ruta-compra): vista imprimible A4 agrupada por suplidor"
```

---

## Task 10: Verificación final

- [ ] **Step 1: Gates completos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npm run lint`
Expected: 0 errores (warnings preexistentes son deuda conocida, no bloquean).

Run: `npm run build`
Expected: build completa. (Ignorar el error conocido de Prisma en prerender, ver memoria del proyecto.)

- [ ] **Step 2: Recorrido funcional de extremo a extremo**

Con `npm run dev`:
1. `/compras/rutas` → "Nueva ruta".
2. Crear ruta con ≥3 materiales en ≥2 suplidores distintos (uno del catálogo con dirección, uno texto libre), distintos proyectos y urgencias.
3. En el detalle: confirmar agrupación por suplidor, marcar comprados, anotar precios reales, ver totales actualizarse, cambiar estado a "completada".
4. Recargar → los cambios persisten.
5. Abrir imprimible → verificar formato A4 sin shell.
6. Volver a `/compras/rutas` → la ruta muestra estado, paradas, items y totales correctos.

- [ ] **Step 3: Commit final (si quedaron ajustes)**

```bash
git add -A
git commit -m "chore(ruta-compra): verificación final del módulo"
```

---

## Self-Review (cobertura del spec)

- ✅ Modelo `RutaCompra` + `ItemRutaCompra` independiente → Task 1.
- ✅ Lista manual multi-proyecto / multi-suplidor / urgencia por línea → Tasks 1, 7.
- ✅ Suplidor desde catálogo `Proveedor` + fallback texto libre → Tasks 1, 7, 8.
- ✅ Numeración `RC-YYYY-NNNN` con patrón MAX → Task 2.
- ✅ Pantalla lista → Task 6. Builder → Task 7. Detalle en vivo agrupado por suplidor → Task 8. Imprimible A4 sin shell → Task 9.
- ✅ Marcar comprado + precio real en vivo (PATCH ligero) → Tasks 4, 8.
- ✅ Estados borrador/en_proceso/completada/cancelada → Tasks 3, 8.
- ✅ Integración en FinanzasNav → Task 5.
- ✅ Permisos vía `compras` existente → todas las rutas API.
- ✅ Sin tocar gastos (solo informativo); recepción de materiales fuera de alcance → no hay tarea (correcto).
- ✅ Gates de verificación → Task 10.
