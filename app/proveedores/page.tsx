import { ProveedoresTab } from '@/components/contabilidad/ProveedoresTab'

export default function ProveedoresPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Proveedores</h1>
        <p className="text-sm text-muted-foreground mt-1">Catálogo de suplidores y contratistas</p>
      </div>
      <ProveedoresTab />
    </div>
  )
}
