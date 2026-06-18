# Informe Económico — Sección Overhead — Plan

**Goal:** Separar Oficina/Taller/General del bucket "Sin proyecto" en una sección propia con ingresos/gastos/resultado por renglón y desglose por categoría.

**Spec:** `docs/superpowers/specs/2026-06-18-informe-overhead-design.md`

**Verificación:** `npx tsc --noEmit`, `npm run lint`, `npm run build` (ignorar error Prisma prerender). DB en VPS — no migrar. Sin cambios de schema.

---

## Task 1: lib pura + data layer

- `lib/informe-economico.ts`:
  - `IngresoRow` += `destinoTipo: string | null`.
  - `GastoRow` += `categoria: string | null`.
  - Tipos nuevos `FilaCategoriaEconomica { categoria, total }` y `FilaRenglonEconomico { destino, label, ingresos, gastos, resultado, margen, categorias }`.
  - `rentabilidadPorProyecto`: filtrar a `proyectoId != null` (quitar bucket "sin").
  - Nueva `rentabilidadOverhead(ingresos, gastos)`: items con `proyectoId == null`; agrupar por `destinoTipo` normalizado a oficina|taller|general|sin_asignar; sumar ingresos/gastos; desglose de gastos por categoría ('Sin categoría' si null); orden fijo de renglones; solo los con movimiento.
  - `InformeEconomicoData` += `overhead: FilaRenglonEconomico[]`; `construirInforme` lo calcula.
- `lib/informe-economico-data.ts`:
  - `recibo.aplicaciones.factura` select += `destinoTipo`; `IngresoRow.destinoTipo = ap.factura.destinoTipo`; porción no aplicada → `destinoTipo: null`.
  - `gastoProyecto` select += `categoria`; `GastoRow.categoria = g.categoria`. `pagosEgreso` → `categoria: null`.
- Verificar: `tsc` 0.
- Commit: `feat(informe): overhead por renglon con desglose por categoria (lib)`.

## Task 2: UI sección Overhead

- `components/contabilidad/InformeEconomico.tsx`: tipo `InformeEconomicoData` (importado) ya trae `overhead`. Añadir sección "Estructura / Overhead" tras "Rentabilidad por proyecto": tabla Renglón|Ingresos|Gastos|Resultado|Margen, filas expandibles por categoría (mismo patrón `Fragment`/`expandido` que proyectos), colores de `DESTINOS`. "Rentabilidad por proyecto" no requiere cambios (ya no llega "Sin proyecto").
- Verificar: `tsc` + `lint` + `build`.
- Commit: `feat(informe): seccion Estructura/Overhead en el tab Resultado`.

## Task 3: Exports Excel + PDF

- `app/api/export/contabilidad/informe-economico/route.ts`: agregar tabla "Estructura / Overhead" (Renglón, Ingresos, Gastos, Resultado, Margen) a la hoja Resumen.
- `app/contabilidad/informe-economico/imprimir/page.tsx`: nueva `Seccion` "Estructura / Overhead" con la tabla.
- Verificar: `tsc` + `lint` + `build`.
- Commit: `feat(informe): overhead en export Excel y PDF`.

## Verificación final
`tsc` 0 · `lint` 0 errores · `build` ✓. Deploy VPS: build + restart (sin migración).
