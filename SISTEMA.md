# Sistema CRM — Gonzalva Group
## Resumen técnico completo para análisis externo

---

## 1. Contexto y propósito

CRM interno para una empresa constructora/remodeladora dominicana (**Gonzalva Group**).
El sistema gestiona el ciclo completo de un proyecto de construcción:

```
Cliente → Proyecto → Presupuesto → Control de Gastos → Reporte
```

Empresa objetivo: constructoras pequeñas/medianas que manejan proyectos residenciales y comerciales,
fabricación de muebles en melamina, y necesitan control de costos por partida presupuestaria.

**Versión actual: v1.2**

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.2.0 (App Router, Turbopack) |
| Lenguaje | TypeScript |
| Base de datos | SQLite vía Prisma ORM |
| Estilos | Tailwind CSS + shadcn/ui (componentes base) |
| Autenticación | JWT en cookie httpOnly (`crm_session`) con `jose` |
| Middleware | `proxy.ts` (convención Next.js 16) |
| Íconos | Lucide React |
| Excel | SheetJS (`xlsx ^0.18.5`) — lectura cliente + escritura servidor |
| Moneda | Dominicana (RD$), con soporte USD y EUR |

---

## 3. Estructura de archivos clave

```
CRM/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          ← Dashboard
│   ├── clientes/
│   ├── proyectos/
│   │   └── [id]/
│   │       ├── page.tsx                  ← Detalle con tabs
│   │       └── reporte/page.tsx          ← Reporte de control presupuestario
│   ├── presupuestos/
│   │   ├── nuevo-v2/page.tsx
│   │   └── [id]/
│   │       ├── page.tsx                  ← Detalle + botón Duplicar
│   │       ├── DuplicarButton.tsx        ← Client component que llama /duplicar
│   │       └── imprimir/page.tsx         ← Vista de impresión (filtra capítulos $0)
│   ├── apus/
│   ├── recursos/
│   │   └── [id]/editar/page.tsx         ← Incluye PriceHistoryPanel
│   ├── tareas/
│   ├── melamina/
│   │   ├── page.tsx                      ← Lista + botón "Materiales"
│   │   ├── nuevo/page.tsx                ← Form simplificado (sin costos)
│   │   ├── materiales/
│   │   │   ├── page.tsx                  ← Catálogo de tableros/cantos/herrajes
│   │   │   └── MaterialesManager.tsx     ← Client component con CRUD inline
│   │   └── [id]/
│   │       ├── page.tsx                  ← ModuloEditor con 4 tabs
│   │       └── editar/page.tsx           ← Redirect a /melamina/[id]
│   ├── configuracion/
│   └── api/
│       ├── auth/login + logout
│       ├── clientes/[id]
│       ├── proyectos/[id]/
│       │   ├── gastos/                   ← CRUD + importar Excel + plantilla
│       │   ├── partidas/
│       │   ├── control-presupuestario/
│       │   └── poblar-presupuesto/
│       ├── presupuestos/[id]/
│       │   └── estado/route.ts           ← Auto-activa proyecto al aprobar
│       ├── presupuestos-v2/
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   ├── [id]/duplicar/route.ts    ← POST copia completa del presupuesto
│       │   └── plantilla/route.ts
│       ├── apus/[id]
│       ├── recursos/
│       │   ├── route.ts
│       │   ├── [id]/route.ts             ← PUT graba historial si cambia precio
│       │   ├── [id]/historial/route.ts   ← GET historial de precios
│       │   ├── importar/route.ts         ← POST importación masiva Excel (3 modos)
│       │   └── plantilla/route.ts        ← GET template .xlsx con instrucciones
│       ├── melamina/
│       │   ├── route.ts                  ← GET lista + POST crear módulo
│       │   ├── [id]/route.ts             ← GET + PUT + DELETE (usa MaterialModuloMelamina)
│       │   └── materiales/
│       │       ├── route.ts              ← GET lista + POST crear material
│       │       └── [id]/route.ts         ← PUT + DELETE (soft)
│       └── configuracion/
├── components/
│   ├── layout/
│   ├── gastos/
│   ├── proyectos/
│   ├── presupuestos/
│   │   ├── PresupuestoV2Builder.tsx      ← Incluye RecursoPickerModal por fila APU
│   │   ├── RecursoPickerModal.tsx        ← Modal búsqueda recursos para APU
│   │   ├── ImportarExcelModal.tsx
│   │   └── ApuSearchModal.tsx
│   ├── melamina/
│   │   ├── ModuloEditor.tsx              ← 4 tabs: Datos, Despiece, Materiales, Resumen
│   │   └── ModuloMelaminaForm.tsx        ← Form nuevo módulo (simplificado)
│   └── recursos/
│       ├── RecursosTable.tsx             ← Con filtros avanzados (cat/proveedor/estado/precio)
│       ├── RecursoForm.tsx               ← step="0.01" en costo unitario
│       ├── ImportarRecursosModal.tsx     ← 3 modos de importación + lote info
│       └── PriceHistoryPanel.tsx         ← Panel historial precios en editar recurso
├── proxy.ts
├── prisma/schema.prisma
└── lib/
    ├── prisma.ts
    ├── utils.ts
    └── excel-parser-recursos.ts          ← Parser específico para importación de recursos
```

---

## 4. Modelos de base de datos (Prisma / SQLite)

### Entidades principales

```
Cliente ──< Proyecto ──< GastoProyecto >── ProyectoPartida >── ProyectoCapitulo
                │
                └──< Presupuesto (V2) ──< CapituloPresupuesto ──< PartidaPresupuesto
                                       ──< PresupuestoTitulo
                                       ──< PresupuestoIndirectoLinea

Recurso ──< RecursoPriceHistory
        ──< RecursoImportBatch (lotes de importación)

MaterialMelamina ──< MaterialModuloMelamina >── ModuloMelaminaV2
ModuloMelaminaV2 ──< PiezaModulo
                 ──< MaterialModuloMelamina
                 ── materialTableroId → MaterialMelamina
```

### Descripción de modelos

| Modelo | Propósito |
|---|---|
| `Cliente` | Contacto: nombre, teléfono, WhatsApp, correo, tipo, fuente |
| `Proyecto` | Obra. Tiene `presupuestoEstimado` y `presupuestoBaseId` |
| `Presupuesto` | Cotización formal `COT-YYYY-NNN`. Estado: Borrador/Enviado/Aprobado/Rechazado |
| `PresupuestoTitulo` | Agrupación de capítulos (nivel 0) |
| `CapituloPresupuesto` | Capítulo V2. Puede tener `tituloId` o flotar |
| `PartidaPresupuesto` | Partida: descripción, unidad, cantidad, precio unitario, subtotal |
| `AnalisisPartida` | APU embebido en partida (JSON + totales) |
| `PresupuestoIndirectoLinea` | Costos indirectos en % sobre base |
| `ProyectoCapitulo` / `ProyectoPartida` | Snapshot del presupuesto para control |
| `GastoProyecto` | Gasto real del proyecto |
| `Recurso` | Catálogo de insumos: materiales, MO, equipos, herrajes, etc. |
| `RecursoPriceHistory` | Historial de cambios de precio de un recurso (origen: manual / importacion) |
| `RecursoImportBatch` | Registro de cada lote de importación Excel de recursos |
| `ApuCatalogo` / `ApuRecurso` | APUs reutilizables del catálogo |
| `MaterialMelamina` | Catálogo propio de materiales de melamina: tipo (tablero/canto/herraje), nombre, código, marca, proveedor, precio, unidad, dimensiones (anchoMm, largoMm, espesorMm) |
| `MaterialModuloMelamina` | Cantos y herrajes usados en un módulo específico (cantidad, costoSnapshot, subtotal) |
| `ModuloMelaminaV2` | Módulo de mueble con dimensiones, despiece, `materialTableroId` (FK a MaterialMelamina) |
| `PiezaModulo` | Pieza del despiece: etiqueta, largo, ancho, cantidad, espesor, tapacanto (JSON) |
| `Empresa` / `Usuario` / `UnidadGlobal` | Configuración del sistema |

---

## 5. Módulos del sistema

### 5.1 Dashboard (`/`)
- Estadísticas: proyectos activos, presupuestos pendientes, tareas vencidas, valor total cotizado
- Actividad reciente: últimos presupuestos y tareas urgentes

### 5.2 Clientes (`/clientes`)
- CRUD completo
- Vista detalle con proyectos y presupuestos relacionados

### 5.3 Proyectos (`/proyectos`)
Detalle con **4 pestañas**: Resumen / Gastos / Control Presupuestario / Melamina

**Tab Resumen**: Info del proyecto, cards financieros (presupuestado/gastado/disponible), rentabilidad real (ingresos - costos reales, margen %)

**Tab Gastos** (`GastosTab`): Tabla configurable, filtros avanzados, asignación inline de partida, bulk assign, importación Excel

**Tab Control Presupuestario**: Poblar desde presupuesto, vista presupuesto vs real por capítulo/partida, semáforo visual (verde/ámbar/rojo/gris)

### 5.4 Presupuestos (`/presupuestos`)

**Constructor V2** (`PresupuestoV2Builder`):
- Jerarquía: Título → Capítulo → Partida
- APU integrado por partida con `RecursoPickerModal` (botón 🔍 por fila para buscar recurso del catálogo y auto-completar descripción/unidad/precio)
- Gastos indirectos en %
- Importar desde Excel (template con instrucciones)
- Numeración automática `COT-YYYY-NNN`
- **Botón Duplicar**: copia completa del presupuesto (todos los títulos, capítulos, partidas, APUs, indirectos) con nuevo número y estado Borrador
- Estados: Borrador → Enviado → Aprobado / Rechazado
  - Al pasar a **Aprobado** con proyecto vinculado → proyecto cambia a estado "Activo" automáticamente
- **Vista de impresión** (`/imprimir`): layout A4 sin sidebar, **filtra capítulos con total $0.00**

### 5.5 APUs — Análisis de Precios Unitarios (`/apus`)
- Catálogo reutilizable
- Líneas de catálogo (recurso existente) o texto libre
- Porcentajes: indirectos, utilidad, desperdicio

### 5.6 Recursos (`/recursos`)

**Catálogo** con tipos: materiales, mano de obra, equipos, herramientas, subcontratos, transportes, herrajes, consumibles

**Filtros avanzados** en la tabla:
- Búsqueda libre (nombre/código/proveedor)
- Filtro por categoría, proveedor, estado activo/inactivo (3 estados)
- Rango de precio mínimo/máximo
- Chips activos con X individual + "Limpiar todo"
- Contador de resultados filtrados/total

**Importación masiva desde Excel**:
- Template descargable con ejemplos e instrucciones
- 3 modos de importación:
  - **Crear + Actualizar**: si el código existe → actualiza; si no → crea
  - **Solo crear**: omite filas con código ya existente
  - **Solo actualizar**: omite filas sin código registrado
- Preview de filas antes de confirmar
- Resumen post-importación: creados / actualizados / precios cambiados / omitidos / errores
- Registro de lote (`RecursoImportBatch`) con conteos

**Historial de precios** (`PriceHistoryPanel` en editar recurso):
- Se registra automáticamente cada vez que cambia `costoUnitario` (vía edición manual o importación)
- Muestra: fecha, precio anterior, precio nuevo, variación %, origen (Manual / Excel #loteId)

### 5.7 Tareas (`/tareas`)
- Vinculadas a cliente y/o proyecto
- Prioridad: Alta/Media/Baja | Estado: Pendiente/En progreso/Completada

### 5.8 Módulos Melamina (`/melamina`)

**Catálogo de Materiales** (`/melamina/materiales`):
- Sección independiente con 3 tabs: **Tableros / Cantos / Herrajes**
- **Tableros**: nombre, código, marca, proveedor, precio/plancha, ancho × largo × espesor (mm)
- **Cantos**: nombre, código, marca, proveedor, precio, ancho (mm), espesor (mm)
- **Herrajes**: nombre, código, marca, proveedor, precio, unidad
- CRUD inline — agregar fila, editar en la misma fila, eliminar (soft delete)

**Editor de Módulos** (`/melamina/[id]`) — 4 tabs:

**Tab Datos**:
- Código, tipo, nombre, dimensiones (ancho/alto/prof mm), puertas, cajones, cantidad
- Tablero principal → selector del catálogo de MaterialMelamina (tipo=tablero), muestra dimensiones y precio
- Color/acabado, estado producción, precio de venta, observaciones

**Tab Despiece**:
- Generación automática según tipo de módulo y dimensiones
- Tabla de piezas: etiqueta, nombre, largo, ancho, cantidad, espesor, tapacanto (botones S/I/L/R)
- Columna "Tablero" por pieza → selector del catálogo con opción "Heredar (tablero principal)"
- **Celdas largo/ancho en rojo** si la pieza supera las dimensiones del tablero seleccionado
- Banner de advertencia si hay piezas que no caben
- Panel de consumo: área total, número de planchas con dimensiones reales del tablero, % uso plancha, tapacanto total ml

**Tab Materiales**:
- Cantos y herrajes del catálogo propio (no del catálogo general de recursos)
- Input + datalist nativo para búsqueda por nombre/código
- Badge de tipo (canto/herraje)
- Auto-fill de unidad y costo al seleccionar

**Tab Resumen**:
- Consumo de tablero: piezas, área, planchas, tapacanto
- Barra de % tablero vs cantos+herrajes del costo total
- Lista de cantos y herrajes con subtotales
- Costo total estimado, precio de venta editable, margen %
- Total × cantidad de módulos

**Nuevo módulo** (form simplificado): código, tipo, nombre, dimensiones, tablero del catálogo, color, observaciones

### 5.9 Configuración (`/configuracion`)
- Empresa, Usuarios, Vendedores, Categorías, Unidades

### 5.10 Reporte de Control Presupuestario (`/proyectos/[id]/reporte`)
- Server component sin sidebar, layout A4
- Encabezado con logo empresa, tablas por capítulo y partida, totales, footer

---

## 6. Sistema de autenticación

- JWT en cookie `crm_session`
- `proxy.ts` intercepta rutas: protege páginas, inyecta `x-pathname`, `x-user-id`, `x-user-nombre`

---

## 7. Layout y navegación

- `AppLayout` detecta rutas shell-free (`/login`, `/reporte`, `/imprimir`) → renderiza sin sidebar
- Sidebar `bg-slate-900`, 256px, secciones: Dashboard / Clientes / Proyectos / Presupuestos / Tareas / Módulos Melamina / Catálogos / Sistema

---

## 8. APIs REST principales

```
GET/POST  /api/clientes
GET/PUT/DELETE /api/clientes/[id]

GET/POST  /api/proyectos
GET/PUT/DELETE /api/proyectos/[id]
GET/POST  /api/proyectos/[id]/gastos
PUT/DELETE /api/proyectos/[id]/gastos/[gastoId]
POST      /api/proyectos/[id]/gastos/importar
GET       /api/proyectos/[id]/gastos/plantilla
GET       /api/proyectos/[id]/partidas
POST/DELETE /api/proyectos/[id]/poblar-presupuesto

GET/POST  /api/presupuestos-v2
GET/PUT/DELETE /api/presupuestos-v2/[id]
POST      /api/presupuestos-v2/[id]/duplicar   ← Copia completa con nuevo COT
GET       /api/presupuestos-v2/plantilla

PUT       /api/presupuestos/[id]/estado        ← Auto-activa proyecto si estado=Aprobado

GET/POST  /api/apus
GET/PUT/DELETE /api/apus/[id]

GET/POST  /api/recursos
GET/PUT/DELETE /api/recursos/[id]              ← PUT graba historial si cambia precio
GET       /api/recursos/[id]/historial         ← Historial de cambios de precio
POST      /api/recursos/importar               ← Excel bulk (3 modos) + lote
GET       /api/recursos/plantilla

GET/POST  /api/melamina                        ← Lista + crear módulo
GET/PUT/DELETE /api/melamina/[id]              ← Incluye piezas + materialesModulo
GET/POST  /api/melamina/materiales             ← CRUD catálogo de materiales
GET/PUT/DELETE /api/melamina/materiales/[id]

POST      /api/auth/login
POST      /api/auth/logout
GET/PUT   /api/configuracion/empresa
POST      /api/configuracion/logo
```

---

## 9. Flujo principal de uso

```
1. Login → JWT cookie
2. Crear Cliente → Proyecto
3. Crear Presupuesto V2 → vincular al proyecto → "Poblar" estructura
4. Registrar gastos → asignar a partidas (inline o bulk)
5. Ver control presupuestario (semáforo por partida)
6. Cambiar presupuesto a "Aprobado" → proyecto pasa a "Activo" automáticamente
7. Generar reporte PDF
```

```
Melamina:
1. Ir a /melamina/materiales → agregar tableros con dimensiones reales, cantos, herrajes
2. Crear módulo → seleccionar tablero principal
3. Tab Despiece → generar cortes automáticos; verificar piezas vs dimensiones tablero
4. Tab Materiales → agregar cantos y herrajes usados con cantidades
5. Tab Resumen → revisar costo total y margen; confirmar precio de venta
```

---

## 10. Características de la interfaz

- Tablas con columnas configurables (`localStorage`)
- Filtros persistentes con chips activos y "limpiar todo"
- Selección masiva con barra de acción bulk
- Popovers inline para asignación sin modal
- Preview de impresión A4 (shell gris en pantalla)
- Flash de confirmación "✓ Guardado" 1.5s
- Datalist nativo para búsquedas en selectores (APU, materiales melamina)
- Barras de progreso visuales (% costos, % uso plancha, semáforo de ejecución)

---

## 11. Deuda técnica y limitaciones conocidas

| Área | Situación |
|---|---|
| Validación de inputs | No usa Zod. Solo validaciones manuales básicas |
| Tests | Sin tests automatizados |
| Roles y permisos | Solo rol "Admin". Sin permisos granulares |
| Multi-moneda | Gastos soportan RD$/USD/EUR pero sin conversión automática |
| Archivos adjuntos | `/public/uploads/` — sin cloud storage |
| Paginación | Sin paginación server-side |
| Presupuesto V1 | Modelo legacy `Partida` coexiste con V2 |
| APU en partidas | No se recalcula si cambia el recurso origen |
| Melamina V1 legacy | `ModuloMelamina` (ligado a presupuesto) coexiste con `ModuloMelaminaV2` |
| RecursoModulo legacy | Tabla `recursos_modulo` coexiste con nueva `material_modulo_melamina` |
| Error handling | Solo `console.error`. Sin logging estructurado |

---

## 12. Variables de entorno

```env
DATABASE_URL="file:./dev.db"      # Dev local (SQLite). En prod se usa PostgreSQL via .env.server
JWT_SECRET="<secret-en-.env>"     # NUNCA commitear el valor real. Ver .env.server en el VPS
```

---

## 13. Decisiones de diseño destacadas

1. **SQLite en producción**: sin servidor de BD externo, adecuado para uso concurrente bajo en una sola empresa.

2. **Snapshot presupuestario**: al "poblar" un proyecto se copia la estructura del presupuesto como snapshot independiente. Cambios posteriores al presupuesto no afectan el control de ejecución.

3. **Historial de precios de recursos**: solo se crea registro cuando el precio realmente cambia. Guarda precio anterior/nuevo, fecha y origen (manual o lote de importación con ID).

4. **Catálogo de materiales melamina independiente**: tableros, cantos y herrajes viven en `MaterialMelamina` separados del catálogo general de `Recurso`. Permite control específico con dimensiones físicas (mm) para calcular consumo real de planchas.

5. **Comparación pieza vs tablero en despiece**: el editor verifica en tiempo real si cada pieza (largo/ancho) cabe dentro del tablero seleccionado, marcando las celdas en rojo y mostrando banner de advertencia.

6. **Duplicar presupuesto**: endpoint `POST /api/presupuestos-v2/[id]/duplicar` copia la estructura completa (títulos, capítulos, partidas, APUs, indirectos) con nuevo número `COT-YYYY-NNN` y estado `Borrador`. Los IDs de títulos se remapean para mantener las relaciones capítulo→título.

7. **Auto-activación de proyecto**: al cambiar estado del presupuesto a `Aprobado` vía `PUT /api/presupuestos/[id]/estado`, si el presupuesto tiene `proyectoId`, el proyecto se actualiza a `estado = "Activo"` en la misma transacción.

8. **`proxy.ts` como middleware**: Next.js 16 renombró `middleware.ts`. Maneja auth JWT e inyecta `x-pathname` para que `AppLayout` decida si mostrar sidebar.

9. **Layout independiente para impresión**: `AppLayout` detecta rutas `/reporte` e `/imprimir` y renderiza sin shell — HTML de print limpio desde el servidor.

10. **Numeración de presupuestos**: usa `MAX` del sufijo numérico del año actual en lugar de `count()` para evitar colisiones con gaps.
