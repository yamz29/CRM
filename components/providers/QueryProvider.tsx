'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Provider de TanStack Query (auditoría F5).
 *
 * Estándar de datos en cliente: los datos mutables se leen con useQuery
 * (con `initialData` de los props del server component cuando exista) y las
 * mutaciones invalidan su queryKey — NUNCA el patrón viejo de copiar props a
 * useState + mutación local + router.refresh(), que creaba dos fuentes de
 * verdad. Las páginas de solo lectura siguen server-first sin Query.
 *
 * Convención de queryKey: ['<módulo>', '<recurso>', ...params]
 * (ej. ['contabilidad', 'facturas']).
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 15s de frescura: cambiar de tab no re-consulta en ráfaga,
            // pero volver a la página tras trabajar en otra sí refresca.
            staleTime: 15_000,
            retry: 1,
          },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
