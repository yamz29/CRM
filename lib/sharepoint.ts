import { getAccessToken, type OneDriveItem } from './onedrive'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// ── Config ──────────────────────────────────────────────────────────────

const SP_HOSTNAME   = process.env.NEXT_PUBLIC_SP_HOSTNAME   || ''  // gonzalezalvarezsrl.sharepoint.com
const SP_SITE_PATH  = process.env.NEXT_PUBLIC_SP_SITE_PATH  || ''  // /sites/gonzalvasrl
const SP_ROOT_FOLDER = process.env.NEXT_PUBLIC_SP_ROOT_FOLDER || 'Proyectos'

// ── Drive discovery (cached) ────────────────────────────────────────────

let cachedDriveId: string | null = null

async function graphGet(path: string): Promise<Record<string, unknown> | null> {
  const token = await getAccessToken()
  if (!token) return null
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    console.error('SharePoint Graph error:', res.status, await res.text().catch(() => ''))
    return null
  }
  return res.json()
}

async function graphPost(path: string, body: unknown): Promise<Record<string, unknown> | null> {
  const token = await getAccessToken()
  if (!token) return null
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error('SharePoint Graph POST error:', res.status, await res.text().catch(() => ''))
    return null
  }
  return res.json()
}

async function graphPut(path: string, body: ArrayBuffer, contentType = 'application/octet-stream'): Promise<Record<string, unknown> | null> {
  const token = await getAccessToken()
  if (!token) return null
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body,
  })
  if (!res.ok) {
    console.error('SharePoint Graph PUT error:', res.status, await res.text().catch(() => ''))
    return null
  }
  return res.json()
}

/** Get the drive ID for the SharePoint site's default document library */
export async function getSiteDriveId(): Promise<string | null> {
  if (cachedDriveId) return cachedDriveId
  if (!SP_HOSTNAME || !SP_SITE_PATH) {
    console.error('SharePoint env vars not set: NEXT_PUBLIC_SP_HOSTNAME / NEXT_PUBLIC_SP_SITE_PATH')
    return null
  }
  const data = await graphGet(`/sites/${SP_HOSTNAME}:${SP_SITE_PATH}:/drive`)
  if (data?.id) {
    cachedDriveId = data.id as string
    return cachedDriveId
  }
  return null
}

// ── File listing ────────────────────────────────────────────────────────

/** List children of the root folder (SP_ROOT_FOLDER, e.g. "Proyectos") */
export async function listSharePointRoot(): Promise<OneDriveItem[]> {
  const driveId = await getSiteDriveId()
  if (!driveId) return []
  const data = await graphGet(`/drives/${driveId}/root:/${SP_ROOT_FOLDER}:/children?$top=200&$orderby=name`)
  return ((data as Record<string, unknown>)?.value as unknown as OneDriveItem[]) ?? []
}

/** List children of a folder by item ID */
export async function listSharePointFolder(folderId: string): Promise<OneDriveItem[]> {
  const driveId = await getSiteDriveId()
  if (!driveId) return []
  const data = await graphGet(`/drives/${driveId}/items/${folderId}/children?$top=200&$orderby=name`)
  return ((data as Record<string, unknown>)?.value as unknown as OneDriveItem[]) ?? []
}

/** List children by path relative to root folder */
export async function listSharePointPath(relativePath: string): Promise<OneDriveItem[]> {
  const driveId = await getSiteDriveId()
  if (!driveId) return []
  const fullPath = relativePath ? `${SP_ROOT_FOLDER}/${relativePath}` : SP_ROOT_FOLDER
  const data = await graphGet(`/drives/${driveId}/root:/${fullPath}:/children?$top=200&$orderby=name`)
  return ((data as Record<string, unknown>)?.value as unknown as OneDriveItem[]) ?? []
}

// ── Preview / Share ─────────────────────────────────────────────────────

export async function getSharePointEmbedUrl(itemId: string): Promise<string | null> {
  const driveId = await getSiteDriveId()
  if (!driveId) return null
  const data = await graphGet(`/drives/${driveId}/items/${itemId}/preview`)
  return ((data as Record<string, unknown>)?.getUrl as string) ?? null
}

export async function getSharePointShareLink(itemId: string): Promise<string | null> {
  const driveId = await getSiteDriveId()
  if (!driveId) return null
  const data = await graphPost(`/drives/${driveId}/items/${itemId}/createLink`, {
    type: 'view',
    scope: 'organization',
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.link?.webUrl ?? null
}

// ── Resolve share URL to preview ────────────────────────────────────────

/** Encode a share URL for use with the /shares/ Graph API endpoint */
function encodeShareUrl(shareUrl: string): string {
  const base64 = btoa(shareUrl)
    .replace(/=+$/, '')
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
  return `u!${base64}`
}

/**
 * Resolve a SharePoint share link to an embeddable preview URL.
 * Uses the /shares/{encoded}/driveItem/preview endpoint.
 * Returns { embedUrl, downloadUrl, mimeType } or null.
 */
export async function resolveShareLinkPreview(shareUrl: string): Promise<{
  embedUrl: string | null
  downloadUrl: string | null
  mimeType: string | null
} | null> {
  const encoded = encodeShareUrl(shareUrl)

  // Get the driveItem to find downloadUrl and mimeType
  const item = await graphGet(`/shares/${encoded}/driveItem`)
  if (!item) return null

  const downloadUrl = (item['@microsoft.graph.downloadUrl'] as string) ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mimeType = ((item as any)?.file?.mimeType as string) ?? null

  // Get embeddable preview URL (works for Office docs)
  const preview = await graphGet(`/shares/${encoded}/driveItem/preview`)
  const embedUrl = ((preview as Record<string, unknown>)?.getUrl as string) ?? null

  return { embedUrl, downloadUrl, mimeType }
}

// ── Upload ──────────────────────────────────────────────────────────────

/** Sanitize a string for use as a SharePoint folder name */
export function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*#%&{}~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 128)
}

export function getRootFolder(): string {
  return SP_ROOT_FOLDER
}

/** Upload a small file (< 4 MB) to a path relative to SP_ROOT_FOLDER */
export async function uploadSmallFile(
  relativePath: string,
  fileName: string,
  content: ArrayBuffer,
): Promise<OneDriveItem | null> {
  const driveId = await getSiteDriveId()
  if (!driveId) return null
  const safeName = sanitizeFolderName(fileName) || 'archivo'
  const fullPath = relativePath
    ? `${SP_ROOT_FOLDER}/${relativePath}/${safeName}`
    : `${SP_ROOT_FOLDER}/${safeName}`
  const data = await graphPut(
    `/drives/${driveId}/root:/${fullPath}:/content`,
    content,
  )
  return (data as unknown as OneDriveItem) ?? null
}

/** Upload a large file (>= 4 MB) using upload session with progress callback */
export async function uploadLargeFile(
  relativePath: string,
  fileName: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<OneDriveItem | null> {
  const driveId = await getSiteDriveId()
  if (!driveId) return null
  const safeName = sanitizeFolderName(fileName) || 'archivo'
  const fullPath = relativePath
    ? `${SP_ROOT_FOLDER}/${relativePath}/${safeName}`
    : `${SP_ROOT_FOLDER}/${safeName}`

  // Create upload session
  const token = await getAccessToken()
  if (!token) return null
  const sessionRes = await fetch(`${GRAPH_BASE}/drives/${driveId}/root:/${fullPath}:/createUploadSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
  })
  if (!sessionRes.ok) return null
  const session = await sessionRes.json()
  const uploadUrl = session.uploadUrl as string

  // Upload in 5 MB chunks
  const CHUNK_SIZE = 5 * 1024 * 1024
  const totalSize = file.size
  let offset = 0
  let result: OneDriveItem | null = null

  while (offset < totalSize) {
    const end = Math.min(offset + CHUNK_SIZE, totalSize)
    const chunk = file.slice(offset, end)
    const buffer = await chunk.arrayBuffer()

    const chunkRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': `${end - offset}`,
        'Content-Range': `bytes ${offset}-${end - 1}/${totalSize}`,
      },
      body: buffer,
    })

    if (chunkRes.status === 200 || chunkRes.status === 201) {
      result = (await chunkRes.json()) as OneDriveItem
    } else if (!chunkRes.ok) {
      console.error('Upload chunk failed:', chunkRes.status)
      return null
    }

    offset = end
    onProgress?.(Math.round((offset / totalSize) * 100))
  }

  return result
}

/** Create a folder under SP_ROOT_FOLDER if it doesn't exist */
export async function ensureFolder(relativePath: string): Promise<boolean> {
  const driveId = await getSiteDriveId()
  if (!driveId) return false

  const parts = relativePath.split('/').filter(Boolean)
  let currentPath = SP_ROOT_FOLDER

  for (const part of parts) {
    const safePart = sanitizeFolderName(part)
    const checkPath = `${currentPath}/${safePart}`
    const existing = await graphGet(`/drives/${driveId}/root:/${checkPath}`)
    if (!existing) {
      // Create the folder
      const parentData = await graphGet(`/drives/${driveId}/root:/${currentPath}`)
      if (!parentData?.id) return false
      const created = await graphPost(`/drives/${driveId}/items/${parentData.id}/children`, {
        name: safePart,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      })
      if (!created) return false
    }
    currentPath = checkPath
  }
  return true
}
