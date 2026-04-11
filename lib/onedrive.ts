import { getMsalInstance, graphScopes } from './msal-config'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// ── Auth ─────────────────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string | null> {
  const msal = getMsalInstance()
  await msal.initialize()

  const accounts = msal.getAllAccounts()
  if (accounts.length > 0) {
    try {
      const result = await msal.acquireTokenSilent({ scopes: graphScopes, account: accounts[0] })
      return result.accessToken
    } catch {
      // Token expired, need interactive login
    }
  }

  try {
    const result = await msal.acquireTokenPopup({ scopes: graphScopes })
    return result.accessToken
  } catch {
    return null
  }
}

export async function loginOneDrive(): Promise<boolean> {
  const token = await getAccessToken()
  return !!token
}

export function isLoggedIn(): boolean {
  try {
    const msal = getMsalInstance()
    return msal.getAllAccounts().length > 0
  } catch {
    return false
  }
}

export async function logoutOneDrive(): Promise<void> {
  const msal = getMsalInstance()
  await msal.initialize()
  const accounts = msal.getAllAccounts()
  if (accounts.length > 0) {
    await msal.logoutPopup({ account: accounts[0] })
  }
}

// ── Graph API helpers ────────────────────────────────────────────────────

async function graphGet(path: string): Promise<Record<string, unknown> | null> {
  const token = await getAccessToken()
  if (!token) return null

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

// ── Types ────────────────────────────────────────────────────────────────

export interface OneDriveItem {
  id: string
  name: string
  size: number
  webUrl: string
  lastModifiedDateTime: string
  folder?: { childCount: number }
  file?: { mimeType: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  thumbnails?: any[]
  '@microsoft.graph.downloadUrl'?: string
}

// ── File operations ──────────────────────────────────────────────────────

export async function listRootFiles(): Promise<OneDriveItem[]> {
  const data = await graphGet('/me/drive/root/children?$top=200&$orderby=name')
  return ((data as Record<string, unknown>)?.value as OneDriveItem[]) ?? []
}

export async function listFolderFiles(folderId: string): Promise<OneDriveItem[]> {
  const data = await graphGet(`/me/drive/items/${folderId}/children?$top=200&$orderby=name`)
  return ((data as Record<string, unknown>)?.value as OneDriveItem[]) ?? []
}

export async function getEmbedUrl(itemId: string): Promise<string | null> {
  const data = await graphGet(`/me/drive/items/${itemId}/preview`)
  return ((data as Record<string, unknown>)?.getUrl as string) ?? null
}

export async function getItemShareLink(itemId: string): Promise<string | null> {
  const token = await getAccessToken()
  if (!token) return null

  const res = await fetch(`${GRAPH_BASE}/me/drive/items/${itemId}/createLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'view', scope: 'organization' }),
  })

  if (!res.ok) return null
  const data = await res.json()
  return data?.link?.webUrl ?? null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function getFileIcon(name: string, mimeType?: string): 'pdf' | 'image' | 'excel' | 'word' | 'ppt' | 'folder' | 'file' {
  if (mimeType?.startsWith('image/')) return 'image'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'excel'
  if (['docx', 'doc'].includes(ext)) return 'word'
  if (['pptx', 'ppt'].includes(ext)) return 'ppt'
  return 'file'
}
