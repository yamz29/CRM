import { redirect } from 'next/navigation'

export default async function EditarModuloPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/melamina/${id}`)
}
