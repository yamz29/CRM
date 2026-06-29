# Subida server-side de facturas a SharePoint (Camino B) — Diseño

**Fecha:** 2026-06-29
**Estado:** Aprobado para implementación

## Problema

El upload a SharePoint es client-side/por-usuario/best-effort: depende de que
quien registra la factura tenga sesión MSAL en el navegador. Cuando no la tiene,
la factura queda solo en el VPS (`sharepointUrl=null`) sin error visible. Es la
causa de raíz del backlog de junio-2026.

## Decisiones tomadas

- **Auth:** client credentials (app-only). Reusa el registro de app existente
  (`8db586b0-…`) añadiéndole un client secret.
- **Permiso Graph:** `Sites.ReadWrite.All` (application) + admin consent.
- **Transición:** el servidor sube al guardar; el cliente (`FacturaForm`) queda
  como **respaldo** y solo corre si el servidor NO puso `sharepointUrl`.
- **Gated:** todo se activa solo si `AZURE_CLIENT_SECRET` está configurado. Sin
  él, el comportamiento actual (cliente) sigue intacto.

## Diseño

### Módulos

1. **`lib/sp-naming.ts`** (nuevo, puro): mueve `sanitizeFolderName` aquí para
   romper la dependencia de MSAL-browser. `lib/sharepoint.ts` lo re-exporta (sin
   cambios para los importadores existentes) y `lib/factura-sp-path.ts` lo
   importa de aquí → queda libre de MSAL y usable en el servidor.

2. **`lib/sharepoint-server.ts`** (nuevo, server-only): NO debe importarse desde
   componentes cliente (lee `AZURE_CLIENT_SECRET`).
   - `isServerSharePointConfigured()`: true si tenant+clientId+secret+host+site.
   - `getAppToken()`: client_credentials contra
     `login.microsoftonline.com/{tenant}/oauth2/v2.0/token`, scope `.default`.
     Token cacheado en memoria hasta ~1 min antes de expirar.
   - `getDriveId()`: resuelve el drive del sitio (cacheado).
   - `ensureFolder()`: crea `Facturas/AAAA/MM` si no existe (recorre segmentos).
   - `uploadFile()`: PUT directo (<4MB) o upload session por chunks (≥4MB).
   - `createShareLink()`: `createLink` organization (fallback a `webUrl`).
   - `subirFacturaServidor({ fileBuffer, originalName, proveedor, numero, fecha,
     facturaId })`: orquesta todo y devuelve `sharepointUrl | null`. Best-effort:
     captura errores, loguea, devuelve null (nunca lanza).

### Enganche

3. **`POST /api/contabilidad/facturas`** y **`PUT .../[id]`**: tras guardar el
   archivo local, si `isServerSharePointConfigured()`, llama
   `subirFacturaServidor` con el buffer ya leído y persiste `sharepointUrl` en el
   create/update. Best-effort: si falla, la factura igual se guarda.

4. **`FacturaForm.tsx`**: el bloque post-guardado solo llama a la subida cliente
   `subirASharepoint` si la respuesta NO trae `sharepointUrl` (el servidor no la
   subió). Si la trae, muestra banner verde "Subida a SharePoint (servidor)".

### Config

5. **`.env.server.example`**: documenta `AZURE_CLIENT_SECRET` y el permiso de
   aplicación `Sites.ReadWrite.All` + admin consent.

## Setup en Azure (lo hace el usuario/admin)

1. App registration `8db586b0-…` → Certificates & secrets → nuevo client secret
   → valor a `.env.server` como `AZURE_CLIENT_SECRET`.
2. API permissions → Microsoft Graph → Application permissions →
   `Sites.ReadWrite.All` → Grant admin consent.
3. Rebuild + redeploy.

## Fuera de alcance

- Gastos de obra.
- Resync server-side masivo (el backfill ya se cubre con la herramienta de
  navegador `/contabilidad/facturas/resync-sharepoint`). Fácil de añadir luego
  reusando `lib/sharepoint-server.ts`.

## Verificación

- Gates: `tsc --noEmit`, `lint`, `build`. Funcional real requiere el secret de
  Azure + deploy (no testeable desde local).
