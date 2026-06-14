# Plan Backlog UX — Fase 2 (roles, OCR en gastos, paginación, Finanzas, migración alert/confirm)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ejecutar el backlog pendiente del plan UX de junio 2026: perfiles de rol predefinidos, escaneo OCR de facturas al registrar gastos, paginación/filtros server-side en Cobros, navegación unificada de Finanzas, y migración de los ~28 componentes restantes que aún usan `alert()`/`confirm()` nativos.

**Architecture:** Cada fase es independiente y mergeable por separado. Se reutiliza infraestructura existente en todos los casos: `PermisoUsuario`/`PermisosModal` para roles, `/api/contabilidad/ocr` (Gemini/Claude vision) para gastos, el patrón URL-driven de `/presupuestos` para paginación, y las primitivas `useToast`/`ConfirmDialog` (ya en `components/ui/`) para la migración masiva.

**Tech Stack:** Next.js 16 App Router · TypeScript · Prisma 5 · Tailwind/shadcn · **sin dependencias nuevas**.

---

## ⚠️ Reglas de este repo (leer antes de ejecutar)

1. **NO hay suite de tests.** Verificación manual en navegador con `npm run dev` (CLAUDE.md). NO inventar tests ni instalar frameworks.
2. **Gates por tarea:** `npx tsc --noEmit` (exit 0) y `npm run lint` (**debe quedar en 0 errores**; los ~266 warnings preexistentes son deuda conocida — no introducir errores nuevos, no "arreglar" warnings en masa). Gate final de rama: `npm run build` exit 0 (imprime un `PrismaClientInitializationError` al prerenderizar `/facturacion` — es ambiental y preexistente, ignorarlo).
3. **Idioma del dominio: español.** Commits en español **sin acentos** (convención del historial).
4. Trabajar en la rama `backlog-ux-fase2`. No tocar ni commitear `next-env.d.ts` (archivo generado).
5. **Primitivas obligatorias** (ya en `main`): `useToast()` de `components/ui/toast.tsx` (API `{ exito, error }`, provider montado en `app/layout.tsx`) y `ConfirmDialog` de `components/ui/confirm-dialog.tsx` (props: `abierto, titulo, descripcion?, textoConfirmar?, variante? ('peligro'|'primario'), cargando?, onConfirmar, onCancelar`). Referencias canónicas de uso en el propio repo: `app/presupuestos/DeletePresupuestoButton.tsx` (borrado simple) y `app/presupuestos/[id]/CambiarEstadoButton.tsx` (múltiples acciones con un estado discriminado).

## Decisiones tomadas (cambiar aquí si el usuario prefiere otra cosa)

- **Roles**: NO se crea un sistema de roles nuevo. Se agregan **plantillas** que precargan el `PermisosMap` existente en el modal de permisos; el admin las aplica con un clic y guarda. El campo `Usuario.rol` no cambia.
- **OCR en gastos**: se reutiliza `/api/contabilidad/ocr` tal cual (ya extrae NCF/RNC/ITBIS/total de facturas dominicanas con Gemini + fallback Claude). Solo se relaja su permiso para aceptar también el módulo `gastos` y se agrega el botón de escaneo en `GastoForm`.
- **Facturación**: los filtros pasan de cliente (useMemo sobre 200 filas) a **server-side por URL** (patrón `/presupuestos`), con 50 por página y tarjetas de resumen calculadas con agregados de BD (globales, no filtradas — semántica actual).
- **Finanzas**: NO se mueven rutas. Se agrega una sub-navegación compartida (`FinanzasNav`) en las 5 páginas del área y el sidebar reduce el grupo Finanzas de 5 items a 3 (Contabilidad, Compras, Proveedores) — Cobros y Transacciones quedan accesibles vía la sub-nav.
- **Migración alert/confirm**: 5 lotes por módulo. Regla de oro: **solo cambia el feedback, nunca la lógica de negocio**.

---

### Task 0: Crear rama

- [ ] **Step 1:**

```bash
git checkout main && git pull && git checkout -b backlog-ux-fase2
```

---

## FASE A — Plantillas de rol (esfuerzo mínimo, valor alto)

La infraestructura ya existe: `PermisoUsuario` (nivel por módulo/usuario), `lib/permisos.ts` (`MODULOS`, `PermisosMap`, `getNivel` con default seguro 'ninguno'), `PermisosModal` (UI con `setNivel`/`setGrupoNivel`/`setTodoNivel` y PUT a `/api/configuracion/permisos/[userId]`). Solo falta poder aplicar un perfil típico con un clic.

### Task 1: `PLANTILLAS_ROL` en lib/permisos.ts + botones en PermisosModal

**Files:**
- Modify: `lib/permisos.ts` (agregar export al final de la sección de tipos, antes del bloque "API route permission check")
- Modify: `components/configuracion/PermisosModal.tsx` (175 líneas — leerlo completo primero)

- [ ] **Step 1: Agregar las plantillas a `lib/permisos.ts`**

Insertar después de la definición de `NIVELES` (línea ~34):

```ts
// ── Plantillas de rol ──────────────────────────────────────────────────────────
// Perfiles típicos de una constructora. Aplicar una plantilla precarga el
// PermisosMap completo (módulos no listados = 'ninguno'); el admin puede
// ajustar antes de guardar.

export const PLANTILLAS_ROL: { nombre: string; descripcion: string; permisos: PermisosMap }[] = [
  {
    nombre: 'Contabilidad',
    descripcion: 'Finanzas completas; lectura de proyectos y clientes',
    permisos: {
      dashboard: 'ver', contabilidad: 'admin', proveedores: 'editar', compras: 'editar',
      gastos: 'editar', proyectos: 'ver', clientes: 'ver', presupuestos: 'ver',
    },
  },
  {
    nombre: 'Taller',
    descripcion: 'Melamina y producción; lectura de proyectos y recursos',
    permisos: {
      dashboard: 'ver', melamina: 'editar', cocinas: 'editar', produccion: 'editar',
      recursos: 'ver', proyectos: 'ver', tareas: 'editar', horas: 'editar',
    },
  },
  {
    nombre: 'Presupuestos',
    descripcion: 'Presupuestos, APUs y catálogos; sin acceso a finanzas',
    permisos: {
      dashboard: 'ver', presupuestos: 'editar', apus: 'editar', recursos: 'editar',
      clientes: 'editar', oportunidades: 'editar', proyectos: 'ver', documentos: 'ver',
    },
  },
  {
    nombre: 'Encargado de obra',
    descripcion: 'Gastos, avance y cronograma en campo; lectura del resto',
    permisos: {
      dashboard: 'ver', gastos: 'editar', proyectos: 'editar', cronogramas: 'editar',
      tareas: 'editar', documentos: 'editar', horas: 'editar',
    },
  },
]
```

- [ ] **Step 2: Botones de plantilla en `PermisosModal.tsx`**

1. Ampliar el import existente de `@/lib/permisos` para incluir `PLANTILLAS_ROL`.
2. Agregar la función junto a `setTodoNivel` (línea ~47):

```ts
  function aplicarPlantilla(plantilla: PermisosMap) {
    const todo: PermisosMap = {}
    for (const m of MODULOS) todo[m.key] = plantilla[m.key] ?? 'ninguno'
    setPermisos(todo)
  }
```

(Importante: rellena TODOS los módulos — los no listados quedan en 'ninguno' — porque el PUT upserta exactamente lo que recibe.)

3. Renderizar la fila de plantillas encima de la lista de grupos de módulos (localizar el primer bloque que itera grupos en el JSX e insertar antes):

```tsx
        {/* Plantillas de rol */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Aplicar plantilla
          </p>
          <div className="flex gap-2 flex-wrap">
            {PLANTILLAS_ROL.map(p => (
              <button
                key={p.nombre}
                type="button"
                title={p.descripcion}
                onClick={() => aplicarPlantilla(p.permisos)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                {p.nombre}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            La plantilla precarga los niveles; ajusta lo que necesites y pulsa Guardar.
          </p>
        </div>
```

- [ ] **Step 3: Verificación**

`npx tsc --noEmit` → exit 0; `npm run lint` → 0 errores.
Manual: Configuración → Usuarios → icono de permisos de un usuario no-admin → clic en "Taller" → los selects cambian (melamina/cocinas/produccion en Editar, contabilidad en Sin acceso) → Guardar → reabrir y confirmar que persistió.

- [ ] **Step 4: Commit**

```bash
git add lib/permisos.ts components/configuracion/PermisosModal.tsx
git commit -m "feat(permisos): plantillas de rol predefinidas en el modal de permisos"
```

---

## FASE B — Escaneo OCR al registrar gastos

`/api/contabilidad/ocr` ya extrae de una foto/PDF: `{ ncf, rncProveedor, proveedor, numero, fecha, subtotal, impuesto, propinaLegal, total, descripcion, ... }` (Gemini primario, Claude fallback, prompt especializado en facturas dominicanas). Hoy solo lo consume `FacturaForm`. Dos cambios: permitir el permiso `gastos` en la ruta, y botón "Escanear factura" en `GastoForm`.

### Task 2: La ruta OCR acepta permiso `gastos` O `contabilidad`

**Files:**
- Modify: `app/api/contabilidad/ocr/route.ts`

- [ ] **Step 1:** Leer el archivo y localizar la llamada a `checkPermiso(req, 'contabilidad', <nivel>)` (al inicio del handler POST). Reemplazarla conservando el `<nivel>` actual por:

```ts
  // El OCR lo usan tanto contabilidad (facturas) como obra (gastos con foto).
  // Basta tener permiso en cualquiera de los dos módulos.
  const deniedContabilidad = await checkPermiso(req, 'contabilidad', 'editar')
  if (deniedContabilidad) {
    const deniedGastos = await checkPermiso(req, 'gastos', 'editar')
    if (deniedGastos) return deniedGastos
  }
```

(Si el nivel actual en el código NO es 'editar', usar el que esté — no subir ni bajar el requisito de contabilidad; el de gastos sí es 'editar'.)

- [ ] **Step 2: Verificación**

`npx tsc --noEmit` → exit 0; `npm run lint` → 0 errores.
Manual (con un usuario que tenga `gastos: editar` y `contabilidad: ninguno` — crear uno con la plantilla "Encargado de obra" de la Task 1): desde la consola del navegador logueado con ese usuario, `fetch('/api/contabilidad/ocr', { method: 'POST', body: new FormData() })` debe devolver un error de "archivo requerido" (≠ 403). Con un usuario sin ninguno de los dos permisos → 403.

- [ ] **Step 3: Commit**

```bash
git add app/api/contabilidad/ocr/route.ts
git commit -m "feat(ocr): permitir acceso con permiso de gastos ademas de contabilidad"
```

### Task 3: Botón "Escanear factura" en GastoForm

**Files:**
- Modify: `components/gastos/GastoForm.tsx` (441 líneas — leerlo completo primero)

Contexto del archivo: `form: GastoData` con campos `fecha, descripcion, suplidor?, referencia?, monto, archivoUrl?, ...`; ya existe `const [archivo, setArchivo] = useState<File | null>(null)` y el submit ya sube `archivo` como adjunto vía FormData. También revisar `components/contabilidad/FacturaForm.tsx` (~línea 120-140) para copiar el nombre exacto del campo del FormData que espera la ruta OCR (es el mismo endpoint).

- [ ] **Step 1: Estado y handler de escaneo**

Agregar dentro del componente (junto a los useState existentes):

```tsx
  const [ocrLoading, setOcrLoading] = useState(false)
  const ocrInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
```

(Agregar `import { useToast } from '@/components/ui/toast'`; `useRef` ya está importado.)

Handler (junto a los demás handlers del componente):

```tsx
  async function handleEscanearFactura(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // La foto sirve doble: se adjunta al gasto y se manda al OCR
    setArchivo(file)
    setOcrLoading(true)
    try {
      const fd = new FormData()
      fd.set('file', file) // ⚠️ verificar el nombre del campo contra FacturaForm.tsx — usar el mismo
      const res = await fetch('/api/contabilidad/ocr', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        toast.error(data?.error ?? 'No se pudo leer la factura. Completa los campos a mano.')
        return
      }
      // Solo rellenar campos que el usuario no haya escrito todavía
      setForm(prev => ({
        ...prev,
        monto: prev.monto || (data.total != null ? String(data.total) : prev.monto),
        fecha: prev.fecha || (data.fecha ?? prev.fecha),
        suplidor: prev.suplidor || (data.proveedor ?? prev.suplidor),
        referencia: prev.referencia || (data.ncf ?? data.numero ?? prev.referencia),
        descripcion: prev.descripcion || (data.descripcion ?? prev.descripcion),
      }))
      toast.exito('Factura leída — revisa los campos antes de guardar')
    } catch {
      toast.error('Error de conexión al leer la factura')
    } finally {
      setOcrLoading(false)
      if (ocrInputRef.current) ocrInputRef.current.value = ''
    }
  }
```

NOTA de tipos: `GastoData.monto` puede ser `number` o `string` según el form (leer la interfaz al inicio del archivo y adaptar la línea de `monto` al tipo real — si es `number`, usar `data.total ?? prev.monto`). Lo mismo para `fecha` (string ISO vs Date). Adaptar respetando los tipos existentes, sin cambiarlos.

- [ ] **Step 2: Botón + input oculto en el JSX**

Insertar al inicio del formulario (antes del primer grupo de campos), visible en todas las variantes del form:

```tsx
        {/* Escanear factura con OCR */}
        <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-muted/30">
          <input
            ref={ocrInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
            onChange={handleEscanearFactura}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={ocrLoading}
            onClick={() => ocrInputRef.current?.click()}
          >
            {ocrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {ocrLoading ? 'Leyendo factura…' : 'Escanear factura'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Toma una foto de la factura: el monto, suplidor, NCF y fecha se rellenan solos.
          </p>
        </div>
```

(Agregar `Camera` y `Loader2` al import de `lucide-react` si no están. `capture="environment"` abre la cámara trasera en móvil; en desktop abre el selector de archivos.)

- [ ] **Step 3: Verificación**

`npx tsc --noEmit` → exit 0; `npm run lint` → 0 errores.
Manual: `/gastos` → Nuevo gasto → "Escanear factura" → subir una foto/PDF de factura → spinner → toast verde y campos rellenos (sin pisar lo ya escrito) → la foto queda como adjunto → Guardar funciona igual que antes. Probar también el caso de error (archivo no-factura → campos null → no pisa nada).

- [ ] **Step 4: Commit**

```bash
git add components/gastos/GastoForm.tsx
git commit -m "feat(gastos): escanear factura con OCR para autocompletar el formulario"
```

---

## FASE C — Paginación y filtros server-side en Cobros (/facturacion)

Hoy `app/facturacion/page.tsx` trae `take: 200` y `FacturacionClient` (276 líneas) filtra en memoria con `useMemo` (estado, búsqueda, rango de fechas). Con más datos esto se rompe. Se replica el patrón ya probado de `/presupuestos` (searchParams + paginación + buscador con debounce — ver `app/presupuestos/PresupuestosBuscador.tsx` como referencia canónica).

### Task 4: page.tsx server-side (filtros, paginación, agregados)

**Files:**
- Modify: `app/facturacion/page.tsx` (reescritura — hoy tiene 77 líneas)

- [ ] **Step 1: Reescribir la carga de datos**

```tsx
const PER_PAGE = 50

interface SearchParams {
  estado?: string   // pendiente | parcial | pagada | anulada | proforma | (vacío = todas)
  q?: string
  desde?: string    // YYYY-MM-DD
  hasta?: string    // YYYY-MM-DD
  page?: string
}

function buildWhere({ estado, q, desde, hasta }: SearchParams) {
  return {
    tipo: 'ingreso' as const,
    ...(estado === 'proforma'
      ? { esProforma: true }
      : estado
        ? { estado }
        : {}),
    ...(q
      ? {
          OR: [
            { numero: { contains: q, mode: 'insensitive' as const } },
            { ncf: { contains: q, mode: 'insensitive' as const } },
            { descripcion: { contains: q, mode: 'insensitive' as const } },
            { cliente: { nombre: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
    ...(desde || hasta
      ? {
          fecha: {
            ...(desde ? { gte: new Date(desde + 'T00:00:00') } : {}),
            ...(hasta ? { lte: new Date(hasta + 'T23:59:59') } : {}),
          },
        }
      : {}),
  }
}
```

En el componente de página (`searchParams` es `Promise<SearchParams>` en Next 16 — await primero, igual que `/presupuestos`):

```tsx
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1') || 1)
  const where = buildWhere(sp)

  const [facturas, total, agregados, proformasCount, porEstado] = await Promise.all([
    prisma.factura.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true, codigo: true } },
      },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
    }),
    prisma.factura.count({ where }),
    // Resumen GLOBAL (no filtrado) — misma semántica que las cards actuales
    prisma.factura.aggregate({
      where: { tipo: 'ingreso', estado: { not: 'anulada' } },
      _sum: { total: true, montoPagado: true },
    }),
    prisma.factura.count({ where: { tipo: 'ingreso', esProforma: true, estado: { not: 'anulada' } } }),
    // Conteos por estado para los pills de filtro (globales)
    prisma.factura.groupBy({
      by: ['estado'],
      where: { tipo: 'ingreso' },
      _count: { _all: true },
    }),
  ])

  const totalFacturado = agregados._sum.total ?? 0
  const totalCobrado = agregados._sum.montoPagado ?? 0
  const resumen = {
    totalFacturado,
    totalCobrado,
    porCobrar: totalFacturado - totalCobrado,
    proformas: proformasCount,
  }
  const conteos = Object.fromEntries(porEstado.map(e => [e.estado, e._count._all])) as Record<string, number>
  const totalPages = Math.ceil(total / PER_PAGE)
```

Pasar a `FacturacionClient` las props nuevas: `filtros={{ estado: sp.estado ?? '', q: sp.q ?? '', desde: sp.desde ?? '', hasta: sp.hasta ?? '' }}`, `conteos`, `paginacion={{ page, totalPages, total }}` además de `facturas` (mismo mapeo a DTO que hoy) y `resumen`. El header de la página (título "Cobros", botón "Nueva factura") se conserva tal cual.

- [ ] **Step 2:** `npx tsc --noEmit` fallará hasta terminar la Task 5 (las props del client cambian) — es esperado; NO commitear todavía. Continuar con la Task 5 y commitear ambas juntas.

### Task 5: FacturacionClient URL-driven + controles de paginación

**Files:**
- Modify: `app/facturacion/FacturacionClient.tsx` (leerlo completo primero)

- [ ] **Step 1: Cambiar el contrato de props**

Reemplazar los `useState` de filtros (`filtroEstado`, `busqueda`, `filtroDesde`, `filtroHasta`) y el `useMemo` de filtrado por props que vienen del server. Nueva interfaz (añadir a las props existentes `facturas` y `resumen`):

```tsx
interface Props {
  facturas: Factura[]
  resumen: Resumen
  filtros: { estado: string; q: string; desde: string; hasta: string }
  conteos: Record<string, number>
  paginacion: { page: number; totalPages: number; total: number }
}
```

La tabla renderiza `facturas` directamente (ya vienen filtradas del server). Los conteos de los pills de estado salen de `conteos` (antes se calculaban con `facturas.filter(...).length`).

- [ ] **Step 2: Navegación por URL con debounce (patrón PresupuestosBuscador)**

Dentro del componente:

```tsx
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState(filtros.q)

  function navegar(cambios: Partial<{ estado: string; q: string; desde: string; hasta: string; page: string }>) {
    const params = new URLSearchParams()
    const merged = { ...filtros, q, page: '', ...cambios }
    if (merged.estado) params.set('estado', merged.estado)
    if (merged.q) params.set('q', merged.q)
    if (merged.desde) params.set('desde', merged.desde)
    if (merged.hasta) params.set('hasta', merged.hasta)
    if (merged.page) params.set('page', merged.page)
    const s = params.toString()
    router.push(`${pathname}${s ? `?${s}` : ''}`)
  }

  function handleBusqueda(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQ(val)
    clearTimeout((window as any)._factSearchTimer)
    ;(window as any)._factSearchTimer = setTimeout(() => navegar({ q: val }), 400)
  }
```

Cablear los controles existentes: los pills de estado llaman `navegar({ estado: <valor o ''> })`; el input de búsqueda usa `handleBusqueda`; los date inputs llaman `navegar({ desde: val })` / `navegar({ hasta: val })` en su onChange. Conservar el JSX/estilos actuales de esos controles — solo cambia de dónde sale el valor (props) y a dónde va el cambio (URL).

- [ ] **Step 3: Controles de paginación**

Al final de la tabla (mismo estilo que `/presupuestos`):

```tsx
      {paginacion.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Página {paginacion.page} de {paginacion.totalPages} · {paginacion.total} facturas
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary" size="sm"
              disabled={paginacion.page <= 1}
              onClick={() => navegar({ page: String(paginacion.page - 1) })}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>
            <Button
              variant="secondary" size="sm"
              disabled={paginacion.page >= paginacion.totalPages}
              onClick={() => navegar({ page: String(paginacion.page + 1) })}
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
```

(Imports de `useRouter`/`usePathname` de `next/navigation` y `ChevronLeft`/`ChevronRight` de lucide si faltan.)

- [ ] **Step 4: Verificación (Tasks 4+5 juntas)**

`npx tsc --noEmit` → exit 0; `npm run lint` → 0 errores.
Manual en `/facturacion`: las cards de resumen muestran lo mismo que antes; pill "Pendientes" → URL `?estado=pendiente` y la tabla cambia; buscar texto → debounce y URL `?q=`; fechas filtran; con >50 facturas aparecen los botones Anterior/Siguiente; recargar la página con filtros en la URL conserva el estado. El deep-link del dashboard `?filtroEstado=pendiente` ya no aplica — actualizar el `href` en `app/page.tsx` (acciones de facturas, 2 ocurrencias `'/facturacion?filtroEstado=pendiente'`) y en `lib/notificaciones-cron.ts` (2 ocurrencias en las urls de notificación) a `'/facturacion?estado=pendiente'`.

- [ ] **Step 5: Commit**

```bash
git add app/facturacion/page.tsx app/facturacion/FacturacionClient.tsx app/page.tsx lib/notificaciones-cron.ts
git commit -m "feat(facturacion): filtros y paginacion server-side con resumen por agregados"
```

---

## FASE D — Navegación unificada de Finanzas

Hoy el sidebar tiene 5 items hermanos (Transacciones, Cobros, Contabilidad, Proveedores, Compras) y `/contabilidad` además tiene tabs internos propios. Se unifica con una sub-nav compartida sin mover rutas.

### Task 6: Componente `FinanzasNav` en las 5 páginas

**Files:**
- Create: `components/contabilidad/FinanzasNav.tsx`
- Modify: `app/contabilidad/page.tsx`, `app/facturacion/page.tsx`, `app/contabilidad/transacciones/page.tsx`, `app/compras/page.tsx`, `app/proveedores/page.tsx` (leer cada una; insertar el nav como primer elemento del contenedor de la página)

- [ ] **Step 1: Crear `components/contabilidad/FinanzasNav.tsx`**

```tsx
import Link from 'next/link'

const ITEMS = [
  { key: 'contabilidad', href: '/contabilidad', label: 'Contabilidad' },
  { key: 'cobros', href: '/facturacion', label: 'Cobros' },
  { key: 'transacciones', href: '/contabilidad/transacciones', label: 'Transacciones' },
  { key: 'compras', href: '/compras', label: 'Compras' },
  { key: 'proveedores', href: '/proveedores', label: 'Proveedores' },
] as const

export type FinanzasSeccion = typeof ITEMS[number]['key']

/**
 * Sub-navegación del área de Finanzas. Server component (solo Links).
 * Las páginas siguen protegidas por sus propios permisos; este nav es
 * solo navegación visual del módulo.
 */
export function FinanzasNav({ activo }: { activo: FinanzasSeccion }) {
  return (
    <div className="flex gap-2 flex-wrap border-b border-border pb-3">
      {ITEMS.map(item => (
        <Link
          key={item.key}
          href={item.href}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activo === item.key
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Insertarlo en cada página**

En cada una de las 5 páginas, importar y renderizar como PRIMER hijo del contenedor raíz (`<div className="space-y-6">` o equivalente — leer cada página y respetar su estructura):

```tsx
<FinanzasNav activo="contabilidad" />   // en app/contabilidad/page.tsx
<FinanzasNav activo="cobros" />         // en app/facturacion/page.tsx
<FinanzasNav activo="transacciones" />  // en app/contabilidad/transacciones/page.tsx
<FinanzasNav activo="compras" />        // en app/compras/page.tsx
<FinanzasNav activo="proveedores" />    // en app/proveedores/page.tsx
```

Si alguna página delega todo el render a un client component (p.ej. transacciones), insertar el nav en la page.tsx servidor ANTES del client component, no dentro de él.

- [ ] **Step 3: Verificación**

`npx tsc --noEmit` → 0; `npm run lint` → 0 errores. Manual: navegar entre las 5 secciones con la sub-nav; el pill activo corresponde a la página actual.

- [ ] **Step 4: Commit**

```bash
git add components/contabilidad/FinanzasNav.tsx app/contabilidad/page.tsx app/facturacion/page.tsx app/contabilidad/transacciones/page.tsx app/compras/page.tsx app/proveedores/page.tsx
git commit -m "feat(finanzas): sub-navegacion compartida entre las paginas del area financiera"
```

### Task 7: Reducir el grupo Finanzas del sidebar

**Files:**
- Modify: `components/layout/Sidebar.tsx` (grupo 'finanzas', líneas ~64-74)

- [ ] **Step 1:** Reemplazar los items del grupo `finanzas` por:

```tsx
    items: [
      { href: '/contabilidad', label: 'Contabilidad', icon: Landmark,      modulo: 'contabilidad' as ModuloKey },
      { href: '/compras',      label: 'Compras',      icon: ShoppingCart,  modulo: 'compras'      as ModuloKey },
      { href: '/proveedores',  label: 'Proveedores',  icon: Truck,         modulo: 'proveedores'  as ModuloKey },
    ],
```

(Se eliminan los items "Transacciones" y "Cobros" — quedan accesibles vía `FinanzasNav` dentro de Contabilidad. OJO: `NavLink` marca activo con `pathname.startsWith(href)`, así que `/contabilidad/transacciones` seguirá iluminando "Contabilidad" — correcto. `/facturacion` no iluminará ningún item del sidebar; aceptable porque la sub-nav muestra la ubicación. Los iconos `Receipt`/`FileText` que queden sin uso en el import NO removerlos sin verificar que ningún otro item los usa — `Receipt` lo usa Gastos y `FileText` lo usa Presupuestos.)

- [ ] **Step 2: Verificación**

`npx tsc --noEmit` → 0; `npm run lint` → 0 errores. Manual: el sidebar muestra Finanzas con 3 items; Cobros y Transacciones se alcanzan en un clic desde Contabilidad.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "fix(sidebar): consolidar grupo Finanzas en 3 items con sub-nav interna"
```

---

## FASE E — Migración de los ~28 componentes restantes con alert()/confirm()

### Contrato de migración (aplica a TODOS los lotes)

Referencias canónicas EN el repo (leerlas antes del primer lote): `app/presupuestos/DeletePresupuestoButton.tsx` (confirmación de borrado) y `app/presupuestos/[id]/CambiarEstadoButton.tsx` (múltiples acciones → un estado discriminado `confirmando` + un ConfirmDialog por acción).

| Patrón actual | Reemplazo |
|---|---|
| `if (!confirm('¿Eliminar X?')) return` + acción destructiva | `ConfirmDialog` con `variante="peligro"`, `textoConfirmar="Sí, eliminar"`, estado `abierto` + `cargando` |
| `confirm()` para continuar acción NO destructiva | `ConfirmDialog` variante por defecto (primario) |
| `alert('<error>')` | `toast.error('<mismo mensaje>')` |
| `alert('<éxito/info>')` | `toast.exito('<mismo mensaje>')` |
| `if (res.ok) {...}` sin rama else (fallo silencioso) | agregar `else { const data = await res.json().catch(() => null); toast.error(data?.error ?? '<fallback en español>') }` |

Reglas:
1. **Nunca cambiar lógica de negocio, URLs, métodos HTTP ni payloads** — solo el feedback.
2. Mantener textos en español; reutilizar el mensaje del `confirm`/`alert` original como `titulo`/`descripcion`/mensaje del toast.
3. Cada archivo migrado debe quedar con **cero** ocurrencias de `alert(` y `confirm(` (verificar con grep).
4. Componentes con varias acciones confirmables: UN estado (`confirmando: '<accion>' | null`) y un ConfirmDialog por acción (patrón CambiarEstadoButton). No crear N booleans.
5. Al inicio de cada lote, RE-GREPEAR las ocurrencias reales (`grep -n "alert(\|confirm(" <archivos del lote>`) — los números de línea de este plan pueden haber cambiado.
6. Excluidos (falsos positivos): `components/ui/confirm-dialog.tsx` (la palabra aparece en su JSDoc).

Verificación por lote: `npx tsc --noEmit` → 0; `npm run lint` → 0 errores; spot-check manual en navegador de 2-3 flujos del lote; y `grep -rn "alert(\|confirm(" <archivos del lote>` → 0 resultados.

### Task 8 — Lote E1: botones standalone de borrado/archivo (5 archivos)

**Files (Modify):**
- `app/clientes/DeleteClienteButton.tsx` (3 ocurrencias)
- `app/proyectos/DeleteProyectoButton.tsx` (3)
- `app/proyectos/ArchivarProyectoButton.tsx` (3)
- `components/proyectos/ReabrirProyectoButton.tsx` (3)
- `app/cronograma/DeleteCronogramaButton.tsx` (3)

- [ ] **Step 1:** Leer los 5 archivos + la referencia `DeletePresupuestoButton.tsx`. Todos siguen el mismo patrón (confirm → fetch DELETE/PATCH → alert en error): replicar la estructura de la referencia adaptando textos, endpoint y comportamiento post-éxito de cada uno (algunos hacen `router.push`, otros `router.refresh` — conservarlo).
- [ ] **Step 2:** Verificación del lote (contrato arriba). Spot-check: borrar un cliente de prueba y archivar/desarchivar un proyecto.
- [ ] **Step 3: Commit**

```bash
git add app/clientes/DeleteClienteButton.tsx app/proyectos/DeleteProyectoButton.tsx app/proyectos/ArchivarProyectoButton.tsx components/proyectos/ReabrirProyectoButton.tsx app/cronograma/DeleteCronogramaButton.tsx
git commit -m "refactor(ux): migrar botones de borrado/archivo a ConfirmDialog y toast (lote 1)"
```

### Task 9 — Lote E2: tabs y modales del detalle de proyecto (12 archivos)

**Files (Modify):** `components/gastos/GastosTab.tsx` (2), `components/proyectos/AdicionalesTab.tsx` (1), `components/proyectos/PunchlistTab.tsx` (1), `components/proyectos/ProgramaTab.tsx` (1), `components/proyectos/DocumentosTab.tsx` (1), `components/proyectos/BitacoraTimeline.tsx` (1), `components/proyectos/AvanceFisicoCard.tsx` (2), `components/proyectos/ConvertirEnAdicionalButton.tsx` (2), `components/proyectos/EditarPartidaModal.tsx` (1), `components/proyectos/FusionarManualModal.tsx` (1), `components/proyectos/FusionarPorCodigoModal.tsx` (1), `components/proyectos/VincularPresupuestoModal.tsx` (4)

- [ ] **Step 1:** Migrar según el contrato. Atención: dentro de modales existentes (Editar/Fusionar/Vincular), un `confirm()` anidado se reemplaza por ConfirmDialog renderizado DENTRO del modal (z-index del ConfirmDialog es 90; si el modal padre usa z mayor, subir el del ConfirmDialog al renderizarlo con un wrapper `className` NO — en su lugar verificar visualmente; si queda detrás, reportar DONE_WITH_CONCERNS con el detalle).
- [ ] **Step 2:** Verificación del lote. Spot-check: eliminar un gasto desde GastosTab y desvincular un presupuesto.
- [ ] **Step 3: Commit**

```bash
git add components/gastos/GastosTab.tsx components/proyectos/
git commit -m "refactor(ux): migrar tabs y modales de proyecto a ConfirmDialog y toast (lote 2)"
```

### Task 10 — Lote E3: finanzas y compras (5 archivos)

**Files (Modify):** `app/contabilidad/ContabilidadClient.tsx` (6), `components/contabilidad/FacturaDetalle.tsx` (3), `components/contabilidad/ProveedoresTab.tsx` (≥1), `components/compras/OrdenCompraDetail.tsx` (5), `components/compras/ComprasPageClient.tsx` (≥1)

- [ ] **Step 1:** Migrar según el contrato. `ContabilidadClient` tiene 2 acciones de borrado (facturas y cuentas) → patrón de estado discriminado: `const [confirmando, setConfirmando] = useState<{ tipo: 'factura' | 'cuenta'; id: number; nombre: string } | null>(null)` y UN ConfirmDialog cuyo título/handler dependen de `confirmando.tipo`.
- [ ] **Step 2:** Verificación del lote. Spot-check: anular/eliminar una factura de prueba y una cuenta.
- [ ] **Step 3: Commit**

```bash
git add app/contabilidad/ContabilidadClient.tsx components/contabilidad/ components/compras/
git commit -m "refactor(ux): migrar finanzas y compras a ConfirmDialog y toast (lote 3)"
```

### Task 11 — Lote E4: cronogramas, horas, gantt, pipeline (6 archivos)

**Files (Modify):** `components/cronograma/ActividadesSpreadsheet.tsx` (4), `components/cronograma/CronogramaV2Client.tsx` (2), `components/cronograma/CronogramaClient.tsx` (≥1), `components/horas/HorasPageClient.tsx` (3), `app/proyectos/gantt/GanttProyectos.tsx` (2), `components/oportunidades/PipelineClient.tsx` (≥1)

- [ ] **Step 1:** Migrar según el contrato. En `ActividadesSpreadsheet` (editor tipo hoja de cálculo) los `confirm` de borrado de filas usan ConfirmDialog; los `alert` de validación usan `toast.error`.
- [ ] **Step 2:** Verificación del lote. Spot-check: borrar una actividad de cronograma y una entrada de horas.
- [ ] **Step 3: Commit**

```bash
git add components/cronograma/ components/horas/HorasPageClient.tsx app/proyectos/gantt/GanttProyectos.tsx components/oportunidades/PipelineClient.tsx
git commit -m "refactor(ux): migrar cronogramas, horas y pipeline a ConfirmDialog y toast (lote 4)"
```

### Task 12 — Lote E5: taller, catálogos, configuración y resto (≈14 archivos)

**Files (Modify):** `app/melamina/materiales/MaterialesManager.tsx` (2), `components/melamina/ModuloEditor.tsx` (≥1), `components/cocinas/KitchenListClient.tsx` (≥1), `components/cocinas/KitchenConfiguratorClient.tsx` (≥1), `components/produccion/ProduccionPageClient.tsx` (1), `components/produccion/OrdenProduccionDetail.tsx` (≥1), `components/recursos/ImportarRecursosModal.tsx` (3), `components/presupuestos/ImportarExcelModal.tsx` (≥1), `components/presupuestos/QuickTextPicker.tsx` (≥1), `components/configuracion/FeriadosPanel.tsx` (2), `components/configuracion/CategoriasPanel.tsx` (≥1), `components/configuracion/UnidadesPanel.tsx` (≥1), `components/configuracion/UsuariosPanel.tsx` (≥1), `components/configuracion/VendedoresPanel.tsx` (≥1), `components/configuracion/RespaldoPanel.tsx` (≥1), `components/documentos/DocumentosPageClient.tsx` (≥1), `components/documentos/SharePointFileManager.tsx` (≥1), `components/horas/` ya cubierto, `components/ui/export-button.tsx` (1)

- [ ] **Step 0:** Este lote es el cajón de sastre — empezar con `grep -rn "alert(\|confirm(" app components --include="*.tsx"` para obtener la lista REAL restante (tras lotes 1-4 deben quedar solo estos) y migrar todo lo que aparezca, excepto el falso positivo de `confirm-dialog.tsx`.
- [ ] **Step 1:** Migrar según el contrato. OJO en `RespaldoPanel` (importar/restaurar BD): esa confirmación es la MÁS crítica del sistema — usar `variante="peligro"` y una `descripcion` explícita de que se sobreescriben los datos.
- [ ] **Step 2:** Verificación del lote + verificación GLOBAL final: `grep -rn "alert(\|confirm(" app components --include="*.tsx"` → solo debe quedar `components/ui/confirm-dialog.tsx` (JSDoc).
- [ ] **Step 3: Commit**

```bash
git add -A app components
git commit -m "refactor(ux): completar migracion de alert/confirm a ConfirmDialog y toast (lote 5)"
```

---

## Cierre

- [ ] `npx tsc --noEmit` → 0; `npm run lint` → **0 errores**; `npm run build` → exit 0 (ignorar el error Prisma de prerender).
- [ ] Actualizar `SISTEMA.md`: §5.9 Configuración (plantillas de rol), §5.x Gastos (escaneo OCR), §10 (sub-nav Finanzas, paginación facturación, "ya no quedan alert/confirm nativos"), §11 quitar de la deuda "Sin paginación server-side" para facturación y "Solo rol Admin" matizado (plantillas disponibles).
- [ ] Merge/PR según prefiera el usuario (referencia: el plan anterior se integró vía PR).

## Backlog que sigue pendiente DESPUÉS de este plan

1. Unificar Pipeline de oportunidades vs estados de proyecto (decisión de producto: el proyecto nace al ganar la oportunidad).
2. Validación de inputs con Zod en APIs (deuda de SISTEMA.md §11).
3. Reducir los ~266 warnings de lint (any explícitos, reglas React Compiler).
4. Cloud storage para `/public/uploads/`.
