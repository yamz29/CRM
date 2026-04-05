import crypto from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * Google Drive upload using REST API + Service Account JWT.
 * No heavy SDK — just fetch calls.
 * Reads credentials from GOOGLE_SERVICE_ACCOUNT_KEY env var (JSON string)
 * or from google-sa.json file in project root.
 */

function base64url(data: string | Buffer): string {
  const b64 = Buffer.isBuffer(data) ? data.toString('base64') : Buffer.from(data).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function loadServiceAccountKey(): any | null {
  // Try env var first
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (keyJson) {
    try {
      return JSON.parse(keyJson)
    } catch {
      console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_KEY env var')
    }
  }

  // Fallback: read from google-sa.json file
  try {
    const filePath = path.join(process.cwd(), 'google-sa.json')
    const content = readFileSync(filePath, 'utf8')
    return JSON.parse(content)
  } catch {
    // File doesn't exist or invalid — Drive not configured
    return null
  }
}

async function getAccessToken(): Promise<string | null> {
  const key = loadServiceAccountKey()
  if (!key) return null

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const signInput = `${header}.${payload}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signInput)
  const signature = base64url(sign.sign(key.private_key))

  const jwt = `${signInput}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  if (!res.ok) {
    console.error('Google OAuth error:', await res.text())
    return null
  }

  const data = await res.json()
  return data.access_token || null
}

/**
 * Upload a file to Google Drive and return the web view link.
 * Returns null if Drive is not configured.
 */
export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string | null> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!folderId) return null

  const token = await getAccessToken()
  if (!token) return null

  // Multipart upload
  const boundary = '---drive-upload-boundary'
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  })

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )

  if (!uploadRes.ok) {
    console.error('Drive upload error:', await uploadRes.text())
    return null
  }

  const fileData = await uploadRes.json()

  // Make readable by anyone with the link
  if (fileData.id) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }).catch(() => {})
  }

  return fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view`
}
