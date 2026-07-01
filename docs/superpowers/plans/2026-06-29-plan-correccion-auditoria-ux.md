# Plan de corrección — Auditoría UX/Productividad (minimax M3)

> **Para workers agénticos:** este es un **plan maestro por fases**. Cada fase es un subsistema independiente que produce software funcional por sí solo. Las Fases 0–1 están detalladas a nivel de tarea (listas para ejecutar con superpowers:executing-plans o subagent-driven-development). Las Fases 2–7 están especificadas a nivel de alcance/archivos/aceptación; **al iniciar cada una se escribe su propio plan detallado** con la skill `writing-plans`. Pasos con checkbox (`- [ ]`).

**Goal:** Corregir de forma incremental y de bajo riesgo los ~50 hallazgos verificados de la auditoría minimax M3, empezando por primitivas compartidas que habilitan el resto.

**Architecture:** Bottom-up. Primero se consolidan primitivas del design-system (badges/botones/iconos/feedback) que eliminan duplicación y desbloquean cambios globales; luego la deuda estructural de listados (URL-driven + paginación con un `<DataTable>` reutilizable); sobre esa base, productividad (inline edit, bulk, mobile); después las pantallas críticas; y al final lo estratégico que requiere migraciones de schema.

**Tech Stack:** Next.js 16 (App Router, Server Components) · React 19 · TypeScript · Prisma 5 + PostgreSQL · Tailwind + shadcn-custom · Vitest (solo utilidades puras en `lib/__tests__/`). Verificación de UI: **manual en navegador** (no hay E2E). Idioma del dominio: **español**.

---

## Principios de ejecución

1. **Orden por dependencia, no por impacto.** Las fases tempranas crean primitivas que las tardías reutilizan. No saltar.
2. **TDD donde aplica.** Solo la lógica pura (mapas de estado, helpers de paginación, conteos, parsers de filtros) va con test Vitest en `lib/__tests__/`. Los cambios de UI se verifican manualmente en navegador — no inventar tests de componentes que el repo no tiene.
3. **Commits frecuentes**, uno por tarea. Rama por fase: `fix/ux-faseN-<tema>`.
4. **Gates antes de cerrar cada fase:** `npx tsc --noEmit` (0 errores) + `npm run lint` (0 errores) + `npm test` (verde) + `npm run build` (ignorar error conocido de prerender Prisma). Ver memoria [[gates-verificacion-crm]].
5. **No tocar V1/V2 legacy sin verificar uso** (ver CLAUDE.md). No "arreglar" deuda técnica documentada como aceptada (xlsx, Float→Decimal).

## Excluidos del plan (ya implementados — verificado contra código)

- **#H06** — Dashboard ya reordenado: "Acciones pendientes" es la Sección 1.
- **#H27** — OCR ya implementado y ya en posición #1 del `GastoForm` (`GastoForm.tsx:232`).
- **#H35 (parcial)** — `CambiarEstadoButton:100` ya avisa que aprobar activa el proyecto.
- **#H21 (parcial)** — 4/9 botones de borrado ya usan `ConfirmDialog`.

> Nota de matiz sobre #H21: los 5 botones restantes **sí confirman**, pero con un patrón viejo de **doble clic inline** (estado `confirming`), no con `ConfirmDialog`. El objetivo es **unificar el patrón**, no "añadir confirmación inexistente".

---

## Fase 0 — Consolidación del design-system (primitivas compartidas)

**Por qué primero:** elimina las 222 ocurrencias de color hardcodeado en 58 archivos y crea los mapas centrales que las fases siguientes reutilizan. Riesgo bajo (cosmético), alto retorno, sin migraciones.

**Cierra:** #H37, #H38, #H40, #H41, #H42, #H43.

**File Structure:**
- Create: `lib/estados.ts` — mapa `dominio → estado → variant` + componente `EstadoBadge`.
- Create: `lib/iconos.ts` — mapa `concepto → componente Lucide`.
- Modify: `components/ui/button.tsx` — añadir prop opcional `color`.
- Modify: `components/layout/Sidebar.tsx:253` — token en vez de hex.
- Modify: `tailwind.config.*` — tokens de motion.
- Modify (barrido): los 58 archivos con badges/botones inline → migrar a `EstadoBadge`/`<Button>`.

### Task 0.1: Mapa central de estados + `EstadoBadge`

**Files:**
- Create: `lib/estados.ts`
- Test: `lib/__tests__/estados.test.ts`

- [ ] **Step 1: Escribir test que falla** — `lib/__tests__/estados.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { variantDeEstado } from '@/lib/estados'

describe('variantDeEstado', () => {
  it('mapea estado de proyecto conocido', () => {
    expect(variantDeEstado('proyecto', 'En Ejecución')).toBe('success')
    expect(variantDeEstado('proyecto', 'Pausado')).toBe('orange')
  })
  it('mapea estado de OC y presupuesto', () => {
    expect(variantDeEstado('oc', 'recibida')).toBe('success')
    expect(variantDeEstado('presupuesto', 'Rechazado')).toBe('danger')
  })
  it('cae a default ante estado desconocido', () => {
    expect(variantDeEstado('proyecto', 'Marciano')).toBe('default')
  })
})
```

- [ ] **Step 2: Correr y ver fallar** — `npm test -- estados` → FAIL ("variantDeEstado is not a function").

- [ ] **Step 3: Implementar** — `lib/estados.ts`

```ts
import type { BadgeProps } from '@/components/ui/badge'

type Variant = NonNullable<BadgeProps['variant']>
type Dominio = 'proyecto' | 'presupuesto' | 'oc' | 'tarea' | 'ruta' | 'gasto' | 'factura'

const MAPAS: Record<Dominio, Record<string, Variant>> = {
  proyecto:    { 'Prospecto': 'default', 'En Cotización': 'info', 'Adjudicado': 'warning', 'En Ejecución': 'success', 'Pausado': 'orange', 'Terminado': 'secondary', 'Cancelado': 'danger' },
  presupuesto: { 'Borrador': 'default', 'Enviado': 'info', 'Aprobado': 'success', 'Rechazado': 'danger' },
  oc:          { 'borrador': 'default', 'enviada': 'info', 'recibida': 'success', 'cancelada': 'danger' },
  tarea:       { 'Pendiente': 'default', 'En proceso': 'info', 'Completada': 'success', 'Archivada': 'secondary' },
  ruta:        { 'planificada': 'info', 'en_curso': 'warning', 'completada': 'success', 'cancelada': 'danger' },
  gasto:       { 'Registrado': 'warning', 'Revisado': 'success', 'Anulado': 'danger' },
  factura:     { 'pendiente': 'warning', 'pagada': 'success', 'anulada': 'danger', 'vencida': 'danger' },
}

export function variantDeEstado(dominio: Dominio, estado: string): Variant {
  return MAPAS[dominio]?.[estado] ?? 'default'
}

export type { Dominio }
```

> **Nota de implementación:** verificar los estados reales de cada dominio en `prisma/schema.prisma` antes de fijar las claves (algunos como `oc`/`ruta` usan minúsculas). Ajustar el mapa a los valores reales — no asumir los de arriba ciegamente.

- [ ] **Step 4: Correr y ver pasar** — `npm test -- estados` → PASS.

- [ ] **Step 5: Añadir componente `EstadoBadge`** al final de `lib/estados.ts`

```tsx
import { Badge } from '@/components/ui/badge'
export function EstadoBadge({ dominio, estado }: { dominio: Dominio; estado: string }) {
  return <Badge variant={variantDeEstado(dominio, estado)}>{estado}</Badge>
}
```

- [ ] **Step 6: Commit** — `git add lib/estados.ts lib/__tests__/estados.test.ts && git commit -m "feat(ui): mapa central de estados + EstadoBadge (#H37)"`

### Task 0.2: Migrar badges inline al `EstadoBadge`

**Files (barrido, uno por commit-grupo):** `components/recursos/RecursosTable.tsx`, `components/tareas/TareasPageClient.tsx`, `components/compras/ComprasPageClient.tsx`, `app/compras/rutas/RutasCompraPageClient.tsx`, `app/proyectos/kanban/KanbanClient.tsx`, `components/empleados/EmpleadosTable.tsx`, `components/gastos/GastosTab.tsx`.

- [ ] **Step 1:** Localizar cada badge hardcodeado: `grep -rn "bg-\(green\|red\|blue\|amber\|yellow\|orange\)-100" components/` y filtrar los que representan **estado de dominio** (no acentos decorativos).
- [ ] **Step 2:** Reemplazar cada bloque inline por `<EstadoBadge dominio="..." estado={x} />`. NO tocar badges que no son de estado (ej. contadores).
- [ ] **Step 3:** Verificación manual en navegador: abrir cada listado y confirmar que los colores de estado se ven idénticos o mejores.
- [ ] **Step 4:** Gate parcial: `npx tsc --noEmit && npm run lint`.
- [ ] **Step 5: Commit** por módulo — `git commit -m "refactor(ui): EstadoBadge en <modulo> (#H37)"`

### Task 0.3: Prop `color` en `Button` + migrar botones de color hardcodeados

**Files:** Modify `components/ui/button.tsx`; barrido en componentes con `bg-green-600`/`bg-red-600`/etc. fuera de `<Button>`.

- [ ] **Step 1:** Añadir a `ButtonProps` la prop `color?: 'success' | 'danger'` y, en el render, aplicar clases tonales cuando se pase (verde para aprobar, rojo para destructivo), preservando padding/focus-ring base. Mantener `variant` como está.
- [ ] **Step 2:** `grep -rn "className=.*bg-\(green\|red\|blue\|amber\)-600" components/ app/` → cada `<button>`/`<Link><button>` crudo pasa a `<Button variant=... color=...>`.
- [ ] **Step 3:** Verificación manual: botones "Aprobar"/"Eliminar"/"Guardar" se ven y enfocan consistentes.
- [ ] **Step 4:** Gate `tsc + lint`. **Commit** por módulo.

### Task 0.4: Tokens (sidebar, motion) + iconos centralizados

**Files:** `components/layout/Sidebar.tsx:253`, `tailwind.config.*`, Create `lib/iconos.ts`.

- [ ] **Step 1 (#H42):** Definir `--sidebar` en `globals.css` (mismo `#0b0f1a` actual como valor del token en ambos temas si se quiere conservar el look) y cambiar `bg-[#0b0f1a] dark:bg-[#0b0f1a]` por `bg-sidebar`.
- [ ] **Step 2 (#H41):** Añadir `transitionDuration`/`transitionTimingFunction` tokens en Tailwind config; reemplazar `transition-all` por `transition-[colors,box-shadow,transform]` en `button.tsx` y `StatsCard.tsx`.
- [ ] **Step 3 (#H40):** Crear `lib/iconos.ts` con `export const ICONO = { proyecto: FolderOpen, parada: MapPin, cotizacion: FileText, recurso: Package, ... }` y reemplazar usos divergentes (`Building2` vs `FolderOpen` para proyecto). Decidir UN icono por concepto.
- [ ] **Step 4:** Verificación manual + gate. **Commit** `style(ui): tokens de sidebar/motion + iconos centralizados (#H40 #H41 #H42)`.

### Task 0.5: Consolidar feedback positivo (`SuccessBanner` → `useToast`)

**Files:** auditar `?msg=` en `app/clientes/page.tsx`, `app/proyectos`, `app/tareas`; los handlers cliente correspondientes.

- [ ] **Step 1 (#H43):** Para acciones que ocurren **en cliente** (POST/PUT/DELETE con handler), reemplazar el patrón `router.push('?msg=creado')` + `SuccessBanner` por `toast.exito(...)` antes/después del `router.refresh()`.
- [ ] **Step 2:** Conservar `SuccessBanner` **solo** para redirects server-side donde no hay cliente activo. Documentar este criterio en un comentario en `success-banner.tsx`.
- [ ] **Step 3:** Verificación manual: crear/editar cliente muestra toast, no banner. Gate. **Commit**.

**Criterio de aceptación Fase 0:** `grep` de badges/botones de estado hardcodeados devuelve ~0 en los listados principales; sidebar usa token; un solo sistema de feedback en acciones cliente; `npm test` verde.

---

## Fase 1 — Seguridad de datos y consistencia de confirmaciones

**Por qué ahora:** riesgo cero, cierra inconsistencias visibles a diario. No depende de Fase 0 pero se beneficia del `EstadoBadge`.

**Cierra:** #H21 (los 5 restantes), #H34, #H35 (completar), #H18 (cerrar huecos).

### Task 1.1: Unificar los 5 botones de borrado a `ConfirmDialog`

**Files:** `app/recursos/DeleteRecursoButton.tsx`, `app/tareas/DeleteTareaButton.tsx`, `components/empleados/DeleteEmpleadoButton.tsx`, `app/melamina/DeleteModuloButton.tsx`, `app/apus/DeleteApuButton.tsx`. **Patrón canónico de referencia:** `app/clientes/DeleteClienteButton.tsx`.

- [ ] **Step 1:** Para cada archivo, reemplazar el estado `confirming` (doble-clic inline) por el patrón: estado `abierto` + `<ConfirmDialog>` modal. API confirmada de `ConfirmDialog`: `{ abierto, titulo, descripcion?, textoConfirmar?, variante: 'peligro', cargando, onConfirmar, onCancelar }`. Feedback con `useToast().exito/error` + `router.refresh()`.
- [ ] **Step 2:** Texto del diálogo específico por entidad (ej. recurso: "¿Eliminar el recurso «X»? Esta acción no se puede deshacer."). Para entidades con dependencias (recurso usado en APUs), si el API devuelve 409, mostrar `toast.error` con el mensaje del backend (ya lo hace `DeleteClienteButton`).
- [ ] **Step 3:** Verificación manual: cada borrado abre modal, confirma, toast, lista refresca. Gate `tsc + lint`.
- [ ] **Step 4: Commit** — `git commit -m "fix(ui): unificar borrados a ConfirmDialog (#H21)"`

### Task 1.2: `DuplicarButton` muestra alcance de la copia

**Files:** `app/presupuestos/[id]/DuplicarButton.tsx` (39 líneas), y la página que lo renderiza (para pasar conteos ya disponibles en el server component).

- [ ] **Step 1 (#H34):** Pasar como props `nPartidas` y `nCapitulos` (calculados en el server component que ya carga el presupuesto). Mostrarlos en el `ConfirmDialog`: "Vas a duplicar este presupuesto (N partidas en M capítulos)."
- [ ] **Step 2:** Estado `cargando` en el botón durante el POST (`Loader2`), por si la copia tarda.
- [ ] **Step 3:** Verificación manual + gate. **Commit**.

### Task 1.3: Completar side-effects en cambios de estado

**Files:** `app/presupuestos/[id]/CambiarEstadoButton.tsx` (ya avisa de activación de proyecto).

- [ ] **Step 1 (#H35):** Enriquecer el texto del diálogo de "Aprobar" con la lista completa de efectos verificados en CLAUDE.md (activa proyecto en la misma transacción; bloquea edición de partidas si aplica). NO inventar efectos que el backend no produce — verificar en `PUT /api/presupuestos/[id]/estado`.
- [ ] **Step 2:** Verificación manual + gate. **Commit**.

### Task 1.4: Cerrar huecos de revalidación tras mutaciones

**Files:** componentes que mutan sin `router.refresh()` (auditar; ya hay 50 usos correctos).

- [ ] **Step 1 (#H18):** `grep -rL "router.refresh" $(grep -rl "method: 'POST'\|method: 'PUT'\|method: 'DELETE'" components app)` para encontrar mutaciones sin refresh. Añadir `router.refresh()` tras éxito donde falte.
- [ ] **Step 2:** (Opcional, si se decide) crear `hooks/useRevalidateOnFocus.ts` que llame `router.refresh()` al volver el foco a la pestaña, y montarlo en listados clave. Evaluar costo/beneficio antes de generalizar.
- [ ] **Step 3:** Verificación manual + gate. **Commit**.

**Criterio de aceptación Fase 1:** ningún borrado usa doble-clic inline; duplicar muestra conteo; mutaciones refrescan su vista.

---

## Fase 2 — Listados URL-driven + paginación server-side (deuda estructural)

**Por qué aquí:** es la fundación de las Fases 3–4. Crea el `<DataTable>` reutilizable y el patrón `?page=&q=&filtro=`. Es la pieza más grande; **requiere su propio plan detallado** al iniciarse.

**Cierra:** #H07, #H08, #H09, #H48. Patrón canónico ya existente: `app/presupuestos/PresupuestosBuscador.tsx` (64 líneas) + paginación de `/presupuestos` y `/facturacion`.

**Alcance:**
- Create `components/ui/data-table.tsx` — recibe `columns`, `rows`, `pagination`, `filters`; render server-friendly con controles cliente que escriben a la URL.
- Create `lib/paginacion.ts` — helper puro `parsearParams({page, perPage, q})` + `skipTake()` (TDD en `lib/__tests__/`).
- Create `components/ui/url-filtros.tsx` — barra de búsqueda + chips con debounce 300ms que serializa a `searchParams` (extraído del patrón `PresupuestosBuscador`).
- Migrar, en este orden (de más simple a más complejo): `/clientes` (#H07) → `/empleados` → `/tareas` → `/proyectos` → `/recursos` (#H08) → `/gastos`.

**Criterio de aceptación:** cada listado migrado responde a `?q=&page=&...` en la URL (compartible, sobrevive refresh); `RecursosTable` conserva localStorage de columnas pero filtros van a URL; paginación server-side (`skip/take` en la query Prisma) en los 6 listados.

**Esfuerzo:** Alto. **Plan propio requerido.**

---

## Fase 3 — Productividad en listados (sobre `<DataTable>`)

**Depende de:** Fase 2.

**Cierra:** #H10, #H11/#H46, #H12, #H47.

**Alcance:**
- **#H10 Edición inline:** generalizar el patrón `onBlur` ya presente en `app/compras/rutas/[id]/RutaCompraDetail.tsx` (único con inline hoy). Celdas editables: estado de tarea (dropdown in-cell con PATCH), avance de proyecto (input numérico), costo unitario de recurso (input `step=0.01`), asignado de tarea (dropdown usuarios).
- **#H11/#H46 Selección múltiple + bulk:** crear `components/ui/bulk-actions.tsx` (checkbox de cabecera + barra flotante). Patrón de referencia: la asignación bulk ya existente en `GastosTab`. Aplicar a tareas, empleados, recursos, compras.
- **#H12 Anchos responsive:** reemplazar `w-24`/`w-72`/`shrink-0` hardcodeados en `RecursosTable` y `KanbanClient` por anchos fluidos; kanban `flex-col` en móvil.
- **#H47 Vistas mobile-card:** para `tareas/gastos/clientes/proyectos/empleados`, render de cards verticales cuando el viewport es `<768px` (Tailwind `md:hidden`/`hidden md:table`).

**Criterio de aceptación:** operaciones de estado/avance sin abrir el detalle; bulk en ≥4 listados; sin scroll horizontal permanente; listados usables en móvil.

**Esfuerzo:** Medio-Alto. **Plan propio requerido.**

---

## Fase 4 — Pantallas críticas (proyecto, presupuesto, dashboard)

**Cierra:** #H19, #H20, #H50, #H22, #H23, #H24, #H33, #H14, #H32, #C05.

**Alcance:**
- **#H19** Aplanar la doble navegación grupos→sub-tabs de `app/proyectos/[id]/page.tsx` (1147 líneas) a una sola barra de tabs sticky; recordar última tab usada (localStorage).
- **#H20/#H50** Reordenar la tab Resumen: alertas → bloque "presupuesto vs gastado" con **Balance** como métrica protagonista (`text-3xl`) → indicadores → refs cronograma/presupuestos.
- **#H24** Botón "+ Crear en este proyecto" en el header con popover (tarea/gasto/actividad/punchlist/bitácora), cada uno con `defaultProyectoId`. Atajo `c`.
- **#H22** Vincular presupuesto vía combobox inline en la tab Presupuestos (PUT directo) en vez del modal; + "Nuevo presupuesto para este proyecto" → `/presupuestos/nuevo-v2?proyectoId=X` (ya existe).
- **#H23** Evaluar embeber el Gantt en la tab Programación (revisar primero qué hace hoy `ProgramaTab`, que es más autónomo de lo que la auditoría supone — **no** enlaza a `/cronograma/[id]`).
- **#H33** Drawer "Vista previa" en `PresupuestoV2Builder` reutilizando la lógica de `/presupuestos/[id]/imprimir`, con debounce 500ms.
- **#H14 + #H32** Crear `/dashboard/personal` (Mi día: mis tareas hoy/vencidas, mis horas semana, mis proyectos, gastos pendientes) y/o widget "Mi actividad reciente" en el dashboard. Primer ítem del sidebar.
- **#C05** Timeline comercial en `/clientes/[id]` o `/proyectos/[id]`: Presupuesto creado→Enviado→Aprobado→Adicional→Cobros→Cierre. (Gran diferenciador; existe `BitacoraTimeline` como referencia de UI, pero los datos vienen del ciclo presupuesto/proyecto.)

**Criterio de aceptación:** detalle de proyecto sin doble navegación; Balance visible de un vistazo; creación contextual; preview de PDF en vivo; punto de entrada personal.

**Esfuerzo:** Alto. **Plan(es) propio(s) requerido(s)** — probablemente subdividir en 4a (proyecto), 4b (presupuesto), 4c (dashboard personal + timeline).

---

## Fase 5 — Búsqueda, navegación y atajos (power users)

**Cierra:** #H03, #H44, #H05, #H02, #H04.

**Alcance:**
- **#H03** Extender `/api/search` y `CommandPalette` con `tareas/recursos/empleados/gastos/melamina`; "Recientes" con input vacío (localStorage últimas 10 visitas); fuzzy con Fuse.js (~5KB); quick actions contextuales cuando la ruta tiene ID. (El placeholder ya nombra las 4 entidades actuales — corregir solo al añadir las nuevas.)
- **#H44** `hooks/useKeyboardShortcuts.ts`: `g c`/`g p` navegación, `n` nuevo en contexto, `/` foco buscador, `?` modal de ayuda de atajos.
- **#H05** Componente `Breadcrumbs` con `usePathname()` + mapa `path→label`, en `LayoutShell`. Reemplaza el "← Volver" manual de `/dashboard/ejecutivo`.
- **#H02** Convertir "Ayuda" del sidebar en FAB global que detecta la ruta y carga el slug de `content/help/` correspondiente (buscador como fallback). Auditar primero la cobertura real de `HelpDrawer` (está en más módulos de los que la auditoría dice, p. ej. melamina).
- **#H04** Estandarizar paths: redirects de `/cronograma`→`/cronogramas` y namespace `/melamina/modulos`, alineando los labels del sidebar. Requiere redirects para no romper links.

**Esfuerzo:** Medio. **Plan propio requerido.**

---

## Fase 6 — Mejoras por módulo

**Cierra:** Gastos (#H13, #H28, #H29, #H26), Horas (#H30, #H31), Empleados (#H16, #H17), Presupuestos (#H15), Kanban (#H36).

**Alcance:**
- **Gastos:** chips de filtro siempre visibles incl. búsqueda textual (#H13/#H28) + filtros guardados por usuario (requiere persistencia); link/badge "gastos en estado Registrado sin revisar" (#H29); refactor de `GastosTab` (933 líneas) en sub-componentes `Table/Form/Import` siguiendo `RecursosTable` (#H26).
- **Horas:** toggle Día/Semana/Mes sobre la vista semanal existente (#H30); botón timer start/stop con estado en localStorage (#H31).
- **Empleados:** `EmpleadoForm` (331 líneas) a tabs/acordeón con autosave por tab usando `useUnsavedChangesWarning` ya existente (#H16); adoptar `react-hook-form` + Zod reutilizando `lib/api-schemas.ts` para validación client+server (#H17) — **decisión transversal**: define el patrón de formularios para todo el repo.
- **Presupuestos:** redirect `/presupuestos/[id]/editar` → `/editar-v2`, ocultar path V1 (#H15). La migración de datos V1→V2 es un proyecto aparte, NO incluir aquí.
- **Kanban:** generalizar `KanbanClient` a `<DraggableKanban>` y aplicarlo a presupuestos y oportunidades (#H36).

**Esfuerzo:** Medio-Alto, paralelizable por módulo. **Plan propio por módulo.**

---

## Fase 7 — Estratégico / schema / gaps de mercado (backlog priorizado)

**Requiere migraciones de schema y/o son features grandes.** No bloquean nada de lo anterior. Cada uno es un mini-proyecto.

**Cierra (orden sugerido por valor/esfuerzo):**
1. **#G03 Adjuntos** — wire-up de `archivoUrl`/galería en modelos principales (ya existe en 3+ modelos; generalizar).
2. **#H45 Soft-delete + Undo** — añadir `deletedAt` a modelos clave, papelera, `toast` con acción "Deshacer". Migración de schema.
3. **#G01 Campana de notificaciones in-app** — `<NotificationBell>` + feed (push ya existe vía `usePushNotifications`).
4. **#C02 Cantidades ejecutadas vs presupuestadas** en `ProyectoPartida` (migración) + doble barra en control.
5. **#C01 Cuadrillas** — modelo estructurado (hoy `cuadrilla` es texto libre) + tab Equipo en proyecto.
6. **#G02 Comentarios** universales (hoy solo `ComentarioDocumento`).
7. **#G08 Audit log** / activity feed por entidad.
8. **#G09 Recordatorios** recurrentes por cliente (existe `ActividadCRM` como base).
9. **#C03 Avance por módulo**, **#C04 Galería de obra**, **#H49 Calendario de tareas**, **#H39 Alto contraste/WCAG**, **#G05 Bottom tab bar móvil**.
10. **Largo plazo:** #G04 automatizaciones, #G07 offline-first real, #G10 webhooks/integraciones.

**Esfuerzo:** Alto. **Plan propio por hallazgo.**

---

## Mapa de cobertura (hallazgo → fase)

| Fase | Hallazgos |
|------|-----------|
| 0 — Design system | H37, H38, H40, H41, H42, H43 |
| 1 — Datos/confirmaciones | H21, H34, H35, H18 |
| 2 — Listados URL-driven | H07, H08, H09, H48 |
| 3 — Productividad listados | H10, H11, H46, H12, H47 |
| 4 — Pantallas críticas | H19, H20, H50, H22, H23, H24, H33, H14, H32, C05 |
| 5 — Búsqueda/nav/atajos | H03, H44, H05, H02, H04 |
| 6 — Por módulo | H13, H28, H29, H26, H30, H31, H16, H17, H15, H36 |
| 7 — Estratégico/schema | H45, H39, H49, C01, C02, C03, C04, G01–G10 |
| Excluidos (ya hechos) | H06, H27, H35(parcial), H21(parcial) |

## Verificación global

Al cerrar cada fase, correr los gates ([[gates-verificacion-crm]]):
```bash
npx tsc --noEmit        # 0 errores
npm run lint            # 0 errores
npm test                # verde (Vitest, utilidades puras)
npm run build           # ignorar error conocido de prerender Prisma
```
Más verificación manual en navegador del módulo tocado (no hay E2E).

## ⏯️ ESTADO DE EJECUCIÓN — retomar aquí (actualizado 2026-06-29 noche)

**Rama:** `fix/ux-fase0-design-system` (NO pusheada). Para retomar: `git checkout fix/ux-fase0-design-system` y leer esta sección.

**Fase 0 estructural COMPLETA (HEAD = `0778556`, tsc 0, vitest 143/143):**
- ✅ Task 0.1 — `lib/estados.ts` (mapa estado→variant + `etiquetaDeEstado` + `EstadoBadge`) + test (6/6). Commits `3e4f83e`, `5ef4c0c`.
- ✅ Task 0.2 — `EstadoBadge` en `TareasPageClient`, `ComprasPageClient`, `RutasCompraPageClient`. Commit `770b186`.
- ✅ Task 0.3 — prop `color` en `Button` + migrados los `<Button>` con bg verde/rojo inline (CambiarEstadoButton aprobar, OportunidadDrawer ganar, OportunidadDrawer "Ganada", MarcarPerdidaModal, ContabilidadClient eliminar). Commit `71aa33a`.
- ✅ Task 0.4 — #H42: sidebar usa `bg-sidebar` (token `--sidebar` en globals + tailwind.config). Commit `c4636f6`.
- ✅ Task 0.5 — #H43: criterio documentado en `success-banner.tsx`. Commit `0778556`.

**Diferido de Fase 0 (con razón, NO olvidar):**
- **#H43 migración real** (12 forms `?msg=` → `toast.exito`): mecánico pero forms no uniformes (PresupuestoV2Builder 1277 líneas, builders) → requiere verificación en navegador. Forms: clientes, proyectos, recursos, tareas, empleados, melamina, nomina, apus, produccion, presupuestos V1/V2. `ToastProvider` ya está en `app/layout.tsx` (toast sobrevive la nav cliente).
- **#H40 iconos** (lib/iconos.ts + unificar Building2/FolderOpen): bajo valor, alto churn; `Building2` puede ser intencional (empresa) vs `FolderOpen` (proyecto) — no adivinar.
- **#H41 motion tokens**: 🟢 bajo valor, alto churn. Defer.
- **Task 0.2b**: badges en `KanbanClient` (proyecto), `RecibosTab`/`FacturaDetalle` (factura). `EmpleadosTable` es booleano activo/inactivo (no aplica). `KitchenConfiguratorClient:1382` usa `#0b0f1a` propio (canvas full-screen, NO migrar a bg-sidebar).
- **Task 0.3 raw `<button>`**: `ImportarRecursosModal:357` ("Listo" verde) y `PeriodosTable:31` (confirm inline rojo) — este último va mejor con Task 1.1 (ConfirmDialog). `RespaldoPanel:443` es ámbar (no mapea a success/danger). PrintButtons (6) de impresión: baja prioridad.

**Working tree:** dejar sin tocar `SISTEMA.md` y `next-env.d.ts` (modificaciones preexistentes ajenas). `.ts-seed-out/` es basura ignorable.

**Fase 0 cerrada:** mergeada a `main` local (fast-forward), rama borrada.

---

### Fase 1 — estado (rama `fix/ux-fase1-confirmaciones`, sin push)

- ✅ Task 1.1 (#H21) — 5 borrados (Recurso, APU, Empleado, Tarea, Módulo melamina) migrados de doble-clic inline a `ConfirmDialog` + `useToast` (surface errores 409). Commit `551e91a`.
- ✅ Task 1.2 (#H34) — `DuplicarButton` confirma mostrando alcance (N partidas en M capítulos, nace Borrador). Commit `d07fdce`.
- ✅ Task 1.3 (#H35) — **ya satisfecho**, sin cambio. Verificado en `app/api/presupuestos/[id]/estado/route.ts`: efectos reales = proyecto→"En Ejecución" (ya en diálogo) + recalc valor oportunidad (interno). NO existe bloqueo de partidas (CLAUDE.md lo menciona hipotético; el código no lo hace). "Volver a Borrador" existe → nada queda bloqueado.
- ⏸️ Task 1.4 (#H18) — **diferido**. El grep de mutaciones sin `router.refresh` da ~38 componentes, pero la mayoría refrescan vía callback del padre (`onSuccess`/`onClose`) o estado local optimista (GastosTab/GastoForm) — no son bugs. Un barrido ciego rompería UIs optimistas. Requiere análisis caso-por-caso con verificación en navegador. Bajo valor (🟢).

**Gate Fase 1:** tsc 0 · vitest 143/143. Cerrar con `finishing-a-development-branch`.

**Fase 1 cerrada:** mergeada a `main` local y pusheada a `origin/main` (a67d3a3..16a03bd).

---

### Fase 2 — estado (rama `fix/ux-fase2-listados`, sin push)

Hallazgo de scope: `hooks/useUrlFilters.ts` ya existía (filtrado **en cliente** sincronizado a URL vía `replaceState`, sin refetch). El patrón del codebase es "cargar todo + filtrar en memoria".

- ✅ Task #H07 — `/clientes`: de `<form method=GET>` (roundtrip server por búsqueda) a búsqueda instantánea en cliente + `useUrlFilters` (`?search=` sobrevive refresh/Atrás). Nuevo `components/clientes/ClientesPageClient.tsx`; la página queda como server component delgado. Commit `e62257f`.
- ✅ Task #H08 — `/recursos`: los 7 filtros de `RecursosTable` pasan de `useState` a `useUrlFilters` (sobreviven refresh/Atrás, vista compartible). Wrappers homónimos preservan call-sites. Commit `b4660bf`.
- ✅ #H48 (política URL-driven) — avanzada por #H07/#H08; compras/rutas/tareas ya la usaban.
- ⏸️ #H09 (paginación server-side) — **diferido por diseño**. El patrón "cargar todo + filtrar en memoria" da búsqueda instantánea (mejor UX) y es adecuado a la escala de la empresa. Paginación server es la arquitectura opuesta, solo se justifica con miles de filas. Revisar por-tabla si alguna crece. NO es deuda olvidada.

**Gate Fase 2:** tsc 0 · lint 0 · vitest 143/143. Verificación en navegador pendiente (clientes: buscar es instantáneo y el `?search=` queda en la URL; recursos: filtrar, refrescar, y que los filtros persistan). Cerrar con `finishing-a-development-branch`.

**Fase 2 cerrada:** mergeada a `main` local y pusheada a `origin/main` (16a03bd..4e65ebb).

---

### Fase 3 — estado (rama `fix/ux-fase3-productividad`, sin push)

Realidad de scope de **#H10 (edición inline)** tras revisar el backend:
- ✅ **Tarea estado** — dropdown in-cell en la lista, reusa el modo `_patch` que ya usa el Kanban (`PUT /api/tareas/[id]` con `{ estado, _patch: true }`). Seguro. Commit `6398c02`.
- ⚠️ **Recurso costo** — BLOQUEADO: `PUT /api/recursos/[id]` hace update COMPLETO (escribe todos los campos del body); mandar `{ costoUnitario }` solo corrompería datos (codigo→null, tipo→'materiales', activo→true, stock→0). Requiere un endpoint de **patch parcial** primero (tarea backend).
- ⚠️ **Proyecto avance** — `/proyectos` es server component con cards + filtro server; el input inline exige refactor a client component (como se hizo con clientes).
- ⚠️ **Tarea asignado** — el modo `_patch` del backend solo cubre `estado`; hay que extenderlo a `asignadoId`.

Pendiente Fase 3: #H11/#H46 (bulk), #H12 (anchos responsive — el kanban `w-72 shrink-0` necesita verificación en navegador para no romper el scroll horizontal desktop), #H47 (mobile cards). Todas behavioral/visual → mejor con verificación en navegador (VPS).

**Gate parcial Fase 3:** tsc 0 · lint 0.

**Descubrimientos (ajustan el plan):**
- `hooks/useUrlFilters.ts` YA EXISTE y lo usan compras/rutas/tareas → **Fase 2 es mucho más chica de lo planeado**. Auditar qué listados faltan realmente antes de reescribir nada (clientes sigue con `<form method=GET>`; recursos con filtros en useState).
- OC `facturada` quedó `secondary` (gris) en vez de púrpura (Badge no tiene púrpura). Si se quiere conservar, añadir variante `purple` a `components/ui/badge.tsx`.

### Pendiente Fase 0 — pasos turnkey

**Task 0.2b (opcional, completar barrido badges):** revisar `KanbanClient.tsx` (badge de estado de proyecto → usar `EstadoProyectoBadge` existente o `EstadoBadge dominio="proyecto"`) y `components/contabilidad/RecibosTab.tsx`/`FacturaDetalle.tsx` (estado factura → `EstadoBadge dominio="factura"`). `EmpleadosTable` es activo/inactivo booleano, NO es dominio de estado → dejar como está (o variante propia).

**Task 0.3 — prop `color` en `Button` + migrar botones hardcodeados.**
1. En `components/ui/button.tsx` añadir `color?: 'success' | 'danger'` que aplique tono verde/rojo manteniendo base/focus. Mantener `variant`.
2. Migrar a `<Button variant color>` los `bg-(green|red|blue|amber)-600` crudos en estos archivos (verificados):
   `app/apus/DeleteApuButton.tsx`, `app/contabilidad/ContabilidadClient.tsx`, `app/dashboard/ejecutivo/page.tsx`, `app/login/page.tsx`, `app/presupuestos/[id]/CambiarEstadoButton.tsx`, `app/recursos/DeleteRecursoButton.tsx`, `components/configuracion/RespaldoPanel.tsx`, `components/empleados/DeleteEmpleadoButton.tsx`, `components/nomina/PeriodosTable.tsx`, `components/oportunidades/MarcarPerdidaModal.tsx`, `components/oportunidades/OportunidadDrawer.tsx`, `components/recursos/ImportarRecursosModal.tsx`.
   ⚠️ Los `app/**/imprimir/PrintButton.tsx` (6 archivos) son botones de impresión — migrar también pero verificar que no rompan estilos de print. Baja prioridad.
3. OJO: `DeleteApuButton`, `DeleteRecursoButton`, `DeleteEmpleadoButton` también son objetivo de **Task 1.1** (ConfirmDialog). Conviene hacer 1.1 y 0.3 juntos en esos 3 archivos para no tocarlos dos veces.

**Task 0.4 — tokens + iconos.**
- #H42: `components/layout/Sidebar.tsx:253` cambiar `bg-[#0b0f1a] dark:bg-[#0b0f1a]` por `bg-sidebar`; definir `--sidebar` en `globals.css`.
- #H41: tokens de motion en Tailwind config; `transition-all` → específico en `button.tsx:12` y `StatsCard.tsx`.
- #H40: crear `lib/iconos.ts` con `ICONO` por concepto; unificar `Building2`(×24)/`FolderOpen`(×45) para proyecto.

**Task 0.5 — `SuccessBanner` → `useToast`.**
Archivos con `?msg=`/SuccessBanner: `app/{apus,clientes,empleados,melamina,nomina,presupuestos,produccion,proyectos,recursos,tareas}/page.tsx`. En acciones cliente usar `toast.exito`; conservar `SuccessBanner` solo para redirects server-side. Documentar criterio en `components/ui/success-banner.tsx`.

**Gate al cerrar Fase 0:** `npx tsc --noEmit` (0) · `npx eslint <archivos tocados>` (0 errores) · `npx vitest run` (verde) · verificación manual en navegador (requiere arreglar primero el [[db-postgres-sqlite-mismatch]] o apuntar `DATABASE_URL` a Postgres).

**Al terminar Fase 0:** usar skill `superpowers:finishing-a-development-branch` para decidir merge/PR. Luego planear Fase 1 (las Tasks 1.1–1.4 ya están detalladas arriba).

---

## Self-review (cobertura del spec)

Los 50 hallazgos verificados como válidos están asignados a una fase en el mapa de cobertura. Los 4 excluidos están justificados (verificados como ya implementados). Hallazgos con matiz (#H13 icono, #H23 navegación, #G03 alcance) llevan nota en su fase para evitar actuar sobre el detalle equivocado.
