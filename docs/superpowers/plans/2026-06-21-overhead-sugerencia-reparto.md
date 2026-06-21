# Sugerencia automática de reparto de overhead — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un botón "Sugerir %" en `/contabilidad/overhead` que calcula un % de reparto sugerido por proyecto/mes (índice de esfuerzo compuesto, con desglose por señal), rellena los inputs y deja el guardado al usuario.

**Architecture:** Lógica pura nueva en `lib/overhead.ts` (testeable con vitest), carga de señales en `lib/overhead-data.ts`, un endpoint `GET /api/contabilidad/overhead/sugerencia` que reusa el conjunto de proyectos candidatos del GET actual, y un botón + desglose en `OverheadClient.tsx`. Sin cambios de schema.

**Tech Stack:** Next.js 16 (App Router), Prisma 5 + SQLite, TypeScript, vitest, Tailwind/shadcn.

---

## File Structure

- `lib/overhead.ts` — **modificar**: añadir tipos (`PesosSugerencia`, `SenalesProyecto`, `SugerenciaProyecto`), constante `PESOS_SUGERENCIA_DEFAULT`, y funciones puras `normalizarPesos` y `sugerirReparto`.
- `lib/overhead-data.ts` — **modificar**: añadir `senalesDelMes()` y `pesosSugerencia()`.
- `app/api/contabilidad/overhead/route.ts` — **modificar**: extraer el cálculo del "conjunto de proyectos candidatos" a un helper exportado reutilizable (`idsProyectosCandidatos`).
- `app/api/contabilidad/overhead/sugerencia/route.ts` — **crear**: endpoint GET de sugerencia.
- `app/contabilidad/overhead/OverheadClient.tsx` — **modificar**: botón "Sugerir %" + popover de desglose por fila.
- `lib/__tests__/overhead.test.ts` — **modificar**: tests de `normalizarPesos` y `sugerirReparto`.

Todas las funciones puras viven en `lib/overhead.ts` (sin Prisma); la carga de datos en `lib/overhead-data.ts` (server-only). Mismo patrón que el código existente.

---

## Task 1: Tipos, constante de pesos y `normalizarPesos`

**Files:**
- Modify: `lib/overhead.ts` (añadir al final)
- Test: `lib/__tests__/overhead.test.ts`

- [ ] **Step 1: Write the failing test**

Añadir al final de `lib/__tests__/overhead.test.ts`. Primero ampliar el import de `../overhead` para incluir lo nuevo:

```ts
import {
  calcularPoolReal, montoPorcentaje, totalPorcentaje, validarReparto,
  sumarOverheadDistribuido, esGastoOverhead, type GastoOverheadRow,
  normalizarPesos, PESOS_SUGERENCIA_DEFAULT, type PesosSugerencia,
} from '../overhead'
```

Y añadir el bloque de tests:

```ts
describe('normalizarPesos', () => {
  it('los defaults suman 1', () => {
    const p = PESOS_SUGERENCIA_DEFAULT
    const suma = p.costoMes + p.horas + p.costoAcum + p.presupuesto + p.avance
    expect(suma).toBeCloseTo(1, 6)
  })
  it('re-normaliza a 1 cuando no suman 1', () => {
    const pesos: PesosSugerencia = { costoMes: 2, horas: 2, costoAcum: 0, presupuesto: 0, avance: 0 }
    const vivas = { costoMes: true, horas: true, costoAcum: true, presupuesto: true, avance: true }
    const r = normalizarPesos(pesos, vivas)
    expect(r.costoMes).toBeCloseTo(0.5, 6)
    expect(r.horas).toBeCloseTo(0.5, 6)
  })
  it('redistribuye el peso de señales muertas entre las vivas', () => {
    const vivas = { costoMes: true, horas: true, costoAcum: true, presupuesto: true, avance: false }
    const r = normalizarPesos(PESOS_SUGERENCIA_DEFAULT, vivas)
    expect(r.avance).toBe(0)
    const suma = r.costoMes + r.horas + r.costoAcum + r.presupuesto + r.avance
    expect(suma).toBeCloseTo(1, 6)
  })
  it('si todas están muertas devuelve todo en 0', () => {
    const vivas = { costoMes: false, horas: false, costoAcum: false, presupuesto: false, avance: false }
    const r = normalizarPesos(PESOS_SUGERENCIA_DEFAULT, vivas)
    expect(r.costoMes + r.horas + r.costoAcum + r.presupuesto + r.avance).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/overhead.test.ts`
Expected: FAIL — `normalizarPesos`/`PESOS_SUGERENCIA_DEFAULT` no exportados (error de import/undefined).

- [ ] **Step 3: Write minimal implementation**

Añadir al final de `lib/overhead.ts`:

```ts
// ── Sugerencia de reparto (índice de esfuerzo compuesto) ───────────────

export interface PesosSugerencia {
  costoMes: number
  horas: number
  costoAcum: number
  presupuesto: number
  avance: number
}

/** Pesos por defecto (suman 1). Configurables vía Configuracion. */
export const PESOS_SUGERENCIA_DEFAULT: PesosSugerencia = {
  costoMes: 0.35,
  horas: 0.25,
  costoAcum: 0.20,
  presupuesto: 0.15,
  avance: 0.05,
}

export type ClaveSenal = keyof PesosSugerencia
const CLAVES_SENAL: ClaveSenal[] = ['costoMes', 'horas', 'costoAcum', 'presupuesto', 'avance']

/**
 * Normaliza pesos a Σ=1, anulando las señales "muertas" (sin datos en el mes)
 * y redistribuyendo su peso proporcionalmente entre las vivas. Si todas están
 * muertas, devuelve todo en 0 (el caller hará fallback a reparto igual).
 */
export function normalizarPesos(
  pesos: PesosSugerencia,
  senalesVivas: Record<ClaveSenal, boolean>,
): PesosSugerencia {
  const sumaVivas = CLAVES_SENAL.reduce(
    (s, k) => s + (senalesVivas[k] ? pesos[k] : 0), 0,
  )
  const out = { costoMes: 0, horas: 0, costoAcum: 0, presupuesto: 0, avance: 0 } as PesosSugerencia
  if (sumaVivas <= 0) return out
  for (const k of CLAVES_SENAL) {
    out[k] = senalesVivas[k] ? pesos[k] / sumaVivas : 0
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/overhead.test.ts`
Expected: PASS (incluyendo los tests previos del archivo).

- [ ] **Step 5: Commit**

```bash
git add lib/overhead.ts lib/__tests__/overhead.test.ts
git commit -m "feat(overhead): pesos de sugerencia y normalizarPesos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Función pura `sugerirReparto`

**Files:**
- Modify: `lib/overhead.ts` (añadir después de `normalizarPesos`)
- Test: `lib/__tests__/overhead.test.ts`

- [ ] **Step 1: Write the failing test**

Ampliar el import para incluir `sugerirReparto`, `type SenalesProyecto`, `type SugerenciaProyecto`:

```ts
import {
  calcularPoolReal, montoPorcentaje, totalPorcentaje, validarReparto,
  sumarOverheadDistribuido, esGastoOverhead, type GastoOverheadRow,
  normalizarPesos, PESOS_SUGERENCIA_DEFAULT, type PesosSugerencia,
  sugerirReparto, type SenalesProyecto,
} from '../overhead'
```

Añadir el bloque de tests:

```ts
const senal = (over: Partial<SenalesProyecto> & { proyectoId: number }): SenalesProyecto => ({
  costoMes: 0, costoAcum: 0, horas: 0, presupuesto: 0, avance: 0, diasActivos: 30, ...over,
})

describe('sugerirReparto', () => {
  it('reparte 50/50 con señales iguales y suma 100', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, costoMes: 1000, horas: 10, costoAcum: 1000, presupuesto: 1000, avance: 50 }),
      senal({ proyectoId: 2, costoMes: 1000, horas: 10, costoAcum: 1000, presupuesto: 1000, avance: 50 }),
    ], 30)
    expect(r.map(x => x.porcentaje)).toEqual([50, 50])
    const total = r.reduce((s, x) => s + x.porcentaje, 0)
    expect(total).toBeLessThanOrEqual(100.0001)
  })

  it('desglose de cada proyecto suma su porcentaje', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, costoMes: 3000, horas: 5, costoAcum: 2000, presupuesto: 1000, avance: 80 }),
      senal({ proyectoId: 2, costoMes: 1000, horas: 20, costoAcum: 5000, presupuesto: 4000, avance: 20 }),
    ], 30)
    for (const x of r) {
      const d = x.desglose
      const sumaD = d.costoMes + d.horas + d.costoAcum + d.presupuesto + d.avance
      expect(sumaD).toBeCloseTo(x.porcentaje, 4)
    }
  })

  it('redistribuye peso cuando una señal está muerta (sin horas el mes)', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, costoMes: 2000, costoAcum: 2000, presupuesto: 2000, avance: 50, horas: 0 }),
      senal({ proyectoId: 2, costoMes: 1000, costoAcum: 1000, presupuesto: 1000, avance: 50, horas: 0 }),
    ], 30)
    // El proyecto 1 (más costo) debe recibir más, y la columna horas del desglose es 0
    expect(r[0].porcentaje).toBeGreaterThan(r[1].porcentaje)
    expect(r[0].desglose.horas).toBe(0)
    expect(r[1].desglose.horas).toBe(0)
  })

  it('todas las señales 0 → reparto igual prorrateado por días', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, diasActivos: 30 }),
      senal({ proyectoId: 2, diasActivos: 15 }),
    ], 30)
    // 30 vs 15 → 2:1 → ~66.67 / ~33.33
    expect(r[0].porcentaje).toBeGreaterThan(r[1].porcentaje)
    expect(r[0].porcentaje + r[1].porcentaje).toBeCloseTo(100, 4)
  })

  it('prorratea por duración: medio mes recibe la mitad', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, costoMes: 1000, horas: 10, costoAcum: 1000, presupuesto: 1000, avance: 50, diasActivos: 30 }),
      senal({ proyectoId: 2, costoMes: 1000, horas: 10, costoAcum: 1000, presupuesto: 1000, avance: 50, diasActivos: 15 }),
    ], 30)
    // mismas señales pero p2 activo la mitad del mes → ~2:1
    expect(r[0].porcentaje).toBeCloseTo(66.67, 1)
    expect(r[1].porcentaje).toBeCloseTo(33.33, 1)
  })

  it('lista vacía → []', () => {
    expect(sugerirReparto([], 30)).toEqual([])
  })

  it('suma nunca supera 100 (redondeo)', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, costoMes: 333 }),
      senal({ proyectoId: 2, costoMes: 333 }),
      senal({ proyectoId: 3, costoMes: 334 }),
    ], 30)
    const total = r.reduce((s, x) => s + x.porcentaje, 0)
    expect(total).toBeLessThanOrEqual(100.01)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/overhead.test.ts`
Expected: FAIL — `sugerirReparto` no exportado.

- [ ] **Step 3: Write minimal implementation**

Añadir después de `normalizarPesos` en `lib/overhead.ts`:

```ts
export interface SenalesProyecto {
  proyectoId: number
  costoMes: number
  costoAcum: number
  horas: number
  presupuesto: number
  avance: number      // 0-100
  diasActivos: number // días activos del proyecto dentro del mes
}

export interface DesgloseSenal {
  costoMes: number
  horas: number
  costoAcum: number
  presupuesto: number
  avance: number
}

export interface SugerenciaProyecto {
  proyectoId: number
  porcentaje: number       // 0-100, redondeado a 2 dec, suma ≤ 100
  desglose: DesgloseSenal  // aporte de cada señal en puntos de %; Σ = porcentaje
}

/**
 * Calcula el % sugerido de reparto de overhead por proyecto.
 *
 * Para cada señal i: cuotaᵢ(p) = señalᵢ(p) / Σ señalᵢ. score(p) = Σ wᵢ·cuotaᵢ(p),
 * prorrateado por diasActivos/diasDelMes, re-normalizado a 100%. Las señales sin
 * total (todas 0) se consideran "muertas" y su peso se redistribuye. Si todas las
 * señales están muertas, reparto igual prorrateado por días.
 */
export function sugerirReparto(
  proyectos: SenalesProyecto[],
  diasDelMes: number,
  pesos: PesosSugerencia = PESOS_SUGERENCIA_DEFAULT,
): SugerenciaProyecto[] {
  if (proyectos.length === 0) return []

  // Totales por señal para detectar señales muertas y calcular cuotas.
  const totales: Record<ClaveSenal, number> = {
    costoMes: 0, horas: 0, costoAcum: 0, presupuesto: 0, avance: 0,
  }
  for (const p of proyectos) {
    totales.costoMes += p.costoMes
    totales.horas += p.horas
    totales.costoAcum += p.costoAcum
    totales.presupuesto += p.presupuesto
    totales.avance += p.avance
  }
  const vivas: Record<ClaveSenal, boolean> = {
    costoMes: totales.costoMes > 0,
    horas: totales.horas > 0,
    costoAcum: totales.costoAcum > 0,
    presupuesto: totales.presupuesto > 0,
    avance: totales.avance > 0,
  }
  const w = normalizarPesos(pesos, vivas)
  const hayPesoVivo = CLAVES_SENAL.some(k => w[k] > 0)

  const factor = (p: SenalesProyecto) =>
    diasDelMes > 0 ? Math.min(Math.max(p.diasActivos, 0), diasDelMes) / diasDelMes : 1

  // score(p) y desglose crudo por señal (antes de re-normalizar a 100).
  const valor = (s: ClaveSenal, p: SenalesProyecto): number => p[s]
  const crudo = proyectos.map(p => {
    const f = factor(p)
    const desglose: DesgloseSenal = { costoMes: 0, horas: 0, costoAcum: 0, presupuesto: 0, avance: 0 }
    let score = 0
    if (hayPesoVivo) {
      for (const k of CLAVES_SENAL) {
        if (w[k] <= 0 || totales[k] <= 0) continue
        const aporte = w[k] * (valor(k, p) / totales[k]) * f
        desglose[k] = aporte
        score += aporte
      }
    } else {
      // Todas las señales muertas: reparto igual prorrateado por días.
      score = f
    }
    return { proyectoId: p.proyectoId, score, desglose }
  })

  const sumaScore = crudo.reduce((s, c) => s + c.score, 0)

  // Re-normalizar a 100. Si sumaScore es 0 (p.ej. todos diasActivos=0), reparto igual.
  const escala = sumaScore > 0 ? 100 / sumaScore : 0
  const round2 = (n: number) => Math.round(n * 100) / 100

  let resultado: SugerenciaProyecto[] = crudo.map(c => {
    if (sumaScore > 0) {
      const k = escala
      const desg = c.desglose
      return {
        proyectoId: c.proyectoId,
        porcentaje: round2(c.score * k),
        desglose: {
          costoMes: round2(desg.costoMes * k),
          horas: round2(desg.horas * k),
          costoAcum: round2(desg.costoAcum * k),
          presupuesto: round2(desg.presupuesto * k),
          avance: round2(desg.avance * k),
        },
      }
    }
    // Fallback estricto: igual entre todos.
    const igual = round2(100 / proyectos.length)
    return {
      proyectoId: c.proyectoId,
      porcentaje: igual,
      desglose: { costoMes: igual, horas: 0, costoAcum: 0, presupuesto: 0, avance: 0 },
    }
  })

  // Ajuste de residuo de redondeo: que la suma quede ≤ 100 exacto, corrigiendo
  // en el proyecto de mayor score (índice del máximo).
  const totalPct = resultado.reduce((s, r) => s + r.porcentaje, 0)
  const residuo = round2(100 - totalPct)
  if (residuo !== 0 && resultado.length > 0) {
    let idxMax = 0
    for (let i = 1; i < crudo.length; i++) {
      if (crudo[i].score > crudo[idxMax].score) idxMax = i
    }
    // Solo bajamos si nos pasamos de 100; si falta para 100 también ajustamos,
    // pero nunca dejamos la suma por encima de 100.
    const ajustado = round2(resultado[idxMax].porcentaje + residuo)
    if (ajustado >= 0) {
      resultado[idxMax] = { ...resultado[idxMax], porcentaje: ajustado }
    }
  }

  return resultado
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/overhead.test.ts`
Expected: PASS (todos los describe del archivo).

- [ ] **Step 5: Commit**

```bash
git add lib/overhead.ts lib/__tests__/overhead.test.ts
git commit -m "feat(overhead): sugerirReparto (índice compuesto con desglose)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Extraer helper de proyectos candidatos en el route actual

**Files:**
- Modify: `app/api/contabilidad/overhead/route.ts`

Objetivo: el endpoint de sugerencia debe operar sobre EL MISMO conjunto de proyectos que el GET actual. Se extrae ese cálculo a una función exportada para no duplicarlo.

- [ ] **Step 1: Añadir el helper exportado**

En `app/api/contabilidad/overhead/route.ts`, añadir tras la constante `ESTADOS_ACTIVOS` (línea 8) esta función exportada:

```ts
/**
 * Conjunto de IDs de proyectos candidatos a recibir overhead en un mes:
 * activos (no archivados) ∪ con gasto en el mes ∪ con fila DistribucionOverhead.
 * Devuelve además el nombre/estado de cada uno.
 */
export async function proyectosCandidatosDelMes(anio: number, mes: number): Promise<
  { id: number; nombre: string; estado: string }[]
> {
  const { desde, hasta } = rangoMes(anio, mes)
  const [distribuciones, proyectosActivos, proyectosConGasto] = await Promise.all([
    prisma.distribucionOverhead.findMany({ where: { anio, mes }, select: { proyectoId: true } }),
    prisma.proyecto.findMany({
      where: { estado: { in: ESTADOS_ACTIVOS }, archivada: false },
      select: { id: true, nombre: true, estado: true },
    }),
    prisma.gastoProyecto.findMany({
      where: { fecha: { gte: desde, lt: hasta }, proyectoId: { not: null } },
      select: { proyectoId: true },
      distinct: ['proyectoId'],
    }),
  ])

  const ids = new Set<number>()
  for (const p of proyectosActivos) ids.add(p.id)
  for (const g of proyectosConGasto) if (g.proyectoId != null) ids.add(g.proyectoId)
  for (const d of distribuciones) ids.add(d.proyectoId)

  const idsFaltantes = [...ids].filter(id => !proyectosActivos.some(p => p.id === id))
  const proyectosExtra = idsFaltantes.length > 0
    ? await prisma.proyecto.findMany({
        where: { id: { in: idsFaltantes } },
        select: { id: true, nombre: true, estado: true },
      })
    : []

  const info = new Map<number, { nombre: string; estado: string }>()
  for (const p of [...proyectosActivos, ...proyectosExtra]) {
    info.set(p.id, { nombre: p.nombre, estado: p.estado })
  }
  return [...ids]
    .map(id => ({ id, nombre: info.get(id)?.nombre ?? `Proyecto ${id}`, estado: info.get(id)?.estado ?? '' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}
```

- [ ] **Step 2: Refactorizar el GET para usar el helper**

Reemplazar, dentro del `GET`, el bloque que va desde el `Promise.all` (línea ~29) hasta la construcción de `const proyectos = [...ids]...sort(...)` (línea ~80), de modo que use el helper. El GET queda así (mantener `poolReal` y `distribuciones` para los % precargados):

```ts
export const GET = withPermiso('contabilidad', 'ver', async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const anio = parseInt(sp.get('anio') ?? '')
  const mes = parseInt(sp.get('mes') ?? '')
  if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'Parámetros anio/mes inválidos' }, { status: 400 })
  }

  const [poolReal, distribuciones, candidatos] = await Promise.all([
    poolRealDelMes(anio, mes),
    prisma.distribucionOverhead.findMany({
      where: { anio, mes },
      select: { proyectoId: true, porcentaje: true, montoAsignado: true },
    }),
    proyectosCandidatosDelMes(anio, mes),
  ])

  const distPorProyecto = new Map(distribuciones.map(d => [d.proyectoId, d]))

  const proyectos = candidatos.map(c => {
    const dist = distPorProyecto.get(c.id)
    return {
      proyectoId: c.id,
      nombre: c.nombre,
      estado: c.estado,
      porcentaje: dist?.porcentaje ?? 0,
      montoAsignado: dist?.montoAsignado ?? 0,
    }
  })

  const totalAsignadoPct = proyectos.reduce((s, p) => s + p.porcentaje, 0)
  const totalAsignadoMonto = proyectos.reduce((s, p) => s + p.montoAsignado, 0)

  return NextResponse.json({
    anio, mes, poolReal, proyectos, totalAsignadoPct, totalAsignadoMonto,
  })
})
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit`
Expected: 0 errores.
Run: `npm run lint`
Expected: 0 errores (warnings preexistentes ok).

- [ ] **Step 4: Commit**

```bash
git add app/api/contabilidad/overhead/route.ts
git commit -m "refactor(overhead): extraer proyectosCandidatosDelMes reutilizable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Carga de señales y pesos (`overhead-data.ts`)

**Files:**
- Modify: `lib/overhead-data.ts`

- [ ] **Step 1: Añadir lectura de pesos desde Configuracion**

Al inicio de `lib/overhead-data.ts`, ampliar imports y añadir la función. El import de `./overhead` ya existe; ampliarlo:

```ts
import {
  RENGLONES_OVERHEAD, calcularPoolReal, sumarOverheadDistribuido,
  PESOS_SUGERENCIA_DEFAULT, type PesosSugerencia, type SenalesProyecto,
} from './overhead'
```

Añadir al final del archivo:

```ts
const CLAVE_PESOS_SUGERENCIA = 'overhead_pesos_sugerencia'

/**
 * Lee los pesos de sugerencia de overhead desde Configuracion (JSON) o devuelve
 * los defaults. Si el JSON es inválido o incompleto, usa defaults (log + fallback).
 */
export async function pesosSugerencia(): Promise<PesosSugerencia> {
  const row = await prisma.configuracion.findUnique({ where: { clave: CLAVE_PESOS_SUGERENCIA } })
  if (!row) return PESOS_SUGERENCIA_DEFAULT
  try {
    const j = JSON.parse(row.valor) as Partial<PesosSugerencia>
    return {
      costoMes: Number(j.costoMes ?? PESOS_SUGERENCIA_DEFAULT.costoMes),
      horas: Number(j.horas ?? PESOS_SUGERENCIA_DEFAULT.horas),
      costoAcum: Number(j.costoAcum ?? PESOS_SUGERENCIA_DEFAULT.costoAcum),
      presupuesto: Number(j.presupuesto ?? PESOS_SUGERENCIA_DEFAULT.presupuesto),
      avance: Number(j.avance ?? PESOS_SUGERENCIA_DEFAULT.avance),
    }
  } catch (e) {
    console.error('overhead_pesos_sugerencia inválido, usando defaults:', e)
    return PESOS_SUGERENCIA_DEFAULT
  }
}
```

- [ ] **Step 2: Añadir `senalesDelMes`**

Añadir al final de `lib/overhead-data.ts`:

```ts
/** Días del mes (anio, mes 1-12). */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

/**
 * Carga las 6 señales por proyecto para (anio, mes) sobre los IDs dados.
 * - costoMes / costoAcum: GastoProyecto destinoTipo=proyecto, RD$, no Anulado.
 * - horas: RegistroHoras del mes.
 * - presupuesto / avance / fechas: Proyecto.
 * diasActivos = intersección de [fechaInicio, fin] con el mes; fin = fechaCierre
 * ?? fechaEstimada ?? fin del mes. Sin fechaInicio → mes completo.
 */
export async function senalesDelMes(
  anio: number, mes: number, proyectoIds: number[],
): Promise<SenalesProyecto[]> {
  if (proyectoIds.length === 0) return []
  const { desde, hasta } = rangoMes(anio, mes)
  const dias = diasDelMes(anio, mes)

  const [gastosMes, gastosAcum, horas, proyectos] = await Promise.all([
    prisma.gastoProyecto.groupBy({
      by: ['proyectoId'],
      where: {
        proyectoId: { in: proyectoIds },
        destinoTipo: 'proyecto', moneda: MONEDA_DEFAULT, estado: { not: 'Anulado' },
        fecha: { gte: desde, lt: hasta },
      },
      _sum: { monto: true },
    }),
    prisma.gastoProyecto.groupBy({
      by: ['proyectoId'],
      where: {
        proyectoId: { in: proyectoIds },
        destinoTipo: 'proyecto', moneda: MONEDA_DEFAULT, estado: { not: 'Anulado' },
        fecha: { lt: hasta },
      },
      _sum: { monto: true },
    }),
    prisma.registroHoras.groupBy({
      by: ['proyectoId'],
      where: { proyectoId: { in: proyectoIds }, fecha: { gte: desde, lt: hasta } },
      _sum: { horas: true },
    }),
    prisma.proyecto.findMany({
      where: { id: { in: proyectoIds } },
      select: { id: true, presupuestoEstimado: true, avanceFisico: true, fechaInicio: true, fechaEstimada: true, fechaCierre: true },
    }),
  ])

  const mapaMes = new Map(gastosMes.map(g => [g.proyectoId, g._sum.monto ?? 0]))
  const mapaAcum = new Map(gastosAcum.map(g => [g.proyectoId, g._sum.monto ?? 0]))
  const mapaHoras = new Map(horas.map(h => [h.proyectoId, h._sum.horas ?? 0]))
  const mapaProyecto = new Map(proyectos.map(p => [p.id, p]))

  const msPorDia = 24 * 60 * 60 * 1000
  const diasActivosEnMes = (inicio: Date | null, fin: Date | null): number => {
    // Sin fechaInicio: se asume mes completo.
    if (!inicio) return dias
    const finReal = fin ?? hasta
    const ini = inicio > desde ? inicio : desde
    const fn = finReal < hasta ? finReal : hasta
    if (fn <= ini) return 0
    const d = Math.ceil((fn.getTime() - ini.getTime()) / msPorDia)
    return Math.min(Math.max(d, 0), dias)
  }

  return proyectoIds.map(id => {
    const p = mapaProyecto.get(id)
    const fin = p?.fechaCierre ?? p?.fechaEstimada ?? null
    return {
      proyectoId: id,
      costoMes: mapaMes.get(id) ?? 0,
      costoAcum: mapaAcum.get(id) ?? 0,
      horas: mapaHoras.get(id) ?? 0,
      presupuesto: p?.presupuestoEstimado ?? 0,
      avance: p?.avanceFisico ?? 0,
      diasActivos: p ? diasActivosEnMes(p.fechaInicio ?? null, fin) : dias,
    }
  })
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit`
Expected: 0 errores.
Run: `npm run lint`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add lib/overhead-data.ts
git commit -m "feat(overhead): carga de señales del mes y pesos configurables

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Endpoint `GET /api/contabilidad/overhead/sugerencia`

**Files:**
- Create: `app/api/contabilidad/overhead/sugerencia/route.ts`

- [ ] **Step 1: Crear el endpoint**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'
import { proyectosCandidatosDelMes } from '../route'
import { senalesDelMes, pesosSugerencia, diasDelMes } from '@/lib/overhead-data'
import { sugerirReparto } from '@/lib/overhead'

/**
 * GET /api/contabilidad/overhead/sugerencia?anio=YYYY&mes=M
 *
 * Devuelve el % de reparto sugerido por proyecto (con desglose por señal) para
 * el mes, sobre el mismo conjunto de proyectos candidatos que el GET principal.
 * NO persiste nada.
 */
export const GET = withPermiso('contabilidad', 'ver', async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const anio = parseInt(sp.get('anio') ?? '')
  const mes = parseInt(sp.get('mes') ?? '')
  if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'Parámetros anio/mes inválidos' }, { status: 400 })
  }

  const candidatos = await proyectosCandidatosDelMes(anio, mes)
  if (candidatos.length === 0) {
    return NextResponse.json({ anio, mes, sugerencias: [] })
  }

  const [senales, pesos] = await Promise.all([
    senalesDelMes(anio, mes, candidatos.map(c => c.id)),
    pesosSugerencia(),
  ])

  const sugerencias = sugerirReparto(senales, diasDelMes(anio, mes), pesos)
  return NextResponse.json({ anio, mes, sugerencias })
})
```

- [ ] **Step 2: Verificar que compila e importa bien el helper del route hermano**

Run: `npx tsc --noEmit`
Expected: 0 errores (confirma que `proyectosCandidatosDelMes` se exporta e importa con la ruta relativa `../route`).

- [ ] **Step 3: Smoke test del endpoint**

Run (con el server dev corriendo, autenticado como Admin): abrir en el navegador
`/api/contabilidad/overhead/sugerencia?anio=2026&mes=6` o `curl` con la cookie de sesión.
Expected: JSON `{ anio, mes, sugerencias: [...] }` con `porcentaje` que sumen ≤ 100 y `desglose` por proyecto.

Nota: si no se quiere levantar el server en este paso, basta con `npx tsc --noEmit` verde; el smoke real se hace en la verificación manual de la Task 6.

- [ ] **Step 4: Commit**

```bash
git add app/api/contabilidad/overhead/sugerencia/route.ts
git commit -m "feat(overhead): endpoint GET de sugerencia de reparto

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: UI — botón "Sugerir %" y desglose por fila

**Files:**
- Modify: `app/contabilidad/overhead/OverheadClient.tsx`

- [ ] **Step 1: Añadir tipos, estado y handler de sugerencia**

En `OverheadClient.tsx`, ampliar el import de iconos para incluir `Sparkles`:

```ts
import { ArrowLeft, Layers, Save, AlertTriangle, Info, Sparkles } from 'lucide-react'
```

Añadir, junto al resto de `useState` del componente (tras `const [guardando, setGuardando] = useState(false)`):

```ts
  const [sugiriendo, setSugiriendo] = useState(false)
  // Desglose por proyecto de la última sugerencia (puntos de % por señal).
  type Desglose = { costoMes: number; horas: number; costoAcum: number; presupuesto: number; avance: number }
  const [desgloses, setDesgloses] = useState<Record<number, Desglose>>({})
```

Añadir el handler (tras `handleGuardar`):

```ts
  const handleSugerir = async () => {
    setSugiriendo(true)
    try {
      const res = await fetch(`/api/contabilidad/overhead/sugerencia?anio=${anio}&mes=${mes}`)
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        toast.error(d?.error ?? 'No se pudo calcular la sugerencia')
        return
      }
      const data: { sugerencias: { proyectoId: number; porcentaje: number; desglose: Desglose }[] } = await res.json()
      if (data.sugerencias.length === 0) {
        toast.error('No hay datos suficientes para sugerir un reparto este mes')
        return
      }
      setPcts(prev => {
        const next = { ...prev }
        for (const s of data.sugerencias) next[s.proyectoId] = String(s.porcentaje)
        return next
      })
      setDesgloses(Object.fromEntries(data.sugerencias.map(s => [s.proyectoId, s.desglose])))
      toast.exito('Sugerencia aplicada — revisa antes de guardar')
    } catch {
      toast.error('Error de red al calcular la sugerencia')
    } finally {
      setSugiriendo(false)
    }
  }
```

- [ ] **Step 2: Limpiar desgloses al cambiar de mes**

En `cargarMes` (callback), tras `setPcts(...)`, añadir:

```ts
      setDesgloses({})
```

- [ ] **Step 3: Añadir el botón "Sugerir %" junto a Guardar**

Reemplazar el bloque de guardar (el `div` con `justify-end` que contiene el botón Guardar) por:

```tsx
      {/* Acciones */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleSugerir} disabled={sugiriendo || cargando || guardando}>
          <Sparkles className="w-4 h-4" /> {sugiriendo ? 'Calculando...' : 'Sugerir %'}
        </Button>
        <Button onClick={handleGuardar} disabled={guardando || cargando || excede}>
          <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar reparto'}
        </Button>
      </div>
```

- [ ] **Step 4: Mostrar el desglose por fila**

En la celda del nombre del proyecto (dentro del `<td>` con el `Link`), añadir debajo del Link un bloque que, si hay desglose para esa fila, lista los aportes. Reemplazar el `<td>` del nombre por:

```tsx
                    <td className="px-4 py-3">
                      <Link href={`/proyectos/${p.proyectoId}`} className="font-medium text-foreground hover:text-primary">
                        {p.nombre}
                      </Link>
                      {desgloses[p.proyectoId] && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                          <span title="Costo del mes">costo {desgloses[p.proyectoId].costoMes.toFixed(1)}</span>
                          <span title="Horas del personal">horas {desgloses[p.proyectoId].horas.toFixed(1)}</span>
                          <span title="Costo acumulado">acum {desgloses[p.proyectoId].costoAcum.toFixed(1)}</span>
                          <span title="Presupuesto estimado">presup {desgloses[p.proyectoId].presupuesto.toFixed(1)}</span>
                          <span title="Avance físico">avance {desgloses[p.proyectoId].avance.toFixed(1)}</span>
                        </p>
                      )}
                    </td>
```

- [ ] **Step 5: Verificar tipos y lint**

Run: `npx tsc --noEmit`
Expected: 0 errores.
Run: `npm run lint`
Expected: 0 errores.

- [ ] **Step 6: Verificación manual en navegador**

Run: `npm run dev`, ir a `/contabilidad/overhead` autenticado como Admin.
- Elegir un mes con gastos/proyectos activos, pulsar **"Sugerir %"** → los inputs se rellenan, aparece el desglose bajo cada nombre, la suma ≤ 100.
- Editar un input a mano → se puede guardar; el desglose queda como referencia.
- Cambiar de mes → el desglose desaparece.
- Pulsar **"Guardar reparto"** → toast de éxito, recarga con los % guardados.

- [ ] **Step 7: Commit**

```bash
git add app/contabilidad/overhead/OverheadClient.tsx
git commit -m "feat(overhead): botón Sugerir % con desglose por señal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Verificación final (gates del proyecto)

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Tests**

Run: `npx vitest run lib/__tests__/overhead.test.ts`
Expected: PASS, todos los describe (los previos + normalizarPesos + sugerirReparto).

- [ ] **Step 2: Tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: 0 errores (warnings preexistentes ok).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build OK (ignorar el error conocido de Prisma de prerender documentado en memoria del proyecto).

- [ ] **Step 5: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "chore(overhead): verificación final de gates

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notas de implementación

- **Sin cambios de schema**: `Configuracion`, `RegistroHoras`, `GastoProyecto`, `Proyecto` y `DistribucionOverhead` ya existen.
- **DRY**: el conjunto de proyectos candidatos se calcula una sola vez (`proyectosCandidatosDelMes`) y lo comparten el GET y el endpoint de sugerencia.
- **YAGNI**: sin UI de edición de pesos en v1 (solo vía `Configuracion`), sin persistencia de histórico de avance.
- **TDD**: la lógica de reparto (Tasks 1-2) se construye test-first; la carga de datos y UI se verifican con tipos/lint y prueba manual (no hay infraestructura de tests de integración en el repo).
