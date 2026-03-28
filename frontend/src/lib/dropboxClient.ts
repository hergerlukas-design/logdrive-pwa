// Dropbox PKCE OAuth + Upload — kein SDK, nur fetch

const APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY as string

const REDIRECT_URI       = `${window.location.origin}/dropbox/callback`
const TOKEN_KEY          = 'logdrive_dropbox_token'
const REFRESH_TOKEN_KEY  = 'logdrive_dropbox_refresh_token'
const CODE_VERIFIER_KEY  = 'logdrive_code_verifier'
const FOLDER_KEY         = 'logdrive_dropbox_folder'

export function getDropboxFolder(): string {
  return localStorage.getItem(FOLDER_KEY) ?? '/LogDrive'
}

export function setDropboxFolder(path: string): void {
  let normalized = path.trim()
  if (!normalized.startsWith('/')) normalized = '/' + normalized
  if (normalized.endsWith('/')) normalized = normalized.slice(0, -1)
  localStorage.setItem(FOLDER_KEY, normalized || '/LogDrive')
}

// ── PKCE ─────────────────────────────────────────────────────────────────────

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => chars[b % chars.length]).join('')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(plain))
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  return base64urlEncode(await sha256(verifier))
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function isDropboxConnected(): boolean {
  return !!localStorage.getItem(TOKEN_KEY)
}

export function logoutDropbox(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(CODE_VERIFIER_KEY)
  localStorage.removeItem(FOLDER_KEY)
}

export async function startDropboxLogin(): Promise<void> {
  const verifier  = generateRandomString(64)
  const challenge = await generateCodeChallenge(verifier)
  localStorage.setItem(CODE_VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    client_id:             APP_KEY,
    response_type:         'code',
    redirect_uri:          REDIRECT_URI,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    token_access_type:     'offline',
  })

  window.location.href = `https://www.dropbox.com/oauth2/authorize?${params}`
}

export async function switchDropboxAccount(): Promise<void> {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(CODE_VERIFIER_KEY)
  // Ordner-Einstellung bleibt erhalten
  await startDropboxLogin()
}

export async function handleDropboxCallback(): Promise<string> {
  const params       = new URLSearchParams(window.location.search)
  const code         = params.get('code')
  const codeVerifier = localStorage.getItem(CODE_VERIFIER_KEY)

  if (!code || !codeVerifier) throw new Error('Kein Code oder Code-Verifier gefunden.')

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type:    'authorization_code',
      client_id:     APP_KEY,
      redirect_uri:  REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  })

  const data = await response.json()
  if (!response.ok || !data.access_token) {
    throw new Error(`Token-Fehler: ${data.error_description ?? data.error ?? JSON.stringify(data)}`)
  }

  localStorage.setItem(TOKEN_KEY, data.access_token)
  if (data.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
  localStorage.removeItem(CODE_VERIFIER_KEY)
  return data.access_token as string
}

// ── Token-Erneuerung ──────────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken) throw new Error('Kein Refresh Token. Bitte erneut verbinden.')

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     APP_KEY,
    }),
  })

  const data = await response.json()
  if (!response.ok || !data.access_token) {
    logoutDropbox()
    throw new Error('Token-Erneuerung fehlgeschlagen. Bitte erneut verbinden.')
  }

  localStorage.setItem(TOKEN_KEY, data.access_token)
  return data.access_token as string
}

async function withTokenRefresh(callFn: (token: string) => Promise<Response>): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) throw new Error('Nicht mit Dropbox verbunden.')

  const response = await callFn(token)
  if (response.status !== 401) return response

  const newToken = await refreshAccessToken()
  return callFn(newToken)
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function normalizeFolderPath(folder: string): string {
  let path = (folder ?? '/LogDrive').trim()
  if (!path.startsWith('/')) path = '/' + path
  if (path.endsWith('/'))    path = path.slice(0, -1)
  if (!path || path === '')  path = '/LogDrive'
  return path
}

function dropboxApiArg(obj: object): string {
  return JSON.stringify(obj).replace(
    /[^\x20-\x7E]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  )
}

async function ensureFolderExists(folderPath: string): Promise<void> {
  const response = await withTokenRefresh(token =>
    fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath, autorename: false }),
    })
  )
  if (response.status === 409) return
  if (!response.ok) {
    const data    = await response.json().catch(() => ({}))
    const summary = (data as { error_summary?: string }).error_summary ?? ''
    if (summary.includes('path/conflict')) return
    throw new Error(`Ordner konnte nicht erstellt werden (${response.status}): ${summary}`)
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadPdfToDropbox(
  pdfBlob:    Blob,
  fileName:   string,
  folderPath: string
): Promise<object> {
  if (!localStorage.getItem(TOKEN_KEY)) throw new Error('Nicht mit Dropbox verbunden.')
  if (!fileName) throw new Error('Dateiname fehlt.')

  const normalizedFolder = normalizeFolderPath(folderPath)
  const fullPath         = `${normalizedFolder}/${fileName}`

  await ensureFolderExists(normalizedFolder)

  const response = await withTokenRefresh(token =>
    fetch('https://content.dropboxapi.com/2/files/upload', {
      method:  'POST',
      headers: {
        'Authorization':   `Bearer ${token}`,
        'Content-Type':    'application/octet-stream',
        'Dropbox-API-Arg': dropboxApiArg({
          path: fullPath, mode: 'add', autorename: true, mute: false,
        }),
      },
      body: pdfBlob,
    })
  )

  const text = await response.text()
  let json: object | null = null
  try { json = JSON.parse(text) } catch { json = null }

  if (!response.ok) {
    const d = json as { error_summary?: string; error?: { '.tag'?: string } } | null
    const detail = d?.error_summary ?? d?.error?.['.tag'] ?? text ?? 'Unbekannter Fehler'
    throw new Error(`Dropbox Upload fehlgeschlagen (${response.status}): ${detail}`)
  }

  return json ?? {}
}
