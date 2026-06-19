# Overhead distribuido — repartir gastos fijos mensuales a los proyectos — Diseño

**Fecha:** 2026-06-19
**Estado:** Aprobado para implementación
**Módulo:** Contabilidad + Proyectos

## Problema

Los gastos administrativos / de taller (overhead) se registran con
`GastoProyecto.destinoTipo` en `oficina | taller | general` y **no se reparten**
a los proyectos. Como consecuencia, la utilidad de cada proyecto se ve inflada:
sólo carga sus gastos directos y mano de obra, ignorando la parte de gastos fijos
de la empresa que su ejecución consume.

## Solución

Permitir repartir, **mes a mes**, el overhead entre los proyectos activos, por
**porcentaje manual**, y que esa porción entre en el **costo real** de cada
proyecto (utilidad/margen y cierre).

### Concepto

- **Pool mensual** = suma **REAL** de `GastoProyecto` con
  `destinoTipo IN ('oficina','taller','general')`, `estado != 'Anulado'` y
  `moneda = 'RD$'`, con `fecha` dentro del mes. Reutiliza el criterio de overhead
  ya usado por el Informe Económico (`lib/informe-economico.ts` /
  `lib/gastos-informe.ts`).
- **Reparto manual por %**: el usuario asigna un porcentaje a cada proyecto
  activo del mes. Porción del proyecto = `pool × % / 100`.
- **Periodicidad mensual**, a proyectos activos.
- **Lo no repartido** queda como overhead de empresa (no se carga a nadie).
- Se **acumula** por proyecto y entra en su **costo real**.

No se crean filas falsas de `GastoProyecto` (eso provocaría doble conteo en el
informe global). El overhead distribuido vive **solo** en la tabla nueva y se
suma aparte al costo del proyecto.

## Modelo de datos

Tabla nueva `distribucion_overhead` (`prisma/schema.prisma`):

```prisma
model DistribucionOverhead {
  id            Int      @id @default(autoincrement())
  anio          Int
  mes           Int      // 1-12
  proyectoId    Int
  porcentaje    Float    // 0-100
  montoAsignado Float    @default(0) // snapshot = poolReal(anio,mes) * porcentaje/100 al guardar
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  proyecto      Proyecto @relation(fields: [proyectoId], references: [id], onDelete: Cascade)
  @@unique([anio, mes, proyectoId])
  @@index([proyectoId])
  @@map("distribucion_overhead")
}
```

Relación inversa en `Proyecto`: `distribucionesOverhead DistribucionOverhead[]`.

`montoAsignado` es un **snapshot** calculado al guardar (`poolReal × % / 100`).
De esta forma el costo del proyecto no cambia retroactivamente si se registran
gastos overhead nuevos en un mes ya repartido; el usuario re-guarda el mes para
actualizar los montos.

Sincronización en dev: `npm run db:push` (este repo no usa migraciones en dev).
En el VPS/prod hay que correr `db:push` (o la migración equivalente) tras
desplegar.

## Lógica pura (`lib/overhead.ts`)

Funciones puras y testeables, separadas del acceso a Prisma:

- `RENGLONES_OVERHEAD = ['oficina','taller','general']` y `esGastoOverhead()`.
- `calcularPoolReal(gastos)` — suma el pool de un conjunto de filas de gasto
  (filtra RD$, no Anulado, renglón overhead).
- `montoPorcentaje(pool, pct)` = `pool × pct / 100`.
- `totalPorcentaje(asignaciones)` y `validarReparto(asignaciones)` — valida que
  la suma de % no supere 100 (±0.01).
- `sumarOverheadDistribuido(filas)` — suma `montoAsignado` (overhead total de un
  proyecto).

Acceso a datos en `lib/overhead-data.ts` (server-only):
`rangoMes`, `poolRealDelMes(anio, mes)`, `overheadDistribuidoProyecto(id)`.

## API (`/api/contabilidad/overhead`, wrapper `withPermiso`)

- **GET** `?anio=YYYY&mes=M` (permiso `contabilidad`/`ver`) →
  `{ poolReal, proyectos: [{ proyectoId, nombre, estado, porcentaje, montoAsignado }], totalAsignadoPct, totalAsignadoMonto }`.
  "Proyectos activos del mes" = proyectos con `estado IN ('Activo','En Ejecución')`
  **O** con al menos un `GastoProyecto` en el mes **O** con una fila
  `DistribucionOverhead` ese mes. Precarga `porcentaje`/`montoAsignado` (0 si no
  hay).
- **POST** (permiso `contabilidad`/`editar`) body
  `{ anio, mes, asignaciones: [{ proyectoId, porcentaje }] }` → calcula `poolReal`
  server-side, valida suma ≤ 100 (±0.01; 400 si excede), hace upsert por
  `(anio,mes,proyectoId)` guardando `porcentaje` y
  `montoAsignado = poolReal × pct / 100`. Elimina filas cuyo % quede en 0. Todo
  en una transacción.

## UI (`/contabilidad/overhead`)

- Server component `page.tsx` que carga el mes actual; client component
  `OverheadClient.tsx` para interacción.
- Selector de **mes/año** (default: mes actual UTC).
- Muestra el **pool real** del mes (`formatCurrency`, RD$).
- Tabla de proyectos activos con input de **%** por proyecto y preview en RD$ en
  vivo (`pool × % / 100`).
- Indicador de **% total asignado** y **monto restante** sin repartir; avisa y
  **bloquea Guardar** si pasa de 100%.
- Botón **Guardar** → POST; feedback con `useToast`.
- Acceso desde la pantalla de Contabilidad (acción rápida "Overhead
  distribuido").

## Integración en el proyecto

`app/proyectos/[id]/page.tsx`:

- Nueva función `overheadDistribuidoProyecto(id)` en el `Promise.all`.
- **Rentabilidad Real**: `costos = totalGastado + costoHoras + overheadDistribuido`;
  `utilidad` y `margen` se recalculan con ese costo. El "Costo total" del resumen
  financiero también lo incluye.
- Se muestra una sub-línea **"Overhead distribuido"** bajo Costos reales.

Cierre del proyecto (`cierre/imprimir/page.tsx` y `cierre-checks/route.ts`):
incluyen el overhead distribuido en el costo real para que el margen del informe
de cierre sea consistente con el detalle del proyecto.

## Decisiones tomadas ante ambigüedad

- El pool y `montoAsignado` se limitan a **RD$** (igual que el Informe
  Económico, que excluye otras monedas del agregado).
- `montoAsignado` es snapshot al guardar; el mes se re-guarda para reflejar
  gastos overhead añadidos después.
- En el detalle y el cierre, el overhead se **suma al costo total** (no sólo al
  bloque de Rentabilidad Real) para mantener coherentes balance, ejecución y
  margen.
