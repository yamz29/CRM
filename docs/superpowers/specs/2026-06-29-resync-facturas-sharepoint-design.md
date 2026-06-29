# Re-sincronización de facturas a SharePoint (backfill) — Diseño

**Fecha:** 2026-06-29
**Autor:** Yamill González (con asistencia)
**Estado:** Aprobado para implementación

## Problema

El upload automático de facturas escaneadas a SharePoint (en `FacturaForm.tsx →
subirASharepoint`) es **client-side y best-effort**: solo sube si la persona que
registra la factura tiene sesión MSAL activa en el navegador. Cuando falla, la
factura queda guardada **solo en el VPS** (`public/uploads/facturas/`) con
`archivoUrl` puesto pero `sharepointUrl` en null, sin error visible.

Como resultado hay un backlog de facturas en el VPS que nunca llegaron a
SharePoint (la subida automática se detuvo ~5-jun-2026). Se necesita una forma
de subir ese backlog.

## Decisiones tomadas

- **Enfoque:** Camino A — botón en el ERP que sube desde el navegador reusando el
  MSAL que ya funciona. (Descartado Camino B / script server-side app-only:
  requiere client secret + permiso de aplicación + consentimiento de admin en
  Azure; queda como posible arreglo de raíz futuro.)
- **Alcance:** solo facturas de Contabilidad (`Factura.archivoUrl` →
  `public/uploads/facturas/`). NO incluye gastos de obra
  (`public/uploads/gastos/`).

## Diseño

Reusa íntegramente la lógica existente (`lib/sharepoint.ts`, `lib/onedrive.ts`,
`lib/factura-sp-path.ts`). Es, en esencia, `subirASharepoint` ejecutado en bucle
sobre las facturas pendientes.

### Componentes

1. **API — listar pendientes:** `GET /api/contabilidad/facturas/sin-sharepoint`
   - Permiso: `contabilidad/editar` (vía `checkPermiso`).
   - Devuelve facturas con `archivoUrl != null AND sharepointUrl == null`.
   - Campos: `id, numero, proveedor, fecha, archivoUrl`. Orden por fecha asc.

2. **Página — `/contabilidad/facturas/resync-sharepoint`**
   - Server page (shell estándar con back a `/contabilidad?tab=facturas`) que
     renderiza el componente cliente `ResyncSharePointClient`.

3. **Componente cliente — `ResyncSharePointClient.tsx`**
   - "Cargar pendientes" → `GET .../sin-sharepoint`, muestra el conteo.
   - Asegura sesión MSAL (`initMsal` → `isLoggedIn` → `loginOneDrive`).
   - "Iniciar subida" → recorre **secuencialmente** cada factura:
     1. baja el archivo local: `fetch('/api' + archivoUrl)` → `Blob` → `File`.
     2. `folderPath = carpetaFactura(fecha)`,
        `fileName = nombreArchivoFactura(proveedor, numero, basename(archivoUrl), id)`.
     3. `ensureFolder(folderPath)` (cachea carpetas ya aseguradas en la corrida).
     4. `uploadSmallFile` (<4MB) / `uploadLargeFile` (≥4MB).
     5. `getSharePointShareLink(item.id)`.
     6. `PUT /api/contabilidad/facturas/{id}` con `{ sharepointUrl }`.
   - Barra de progreso + contadores hecho/fallidas; al final lista de fallidas
     con motivo.

### Propiedades

- **Idempotente:** al persistir `sharepointUrl`, una re-ejecución solo reintenta
  las que sigan pendientes. Si la pestaña se cierra a mitad, reanuda.
- **Best-effort por ítem:** archivo faltante en disco (404) o error de upload se
  registra y continúa con el resto.
- **Sin cambios en Azure.** Usa la sesión del usuario (Documentos ya lo prueba).
- **Secuencial** para evitar throttling de Graph y mantener el progreso claro.

### Casos borde

- Archivo no encontrado en disco → fallida "archivo no encontrado", continúa.
- Nombre original perdido: se usa el basename de `archivoUrl` (conserva extensión).
- Reintento parcial previo con otro nombre → `conflictBehavior: rename` evita
  sobrescribir; el flag `sharepointUrl` evita reprocesar.

## Fuera de alcance

- Gastos de obra (`public/uploads/gastos/`).
- Arreglo de raíz del flujo normal (Camino B, server-side app-only).

## Verificación

- Gates: `npx tsc --noEmit`, `npm run lint`, `npm run build` (ignorar error
  Prisma de prerender conocido).
- Funcional: manual en navegador tras desplegar al VPS (no ejecutable desde el
  entorno de desarrollo local — los archivos viven en el VPS).
