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
│   ├── layout.tsx                        ← Root layout (html/body + AppLayout)
│   ├── page.tsx                          ← Dashboard
│   ├── login/page.tsx
│   ├── clientes/
│   │   ├── page.tsx                      ← Lista de clientes
│   │   ├── nuevo/page.tsx
│   │   └── [id]/page.tsx + editar/
│   ├── proyectos/
│   │   ├── page.tsx
│   │   ├── nuevo/page.tsx
│   │   └── [id]/
│   │       ├── page.tsx                  ← Detalle con tabs
│   │       ├── editar/page.tsx
│   │       └── reporte/
│   │           ├── page.tsx              ← Reporte de control presupuestario (impresión)
│   │           └── ReporteButtons.tsx
│   ├── presupuestos/
│   │   ├── page.tsx
│   │   ├── nuevo-v2/page.tsx             ← Constructor V2 (capítulos/partidas)
│   │   └── [id]/
│   │       ├── page.tsx
│   │       ├── editar-v2/page.tsx
│   │       └── imprimir/
│   │           ├── page.tsx              ← Vista de impresión (sin sidebar)
│   │           └── PrintButton.tsx
│   ├── apus/                             ← Catálogo de APUs
│   ├── recursos/                         ← Catálogo de recursos
│   ├── tareas/
│   ├── melamina/                         ← Módulos de melamina (producción)
│   ├── configuracion/
│   └── api/
│       ├── auth/login + logout
│       ├── clientes/[id]
│       ├── proyectos/[id]
│       │   ├── gastos/                   ← CRUD gastos + importar Excel + plantilla
│       │   ├── gastos/[gastoId]          ← PUT individual (asignación partida inline)
│       │   ├── partidas/                 ← Lista partidas del snapshot
│       │   ├── control-presupuestario/
│       │   └── poblar-presupuesto/       ← POST (importar) + DELETE (limpiar)
│       ├── presupuestos/[id]
│       ├── presupuestos-v2/
│       │   ├── route.ts                  ← GET lista + POST crear
│       │   ├── [id]/route.ts             ← GET + PUT + DELETE
│       │   └── plantilla/route.ts        ← GET descarga template Excel
│       ├── apus/[id]
│       ├── recursos/[id]
│       ├── unidades/[id]
│       └── configuracion/empresa + usuarios + vendedores + categorias + logo
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx                 ← Detecta rutas shell-free (/reporte, /imprimir, /login)
│   │   └── Sidebar.tsx                  ← <aside> fijo, 256px, oculto en rutas print
│   ├── gastos/
│   │   ├── GastosTab.tsx                ← Tabla completa con filtros, columnas, bulk assign
│   │   ├── GastoForm.tsx                ← Modal de registro/edición de gasto
│   │   └── ImportarGastosModal.tsx      ← Importación masiva por Excel
│   ├── proyectos/
│   │   ├── ControlPresupuestarioTab.tsx ← Vista presupuesto vs real por partida
│   │   └── PoblarPresupuestoModal.tsx   ← Importar estructura desde presupuesto
│   └── presupuestos/
│       ├── PresupuestoV2Builder.tsx      ← Builder drag-less de capítulos/partidas
│       ├── ImportarExcelModal.tsx        ← Upload + preview + confirm Excel
│       └── ApuSearchModal.tsx           ← Búsqueda y aplicación de APUs al builder
├── proxy.ts                              ← Middleware Next.js 16 (auth JWT + x-pathname)
├── prisma/schema.prisma
└── lib/
    ├── prisma.ts
    ├── utils.ts                          ← formatCurrency, formatDate, cn()
    └── excel-parser.ts                  ← Parser SheetJS para importación
```

---

## 4. Modelos de base de datos (Prisma / SQLite)

### Entidades principales

```
Cliente ──< Proyecto ──< GastoProyecto >── ProyectoPartida >── ProyectoCapitulo
                 │
                 └──< Presupuesto ──< CapituloPresupuesto ──< PartidaPresupuesto
                                  ──< PresupuestoTitulo
                                  ──< PresupuestoIndirectoLinea
                                  ──< ModuloMelamina (legacy)
                                  ──< Partida (legacy)
```

### Descripción de modelos

| Modelo | Propósito |
|---|---|
| `Cliente` | Contacto: nombre, teléfono, WhatsApp, correo, tipo (Particular/Empresa), fuente |
| `Proyecto` | Obra o trabajo. Tiene `presupuestoEstimado` y `presupuestoBaseId` (snapshot) |
| `Presupuesto` | Cotización formal con número único `COT-YYYY-NNN`. Estado: Borrador/Enviado/Aprobado/Rechazado |
| `PresupuestoTitulo` | Agrupación de capítulos (nivel 0). Ej: "Obra Civil" |
| `CapituloPresupuesto` | Capítulo dentro del presupuesto V2. Puede tener `tituloId` o flotar sin título |
| `PartidaPresupuesto` | Partida de trabajo: descripción, unidad, cantidad, precio unitario, subtotal |
| `AnalisisPartida` | APU embebido en la partida: materiales, mano de obra, equipos, etc. (JSON + totales) |
| `PresupuestoIndirectoLinea` | Líneas de costos indirectos en % sobre base. Ej: "Administración 12%" |
| `ProyectoCapitulo` | Snapshot de capítulo importado al proyecto para control |
| `ProyectoPartida` | Snapshot de partida. Tiene `subtotalPresupuestado`. Linked con gastos |
| `GastoProyecto` | Gasto real del proyecto. Tipos: Factura, Gasto menor, Mano de obra, etc. |
| `ModuloMelaminaV2` | Módulo de mueble: tipo, dimensiones, materiales, precio venta, estado de producción |
| `Recurso` | Catálogo de insumos: materiales, mano de obra, equipos, herrajes, etc. |
| `ApuCatalogo` | Análisis de Precio Unitario reutilizable. Composición de recursos |
| `ApuRecurso` | Línea de recurso dentro de un APU con snapshot de costo |
| `Empresa` | Configuración de la empresa: nombre, RNC, logo, correo, slogan |
| `Usuario` | Usuarios del sistema con rol y password hasheado |
| `UnidadGlobal` | Catálogo de unidades de medida (m2, ml, kg, etc.) |

---

## 5. Módulos del sistema

### 5.1 Dashboard (`/`)
- Estadísticas en tiempo real: proyectos activos, presupuestos pendientes, tareas vencidas, valor total cotizado
- Actividad reciente: últimos presupuestos y tareas urgentes

### 5.2 Clientes (`/clientes`)
- CRUD completo
- Campos: nombre, teléfono, WhatsApp, correo, dirección, tipo (Particular/Empresa/Constructor), fuente (Directo/Referido/Web/Redes)
- Vista detalle con proyectos y presupuestos relacionados

### 5.3 Proyectos (`/proyectos`)
Detalle del proyecto con **4 pestañas**:

**Tab: Resumen**
- Info del proyecto: tipo, estado, ubicación, responsable, fechas
- Cards de resumen financiero: presupuestado vs gastado vs disponible + barra de progreso
- **Rentabilidad Real**: panel con 4 indicadores calculados en el servidor:
  - **Ingresos** = total del primer presupuesto con estado `Aprobado` (fallback: `presupuestoEstimado`)
  - **Costos reales** = suma de gastos activos (`estado ≠ Anulado`)
  - **Utilidad** = Ingresos − Costos
  - **Margen %** = Utilidad / Ingresos × 100 (con barra visual: verde ≥15%, ámbar ≥0%, rojo <0%)
  - El número del presupuesto aprobado se muestra como referencia en el título del panel
- Lista de presupuestos vinculados
- Acceso rápido a reporte

**Tab: Gastos** (`GastosTab`)
- Tabla con 11 columnas configurables (visibilidad persistida en localStorage)
- Filtros: búsqueda libre, tipo, método pago, estado, categoría, partida presupuestaria, fecha desde/hasta
- **Asignación inline de partida**: popover con búsqueda, guarda con PUT automático
- **Bulk selection**: checkboxes + barra de acción masiva para asignar partida a varios gastos a la vez
- **Barra de clasificación**: % de gastos asignados a partida presupuestaria
- Acciones por fila: editar, anular, eliminar
- **Importación por Excel**: template descargable + upload + preview + confirm
- Estados: Registrado / Revisado / Anulado

**Tab: Control Presupuestario** (`ControlPresupuestarioTab`)
- Poblar estructura desde un presupuesto (`PoblarPresupuestoModal`)
- Vista presupuesto vs gasto real por capítulo y partida
- % de ejecución, diferencias, alertas de sobregiro
- **Semáforo visual por partida**: dot de color al inicio de cada fila
  - 🟢 Verde (`bg-green-500`) = `normal` — ejecutado < 80%
  - 🟡 Ámbar (`bg-amber-400`) = `alerta` — ejecutado 80–100%
  - 🔴 Rojo (`bg-red-500`) = `excedido` — ejecutado > 100%
  - ⚪ Gris (`bg-slate-300`) = `sin_gasto` — sin gastos asignados
  - Presente en ambas vistas: "Por capítulo" y "Todas las partidas"
  - Tooltip con nombre del estado al hacer hover (`title`)

**Tab: Melamina**
- Módulos de muebles asignados al proyecto

### 5.4 Presupuestos (`/presupuestos`)

**Constructor V2** (`PresupuestoV2Builder`):
- Jerarquía: Título → Capítulo → Partida
- Partidas con: código, descripción, unidad, cantidad, precio unitario, subtotal calculado
- APU integrado por partida: buscar del catálogo o componer inline (materiales/mano de obra/equipos/subcontratos/transporte/desperdicio/indirectos/utilidad)
- **Modal APU** (`ApuSearchModal`): búsqueda por nombre/código, aplica precio al campo
- **Gastos indirectos**: líneas en % aplicadas sobre el subtotal de partidas directas (Administración, Utilidad, IVA, etc.)
- **Importar desde Excel**: template descargable (`.xlsx` con instrucciones), upload, preview tabla, confirmar → carga capítulos y partidas
- Numeración automática: `COT-YYYY-NNN` (busca el máximo existente para ese año)
- Estados: Borrador → Enviado → Aprobado / Rechazado
- **Vista de impresión** (`/imprimir`): layout completamente independiente (sin sidebar), shell gris de preview en pantalla, A4 en print

### 5.5 APUs — Análisis de Precios Unitarios (`/apus`)
- Catálogo reutilizable de análisis
- Composición: recursos del catálogo con cantidad y snapshot de costo
- Porcentajes configurables: indirectos, utilidad, desperdicio
- Precio de venta calculado = costo directo × (1 + indirectos + utilidad + desperdicio)

### 5.6 Recursos (`/recursos`)
- Catálogo de insumos y servicios
- Tipos: materiales, mano de obra, equipos, herramientas, subcontratos, transportes, herrajes, consumibles
- Campos: código, nombre, tipo, categoría, unidad, costo unitario, proveedor, marca

### 5.7 Tareas (`/tareas`)
- Gestión simple de tareas
- Vinculadas a cliente y/o proyecto
- Prioridad: Alta/Media/Baja | Estado: Pendiente/En progreso/Completada
- Alertas de vencimiento en dashboard

### 5.8 Módulos Melamina (`/melamina`)
- Catálogo de módulos de muebles
- Dimensiones (ancho × alto × profundidad), material, color, herrajes
- Costos: materiales, mano de obra, instalación → precio de venta
- Estado de producción: Diseño / En producción / Listo / Entregado

### 5.9 Configuración (`/configuracion`)
- **Empresa**: nombre, RNC, dirección, teléfono, correo, sitio web, slogan, logo (upload de imagen)
- **Usuarios**: CRUD con roles (Admin), password hasheado
- **Vendedores**: equipo comercial
- **Categorías**: para proyectos y otros módulos
- **Unidades**: catálogo global de unidades de medida

### 5.10 Reporte de Control Presupuestario (`/proyectos/[id]/reporte`)
- Server component — sin sidebar (layout independiente)
- Encabezado: logo empresa, nombre, "Reporte de Control Presupuestario", fecha de emisión
- Bloque proyecto/cliente en 2 columnas
- 4 tarjetas de totales: Presupuestado / Gastado / Disponible o Sobregiro / % Ejecutado
- **Nivel 1**: Tabla resumen por capítulo (presupuestado / real / diferencia / %)
- **Nivel 2**: Detalle por partida dentro de cada capítulo
- Barra de progreso de ejecución
- Alerta de gastos sin clasificar
- Total de cierre en bloque destacado
- Footer con nombre empresa y marca de tiempo
- Impresión: A4 portrait, márgenes 1.5cm, `@page`, colores forzados

---

## 6. Sistema de autenticación

- JWT almacenado en cookie `crm_session` (httpOnly implícito por Next.js)
- `proxy.ts` (middleware Next.js 16) intercepta todas las rutas:
  - Rutas estáticas: pasan sin verificación
  - `/login`, `/api/auth/*`: pasan sin verificación pero reciben `x-pathname`
  - APIs: verifican token si existe (opcional, no bloquean)
  - Páginas protegidas: redirigen a `/login` si no hay token válido
- El middleware inyecta headers en cada request:
  - `x-pathname` → para que `AppLayout` sepa en qué ruta está
  - `x-user-id`, `x-user-nombre`, `x-user-correo` → para el sidebar y auditoría

---

## 7. Layout y navegación

### AppLayout
```tsx
// Rutas que NO usan el shell del dashboard (sin sidebar):
const SHELL_FREE = ['/login', '/reporte', '/imprimir']
// Cualquier pathname que termine en alguno de estos valores
// recibe solo {children} — sin Sidebar, sin main ml-64, sin p-8
```

### Sidebar
- Ancho fijo: 256px (`w-64`)
- Fondo: `bg-slate-900`
- Secciones: Dashboard, Clientes, Proyectos, Presupuestos, Tareas, Módulos Melamina / Catálogos (Recursos, APU) / Sistema (Configuración)
- Logo de empresa configurable en el header del sidebar
- Usuario activo + botón logout en el footer

---

## 8. APIs REST

### Patrón general
- Todas en `app/api/` con Next.js App Router Route Handlers
- Responden JSON
- Sin validación de schema formal (Zod no está en uso)
- Errores devuelven `{ error: string }` con status HTTP apropiado
- Params de Next.js 15/16 son `Promise<{ id: string }>` (se hace `await params`)

### Endpoints principales

```
GET    /api/clientes
POST   /api/clientes
GET    /api/clientes/[id]
PUT    /api/clientes/[id]
DELETE /api/clientes/[id]

GET    /api/proyectos
POST   /api/proyectos
GET    /api/proyectos/[id]
PUT    /api/proyectos/[id]
DELETE /api/proyectos/[id]

GET    /api/proyectos/[id]/gastos          ← lista con partida incluida
POST   /api/proyectos/[id]/gastos          ← soporta multipart/form-data (adjunto)
PUT    /api/proyectos/[id]/gastos/[gastoId] ← edición + asignación partida inline
DELETE /api/proyectos/[id]/gastos/[gastoId]
POST   /api/proyectos/[id]/gastos/importar ← Excel bulk import
GET    /api/proyectos/[id]/gastos/plantilla ← Descarga template .xlsx
GET    /api/proyectos/[id]/partidas        ← Snapshot de partidas del proyecto

POST   /api/proyectos/[id]/poblar-presupuesto  ← Importa estructura desde presupuesto
DELETE /api/proyectos/[id]/poblar-presupuesto  ← Limpia estructura + desvincula gastos

GET    /api/presupuestos-v2                ← Lista con filtros ?proyectoId= ?clienteId=
POST   /api/presupuestos-v2               ← Crea presupuesto V2 completo (transacción)
GET    /api/presupuestos-v2/[id]
PUT    /api/presupuestos-v2/[id]
DELETE /api/presupuestos-v2/[id]
GET    /api/presupuestos-v2/plantilla      ← Template Excel (.xlsx)

GET    /api/apus
POST   /api/apus
GET    /api/apus/[id]
PUT    /api/apus/[id]
DELETE /api/apus/[id]

GET    /api/recursos
POST   /api/recursos
...

POST   /api/auth/login                     ← Genera JWT, setea cookie
POST   /api/auth/logout                    ← Elimina cookie

GET/PUT /api/configuracion/empresa
POST    /api/configuracion/logo            ← Upload imagen a /public/uploads/
GET/POST/DELETE /api/configuracion/usuarios/[id]
```

---

## 9. Flujo principal de uso

```
1. Login → JWT cookie
2. Crear Cliente
3. Crear Proyecto para ese cliente
4. Crear Presupuesto V2 (capítulos + partidas + indirectos)
   → Opcionalmente importar desde Excel
   → Opcionalmente aplicar APUs por partida
5. Vincular presupuesto al proyecto ("Poblar desde presupuesto")
   → Crea snapshot de ProyectoCapitulo + ProyectoPartida
   → Setea presupuestoBaseId y presupuestoEstimado en el proyecto
6. Registrar gastos del proyecto
   → Manual (GastoForm) o masivo (Excel)
   → Asignar cada gasto a una partida (inline o bulk)
7. Ver control presupuestario: presupuestado vs real por partida
8. Generar reporte PDF (imprimir desde /reporte)
```

---

## 10. Características de la interfaz

- **Tablas con columnas configurables**: visibilidad guardada en `localStorage` (clave `gastos_cols_v1`)
- **Filtros persistentes**: search, tipo, método, estado, categoría, partida, fecha desde/hasta
- **Selección masiva**: checkboxes con indeterminate en header, barra de acción bulk
- **Popovers inline**: asignación de partida sin abrir modal (click-outside para cerrar)
- **Preview de impresión**: páginas de print con shell gris en pantalla (similar a Google Docs Print Preview)
- **Flash de confirmación**: "✓ Guardado" 1.5s después de guardar inline
- Moneda formateada con `Intl.NumberFormat` (formato dominicano)
- Fechas con `toLocaleDateString('es-DO')`

---

## 11. Deuda técnica y limitaciones conocidas

| Área | Situación |
|---|---|
| Validación de inputs | No usa Zod ni schema validation. Solo validaciones manuales básicas en el frontend |
| Tests | No hay tests automatizados (ni unitarios ni e2e) |
| Roles y permisos | Solo existe el rol "Admin". No hay permisos granulares |
| Multi-moneda | Los gastos soportan RD$, USD, EUR pero no hay conversión automática. Los totales mezclan monedas |
| Archivos adjuntos | Se guardan en `/public/uploads/` — no hay cloud storage. No escala bien |
| Paginación | Las listas no tienen paginación server-side. Con muchos registros puede ser lento |
| Presupuesto V1 | Existe un sistema legacy (`/api/presupuestos` y `Partida` model). Coexiste con V2 |
| APU en partidas | El APU embebido en `AnalisisPartida` no se recalcula automáticamente si cambia el recurso origen |
| Módulos Melamina | Hay dos modelos: `ModuloMelamina` (legacy, en presupuesto) y `ModuloMelaminaV2` (standalone) |
| Snapshot presupuestario | Al re-poblar, el sistema ahora intenta re-asignar gastos a las nuevas partidas por `codigo` (exacto) o `descripcion` (inclusión de texto). Los que no tienen coincidencia quedan con `partidaId = null` |
| Error handling | Los errores de API no tienen logging estructurado. Solo `console.error` |
| Sin transacciones optimistas | La UI no tiene rollback si una operación falla a mitad |

---

## 12. Variables de entorno

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="gonzalva-group-crm-jwt-secret-2025-xK9mP2qL"
```

---

## 13. Decisiones de diseño destacadas

1. **SQLite en producción**: elección deliberada para simplicidad de despliegue (sin servidor de base de datos externo). Adecuado para una sola empresa con uso concurrente bajo.

2. **Snapshot presupuestario**: al "poblar" un proyecto, se copian los capítulos y partidas del presupuesto como un snapshot independiente. Esto permite que el presupuesto original sea modificado sin afectar el control de ejecución.

3. **Presupuesto V2 vs Legacy**: el sistema migró de un modelo plano (`Partida`) a una jerarquía (Título → Capítulo → Partida). El V1 se mantiene por compatibilidad pero los nuevos presupuestos se crean con V2.

4. **`proxy.ts` como middleware**: Next.js 16 renombró `middleware.ts` a `proxy.ts`. Este archivo maneja auth JWT y también inyecta `x-pathname` para que `AppLayout` pueda decidir si mostrar o no el sidebar.

5. **Layout independiente para impresión**: en lugar de media queries para ocultar el sidebar, `AppLayout` detecta las rutas `/reporte` e `/imprimir` y renderiza sin el shell del dashboard. Así el HTML de print está limpio desde el servidor.

6. **Numeración de presupuestos**: en lugar de `count()` (colisiona con gaps), usa `MAX` del sufijo numérico del año actual para generar el siguiente número.

7. **Bulk assign de gastos**: llama `PUT /api/gastos/[id]` en paralelo con `Promise.all` en lugar de un endpoint batch — simple de implementar y suficiente para el volumen esperado.

8. **Rentabilidad real como cálculo puro del servidor**: no requiere nuevo endpoint. Se calcula en el Server Component con los datos ya disponibles (`proyecto.presupuestos` + `getGastosResumen`). Sin estado del cliente, sin fetch extra.

9. **Re-poblar con preservación de asignaciones**: al reimportar la estructura presupuestaria, se guarda en memoria el mapa `gastoId → { codigo, descripcion }` de la partida anterior antes de limpiar. Después de crear las nuevas partidas, se reintenta la asignación por coincidencia de `codigo` (exacto) o `descripcion` (substring bidireccional). Todo ocurre dentro de la misma transacción Prisma.
