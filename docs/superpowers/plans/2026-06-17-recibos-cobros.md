# Recibos de cobro — Implementation Plan (Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el modelo pago-atado-a-factura (`PagoFactura`) en el lado **ingreso** por **Recibo + Aplicación**, de modo que el dinero que entra se registre como recibo (incluidos anticipos) y se reparta sobre una o varias facturas.

**Architecture:** Nuevo modelo `Recibo` (dinero recibido) + `AplicacionRecibo` (reparto N..N a facturas). `Factura.montoPagado`/`estado` se conservan pero se recalculan desde las aplicaciones. Migración 1:1 de los `PagoFactura` de ingreso. El Informe Económico pasa a contar recibos. Egresos siguen con `PagoFactura` sin tocar.

**Tech Stack:** Next.js 16 (App Router), Prisma 5 + SQLite (dev), TypeScript, Tailwind/shadcn. Sin suite de tests: verificación con `npx tsc --noEmit`, `npm run lint`, `npm run build` y checks manuales en navegador. Para lógica pura se usa un script node de sanity.

**Spec:** `docs/superpowers/specs/2026-06-17-recibos-cobros-design.md`

---

## File Structure

- `prisma/schema.prisma` — **modificar**: añadir `Recibo`, `AplicacionRecibo`, `MovimientoBancario.reciboId`, y relaciones inversas en `Cliente`, `Factura`, `CuentaBancaria`.
- `lib/recibos.ts` — **crear**: lógica pura (estado, siguiente número, validación de aplicaciones) + helper de recálculo de factura (recibe `tx`).
- `prisma/migrate-recibos.ts` — **crear**: script de migración PagoFactura(ingreso) → Recibo + Aplicación.
- `app/api/cobros/recibos/route.ts` — **crear**: `POST` (crear + aplicar) y `GET` (listar).
- `app/api/cobros/recibos/[id]/route.ts` — **crear**: `GET` detalle.
- `app/api/cobros/recibos/[id]/aplicar/route.ts` — **crear**: `POST` aplicar saldo a cuenta.
- `app/api/cobros/recibos/[id]/anular/route.ts` — **crear**: `POST` anular + revertir.
- `lib/informe-economico-data.ts` — **modificar**: fuente de ingreso = `Recibo`; atribución por proyecto vía aplicaciones.
- `components/contabilidad/RecibosTab.tsx` — **crear**: lista + formulario de recibo en Cobros.
- `app/facturacion/page.tsx` / `FacturacionClient.tsx` — **modificar**: montar la pestaña Recibos.
- `components/contabilidad/FacturaDetalle.tsx` — **modificar**: "registrar pago" → "registrar/aplicar cobro" (recibo).

---

## Task 1: Schema — modelos Recibo y AplicacionRecibo

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Añadir los modelos y relaciones**

En `prisma/schema.prisma`, al final del bloque de finanzas (después de `model MovimientoBancario`), añadir:

```prisma
model Recibo {
  id               Int      @id @default(autoincrement())
  numero           String   @unique           // REC-2026-0001
  clienteId        Int
  fecha            DateTime
  monto            Float
  metodoPago       String   @default("Transferencia")
  cuentaBancariaId Int?
  referencia       String?
  observaciones    String?
  montoAplicado    Float    @default(0)        // derivado: suma de aplicaciones
  estado           String   @default("sin_aplicar") // sin_aplicar|parcial|aplicado|anulado
  createdBy        Int?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  cliente        Cliente            @relation(fields: [clienteId], references: [id], onDelete: Restrict)
  cuentaBancaria CuentaBancaria?    @relation(fields: [cuentaBancariaId], references: [id], onDelete: SetNull)
  aplicaciones   AplicacionRecibo[]
  movimientos    MovimientoBancario[]

  @@index([clienteId])
  @@index([estado])
  @@index([fecha])
  @@map("recibo")
}

model AplicacionRecibo {
  id        Int      @id @default(autoincrement())
  reciboId  Int
  facturaId Int
  monto     Float
  createdAt DateTime @default(now())

  recibo  Recibo  @relation(fields: [reciboId], references: [id], onDelete: Cascade)
  factura Factura @relation(fields: [facturaId], references: [id], onDelete: Cascade)

  @@unique([reciboId, facturaId])
  @@index([facturaId])
  @@map("aplicacion_recibo")
}
```

- [ ] **Step 2: Añadir las relaciones inversas y `reciboId` en modelos existentes**

En `model Cliente` añadir dentro del bloque de relaciones:
```prisma
  recibos          Recibo[]
```
En `model Factura` añadir:
```prisma
  aplicaciones     AplicacionRecibo[]
```
En `model CuentaBancaria` añadir:
```prisma
  recibos          Recibo[]
```
En `model MovimientoBancario` añadir el campo y la relación (junto a `facturaId`/`factura`):
```prisma
  reciboId         Int?
  recibo           Recibo?   @relation(fields: [reciboId], references: [id], onDelete: SetNull)
```

- [ ] **Step 3: Sincronizar el schema y regenerar el cliente**

Run: `npm run db:push`
Expected: "Your database is now in sync with your Prisma schema" y `Generated Prisma Client`.

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: exit 0 (sin errores). El cliente Prisma ahora conoce `prisma.recibo` y `prisma.aplicacionRecibo`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recibos): modelos Recibo y AplicacionRecibo + relaciones"
```

---

## Task 2: lib/recibos.ts — lógica pura + recálculo de factura

**Files:**
- Create: `lib/recibos.ts`
- Create (temporal): `scripts/_sanity-recibos.mjs` (sanity check, se borra al final del task)

- [ ] **Step 1: Crear `lib/recibos.ts`**

```ts
// lib/recibos.ts
// Lógica de recibos de cobro. Las funciones puras (estado, numeración,
// validación) no tocan Prisma; recalcularFactura recibe el client/tx.

import type { Prisma, PrismaClient } from '@prisma/client'

const EPS = 0.01

// ── Estado del recibo según monto aplicado ──────────────────────────────
export function estadoRecibo(monto: number, montoAplicado: number): string {
  if (montoAplicado <= EPS) return 'sin_aplicar'
  if (montoAplicado >= monto - EPS) return 'aplicado'
  return 'parcial'
}

// ── Estado de la factura según lo pagado ────────────────────────────────
export function estadoFactura(total: number, montoPagado: number): string {
  if (montoPagado >= total - EPS) return 'pagada'
  if (montoPagado > EPS) return 'parcial'
  return 'pendiente'
}

// ── Siguiente número REC-YYYY-NNNN dado el máximo del año ────────────────
// ultimoNumero: el numero REC más alto del año (o null si no hay).
export function siguienteNumeroRecibo(ultimoNumero: string | null, anio: number): string {
  let n = 0
  if (ultimoNumero) {
    const m = ultimoNumero.match(/REC-\d{4}-(\d+)/)
    if (m) n = parseInt(m[1], 10)
  }
  return `REC-${anio}-${String(n + 1).padStart(4, '0')}`
}

// ── Validación de una lista de aplicaciones de un recibo ─────────────────
export interface AplicacionInput { facturaId: number; monto: number }
export interface FacturaSaldo { id: number; total: number; montoPagado: number; estado: string }

/**
 * Valida que las aplicaciones no excedan el monto del recibo ni el saldo de
 * cada factura. Devuelve lista de errores (vacía = ok).
 */
export function validarAplicaciones(
  montoRecibo: number,
  aplicaciones: AplicacionInput[],
  facturas: Map<number, FacturaSaldo>,
): string[] {
  const errores: string[] = []
  let suma = 0
  const porFactura = new Map<number, number>()
  for (const a of aplicaciones) {
    if (!(a.monto > 0)) { errores.push(`Aplicación a factura ${a.facturaId}: monto debe ser > 0`); continue }
    const f = facturas.get(a.facturaId)
    if (!f) { errores.push(`Factura ${a.facturaId} no encontrada`); continue }
    if (f.estado === 'anulada') { errores.push(`Factura ${a.facturaId} está anulada`); continue }
    suma += a.monto
    porFactura.set(a.facturaId, (porFactura.get(a.facturaId) ?? 0) + a.monto)
  }
  if (suma > montoRecibo + EPS) {
    errores.push(`Las aplicaciones (${suma.toFixed(2)}) exceden el monto del recibo (${montoRecibo.toFixed(2)})`)
  }
  for (const [facturaId, aplicado] of porFactura) {
    const f = facturas.get(facturaId)!
    const saldo = f.total - f.montoPagado
    if (aplicado > saldo + EPS) {
      errores.push(`Factura ${facturaId}: aplicado ${aplicado.toFixed(2)} excede su saldo (${saldo.toFixed(2)})`)
    }
  }
  return errores
}

// ── Recálculo de una factura desde sus aplicaciones (server, dentro de tx) ─
type Tx = PrismaClient | Prisma.TransactionClient

export async function recalcularFactura(tx: Tx, facturaId: number): Promise<void> {
  const factura = await tx.factura.findUnique({ where: { id: facturaId }, select: { total: true } })
  if (!factura) return
  const agg = await tx.aplicacionRecibo.aggregate({ where: { facturaId }, _sum: { monto: true } })
  const montoPagado = agg._sum.monto ?? 0
  await tx.factura.update({
    where: { id: facturaId },
    data: { montoPagado, estado: estadoFactura(factura.total, montoPagado) },
  })
}

// ── Recálculo del estado/aplicado de un recibo (server, dentro de tx) ─────
export async function recalcularRecibo(tx: Tx, reciboId: number): Promise<void> {
  const recibo = await tx.recibo.findUnique({ where: { id: reciboId }, select: { monto: true, estado: true } })
  if (!recibo || recibo.estado === 'anulado') return
  const agg = await tx.aplicacionRecibo.aggregate({ where: { reciboId }, _sum: { monto: true } })
  const montoAplicado = agg._sum.monto ?? 0
  await tx.recibo.update({
    where: { id: reciboId },
    data: { montoAplicado, estado: estadoRecibo(recibo.monto, montoAplicado) },
  })
}
```

- [ ] **Step 2: Sanity check de las funciones puras**

Crear `scripts/_sanity-recibos.mjs`:
```js
import { estadoRecibo, estadoFactura, siguienteNumeroRecibo, validarAplicaciones } from '../lib/recibos.ts'
```
Como el proyecto no transpila `.ts` con node directo, en su lugar verificamos por inspección + tsc. Borra el archivo si lo creaste:
```bash
rm -f scripts/_sanity-recibos.mjs
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/recibos.ts
git commit -m "feat(recibos): lib pura (estado, numeracion, validacion, recalculo)"
```

---

## Task 3: API crear y listar recibos

**Files:**
- Create: `app/api/cobros/recibos/route.ts`

- [ ] **Step 1: Implementar `POST` (crear + aplicar) y `GET` (listar)**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'
import {
  siguienteNumeroRecibo, validarAplicaciones, recalcularFactura,
  estadoRecibo, type AplicacionInput, type FacturaSaldo,
} from '@/lib/recibos'

export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied
  const sp = request.nextUrl.searchParams
  const where: Record<string, unknown> = {}
  const estado = sp.get('estado'); if (estado) where.estado = estado
  const clienteId = sp.get('clienteId'); if (clienteId) where.clienteId = parseInt(clienteId)
  const desde = sp.get('desde'); const hasta = sp.get('hasta')
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde + 'T00:00:00') } : {}),
      ...(hasta ? { lte: new Date(hasta + 'T23:59:59') } : {}),
    }
  }
  const recibos = await prisma.recibo.findMany({
    where,
    include: {
      cliente: { select: { id: true, nombre: true } },
      cuentaBancaria: { select: { id: true, nombre: true } },
      _count: { select: { aplicaciones: true } },
    },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
  })
  return NextResponse.json(recibos)
}

export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied
  const userId = request.headers.get('x-user-id')
  const createdBy = userId ? parseInt(userId) : null

  const body = await request.json().catch(() => null)
  const clienteId = parseInt(String(body?.clienteId))
  const monto = parseFloat(String(body?.monto))
  if (!clienteId || isNaN(clienteId)) return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 })
  if (!(monto > 0)) return NextResponse.json({ error: 'Monto debe ser mayor a 0' }, { status: 400 })

  const aplicaciones: AplicacionInput[] = Array.isArray(body?.aplicaciones)
    ? body.aplicaciones.map((a: { facturaId: number; monto: number }) => ({ facturaId: Number(a.facturaId), monto: Number(a.monto) }))
    : []

  // Validar aplicaciones contra saldos reales
  if (aplicaciones.length > 0) {
    const facturas = await prisma.factura.findMany({
      where: { id: { in: aplicaciones.map(a => a.facturaId) }, tipo: 'ingreso' },
      select: { id: true, total: true, montoPagado: true, estado: true, proyectoId: true },
    })
    const map = new Map<number, FacturaSaldo>(facturas.map(f => [f.id, f]))
    const errores = validarAplicaciones(monto, aplicaciones, map)
    if (errores.length) return NextResponse.json({ error: errores.join(' · ') }, { status: 400 })
    // Bloquear si alguna factura es de proyecto cerrado
    for (const f of facturas) {
      const cerrado = await validarProyectoNoCerrado(f.proyectoId)
      if (cerrado) return cerrado
    }
  }

  const fecha = new Date(body?.fecha || Date.now())
  const cuentaBancariaId = body?.cuentaBancariaId ? parseInt(String(body.cuentaBancariaId)) : null

  const result = await prisma.$transaction(async (tx) => {
    const anio = fecha.getFullYear()
    const ultimo = await tx.recibo.findFirst({
      where: { numero: { startsWith: `REC-${anio}-` } },
      orderBy: { numero: 'desc' }, select: { numero: true },
    })
    const numero = siguienteNumeroRecibo(ultimo?.numero ?? null, anio)
    const montoAplicado = aplicaciones.reduce((s, a) => s + a.monto, 0)

    const recibo = await tx.recibo.create({
      data: {
        numero, clienteId, fecha, monto,
        metodoPago: body?.metodoPago || 'Transferencia',
        cuentaBancariaId, referencia: body?.referencia || null,
        observaciones: body?.observaciones || null,
        montoAplicado, estado: estadoRecibo(monto, montoAplicado), createdBy,
      },
    })

    for (const a of aplicaciones) {
      await tx.aplicacionRecibo.create({ data: { reciboId: recibo.id, facturaId: a.facturaId, monto: a.monto } })
      await recalcularFactura(tx, a.facturaId)
    }

    if (cuentaBancariaId) {
      await tx.movimientoBancario.create({
        data: {
          cuentaBancariaId, fecha, tipo: 'credito', monto,
          descripcion: `Recibo ${numero}`, referencia: body?.referencia || null,
          conciliado: true, reciboId: recibo.id,
        },
      })
    }
    return recibo
  })

  return NextResponse.json(result, { status: 201 })
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc exit 0; lint 0 errors.

- [ ] **Step 3: Verificar build de la ruta**

Run: `npm run build 2>&1 | grep "api/cobros/recibos"`
Expected: aparece `ƒ /api/cobros/recibos` (compila). Ignorar el error Prisma de prerender.

- [ ] **Step 4: Commit**

```bash
git add app/api/cobros/recibos/route.ts
git commit -m "feat(recibos): API crear (con aplicaciones) y listar recibos"
```

---

## Task 4: API detalle, aplicar y anular

**Files:**
- Create: `app/api/cobros/recibos/[id]/route.ts`
- Create: `app/api/cobros/recibos/[id]/aplicar/route.ts`
- Create: `app/api/cobros/recibos/[id]/anular/route.ts`

- [ ] **Step 1: Detalle `GET /api/cobros/recibos/[id]`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied
  const id = parseInt((await params).id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  const recibo = await prisma.recibo.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nombre: true } },
      cuentaBancaria: { select: { id: true, nombre: true } },
      aplicaciones: { include: { factura: { select: { id: true, numero: true, total: true, montoPagado: true } } } },
    },
  })
  if (!recibo) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 })
  return NextResponse.json(recibo)
}
```

- [ ] **Step 2: Aplicar `POST /api/cobros/recibos/[id]/aplicar`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'
import { validarAplicaciones, recalcularFactura, recalcularRecibo, type AplicacionInput, type FacturaSaldo } from '@/lib/recibos'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied
  const id = parseInt((await params).id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const recibo = await prisma.recibo.findUnique({ where: { id }, include: { aplicaciones: true } })
  if (!recibo) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 })
  if (recibo.estado === 'anulado') return NextResponse.json({ error: 'Recibo anulado' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const nuevas: AplicacionInput[] = Array.isArray(body?.aplicaciones)
    ? body.aplicaciones.map((a: { facturaId: number; monto: number }) => ({ facturaId: Number(a.facturaId), monto: Number(a.monto) }))
    : []
  if (nuevas.length === 0) return NextResponse.json({ error: 'No hay aplicaciones' }, { status: 400 })

  // El monto disponible del recibo es monto - lo ya aplicado
  const disponible = recibo.monto - recibo.montoAplicado
  const facturas = await prisma.factura.findMany({
    where: { id: { in: nuevas.map(a => a.facturaId) }, tipo: 'ingreso' },
    select: { id: true, total: true, montoPagado: true, estado: true, proyectoId: true },
  })
  const map = new Map<number, FacturaSaldo>(facturas.map(f => [f.id, f]))
  const errores = validarAplicaciones(disponible, nuevas, map)
  if (errores.length) return NextResponse.json({ error: errores.join(' · ') }, { status: 400 })
  for (const f of facturas) {
    const cerrado = await validarProyectoNoCerrado(f.proyectoId)
    if (cerrado) return cerrado
  }

  await prisma.$transaction(async (tx) => {
    for (const a of nuevas) {
      // upsert: si ya hay aplicación a esa factura, sumar
      const existente = await tx.aplicacionRecibo.findUnique({
        where: { reciboId_facturaId: { reciboId: id, facturaId: a.facturaId } },
      })
      if (existente) {
        await tx.aplicacionRecibo.update({ where: { id: existente.id }, data: { monto: existente.monto + a.monto } })
      } else {
        await tx.aplicacionRecibo.create({ data: { reciboId: id, facturaId: a.facturaId, monto: a.monto } })
      }
      await recalcularFactura(tx, a.facturaId)
    }
    await recalcularRecibo(tx, id)
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Anular `POST /api/cobros/recibos/[id]/anular`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { recalcularFactura } from '@/lib/recibos'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied
  const id = parseInt((await params).id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const recibo = await prisma.recibo.findUnique({ where: { id }, include: { aplicaciones: true } })
  if (!recibo) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 })
  if (recibo.estado === 'anulado') return NextResponse.json({ error: 'Ya está anulado' }, { status: 400 })

  const facturaIds = recibo.aplicaciones.map(a => a.facturaId)
  await prisma.$transaction(async (tx) => {
    await tx.aplicacionRecibo.deleteMany({ where: { reciboId: id } })
    await tx.movimientoBancario.deleteMany({ where: { reciboId: id } })
    await tx.recibo.update({ where: { id }, data: { estado: 'anulado', montoAplicado: 0 } })
    for (const fid of facturaIds) await recalcularFactura(tx, fid)
  })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Verificar y commit**

Run: `npx tsc --noEmit && npm run lint && npm run build 2>&1 | grep "recibos/\[id\]"`
Expected: tsc 0, lint 0 errores, rutas `recibos/[id]`, `.../aplicar`, `.../anular` compiladas.

```bash
git add app/api/cobros/recibos
git commit -m "feat(recibos): API detalle, aplicar y anular"
```

---

## Task 5: Migración PagoFactura(ingreso) → Recibo + Aplicación

**Files:**
- Create: `prisma/migrate-recibos.ts`

- [ ] **Step 1: Escribir el script**

```ts
// prisma/migrate-recibos.ts
// Convierte cada PagoFactura de factura tipo 'ingreso' en Recibo + Aplicación.
// Idempotente: salta pagos ya migrados (marca por observaciones).
// Ejecutar: ts-node --project tsconfig.seed.json prisma/migrate-recibos.ts
import { PrismaClient } from '@prisma/client'
import { estadoRecibo, estadoFactura, siguienteNumeroRecibo } from '../lib/recibos'

const prisma = new PrismaClient()
const MARCA = '[migrado-de-pago]'

async function main() {
  const pagos = await prisma.pagoFactura.findMany({
    where: { factura: { tipo: 'ingreso' } },
    include: { factura: { select: { clienteId: true } } },
    orderBy: { fecha: 'asc' },
  })
  console.log(`Pagos de ingreso a migrar: ${pagos.length}`)

  const contadorAnio = new Map<number, number>()
  let creados = 0

  for (const p of pagos) {
    const obs = `${MARCA} pago#${p.id}`
    const ya = await prisma.recibo.findFirst({ where: { observaciones: { contains: `pago#${p.id}` } } })
    if (ya) continue
    if (!p.factura.clienteId) { console.warn(`Pago ${p.id} sin clienteId — omitido`); continue }

    const anio = p.fecha.getFullYear()
    let n = contadorAnio.get(anio)
    if (n === undefined) {
      const ultimo = await prisma.recibo.findFirst({
        where: { numero: { startsWith: `REC-${anio}-` } }, orderBy: { numero: 'desc' }, select: { numero: true },
      })
      n = ultimo ? parseInt(ultimo.numero.match(/REC-\d{4}-(\d+)/)?.[1] ?? '0', 10) : 0
    }
    const numero = siguienteNumeroRecibo(`REC-${anio}-${String(n).padStart(4, '0')}`, anio)
    contadorAnio.set(anio, n + 1)

    await prisma.$transaction(async (tx) => {
      const recibo = await tx.recibo.create({
        data: {
          numero, clienteId: p.factura.clienteId!, fecha: p.fecha, monto: p.monto,
          metodoPago: p.metodoPago, cuentaBancariaId: p.cuentaBancariaId,
          referencia: p.referencia,
          observaciones: [p.observaciones, obs].filter(Boolean).join(' '),
          montoAplicado: p.monto, estado: estadoRecibo(p.monto, p.monto),
        },
      })
      await tx.aplicacionRecibo.create({ data: { reciboId: recibo.id, facturaId: p.facturaId, monto: p.monto } })
    })
    creados++
  }

  // Recalcular facturas de ingreso desde aplicaciones (debe coincidir con lo previo)
  const facturas = await prisma.factura.findMany({ where: { tipo: 'ingreso' }, select: { id: true, total: true } })
  for (const f of facturas) {
    const agg = await prisma.aplicacionRecibo.aggregate({ where: { facturaId: f.id }, _sum: { monto: true } })
    const montoPagado = agg._sum.monto ?? 0
    await prisma.factura.update({ where: { id: f.id }, data: { montoPagado, estado: estadoFactura(f.total, montoPagado) } })
  }

  console.log(`Recibos creados: ${creados}. Facturas recalculadas: ${facturas.length}.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Ejecutar en la base de dev**

Run: `npx ts-node --project tsconfig.seed.json prisma/migrate-recibos.ts`
Expected: imprime "Recibos creados: N" y "Facturas recalculadas: M" sin errores.

- [ ] **Step 3: Verificar en Prisma Studio (manual)**

Run: `npm run db:studio`
Verificar: tabla `recibo` con N filas; cada factura ingreso con `montoPagado` igual a antes; estados coherentes.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrate-recibos.ts
git commit -m "feat(recibos): script de migracion PagoFactura(ingreso) -> Recibo"
```

---

## Task 6: Informe Económico — fuente de ingreso = Recibo

**Files:**
- Modify: `lib/informe-economico-data.ts`

- [ ] **Step 1: Reemplazar la consulta de ingresos (cobros)**

En `cargarRango`, sustituir el bloque que consulta `prisma.pagoFactura.findMany({ ... tipo: 'ingreso' ... })` por una consulta a `recibo`. El **total de ingreso** del período = recibos por fecha (no anulados). La **atribución por proyecto** se obtiene de las aplicaciones; la parte no aplicada va a `proyectoNombre: null`.

Reemplazar el primer elemento del `Promise.all` (cobros) por:
```ts
    prisma.recibo.findMany({
      where: { fecha: enRango, estado: { not: 'anulado' } },
      select: {
        fecha: true,
        monto: true,
        montoAplicado: true,
        aplicaciones: {
          select: { monto: true, factura: { select: { proyectoId: true, proyecto: { select: { nombre: true } } } } },
        },
      },
    }),
```

Y construir las filas de ingreso así (reemplaza el `cobros.map(...)` actual):
```ts
  const ingresos: IngresoRow[] = []
  for (const r of recibos) {
    // Parte aplicada → atribuida al proyecto de cada factura
    for (const ap of r.aplicaciones) {
      ingresos.push({
        fecha: r.fecha.toISOString(),
        monto: ap.monto,
        proyectoId: ap.factura.proyectoId,
        proyectoNombre: ap.factura.proyecto?.nombre ?? null,
      })
    }
    // Parte NO aplicada (anticipo) → sin proyecto, pero cuenta como ingreso (caja)
    const sinAplicar = r.monto - r.montoAplicado
    if (sinAplicar > 0.01) {
      ingresos.push({ fecha: r.fecha.toISOString(), monto: sinAplicar, proyectoId: null, proyectoNombre: null })
    }
  }
```
(Renombrar la variable destructurada del `Promise.all` de `cobros` a `recibos`.)

- [ ] **Step 2: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npm run lint && npm run build 2>&1 | grep "Compiled successfully"`
Expected: tsc 0, lint 0 errores, "✓ Compiled successfully".

- [ ] **Step 3: Verificación manual del informe**

Run: `npm run dev` → abrir Contabilidad → tab Resultado → preset "Este año". El total de Ingresos debe coincidir con la suma de recibos del período; los anticipos sin aplicar aparecen en el total pero no en ningún proyecto.

- [ ] **Step 4: Commit**

```bash
git add lib/informe-economico-data.ts
git commit -m "feat(recibos): informe economico cuenta ingresos desde recibos"
```

---

## Task 7: UI — pestaña Recibos en Cobros

**Files:**
- Create: `components/contabilidad/RecibosTab.tsx`
- Modify: `app/facturacion/FacturacionClient.tsx` (montar pestaña) y `app/facturacion/page.tsx` (pasar clientes + facturas pendientes por cliente)

- [ ] **Step 1: Pasar datos necesarios desde el server**

En `app/facturacion/page.tsx`, añadir a las consultas en paralelo:
```ts
    prisma.cliente.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    prisma.cuentaBancaria.findMany({ where: { activa: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
```
y pasarlos como props (`clientes`, `cuentas`) al `FacturacionClient`.

- [ ] **Step 2: Crear `RecibosTab.tsx`**

Componente cliente con: tabla de recibos (`GET /api/cobros/recibos`), botón "Nuevo recibo" que abre un formulario (cliente, fecha, monto, método, cuenta, referencia, observaciones) + sección de aplicación: al elegir cliente, hace `GET /api/cobros/recibos?...`? No — para las facturas pendientes del cliente usar `GET /api/contabilidad/facturas?tipo=ingreso&clienteId=...` (filtra `estado != pagada/anulada`) y permite repartir el monto. Al guardar: `POST /api/cobros/recibos` con `{ clienteId, fecha, monto, metodoPago, cuentaBancariaId, referencia, observaciones, aplicaciones: [{facturaId, monto}] }`. Usar `useToast` para feedback y `ConfirmDialog` para anular. Seguir el estilo de `FacturaDetalle.tsx` (formularios, badges de estado).

> Nota de implementación: reusar los patrones visuales de `components/contabilidad/FacturaDetalle.tsx` y `app/facturacion/FacturacionClient.tsx`. El form valida en cliente que la suma de aplicaciones ≤ monto del recibo antes de enviar.

- [ ] **Step 3: Montar la pestaña en `FacturacionClient.tsx`**

Añadir estado de pestañas (`'facturas' | 'recibos'`) y renderizar `<RecibosTab clientes={clientes} cuentas={cuentas} />` cuando esté activa. Mantener la vista de facturas existente como pestaña por defecto.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm run build 2>&1 | grep "Compiled successfully"`
Expected: tsc 0, lint 0 errores, build compila.

- [ ] **Step 5: Verificación manual**

`npm run dev` → Cobros → pestaña Recibos → crear un recibo aplicándolo a una factura pendiente; verificar que la factura cambia a parcial/pagada y que aparece el movimiento bancario si se eligió cuenta. Crear un recibo sin aplicar (anticipo) y verificar saldo a cuenta.

- [ ] **Step 6: Commit**

```bash
git add components/contabilidad/RecibosTab.tsx app/facturacion/FacturacionClient.tsx app/facturacion/page.tsx
git commit -m "feat(recibos): pestana Recibos en Cobros (crear + aplicar)"
```

---

## Task 8: FacturaDetalle — registrar/aplicar cobro vía recibo

**Files:**
- Modify: `components/contabilidad/FacturaDetalle.tsx`

- [ ] **Step 1: Reemplazar el flujo "registrar pago"**

Localizar el formulario/acción que hoy hace `POST /api/contabilidad/facturas/[id]/pagos`. Reemplazar por una acción "Registrar cobro" que llama `POST /api/cobros/recibos` con `{ clienteId: <cliente de la factura>, fecha, monto, metodoPago, cuentaBancariaId, referencia, aplicaciones: [{ facturaId: <esta factura>, monto }] }`. El monto por defecto = saldo pendiente de la factura. Tras éxito, `router.refresh()`.

> El endpoint viejo `/api/contabilidad/facturas/[id]/pagos` se mantiene por ahora para egresos (facturas de proveedor). Para ingreso, esta pantalla deja de usarlo.

- [ ] **Step 2: Mostrar las aplicaciones de recibos en lugar de pagos**

Donde la pantalla lista los `pagos` de la factura, para facturas de ingreso listar las `aplicaciones` (cada una con su recibo: número, fecha, monto). Obtenerlas vía un `GET` a la factura/aplicaciones o incluyéndolas en la carga del detalle. Para egreso, seguir mostrando `pagos`.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm run build 2>&1 | grep "Compiled successfully"`
Expected: tsc 0, lint 0 errores, build compila.

- [ ] **Step 4: Verificación manual**

`npm run dev` → abrir una factura de ingreso → Registrar cobro → verificar que crea recibo + aplicación, la factura pasa a parcial/pagada, y la aplicación aparece listada. Abrir una factura de egreso → el flujo de pago a proveedor sigue funcionando igual.

- [ ] **Step 5: Commit**

```bash
git add components/contabilidad/FacturaDetalle.tsx
git commit -m "feat(recibos): detalle de factura ingreso usa recibos/aplicaciones"
```

---

## Verificación final (gates del proyecto)

- [ ] `npx tsc --noEmit` → 0 errores
- [ ] `npm run lint` → 0 errores (warnings = deuda conocida)
- [ ] `npm run build` → "✓ Compiled successfully" (ignorar error Prisma de prerender)
- [ ] Recorrido manual: crear recibo con/sin aplicación, anular, ver factura recalculada, Informe Económico con ingresos = recibos.

## Notas de cierre

- Egresos (pagos a proveedores) **no** se tocan: siguen con `PagoFactura` y `/api/contabilidad/facturas/[id]/pagos`.
- Fase 2 (no en este plan): vincular crédito de extracto → recibo, adaptar el importador masivo de pagos a recibos, PDF imprimible del recibo, recibos para egresos.
