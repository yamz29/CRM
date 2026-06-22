# Módulo "Ruta de compra" — Diseño

**Fecha:** 2026-06-22
**Estado:** Aprobado (pendiente de plan de implementación)

## 1. Propósito

Herramienta para que el comprador/chofer salga a la calle a comprar materiales: una
**lista manual** de materiales donde cada línea indica a qué proyecto va, su urgencia y
el suplidor donde se compraría. La pantalla agrupa los materiales por suplidor para armar
el **recorrido** (qué comprar en cada parada y cuánto presupuesto lleva).

Es **solo informativo para el comprador**: no toca el control de gastos ni la facturación.
La recepción de materiales queda explícitamente **fuera de alcance** (flujo futuro).

### Por qué un modelo nuevo (no reusar OrdenCompra)

El proyecto ya tiene `OrdenCompra` + `ItemOrdenCompra`, pero una OC es de **un solo
proveedor** y carga semántica fiscal (NCF, impuesto, total, estado `facturada`). No tiene
proyecto ni urgencia por línea. Forzar la ruta dentro de la OC sería incómodo. La ruta de
compra es un concepto distinto: lista manual, multi-proyecto, multi-suplidor, informativa.
Por eso se crea un modelo independiente que **reusa el catálogo `Proveedor`** existente
(la dirección/teléfono del proveedor son los datos de cada parada).

## 2. Modelo de datos (Prisma)

```prisma
model RutaCompra {
  id          Int      @id @default(autoincrement())
  codigo      String   @unique          // RC-2026-0001
  titulo      String?                    // ej. "Compras martes AM"
  fecha       DateTime @default(now())
  estado      String   @default("borrador") // borrador | en_proceso | completada | cancelada
  comprador   String?                    // nombre del chofer/comprador (texto libre)
  notas       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items       ItemRutaCompra[]
  @@index([estado])
  @@map("ruta_compra")
}

model ItemRutaCompra {
  id             Int      @id @default(autoincrement())
  rutaCompraId   Int
  descripcion    String                   // material a comprar
  cantidad       Float    @default(1)
  unidad         String   @default("ud")
  proyectoId     Int?                     // a qué proyecto va (opcional)
  proveedorId    Int?                     // suplidor (catálogo)
  proveedorTexto String?                  // fallback si el suplidor no está en catálogo
  urgencia       String   @default("media") // alta | media | baja
  precioEstimado Float?
  comprado       Boolean  @default(false)
  precioReal     Float?
  notas          String?
  orden          Int      @default(0)

  rutaCompra  RutaCompra @relation(fields: [rutaCompraId], references: [id], onDelete: Cascade)
  proyecto    Proyecto?  @relation(fields: [proyectoId], references: [id], onDelete: SetNull)
  proveedor   Proveedor? @relation(fields: [proveedorId], references: [id], onDelete: SetNull)

  @@index([rutaCompraId])
  @@map("item_ruta_compra")
}
```

Relaciones inversas a añadir:
- En `Proveedor`: `itemsRutaCompra ItemRutaCompra[]`
- En `Proyecto`: `itemsRutaCompra ItemRutaCompra[]`

**Parada:** no es una tabla. Se deriva en el server agrupando los items por `proveedorId`
(los de `proveedorTexto` se agrupan por ese texto; los sin suplidor caen en "Sin asignar").
La dirección/teléfono de cada parada salen del catálogo `Proveedor`.

## 3. Pantallas

Todas bajo `/compras/rutas`, integradas en `FinanzasNav` junto a "Compras".

### `/compras/rutas` — Lista
Tabla de rutas: código, título, fecha, estado (badge), # paradas, # items,
total estimado vs. total real. Botón "Nueva ruta". Filtro por estado.

### `/compras/rutas/nueva` — Builder
- Cabecera: título (opcional), comprador (texto), fecha.
- Tabla de líneas; cada fila:
  - material (`descripcion`), cantidad, unidad
  - **proyecto** — picker de proyectos activos (opcional)
  - **suplidor** — picker del catálogo `Proveedor`, con opción de texto libre (`proveedorTexto`)
  - **urgencia** — alta / media / baja
  - precio estimado (opcional)
- Botón "Agregar línea" para añadir filas rápido.
- Guardar → crea `RutaCompra` en estado `borrador`.

### `/compras/rutas/[id]` — Detalle en vivo (agrupado por suplidor)
- Vista **agrupada por parada/suplidor**. Cada parada: nombre, dirección y teléfono del
  proveedor (desde catálogo) + sus materiales.
- Por línea: checkbox **comprado** + input **precio real**.
- Totales por parada y total general (estimado vs. real).
- Badges de color por urgencia (alta=rojo, media=ámbar, baja=gris).
- Pensado para uso en móvil (marcar/anotar en la calle).
- Acciones: cambiar estado, "Imprimir", editar.

### `/compras/rutas/[id]/imprimir` — Hoja A4
Server component **sin shell** (patrón de `app/produccion/[id]/lista-compra`):
agrupada por suplidor, checkboxes por material, columna de precio, líneas de firma
"Comprador / Recibido". Ruta tipo `*/imprimir` para que el layout no renderice el sidebar.

## 4. API

- `GET /api/compras/rutas` — listar rutas (con conteos/totales).
- `POST /api/compras/rutas` — crear ruta (genera `codigo` con patrón `MAX` del sufijo del
  año en curso, **no** `count()`, igual que `COT-` / `OC-`).
- `GET /api/compras/rutas/[id]` — leer ruta con items, proveedor y proyecto.
- `PUT /api/compras/rutas/[id]` — actualizar cabecera + items (reemplazo de líneas).
- `DELETE /api/compras/rutas/[id]` — eliminar (cascade a items).
- `PATCH /api/compras/rutas/[id]/items/[itemId]` — marcar `comprado` / fijar `precioReal`
  (endpoint ligero para el modo en vivo desde el móvil, sin reenviar toda la ruta).

Todas las rutas protegidas con el wrapper `lib/with-permiso.ts` existente.

## 5. Detalles y convenciones

- **Numeración:** `RC-YYYY-NNNN` vía `MAX` del sufijo numérico del año en curso.
- **Estados:** `borrador` (armando) → `en_proceso` (comprador en la calle) → `completada`;
  `cancelada` aparte. Sin transiciones automáticas hacia otros módulos.
- **Urgencia:** alta=rojo, media=ámbar, baja=gris.
- **Moneda:** RD$ (default del sistema). Sin conversión.
- **Idioma:** español (modelos, rutas y UI), siguiendo la convención del repo.
- **Sin Zod / sin tests automatizados:** se sigue la deuda técnica conocida del proyecto;
  verificación manual en navegador.

## 6. Fuera de alcance (explícito)

- Generación de `GastoProyecto` / integración con control presupuestario.
- Recepción de materiales (confirmar entrega en taller) — **flujo futuro**.
- Conversión automática a `OrdenCompra`.
- Optimización geográfica real del recorrido (mapa/distancias). Las paradas se ordenan
  por agrupación de suplidor, no por geolocalización.

## 7. Gates de verificación

Antes de dar por terminado: `npx tsc --noEmit` + `npm run lint` (0 errores) + `npm run build`
(ignorar el error conocido de Prisma en prerender). `npm run db:push` para sincronizar el
schema en dev.
