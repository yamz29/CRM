# Informe Económico (Resultado) — Diseño

**Fecha:** 2026-06-17
**Estado:** Aprobado para implementación (Opción A)

## Objetivo

Saber si el negocio está en positivo o negativo en un período (mes o rango
personalizado), cruzando **ingresos vs gastos**, y poder ver **qué renglón**
(proyecto / oficina / taller / general) y **qué proyecto** gasta más y cuáles
proyectos ganan o pierden plata (rentabilidad).

Vive como un **tab "Resultado"** dentro de la página de Contabilidad.

## Definiciones contables

Todo en **base caja** (lo que entró/salió) y en **RD$**.

| Concepto    | Fuente                                                                 | Fecha           | Renglón / Proyecto                          |
|-------------|-----------------------------------------------------------------------|-----------------|---------------------------------------------|
| **Ingreso** | `PagoFactura` de facturas `tipo = ingreso` (no anuladas)              | fecha del pago  | proyecto = `factura.proyectoId`             |
| **Gasto a** | `GastoProyecto` (estado ≠ `Anulado`, `moneda = RD$`)                  | `fecha` gasto   | `destinoTipo` + `proyectoId`                |
| **Gasto b** | `PagoFactura` de facturas `tipo = egreso` **sin** gasto vinculado     | fecha del pago  | `factura.destinoTipo` + `factura.proyectoId`|

- **Resultado del período = Ingresos − (Gasto a + Gasto b).** Positivo = ganamos.
- **Margen = Resultado / Ingresos** (cuando Ingresos > 0).
- **Regla "sin duplicar":** un `GastoProyecto` cuenta siempre (Gasto a), aunque
  tenga `facturaId`. Las facturas de egreso solo aportan (Gasto b) cuando **no**
  tienen un `GastoProyecto` vinculado (`factura.gasto` es null) — así no se
  cuenta dos veces el mismo egreso.
- **Moneda:** el informe es RD$. Las facturas/pagos son RD$ por modelo. Los
  gastos en USD/EUR se **excluyen** y se reportan en un aviso (cantidad + total
  sin convertir), misma convención que el Informe de Gastos.
- **Período anterior:** mismo largo de rango inmediatamente anterior
  (`rangoPeriodoAnterior` de `lib/gastos-informe.ts`) para el delta de KPIs.

## Pantalla (tab "Resultado")

1. **Filtros:** presets *Este mes / Mes pasado / Este año / Todo* + rango
   personalizado (desde–hasta). Mismo patrón visual que el Informe de Gastos.
2. **KPIs:** Ingresos · Gastos · **Resultado** (verde si ≥0, rojo si <0) ·
   Margen % con comparación vs período anterior.
3. **Por renglón:** barras horizontales del gasto por destino
   (proyecto/oficina/taller/general/sin asignar), mayor a menor.
4. **Rentabilidad por proyecto:** tabla `Proyecto | Ingresos | Gastos |
   Resultado | Margen`, ordenada por resultado. Fila "Sin proyecto" agrupa lo
   no asignado. (Desglose por partida expandible — fase 2 opcional.)
5. **Evolución mensual:** barras Ingresos vs Gastos por mes + línea de Resultado.
6. **Aviso de moneda** si hay gastos en otra moneda en el período.

## Arquitectura (Opción A — cálculo en servidor, tab bajo demanda)

- **`lib/informe-economico.ts`** — funciones puras de agregación sobre filas
  normalizadas (`IngresoRow`, `GastoRow`): `kpis`, `porRenglon`, `porProyecto`
  (join ingreso↔gasto), `porMes`. Reutiliza fechas/presets/`rangoPeriodoAnterior`
  de `lib/gastos-informe.ts` y la constante `DESTINOS`.
- **`app/api/contabilidad/informe-economico/route.ts`** — `GET ?desde&hasta`.
  Protegido con `checkPermiso(request, 'contabilidad', 'ver')`. Hace 3 consultas
  Prisma (gastos RD$, cobros ingreso, pagos egreso sin gasto), normaliza a filas,
  llama al lib, calcula el período anterior y devuelve agregados JSON +
  `otrasMonedas` (cantidad y total).
- **`components/contabilidad/InformeEconomico.tsx`** — tab cliente. Estado de
  filtros, `fetch` al endpoint al abrir/cambiar filtros, render de KPIs y
  secciones (recharts para la evolución mensual, como el Informe de Gastos).
- **`app/contabilidad/ContabilidadClient.tsx`** — agregar el tab `resultado`
  (label "Resultado", icono) y montar `<InformeEconomico />`. La página padre
  ya pasa `clientes`; el tab carga su propia data, no infla la carga inicial.

## Fuera de alcance (fase 2)

- Export Excel y vista PDF A4 (replicando el patrón del Informe de Gastos:
  rutas que reusan `lib/informe-economico.ts`).
- Desglose por partida dentro de cada proyecto.
- Conversión de moneda.

## Deuda técnica respetada

Sin Zod en el input del endpoint (consistente con el resto del repo). Filtrado
de fechas en la query Prisma (gte/lte) en vez de traer todo a cliente, evitando
el problema de "sin paginación" para este informe.
