import { redirect } from 'next/navigation'

// Classic budget removed — redirect to V2
export default async function NuevoPresupuestoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp = await searchParams
  const qs = new URLSearchParams(sp).toString()
  redirect(`/presupuestos/nuevo-v2${qs ? `?${qs}` : ''}`)
}
