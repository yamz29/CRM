# Auditoría técnica profunda — CRM Gonzalva

**Fecha:** 2026-07-01 · **Alcance:** arquitectura, código, UX, rendimiento, mantenibilidad y consistencia (seguridad excluida a petición) · **Método:** análisis estático de todo el repo (~550 archivos TS/TSX, ~88.000 LOC, 194 rutas API, 87 páginas, 76 modelos Prisma) + lectura profunda de módulos representativos.

> Nota de honestidad metodológica: esta auditoría es de código, no de navegador (el entorno local no puede levantar la app por el mismatch Postgres/SQLite del `.env`, ver F0-1). Los hallazgos UX se derivan de leer los componentes reales, no de capturas.

---

## 0. Resumen ejecutivo

El proyecto está **muy por encima de la media** para un ERP interno construido iterativamente: `tsc --noEmit` pasa con 0 errores, hay un design system embrionario real (`components/ui/`, toasts unificados, ConfirmDialog, breadcrumbs, dark mode, Ctrl+K, memoria de filtros por URL), 143/194 rutas usan el wrapper de permisos, y las páginas server hacen queries en paralelo con `Promise.all` y `select` específicos.

Los problemas no son de "código sucio" sino de **tres decisiones estructurales que nunca se tomaron**, y cuya ausencia se replica 190 veces:

1. **No hay capa de datos en el cliente.** 300 `fetch()` crudos, 0 react-query/SWR, y el anti-patrón "props del server → copia en `useState` → mutación local + `router.refresh()`" en 21 componentes. Cada pantalla reinventa loading/error/refetch y mantiene dos fuentes de verdad.
2. **No hay contrato de API.** La infraestructura de validación existe (`lib/api-schemas.ts` con `parseBody()`) pero **solo 1 ruta de 194 la usa** (gastos) — la documentación dice "~4", la realidad es peor. 63 rutas ni siquiera tienen try/catch. Los tipos de respuesta se redeclaran a mano en cada componente (16+ copias de `interface Cliente/Proyecto/Factura`).
3. **No hay presupuesto de tamaño de componente.** 8 componentes superan las 1.000 líneas (el mayor: 1.906), un formulario tiene 36 `useState`, y hay **0 imports dinámicos** en toda la app: cada página de detalle carga el bundle de todas sus tabs aunque el usuario nunca las abra.

Además hay **~3.500 líneas de código muerto confirmado** (8 componentes + 2 módulos lib/hooks que nada importa), incluyendo `lib/iconos.ts` — creado en el **último commit** con el objetivo de centralizar iconos y que nadie importa: el refactor #H40 quedó a medias.

La buena noticia: como los problemas son sistémicos y no puntuales, **tres abstracciones (un `apiHandler`, un hook/capa de datos, y tipos compartidos) corrigen el 70% de los hallazgos** de forma incremental y de bajo riesgo.

---

## 1. Fortalezas (para no romperlas)

- **Cero errores de TypeScript** en 88k LOC. Base sólida para refactors.
- `withPermiso` en 143 rutas — el patrón correcto existe y se adoptó de verdad.
- Server components bien aprovechados en páginas de lectura: [proyectos/[id]/page.tsx](app/proyectos/[id]/page.tsx) hace 6 queries en `Promise.all` con `select` acotados.
- Design system incipiente honesto: `useToast` (65 usos, **0 `alert()`** en toda la app), `ConfirmDialog` (solo queda 1 `confirm()` nativo), `PageHeader`, `StatsCard`, `Breadcrumbs`, `useUrlFilters` (filtros persistidos en URL sin contaminar historial — bien pensado y bien documentado), `useUnsavedChangesWarning`, selección múltiple con `useSelection` + `BulkActionBar`.
- [lib/estados.ts](lib/estados.ts) es exactamente la abstracción correcta (mapa dominio→estado→variant verificado contra el schema)… el problema es que convive con sus predecesores (ver H-C2).
- Comentarios de diseño de calidad excepcional donde existen (el comentario de UTC en `formatDate`, el de `useUrlFilters`).
- Numeración `COT-YYYY-NNN` por `MAX` y no `count()`, snapshot presupuestario, transición Aprobado→Activo transaccional: las invariantes de negocio delicadas están bien resueltas.

---

## 2. Hallazgos transversales

Formato: **ID · Prioridad · Título** — evidencia → propuesta. (Impacto U=usuario, T=técnico; Dificultad; Riesgo de implementación.)

### Datos y estado (el hallazgo #1 del proyecto)

**H-A1 · 🔴 · Sin capa de data-fetching en el cliente**
300 llamadas `fetch()` distribuidas en 170 componentes cliente, sin caché, sin deduplicación, sin estados de carga/error uniformes. 0 usos de TanStack Query/SWR.
- *Síntoma agravado:* 21 componentes copian props del server a estado local (`useState(facturasIniciales)`) y luego mezclan mutación local + `router.refresh()` (87 usos). El refresh re-renderiza el server component con datos frescos, pero el `useState` ya no se re-inicializa → **dos fuentes de verdad que divergen silenciosamente**. Ejemplo: [ContabilidadClient.tsx:65](app/contabilidad/ContabilidadClient.tsx:65).
- *Propuesta:* adoptar **TanStack Query** como estándar único para datos mutables en cliente (las páginas de solo lectura siguen server-first, que ya funciona bien). Migración incremental módulo a módulo, empezando por Contabilidad (el más afectado).
- Impacto U: alto (datos obsoletos, spinners inconsistentes) · T: alto · Dificultad: media-alta (incremental) · Riesgo: medio.

**H-A2 · 🔴 · Contrato de API inexistente: validación al 0,5%**
`parseBody()` + Zod están construidos y documentados, pero `grep` confirma que **solo `app/api/gastos/route.ts` los usa**. SISTEMA.md §11 y CLAUDE.md dicen "~4 de ~192" — hay que corregir la doc además del código. Las rutas de contabilidad, nómina y cobros (dinero) aceptan cualquier body: `parseFloat(presupuestoEstimado)` sin chequear NaN, strings directos a Prisma.
- *Propuesta:* no pedir "validar 194 rutas" (no ocurrirá); crear **un wrapper único `apiHandler({ permiso, schema, handler })`** que componga `withPermiso` + `parseBody` + manejo de errores estándar, y migrar por olas: 1º contabilidad/nómina/cobros, 2º mutaciones restantes, 3º GETs con querystring.
- Impacto U: alto (errores 500 crípticos hoy) · T: alto · Dificultad: media · Riesgo: bajo (por ruta).

**H-A3 · 🟠 · 63/194 rutas sin try/catch y sin traducción de errores Prisma**
Un DELETE con FK dependiente ([proyectos/[id]/route.ts:209](app/api/proyectos/[id]/route.ts:209)) revienta con P2003 → 500 "Error al eliminar proyecto"; el usuario nunca sabe que el proyecto tiene gastos/facturas colgando. P2025 (no encontrado) tampoco se traduce a 404.
- *Propuesta:* dentro del mismo `apiHandler` de H-A2: catch central que mapee P2025→404, P2003→409 con mensaje de dominio ("No se puede eliminar: tiene N gastos asociados"), ZodError→400, resto→500 con log.
- Impacto U: alto · T: medio · Dificultad: baja (una vez existe el wrapper) · Riesgo: bajo.

**H-A4 · 🟠 · Endpoints multiplexados con flags mágicos**
`PUT /api/proyectos/[id]` es tres endpoints en uno según `body._archivar` / `body._patch` ([route.ts:53-101](app/api/proyectos/[id]/route.ts:53)). Es RPC encubierto, intipable e indocumentable; el mismo archivo duplica el bloque de notificación push dos veces (líneas 86-98 y 153-167).
- *Propuesta:* PATCH real para parciales; subrutas (`/archivar`) para acciones; extraer `notificarCambioEstado()`.
- Impacto U: bajo · T: medio · Dificultad: baja · Riesgo: bajo.

**H-A5 · 🟠 · Sin paginación server-side (deuda conocida, pero cuantificada)**
~121 `findMany` y solo 11 `take:` en todo `app/api`. El patrón dominante es "cargar tabla completa → filtrar en memoria en el cliente" ([clientes/page.tsx](app/clientes/page.tsx)). Solo `/presupuestos` y `/facturacion` paginan. Con 2 usuarios hoy funciona; con 2-3 años de gastos/facturas/horas la degradación será en las pantallas que más se usan.
- *Propuesta:* no generalizar a ciegas; instrumentar primero (contar filas por tabla en prod) y paginar las 4-5 tablas que crecen linealmente con el tiempo: `GastoProyecto`, `Factura`, `RegistroHoras`, `MovimientoBancario`, `Recibo`.
- Impacto U: medio (creciente) · T: alto · Dificultad: media · Riesgo: medio.

### Tipado

**H-B1 · 🟠 · Tipos de dominio redeclarados a mano en cada componente**
16+ redefiniciones de `interface Cliente/Proyecto/Factura` en componentes; 0 componentes cliente importan tipos Prisma. Cada redeclaración es una oportunidad de divergencia con el schema (y explica casts como `(proyecto as any).avanceFisico` en [proyectos/[id]/page.tsx:188](app/proyectos/[id]/page.tsx:188) — cast innecesario: el campo existe en el modelo).
- *Propuesta:* `lib/types.ts` (o `types/`) con payloads derivados: `export type FacturaConCliente = Prisma.FacturaGetPayload<{ include: { cliente: true } }>`. Los schemas Zod de H-A2 pueden inferir los tipos de entrada (`z.infer`) — un solo origen para API y formularios.
- Impacto T: alto · Dificultad: baja-media · Riesgo: bajo.

**H-B2 · 🟡 · 46 `: any` + 25 `as any`**
Concentrados en parsers de Excel y componentes viejos. Con `tsc` en 0 errores, es deuda barata de pagar por lotes.

### Código muerto y duplicación

**H-C1 · 🟠 · ~3.500 líneas de código muerto confirmado**
Escaneo de imports (verificado individualmente, no solo heurística):

| Archivo | Líneas | Nota |
|---|---|---|
| `components/presupuestos/PresupuestoBuilder.tsx` | 678 | Builder V1 — señal de que la retirada V1 puede avanzar |
| `components/documentos/SharePointBrowser.tsx` | 487 | Sustituido por SharePointFileManager |
| `components/documentos/OneDriveBrowser.tsx` | ~300 | ídem |
| `components/produccion/KanbanProduccion.tsx` | ~350 | |
| `components/produccion/QCChecklistEditor.tsx` | ~250 | |
| `components/produccion/MaterialesList.tsx` | ~200 | |
| `components/produccion/ImportarModulosModal.tsx` | ~250 | |
| `components/dashboard/PeriodoSelector.tsx` | ~100 | |
| `lib/iconos.ts` | ~100 | **Creado en el último commit (#H40) y nunca importado** |
| `hooks/useHelpSlug.ts` | ~30 | |

- *Propuesta:* verificar cada uno en el navegador/git log y borrar. Para `lib/iconos.ts`: decidir — o se conecta de verdad (ver H-D2) o se elimina; a medias es peor que nada.
- Impacto T: medio · Dificultad: trivial · Riesgo: casi nulo.

**H-C2 · 🟠 · Tres sistemas de colores de estado conviviendo**
1) `lib/estados.ts` (el bueno, "fuente de verdad única" según su propio doc-comment); 2) `getEstadoProyectoColor`/`getEstadoPresupuestoColor` en [utils.ts:33-57](lib/utils.ts:33) (mapas paralelos desactualizados: no conocen "Pausado"); 3) **231 literales de paleta** (`bg-green-100 text-green-700`…) inline en componentes, muchos sin variante `dark:` → badges ilegibles en dark mode.
- *Bug concreto:* `getEstadoColor()` ([utils.ts:55](lib/utils.ts:55)) hace `return getEstadoProyectoColor(e) || getEstadoPresupuestoColor(e)` — el primer término **siempre** devuelve string truthy (tiene fallback), así que los estados de presupuesto jamás resuelven su color.
- *Propuesta:* migrar todo a `estados.ts`/variantes de `Badge`, borrar los mapas de utils.ts, y un lint rule o grep en CI que prohíba `bg-*-100 text-*-700` fuera de `ui/`.
- Impacto U: medio (dark mode, consistencia) · T: medio · Dificultad: media (mecánica) · Riesgo: bajo.

**H-C3 · 🟡 · Duplicaciones menores**: formateadores locales en `onedrive.ts`/`parse-extracto.ts` en vez de `lib/utils`; bloques push repetidos; `formatCurrency` usa locale `en-US` mientras `formatDate` usa `es-DO`.

### Tamaño de componentes y rendimiento de bundle

**H-D1 · 🟠 · 8 god-components >1.000 líneas y 0 imports dinámicos**

| Componente | LOC | Problema principal |
|---|---|---|
| `cocinas/KitchenConfiguratorClient` | 1.906 | Editor completo en un archivo |
| `melamina/ModuloEditor` | 1.676 | ídem |
| `proyectos/gantt/GanttProyectos` | 1.400 | Render pesado, candidato #1 a `next/dynamic` |
| `contabilidad/ContabilidadClient` | 1.389 | **6 tabs = 1 client bundle**; toda Contabilidad es un solo componente cliente |
| `presupuestos/PresupuestoV2Builder` | 1.290 | |
| `apus/ApuEditor` | 1.151 | |
| `produccion/OrdenProduccionDetail` | 1.148 | |
| `proyectos/[id]/page.tsx` | 1.209 | Server, menos grave, pero importa las 10 tabs estáticamente |

`grep next/dynamic` = **0 resultados** en toda la app. La página de detalle de proyecto envía al cliente el código de Gantt, EVM (recharts), Punchlist, etc. aunque el usuario solo mire el resumen.
- *Propuesta:* (a) `next/dynamic` para tabs pesadas y editores (Gantt, EVM, configuradores, modales de importación); (b) regla de equipo: componente >400 líneas se parte (el patrón ya existe: el refactor de GastosTab del commit `df7d250` extrajo `PartidaCell`/`ColumnPicker` — replicarlo).
- Impacto U: medio-alto (TTI en páginas grandes) · T: alto · Dificultad: media · Riesgo: bajo-medio.

**H-D2 · 🟡 · Renders y percepción**
- Solo 10 `loading.tsx` para 87 páginas; ningún detalle (`[id]`) tiene skeleton → navegación a detalle "congela" sin feedback.
- Filtrado en memoria por keystroke sin `useDeferredValue`/debounce sobre tablas completas sin virtualización (aceptable hoy; será el cuello junto a H-A5).
- 29 `setTimeout` en UI, varios como hacks de sincronización.
- *Propuesta:* `loading.tsx` con skeleton en los 6-8 detalles principales; virtualización solo si la telemetría de H-A5 lo justifica.

### Formularios

**H-E1 · 🟠 · Formularios artesanales con 20-36 `useState`**
Sin react-hook-form ni equivalente. `FacturaForm` (927 líneas) tiene 36 `useState`; `GastoForm` modela montos como `string` en su interfaz y parsea a mano. Validación cliente = `required` HTML dispersos; los errores del server no se mapean a campos.
- *Propuesta:* **react-hook-form + zodResolver reutilizando los schemas de H-A2** (ya existe el precedente: `lib/empleado-form-schema.ts`). Migrar primero los 3 formularios de dinero (Factura, Gasto, Recibo).
- Impacto U: alto (errores de captura de dinero) · T: alto · Dificultad: media-alta · Riesgo: medio.

### UX transversal

**H-F1 · 🟡 · Dos paradigmas de feedback conviven**
Toast (estándar actual, 65 usos) vs `SuccessBanner` vía `?msg=creado` en la URL ([clientes/page.tsx](app/clientes/page.tsx)). Aunque SuccessBanner ya dispara toast (#H43), el mecanismo `?msg=` persiste: ensucia la URL, se re-dispara al recargar/compartir el enlace, y duplica el patrón.
- *Propuesta:* completar la migración: mutación → toast en el cliente; eliminar `?msg=` y `SuccessBanner`.

**H-F2 · 🟡 · Sin componente `EmptyState`**
89 textos "No hay…" ad-hoc, cada uno con su estilo, casi ninguno con CTA ("No hay gastos → **Registrar el primero**"). Un `<EmptyState icon título descripción acción />` en `ui/` estandariza y convierte estados vacíos en onboarding.

**H-F3 · 🟡 · Iconografía y color no gobernados**
El intento de gobernanza existe (`lib/iconos.ts`, #H40) pero quedó desconectado. Mismo concepto con iconos distintos entre módulos; 231 colores literales (H-C2). Decidir el mapa central y aplicarlo en Sidebar + PageHeaders como mínimo.

**H-F4 · 🟡 · Accesibilidad baja pero recuperable**
73 `aria-label` en toda la app; botones icon-only con `title` pero sin `aria-label`; se depende de Radix (bueno) donde se usa. Auditar con eslint-plugin-jsx-a11y (ya hay flat config) y corregir por lotes.

**H-F5 · 🟢 · Detalles menores**: 1 `confirm()` nativo restante; `formatCurrency` con separadores `en-US` (¿decisión o descuido? documentar).

---

## 3. Hallazgos por módulo

**Contabilidad** (el módulo con más riesgo/beneficio)
- `ContabilidadClient` 1.389 líneas + `FacturaForm` 927 + `RecibosTab` 897 + `FacturaDetalle` 861: el módulo entero vive en 4 god-components cliente (H-D1).
- Doble fuente de verdad facturas/cuentas (H-A1) — es el ejemplo canónico del anti-patrón.
- Rutas de dinero sin Zod (H-A2). Primera ola de migración recomendada.
- Tab state en `useState` (no URL): F5 o compartir enlace pierde la tab activa — inconsistente con proyectos/[id], que sí usa `?tab=`. **Estándar propuesto: tabs siempre en URL.**

**Proyectos**
- Página de detalle server-first bien resuelta (queries paralelas, tabs por searchParams). Mejorable: KPIs financieros (60 líneas de cálculo inline, líneas 144-206) deberían vivir en `lib/proyecto-kpis.ts` con tests — es lógica de negocio pura, exactamente lo que este repo ya testea bien.
- `PUT` multiplexado y DELETE sin FK-handling (H-A3/A4).
- Gantt de 1.400 líneas sin import dinámico.

**Presupuestos**
- V1 (`PresupuestoBuilder`) ya huérfano → ejecutar el plan de retirada V1 que SISTEMA.md pospone: verificar rutas `/api/presupuestos/*` legacy y modelos `Partida` con datos reales antes de borrar.
- `PresupuestoV2Builder` 1.290 líneas: extraer fila-de-partida, editor de APU embebido y totales.

**Melamina / Cocinas**
- Los dos mayores componentes del repo (1.906 y 1.676 líneas) están aquí. Son editores complejos legítimos, pero sin división interna ni lazy loading. Extraer: panel de piezas, cálculo de nesting (ya está en `lib/nesting.ts` con tests — bien), toolbar.
- Duplicación conceptual V1/V2 conocida (`ModuloMelamina` vs `V2`): igual que presupuestos, el V1 sigue montado en `app/melamina/[id]`.

**Producción**
- 4 componentes huérfanos (Kanban, QCChecklist, MaterialesList, ImportarModulos) sugieren una iteración abandonada a medias — borrar o terminar.
- `OrdenProduccionDetail` 1.148 líneas.

**Gastos**
- El módulo más sano: única ruta con Zod, refactor reciente de GastosTab, import masivo con 3 modos. Úsese como **módulo de referencia** del estándar.

**Documentos / SharePoint**
- 2 browsers huérfanos + el upload best-effort que falla en silencio (ya conocido y con herramienta de resync pendiente de correr en VPS). El patrón "best-effort silencioso" contradice el estándar de feedback del resto de la app: mínimo, un toast de advertencia cuando el upload a SharePoint falle.

**Dashboard**
- `app/page.tsx` (551) y `dashboard/ejecutivo` (455): server-first correcto. `PeriodoSelector` huérfano.

**Recursos / APUs / Compras / RRHH (empleados, horas, nómina)**
- Sin hallazgos propios más allá de los transversales (H-A1/A2/B1). Nómina entra en la ola 1 de validación Zod por ser dinero.

---

## 4. Propuestas de rediseño (visión arquitecto)

**R1 — `apiHandler` único (la pieza que más paga).** Un wrapper que componga permiso + validación + errores + logging da: contratos tipados end-to-end (con `z.infer`), 404/409 correctos, y un punto único para añadir después logging estructurado o rate-limiting. Las 194 rutas migran mecánicamente y por olas.

**R2 — Capa de datos cliente con TanStack Query.** Regla simple: *lectura → server component; mutación/refetch → useQuery/useMutation*. Elimina el doble estado (H-A1), los 87 `router.refresh()` selectivos y los spinners artesanales. Alternativa más conservadora: server actions + `revalidatePath`, pero con 300 fetch existentes la migración a Query es más mecánica.

**R3 — Paquete de contratos compartidos.** `lib/schemas/` (Zod, por dominio) + `lib/types.ts` (payloads Prisma). API valida con el schema; formulario usa el mismo schema con RHF; componente importa el payload. Una definición, tres usos — mata H-A2, H-B1 y H-E1 con la misma pieza.

**R4 — Presupuesto de componentes + lazy loading.** Regla de 400 líneas, `next/dynamic` para editores/tabs pesadas. No es un rewrite: es política aplicada en cada PR que toque un god-component.

**R5 — Plan de retirada V1.** Los huérfanos demuestran que la migración V2 ya terminó funcionalmente en presupuestos. Falta el último paso que nadie dio: auditar datos V1 en prod, congelar rutas legacy (410 Gone), borrar modelos en la migración a Decimal (mismo evento de schema).

**R6 — Estándar UX escrito** (una página en SISTEMA.md): tabs en URL, feedback solo por toast, EmptyState con CTA, colores de estado solo vía `estados.ts`, iconos solo vía mapa central, skeleton en todo detalle. Sin documento, la disciplina se evapora en el siguiente sprint.

---

## 5. Roadmap de implementación

Ordenado por (impacto ÷ riesgo). Cada fase es entregable de forma independiente.

| Fase | Contenido | Hallazgos | Esfuerzo | Riesgo |
|---|---|---|---|---|
| **0. Desbloqueo entorno** | Alinear `DATABASE_URL` local a Postgres (precondición de Decimal y de poder probar en navegador); corregir doc (parseBody "~4"→1) | F0, H-A2(doc) | ½ día | nulo |
| **1. Limpieza sin riesgo** | Borrar los 10 muertos confirmados; decidir destino de `iconos.ts`; eliminar mapas de estado de `utils.ts` + bug `getEstadoColor`; extraer `notificarCambioEstado` | H-C1, H-C2(parcial), H-A4(parcial) | 1-2 días | casi nulo |
| **2. `apiHandler` + ola 1 de validación** | Wrapper (permiso+Zod+errores P2025/P2003); migrar contabilidad, nómina, cobros, proyectos | H-A2, H-A3, H-A4 | 4-6 días | bajo |
| **3. Contratos compartidos** | `lib/types.ts` con payloads Prisma; matar 16 interfaces duplicadas y los `as any` fáciles | H-B1, H-B2 | 2-3 días | bajo |
| **4. Estándar UX** | `EmptyState`; migrar 231 literales de color a Badge/estados.ts; `loading.tsx` en detalles; retirar `?msg=`; tabs→URL en Contabilidad; documento R6 | H-C2, H-F1-F3, H-D2 | 4-5 días | bajo |
| **5. Capa de datos cliente** | TanStack Query; migrar Contabilidad primero (peor caso), luego módulo a módulo; eliminar doble estado | H-A1 | 1-2 sem (incremental) | medio |
| **6. Descomposición + lazy** | Partir los 8 >1.000 LOC (uno por sprint); `next/dynamic` en Gantt/EVM/editores | H-D1 | continuo | bajo-medio |
| **7. Formularios** | RHF + zodResolver con schemas de fase 2; primero Factura/Gasto/Recibo | H-E1 | 4-6 días | medio |
| **8. Escala de datos** | Medir tamaños de tabla en prod; paginar Gastos/Facturas/Horas/Movimientos; virtualización solo si hace falta | H-A5 | 1 sem | medio |
| **9. Schema** | Float→Decimal + borrado de modelos V1 (mismo evento de migración); requiere fase 0 y ventana de mantenimiento en VPS | conocidos | 3-5 días | alto |

**Regla transversal desde la fase 2:** todo PR que toque un módulo lo deja en el estándar nuevo (validación, tipos, colores, tabs en URL). Así el estándar se propaga sin necesitar un "gran refactor".

---

## Apéndice — métricas base (2026-07-01)

| Métrica | Valor |
|---|---|
| Archivos TS/TSX · LOC | ~550 · ~88.000 |
| Rutas API · con permiso · con Zod · sin try/catch | 194 · 143 · **1** · 63 |
| `fetch()` en cliente · react-query/SWR | 300 · 0 |
| `useState` · componentes >1.000 LOC · `next/dynamic` | 1.226 · 8 · **0** |
| `: any` + `as any` | 71 |
| Literales de paleta inline | 231 |
| `loading.tsx` / páginas | 10 / 87 |
| Código muerto confirmado | ~3.500 LOC |
| `tsc --noEmit` | ✅ 0 errores |
