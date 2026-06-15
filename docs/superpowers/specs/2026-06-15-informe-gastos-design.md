# Informe de Gastos — Diseño

**Fecha:** 2026-06-15
**Estado:** Aprobado (diseño)
**Módulo:** Gastos (`/gastos`)

## Objetivo

Convertir el módulo de Gastos —hoy puramente operativo (lista + filtros + export
crudo)— en una herramienta que además permita **analizar** en qué se gasta: por
**destino** (oficina / taller / proyectos / general), por **mes** y por
**proyecto**. El informe debe servir tanto para análisis interactivo en pantalla
como para generar un documento formal (PDF/Excel) para gerencia.

## Contexto actual (lo que ya existe)

- **Modelo `GastoProyecto`** ([prisma/schema.prisma:121](../../../prisma/schema.prisma)) ya guarda
  todo lo necesario: `destinoTipo` (`proyecto|oficina|taller|general|sin_asignar`),
  `fecha`, `monto`, `moneda`, `categoria`, `subcategoria`, `suplidor`, `tipoGasto`,
  `metodoPago`, `cuentaOrigen`, `estado` (`Registrado|Revisado|Anulado`), vínculo a
  `proyecto` y `partida`.
- **`app/gastos/page.tsx`** carga **todos** los gastos (con `proyecto` y `partida`) y
  los pasa al cliente.
- **`app/gastos/GastosPageClient.tsx`**: vista operativa con tarjetas por destino,
  filtros client-side (búsqueda, destino, proyecto, estado, "sin partida"), tabla
  plana y export Excel crudo.
- **`app/api/gastos/route.ts`** (GET) ya soporta filtro por rango de fechas
  (`desde`/`hasta`) pero **la UI no lo expone**.
- **`recharts`** ya está instalado y se usa en reportes existentes
  (`components/oportunidades/ReportePipelineClient.tsx`,
  `app/proyectos/reporte/ReporteProyectosClient.tsx`).
- Patrón de impresión A4 shell-free: rutas `*/imprimir` con un `PrintButton`
  (ej. `app/presupuestos/[id]/imprimir/`). El layout omite el shell para rutas
  que contienen `/imprimir` o `/reporte`.

### Brechas que cubre este diseño
1. La UI no expone filtro por rango de fechas.
2. No hay agrupaciones/subtotales (mes, destino, proyecto).
3. No hay gráficos ni comparativas.
4. El Excel es una lista cruda sin totales.

## Decisiones de alcance (acordadas)

| Tema | Decisión |
|------|----------|
| Propósito | **Ambos**: dashboard interactivo + exportación PDF/Excel con formato |
| Cortes de análisis | **Por destino · Por mes · Por proyecto** |
| Ubicación | Toggle `Lista \| Informe` dentro de `/gastos` |
| Monedas | **Separar por moneda** (sistema NO convierte). Informe muestra **una moneda a la vez**; default `RD$`; aviso si hay gastos en otras monedas en el periodo |
| Anulados | **Excluir siempre** (solo `Registrado` + `Revisado`) |
| Arquitectura | **A** (agregación en cliente para el dashboard, reusando datos ya cargados) + **C** (endpoints/rutas dedicados solo para exportar) |

## Arquitectura

### Enfoque A — dashboard en cliente
La página `/gastos` ya carga todos los gastos en memoria. El tab "Informe" agrega
esos mismos datos con `useMemo`. No se añade API nueva para el dashboard. Encaja
con el patrón del CRM (SQLite, dataset pequeño; deuda técnica conocida: sin
paginación server-side).

### Enfoque C — exportaciones dedicadas
- **Excel**: endpoint nuevo que recibe los filtros por query y arma un workbook con
  formato (sigue el patrón de `app/api/export/gastos/route.ts`).
- **PDF**: ruta server A4 shell-free `*/imprimir` que recibe los filtros por
  `searchParams` (sigue el patrón de `app/presupuestos/[id]/imprimir/`).

### Fuente de verdad única
`lib/gastos-informe.ts` contiene **funciones puras** de agregación (filtrar por
moneda/estado/rango, agrupar por mes/destino/proyecto, calcular periodo anterior).
Las consumen los tres destinos (dashboard, Excel, PDF) para no duplicar lógica.

## Componentes

### 1. Toggle de vista — `app/gastos/GastosPageClient.tsx` (editar)
- Estado local `vista: 'lista' | 'informe'`.
- Control segmentado en el header.
- Renderiza la lista actual (sin cambios) o `<GastosInforme>` según `vista`.
- `GastosInforme` recibe los mismos props ya disponibles (`gastos`, `proyectos`).

### 2. Dashboard — `components/gastos/GastosInforme.tsx` (nuevo, cliente)
**Barra de filtros propia:**
- Rango de fechas con presets: `Este mes · Mes pasado · Este año · Todo ·
  Personalizado` (dos inputs `date`). Default: **Este año**.
- Selector de **moneda** (default `RD$`). Si hay gastos de otra moneda en el
  periodo: aviso "Hay X gastos en USD/EUR no incluidos — cambia la moneda para
  verlos."
- Filtros opcionales reutilizados: **destino** y **proyecto**.
- Anulados siempre excluidos.

**Contenido (recharts + tarjetas), todo vía `useMemo`:**
1. **KPIs**: Total del periodo · # gastos · Ticket promedio · **Δ% vs periodo
   anterior** (misma duración inmediatamente previa).
2. **Por destino**: barras/tarjetas con monto y **% del total**.
3. **Por mes**: `BarChart` mensual (apilable por destino) + tabla mes × total.
4. **Por proyecto**: ranking (solo `destinoTipo=proyecto`), Top N + "ver todos";
   fila expandible a **partidas** del proyecto.

**Botones de exportación**: "Excel" (abre endpoint con filtros) y "PDF/Imprimir"
(abre `/gastos/informe/imprimir` con los filtros como query).

### 3. Excel — `app/api/export/gastos/informe/route.ts` (nuevo)
- `GET` protegido con `withPermiso('gastos', 'ver', ...)`.
- Query: `desde`, `hasta`, `moneda`, `destino?`, `proyectoId?`.
- Workbook con hojas:
  - **Resumen**: KPIs + tabla por destino + tabla por mes.
  - **Detalle**: lista filtrada con subtotales.
- Usa helpers de `lib/gastos-informe.ts`.

### 4. PDF — `app/gastos/informe/imprimir/page.tsx` + `PrintButton.tsx` (nuevos)
- Server component A4, shell-free (la ruta contiene `/imprimir`).
- Lee filtros de `searchParams`, consulta Prisma, agrega con
  `lib/gastos-informe.ts`, renderiza KPIs + por destino + por mes + por proyecto.
- `PrintButton` dispara `window.print()` (patrón existente).

### 5. Helpers — `lib/gastos-informe.ts` (nuevo)
Funciones puras y tipos compartidos:
- `filtrarGastos(gastos, { moneda, desde, hasta, destino?, proyectoId? })` — excluye
  Anulado, aplica moneda/rango/filtros.
- `agruparPorMes(gastos)` → `{ mes: 'YYYY-MM', total, porDestino }[]`.
- `agruparPorDestino(gastos)` → `{ destino, total, pct }[]`.
- `agruparPorProyecto(gastos)` → ranking con desglose por partida.
- `calcularKpis(gastos, gastosPeriodoAnterior)` → total, conteo, promedio, deltaPct.
- `rangoPeriodoAnterior(desde, hasta)` → `{ desde, hasta }` de la duración previa.

## Flujo de datos

```
app/gastos/page.tsx (server)
  └─ findMany gastos (+proyecto +partida)  ──► GastosPageClient
                                                  ├─ vista 'lista'  → tabla actual
                                                  └─ vista 'informe'→ GastosInforme
                                                        └─ useMemo(lib/gastos-informe) → KPIs/charts/tablas
                                                        ├─ botón Excel → /api/export/gastos/informe?filtros
                                                        └─ botón PDF   → /gastos/informe/imprimir?filtros (server, lib/gastos-informe)
```

## Manejo de errores y casos borde
- **Periodo sin gastos**: KPIs en 0, mensaje "No hay gastos en este periodo".
- **Moneda con 0 gastos pero otras monedas presentes**: mostrar el aviso de monedas.
- **Δ% sin periodo anterior** (división por 0): mostrar "—" en lugar de Δ.
- **Proyecto eliminado** (gasto con `proyectoId` null pero `destinoTipo=proyecto`):
  agrupar como "Sin proyecto".
- **Fechas inválidas en query del export/PDF**: usar defaults (Este año).

## Verificación (manual, no hay tests automatizados)
Gates del proyecto antes de cerrar: `npx tsc --noEmit`, `npm run lint` (0 errores),
`npm run build` (ignorar error Prisma de prerender). Verificación manual en
navegador: toggle Lista/Informe, presets de fecha, cambio de moneda con aviso,
exportar Excel, abrir PDF e imprimir.

## Fuera de alcance (YAGNI)
- Conversión automática de monedas.
- Cortes por categoría/suplidor (no priorizados; el modelo los soporta si se piden
  después).
- Agregación server-side / paginación (el dataset es pequeño).
- Guardar/compartir informes; programación de envíos.
