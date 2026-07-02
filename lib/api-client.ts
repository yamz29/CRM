/**
 * Helper de fetch para el cliente (auditoría F5): parsea JSON y convierte
 * respuestas no-ok en un Error con el mensaje del servidor (el formato
 * `{ error }` que devuelve apiHandler), listo para toast.error(e.message).
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiClientError(res.status, data?.error ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}
