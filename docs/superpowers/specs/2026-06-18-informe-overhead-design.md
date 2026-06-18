# Informe Económico — Sección Overhead (estructura) — Diseño

**Fecha:** 2026-06-18
**Estado:** Aprobado para implementación
**Módulo:** Informe Económico (tab Resultado en Contabilidad)

## Problema

La tabla "Rentabilidad por proyecto" agrupa todo por `proyectoId`. Los gastos de
renglones no-proyecto (Oficina, Taller, General) tienen `proyectoId = null`, así
que caen juntos en una fila confusa "Sin proyecto". El usuario quiere verlos
**separados por renglón**, con su posible **ingreso directo** y el **desglose de
gastos por categoría**.

## Solución

Dividir cada movimiento del informe en dos secciones, sin doble conteo:

- **Tiene proyecto** (`proyectoId != null`) → **Rentabilidad por proyecto**
  (queda igual, pero ya **sin** la fila "Sin proyecto").
- **No tiene proyecto** (`proyectoId == null`) → nueva sección **Estructura /
  Overhead**, agrupado por `destinoTipo`: Oficina, Taller, General, Sin asignar.

Los KPIs globales y la evolución mensual **no cambian** (siguen siendo totales).

### Atribución de ingresos a un renglón ("entrada directa")

Vía `Factura.destinoTipo` (campo ya existente). Un cobro (recibo) aplicado a una
factura cuyo `destinoTipo` es `oficina`/`taller`/`general` (sin proyecto) cuenta
como ingreso de ese renglón. Los anticipos sin aplicar (porción no aplicada del
recibo, sin factura) van a **Sin asignar**. No requiere cambios de modelo.

### Desglose de gastos overhead

Por **categoría** (`GastoProyecto.categoria`). Los gastos sin categoría se
agrupan como "Sin categoría". (Los gastos que vienen de pagos de facturas egreso
no tienen categoría → "Sin categoría".)

## Cambios de datos

`lib/informe-economico.ts`:
- `IngresoRow` gana `destinoTipo: string | null` (de `factura.destinoTipo`; null
  para la porción no aplicada del recibo).
- `GastoRow` gana `categoria: string | null`.
- `rentabilidadPorProyecto(ingresos, gastos)` → **solo** filas con
  `proyectoId != null` (eliminar el bucket "Sin proyecto").
- Nueva `rentabilidadOverhead(ingresos, gastos)`: opera sobre los items con
  `proyectoId == null`, agrupa por `destinoTipo` normalizado a uno de
  `oficina|taller|general|sin_asignar` (cualquier otro, incl. `proyecto`
  huérfano sin id, cae en `sin_asignar`). Por cada renglón: `ingresos`,
  `gastos`, `resultado`, `margen`, y `categorias: { categoria, total }[]`
  (desglose de los gastos por categoría, ordenado desc). Devuelve solo los
  renglones con algún movimiento, en orden fijo (oficina, taller, general,
  sin_asignar).
- `InformeEconomicoData` gana `overhead: FilaRenglonEconomico[]`.
- `construirInforme` llama a la nueva función.

`lib/informe-economico-data.ts` (consulta Prisma):
- En `recibo.aplicaciones.factura`, seleccionar también `destinoTipo`. Poblar
  `IngresoRow.destinoTipo` con `ap.factura.destinoTipo`. La porción no aplicada
  → `destinoTipo: null`.
- En `gastoProyecto`, seleccionar `categoria`. Poblar `GastoRow.categoria`. En
  `pagosEgreso` (factura egreso), `categoria: null` (ya aportan `destinoTipo`).

### Tipos nuevos

```ts
interface FilaCategoriaEconomica { categoria: string; total: number }
interface FilaRenglonEconomico {
  destino: string            // oficina|taller|general|sin_asignar
  label: string              // de DESTINOS
  ingresos: number
  gastos: number
  resultado: number
  margen: number | null
  categorias: FilaCategoriaEconomica[]
}
```

## UI

`components/contabilidad/InformeEconomico.tsx`:
- "Rentabilidad por proyecto": sin cambios de render salvo que `data.porProyecto`
  ya no trae "Sin proyecto".
- Nueva sección **"Estructura / Overhead"** debajo: tabla con columnas
  `Renglón | Ingresos | Gastos | Resultado | Margen`, una fila por renglón
  (Oficina/Taller/General/Sin asignar) usando colores/labels de `DESTINOS`.
  Filas con `categorias.length > 0` son expandibles (chevron) y muestran el
  desglose por categoría (categoría · monto), mismo patrón que el expand de
  proyecto. Resultado en verde/rojo; margen "—" si no hay ingresos.

## Exports

- Excel (`/api/export/contabilidad/informe-economico`): nueva tabla "Estructura /
  Overhead" en la hoja Resumen (Renglón, Ingresos, Gastos, Resultado, Margen) y,
  opcional, el desglose por categoría debajo de cada renglón.
- PDF (`/contabilidad/informe-economico/imprimir`): nueva `Seccion` "Estructura /
  Overhead" con la misma tabla.

## Alcance / decisiones

- Sin cambios de schema → en el VPS solo build + restart.
- No se agrega entrada de ingreso directa nueva en UI; se reusa el
  `destinoTipo` de factura existente (marcando la factura como Oficina/Taller/
  General sin proyecto). Si más adelante se quiere asignar un recibo directo a un
  renglón sin factura, sería otra iteración.
- "Gasto por renglón" (las barras de arriba) se mantiene como vista rápida.

## Deuda técnica respetada

Sin Zod. Agregación pura y testeable en `lib/informe-economico.ts`.
