/**
 * Subida de facturas a SharePoint desde el SERVIDOR usando autenticación
 * app-only (client credentials flow). No depende de la sesión MSAL del navegador
 * de ningún usuario.
 *
 * ⚠️ Server-only: este módulo lee AZURE_CLIENT_SECRET. NO importarlo desde
 *    componentes cliente.
 *
 * Requisitos en Azure (registro de app existente):
 *  - Un client secret en AZURE_CLIENT_SECRET.
 *  - Permiso de APLICACIÓN Microsoft Graph `Sites.ReadWrite.All` + admin consent.
 *
 * Best-effort: ninguna función pública lanza; ante cualquier fallo loguea y
 * devuelve null, para no romper el guardado de la factura.
 */
import { carpetaFactura, nombreArchivoFactura } from './factura-sp-path'

const GRAPH = 'https://graph.microsoft.com/v1.0'

const TENANT = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || ''
const CLIENT_ID = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || ''
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || ''
const SP_HOSTNAME = process.env.NEXT_PUBLIC_SP_HOSTNAME || ''
const SP_SITE_PATH = process.env.NEXT_PUBLIC_SP_SITE_PATH || ''
const SP_ROOT_FOLDER = process.env.NEXT_PUBLIC_SP_ROOT_FOLDER || 'Proyectos'

const FOUR_MB = 4 * 1024 * 1024

/** ¿Están todas las variables necesarias para la subida server-side? */
export function isServerSharePointConfigured(): boolean {
  return !!(TENANT && CLIENT_ID && CLIENT_SECRET && SP_HOSTNAME && SP_SITE_PATH)
}

// ── Token app-only (cacheado en memoria) ───────────────────────────────────
let tokenCache: { token: string; exp: number } | null = null

async function getAppToken(): Promise<string | null> {
  if (!isServerSharePointConfigured()) return null
  if (tokenCache && Date.now() < tokenCache.exp - 60_000) return tokenCache.token

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    console.error('SharePoint app token error:', res.status, await res.text().catch(() => ''))
    return null
  }
  const data = await res.json()
  if (!data?.access_token) return null
  tokenCache = { token: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 }
  return tokenCache.token
}

// ── Drive del sitio (cacheado) ─────────────────────────────────────────────
let driveIdCache: string | null = null

async function getDriveId(token: string): Promise<string | null> {
  if (driveIdCache) return driveIdCache
  const res = await fetch(`${GRAPH}/sites/${SP_HOSTNAME}:${SP_SITE_PATH}:/drive?$select=id`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    console.error('SharePoint getDriveId error:', res.status, await res.text().catch(() => ''))
    return null
  }
  const data = await res.json()
  driveIdCache = (data?.id as string) || null
  return driveIdCache
}

// ── Asegurar carpeta (crea segmentos faltantes bajo SP_ROOT_FOLDER) ────────
async function ensureFolder(token: string, driveId: string, relativePath: string): Promise<boolean> {
  const parts = relativePath.split('/').filter(Boolean)
  let currentPath = SP_ROOT_FOLDER

  for (const part of parts) {
    const checkPath = `${currentPath}/${part}`
    const check = await fetch(`${GRAPH}/drives/${driveId}/root:/${encodeURI(checkPath)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (check.status === 404) {
      const parent = await fetch(`${GRAPH}/drives/${driveId}/root:/${encodeURI(currentPath)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!parent.ok) return false
      const parentData = await parent.json()
      if (!parentData?.id) return false
      const created = await fetch(`${GRAPH}/drives/${driveId}/items/${parentData.id}/children`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: part, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
      })
      // 409 = creada por otra request concurrente; la tomamos como OK.
      if (!created.ok && created.status !== 409) return false
    } else if (!check.ok) {
      return false
    }
    currentPath = checkPath
  }
  return true
}

// ── Subir contenido (PUT directo o upload session por chunks) ──────────────
async function uploadFile(
  token: string,
  driveId: string,
  fullPath: string,
  content: Buffer,
  contentType: string,
): Promise<{ id: string; webUrl: string } | null> {
  if (content.length < FOUR_MB) {
    const res = await fetch(`${GRAPH}/drives/${driveId}/root:/${encodeURI(fullPath)}:/content`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType || 'application/octet-stream' },
      body: new Uint8Array(content),
    })
    if (!res.ok) {
      console.error('SharePoint upload (small) error:', res.status, await res.text().catch(() => ''))
      return null
    }
    return res.json()
  }

  // Archivo grande: upload session por chunks de 5 MB.
  const sessionRes = await fetch(`${GRAPH}/drives/${driveId}/root:/${encodeURI(fullPath)}:/createUploadSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
  })
  if (!sessionRes.ok) {
    console.error('SharePoint createUploadSession error:', sessionRes.status)
    return null
  }
  const { uploadUrl } = await sessionRes.json()

  const CHUNK = 5 * 1024 * 1024
  const total = content.length
  let offset = 0
  let result: { id: string; webUrl: string } | null = null
  while (offset < total) {
    const end = Math.min(offset + CHUNK, total)
    const chunk = content.subarray(offset, end)
    const chunkRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': `${end - offset}`,
        'Content-Range': `bytes ${offset}-${end - 1}/${total}`,
      },
      body: new Uint8Array(chunk),
    })
    if (chunkRes.status === 200 || chunkRes.status === 201) {
      result = await chunkRes.json()
    } else if (!chunkRes.ok) {
      console.error('SharePoint upload chunk error:', chunkRes.status)
      return null
    }
    offset = end
  }
  return result
}

// ── Link para compartir (organization); fallback a webUrl ──────────────────
async function createShareLink(token: string, driveId: string, itemId: string): Promise<string | null> {
  const res = await fetch(`${GRAPH}/drives/${driveId}/items/${itemId}/createLink`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'view', scope: 'organization' }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.link?.webUrl ?? null
}

// ── API pública ────────────────────────────────────────────────────────────

export interface SubirFacturaServidorOpts {
  fileBuffer: Buffer
  originalName: string
  proveedor: string | null | undefined
  numero: string | null | undefined
  fecha: Date | string
  facturaId?: number
  contentType?: string
}

/**
 * Sube una factura a `<SP_ROOT>/Facturas/AAAA/MM/<nombre>` desde el servidor.
 * Devuelve el sharepointUrl (share link o webUrl) o null si no está configurado
 * o si algo falla (best-effort, nunca lanza).
 */
export async function subirFacturaServidor(opts: SubirFacturaServidorOpts): Promise<string | null> {
  try {
    const token = await getAppToken()
    if (!token) return null
    const driveId = await getDriveId(token)
    if (!driveId) return null

    const folderPath = carpetaFactura(opts.fecha)
    const fileName = nombreArchivoFactura(opts.proveedor, opts.numero, opts.originalName, opts.facturaId)

    const ok = await ensureFolder(token, driveId, folderPath)
    if (!ok) return null

    const fullPath = `${SP_ROOT_FOLDER}/${folderPath}/${fileName}`
    const item = await uploadFile(token, driveId, fullPath, opts.fileBuffer, opts.contentType || 'application/octet-stream')
    if (!item) return null

    return (await createShareLink(token, driveId, item.id)) || item.webUrl || null
  } catch (e) {
    console.error('subirFacturaServidor falló (best-effort):', e)
    return null
  }
}
