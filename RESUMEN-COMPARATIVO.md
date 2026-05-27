# Resumen Comparativo — CRM Constructora (Gonzalva Group)

> Documento de referencia rápida para comparar este CRM con otro software del mercado.
> Versión actual: **v1.4** (migración a PostgreSQL). Última revisión: 2026-05-27.

---

## 1. Identidad del producto

| Atributo | Valor |
|---|---|
| Nombre | CRM Constructora — Gonzalva Group |
| Propósito | ERP/CRM para constructoras y remodeladoras pequeñas/medianas |
| Mercado objetivo | República Dominicana (RD$, soporte USD/EUR), residencial + comercial + muebles a medida |
| Tipo de despliegue | Web self-hosted (VPS propio: `erp.gonzalva.com.do`) |
| Idioma | Español |
| Modelo de uso | Single-tenant (una empresa por instancia) |

**Ciclo de negocio cubierto:**

```
Oportunidad → Cliente → Presupuesto → Proyecto → Producción/Compras → Facturación → Cobranza → Reporte
```

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Lenguaje | TypeScript |
| Base de datos | **PostgreSQL** en producción (SQLite en dev) vía Prisma ORM |
| UI | Tailwind CSS + shadcn/ui + Radix UI |
| Auth | JWT en cookie httpOnly (`crm_session`) con `jose` + bcryptjs |
| Middleware | `proxy.ts` (convención Next 16) |
| Excel | SheetJS (xlsx) — import/export en cliente y servidor |
| PDFs | jsPDF + html2canvas |
| Gantt | frappe-gantt + gantt-task-react |
| Charts | Recharts |
| Notificaciones push | web-push (VAPID) |
| SSO opcional | `@azure/msal-browser` (Microsoft 365) |
| Despliegue | PM2 + Nginx en VPS Linux |
| Tests | Vitest (cobertura mínima) |

---

## 3. Mapa de módulos

### 3.1 Operaciones comerciales
- **Dashboard** — métricas, actividad reciente, alertas
- **Clientes** — CRUD, tipos (Particular/Empresa/Arquitecto/Inmobiliaria), fuente de captación, ficha con histórico
- **Oportunidades (Pipeline)** — embudo de ventas con actividades CRM, reporte de pipeline
- **Presupuestos V2** — constructor jerárquico (Título → Capítulo → Partida), APU por partida, indirectos en %, numeración `COT-YYYY-NNN`, duplicar, vista impresión A4
- **Proyectos** — Estados: Prospecto → Cotización → Adjudicado → En Ejecución → Terminado / Archivado. Detalle con tabs (Resumen, Gastos, Control Presupuestario, Melamina, Producción, etc.)
- **Cronogramas (Gantt)** — actividades, hitos, dependencias, avances, EVM Snapshot
- **Documentos** — gestor por proyecto con comentarios
- **Gastos** — registro multi-moneda (RD$/USD/EUR), asignación a partidas, importación Excel
- **Recursos** — catálogo de insumos (materiales, MO, equipos, herrajes, etc.) con historial de precios e importación masiva
- **Catálogo APU** — análisis de precios unitarios reutilizables

### 3.2 Finanzas
- **Transacciones** — libro contable de movimientos
- **Facturación** — emisión de facturas a clientes con pagos parciales
- **Contabilidad** — cuentas bancarias, movimientos, conciliación
- **Proveedores** — directorio, integración con DGII (RNC)
- **Compras** — órdenes de compra con líneas (ItemOrdenCompra)

### 3.3 Gestión
- **Tareas** — vinculadas a cliente/proyecto, prioridad y estados, plantillas por etapa
- **Horas del Equipo** — registro de horas trabajadas por usuario/proyecto

### 3.4 Taller
- **Módulos Melamina** — catálogo de tableros/cantos/herrajes + editor de módulos con despiece automático, verificación de medidas pieza vs tablero, cálculo de planchas y consumo
- **Espacios / Cocinas Modulares** — diseño de espacios con muros, colocación de módulos (KitchenProject, KitchenWall, KitchenModulePlacement)
- **Producción** — órdenes de producción, items, asignaciones, materiales, bitácora con fotos

### 3.5 Sistema
- **Ayuda** — documentación in-app
- **Configuración** — Empresa, Usuarios, Vendedores, Categorías, Unidades, Permisos por módulo, días feriados, quicktexts, plantillas de tareas

---

## 4. Modelo de datos (resumen)

**~70 modelos** en `prisma/schema.prisma` (~1500 líneas). Bloques principales:

```
CRM/Ventas:    Cliente, Oportunidad, ActividadCRM, Vendedor
Proyectos:     Proyecto, AdicionalProyecto, ProyectoCapitulo, ProyectoPartida
Presupuestos:  Presupuesto (V1), Partida (V1 legacy),
               PresupuestoTitulo, CapituloPresupuesto, PartidaPresupuesto,
               AnalisisPartida, PresupuestoIndirectoLinea, PresupuestoQuickText
Recursos/APU:  Recurso, RecursoPriceHistory, RecursoImportBatch,
               ApuCatalogo, ApuRecurso
Melamina:      MaterialMelamina, MaterialModuloMelamina,
               ModuloMelaminaV2, PiezaModulo,
               ModuloMelamina (V1 legacy), RecursoModulo (legacy)
Cocinas:       KitchenProject, KitchenWall, KitchenModulePlacement
Producción:    OrdenProduccion, ItemProduccion, AsignacionProduccion,
               MaterialOrdenProduccion, BitacoraEntrada, BitacoraFoto
Finanzas:      CuentaBancaria, MovimientoBancario, Factura, PagoFactura,
               Proveedor, OrdenCompra, ItemOrdenCompra, RncDgii
Cronograma:    Cronograma, ActividadCronograma, AvanceCronograma,
               HitoCronograma, TareaGantt, ItemProgramaProyecto,
               EVMSnapshot, PunchItem
Gestión:       Tarea, RegistroHoras, PlantillaTareaEtapa
Documentos:    DocumentoProyecto, ComentarioDocumento
Gastos:        GastoProyecto
Sistema:       Empresa, Usuario, PermisoUsuario, PushSubscription,
               Categoria, UnidadGlobal, Configuracion, DiaFeriado
```

---

## 5. Funcionalidades diferenciadoras

### 5.1 Presupuestos V2 (núcleo del sistema)
- Jerarquía de **3 niveles** (Título → Capítulo → Partida)
- **APU integrado por partida** con `RecursoPickerModal` (búsqueda inline del catálogo)
- **Indirectos en %** sobre la base
- **Importar/Exportar Excel** con plantilla y validación
- **Duplicar presupuesto completo** (`POST /api/presupuestos-v2/[id]/duplicar`) con remapeo de IDs y nuevo número
- **Quicktexts** para descripciones reutilizables
- Vista de **impresión A4** sin shell, filtra capítulos en $0
- **Auto-activación del proyecto** cuando el presupuesto pasa a "Aprobado"

### 5.2 Control presupuestario por proyecto
- **Snapshot** independiente al "poblar" un proyecto desde un presupuesto
- Vista **presupuestado vs ejecutado** por capítulo/partida
- **Semáforo visual** (verde/ámbar/rojo/gris) por desviación
- **EVM Snapshots** (Earned Value Management): seguimiento de valor ganado en el tiempo
- **Punch List** (items pendientes de cierre)

### 5.3 Melamina con despiece físico
- Catálogo propio de **Tableros / Cantos / Herrajes** (independiente de `Recurso`)
- **Despiece automático** según tipo de módulo y dimensiones
- **Verificación pieza vs tablero**: celdas en rojo si la pieza no cabe
- **Tapacanto por cara** (S/I/L/R) con cálculo de ml total
- **Cálculo de planchas necesarias** y % uso por plancha
- Costo total con tablero + cantos + herrajes y margen sobre precio de venta

### 5.4 Cocinas (Espacios Modulares)
- Diseño por **muros** (`KitchenWall`)
- **Colocación de módulos** existentes en posiciones específicas
- Generación de presupuesto con herrajes y cantos del proyecto completo

### 5.5 Recursos: catálogo inteligente
- 8+ tipos: materiales, MO, equipos, herramientas, subcontratos, transportes, herrajes, consumibles
- **Filtros avanzados** persistentes con chips (categoría, proveedor, estado, rango de precio)
- **Importación masiva Excel** con 3 modos: Crear+Actualizar / Solo crear / Solo actualizar
- **Lote de importación** (`RecursoImportBatch`) con resumen creados/actualizados/omitidos/errores
- **Historial automático de precios** (`RecursoPriceHistory`) — origen Manual o Excel #lote, con variación %

### 5.6 Cronograma + Gantt
- **Dos vistas**: Gantt (frappe-gantt / gantt-task-react) y Kanban
- **Actividades, hitos y dependencias**
- **Avances %** registrados en el tiempo
- **Día feriado** configurable (afecta cálculo de duración)
- **Plantillas de tareas por etapa** para nuevos proyectos

### 5.7 Producción / Taller
- **Órdenes de producción** con items, asignaciones de operarios y materiales consumidos
- **Bitácora con fotos** por orden
- Integración con módulos de melamina/cocinas

### 5.8 Finanzas
- **Facturación** con pagos parciales (PagoFactura)
- **Cuentas bancarias** y conciliación de movimientos
- **Órdenes de compra** a proveedores
- **Integración DGII** (catálogo `RncDgii` para validar RNC de proveedores en RD)
- Multi-moneda RD$/USD/EUR (sin conversión automática)

### 5.9 Otros
- **Notificaciones push web** (VAPID + service workers)
- **Search global** (`/api/search`)
- **Permisos por módulo** (`PermisoUsuario`) — granularidad por usuario × módulo
- **Export masivo** (`/api/export`)
- **Quicktexts** para reutilizar textos en presupuestos
- **SSO Microsoft 365** opcional (msal-browser)

---

## 6. Seguridad y operación

| Aspecto | Implementación |
|---|---|
| Autenticación | JWT en cookie httpOnly + bcryptjs para hash de password |
| Autorización | Permisos por módulo (`PermisoUsuario`) — rol Admin + permisos granulares |
| Middleware | `proxy.ts` protege rutas y inyecta `x-pathname`, `x-user-id`, `x-user-nombre` |
| Multi-tenant | No (single-tenant por instancia) |
| Validación | Zod incluido en dependencias (uso parcial) |
| Logs | `console.error` (sin logging estructurado todavía) |
| Backups | Scripts manuales de export/import JSON entre SQLite y PostgreSQL |
| Despliegue | `deploy.sh` + PM2 + Nginx, entornos `prod` y `test` separados |

---

## 7. APIs REST (selección)

```
/api/auth/login | /api/auth/logout
/api/clientes              CRUD
/api/oportunidades         CRUD + reporte
/api/proyectos             CRUD + gastos + partidas + control-presupuestario
/api/presupuestos-v2       CRUD + /duplicar + /plantilla
/api/presupuestos/:id/estado    (auto-activa proyecto al aprobar)
/api/recursos              CRUD + /importar (Excel) + /:id/historial
/api/apus                  CRUD
/api/melamina              CRUD módulos + /materiales (CRUD tableros/cantos/herrajes)
/api/cocinas               CRUD espacios + muros + módulos colocados
/api/produccion            CRUD órdenes + items + bitácora
/api/compras               CRUD órdenes de compra
/api/proveedores           CRUD + validación RNC
/api/facturacion           CRUD facturas + pagos
/api/contabilidad          transacciones + movimientos bancarios
/api/cronograma            CRUD + actividades + avances + hitos
/api/tareas | /api/tareas-gantt | /api/plantillas-tareas
/api/horas                 registro de horas
/api/documentos            uploads + comentarios
/api/gastos                CRUD + importar
/api/notifications         push (VAPID)
/api/search                global
/api/export                export masivo
/api/configuracion         empresa, usuarios, permisos, unidades, etc.
```

---

## 8. Flujo de uso típico

```
1.  Login → JWT cookie
2.  Oportunidad (pipeline) → convertir a Cliente + Proyecto
3.  Crear Presupuesto V2 → APUs por partida → enviar
4.  Cliente aprueba → presupuesto pasa a "Aprobado" → proyecto pasa a "Activo"
5.  Poblar proyecto desde el presupuesto (snapshot)
6.  Generar Cronograma (Gantt) y Plantillas de Tareas
7.  Compras: emitir OC a Proveedores → recibir → registrar Gasto
8.  Producción: emitir Órdenes (melamina/cocinas) → bitácora con fotos
9.  Control Presupuestario: gastos vs partidas con semáforo + EVM snapshots
10. Facturación parcial al cliente → pagos → conciliación bancaria
11. Cierre: Punch List → reporte PDF
```

---

## 9. Limitaciones y deuda técnica conocida

| Área | Situación |
|---|---|
| Tests automatizados | Mínimos (Vitest configurado pero pocos casos) |
| Multi-tenant | No soportado (1 empresa por instancia) |
| Multi-moneda | Soporta RD$/USD/EUR pero **sin conversión automática** |
| Paginación | Sin paginación server-side en la mayoría de listados |
| Archivos | Almacenamiento local (`/public/uploads/`), sin cloud storage |
| Modelos legacy | `Partida` (V1), `ModuloMelamina` (V1), `RecursoModulo` (legacy) coexisten con V2 |
| APU dinámico | APU dentro de partidas no se recalcula si cambia el recurso origen |
| Validación | Zod parcial — muchas rutas validan manualmente |
| Logging | Sin logger estructurado, solo `console.*` |
| Internacionalización | Solo español, fechas y moneda dominicana |

---

## 10. Tabla resumen para comparativa

| Característica | Soportado | Notas |
|---|---|---|
| CRM (clientes, pipeline, actividades) | Sí | Oportunidades con ActividadCRM |
| Presupuestos jerárquicos | Sí | 3 niveles + APU + indirectos |
| APU (Análisis de Precios Unitarios) | Sí | Catálogo + por partida |
| Control presupuestario | Sí | Snapshot + semáforo + EVM |
| Cronograma Gantt + Kanban | Sí | frappe-gantt + dependencias |
| Gestión documental | Sí | Por proyecto, con comentarios |
| Producción/Taller | Sí | Órdenes, asignaciones, bitácora |
| Diseño de muebles a medida | Sí | Melamina con despiece físico |
| Cocinas/Espacios modulares | Sí | Muros + colocación de módulos |
| Compras a proveedores | Sí | OC con líneas, integración DGII |
| Facturación | Sí | Pagos parciales |
| Contabilidad bancaria | Básica | Movimientos + conciliación |
| Multi-moneda con conversión | Parcial | Sin tasa automática |
| Multi-tenant | No | Single-tenant |
| Roles y permisos granulares | Sí | Por módulo y usuario |
| Notificaciones push | Sí | Web push (VAPID) |
| SSO Microsoft 365 | Opcional | msal-browser |
| Importación/Exportación Excel | Sí | Recursos, gastos, presupuestos |
| Reportes PDF | Sí | jsPDF + html2canvas + impresión A4 |
| Móvil nativo | No | Responsive web only |
| API pública | No | API interna |
| Integración fiscal | Parcial | RNC DGII (RD) para proveedores |

---

## 11. Variables de entorno (referencia)

```env
DATABASE_URL="postgresql://usuario:pass@host:5432/db"   # Prod
DATABASE_URL="file:./dev.db"                            # Dev local SQLite
JWT_SECRET="<64 chars random>"                          # NUNCA en repo
VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY                    # Push notifications
```

---

*Documento generado para evaluación comparativa. Fuente: `SISTEMA.md`, `README.md`, `README-v1.4.md`, `prisma/schema.prisma`, estructura de `app/` y `components/layout/Sidebar.tsx`.*
