import { ProveedoresTab } from '@/components/contabilidad/ProveedoresTab'
import { FinanzasNav } from '@/components/contabilidad/FinanzasNav'
import { PageHeader } from '@/components/ui/page-header'

export default function ProveedoresPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <FinanzasNav activo="proveedores" />
      <PageHeader
        title="Proveedores"
        subtitle="Catálogo de suplidores y contratistas"
      />
      <ProveedoresTab />
    </div>
  )
}
