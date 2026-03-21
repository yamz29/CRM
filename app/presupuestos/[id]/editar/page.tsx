import { redirect } from 'next/navigation'

// Classic budget removed — redirect to V2 editor
export default async function EditarPresupuestoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/presupuestos/${id}/editar-v2`)
}
