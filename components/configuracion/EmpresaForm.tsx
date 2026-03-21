'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, CheckCircle, Upload, X, ImageIcon } from 'lucide-react'

interface EmpresaData {
  id?: number
  nombre: string
  rut?: string | null
  slogan?: string | null
  direccion?: string | null
  telefono?: string | null
  correo?: string | null
  sitioWeb?: string | null
  logoUrl?: string | null
}

export function EmpresaForm({ initialData }: { initialData: EmpresaData | null }) {
  const [form, setForm] = useState<EmpresaData>({
    nombre: initialData?.nombre || 'Gonzalva Group',
    rut: initialData?.rut || '',
    slogan: initialData?.slogan || '',
    direccion: initialData?.direccion || '',
    telefono: initialData?.telefono || '',
    correo: initialData?.correo || '',
    sitioWeb: initialData?.sitioWeb || '',
    logoUrl: initialData?.logoUrl || '',
    id: initialData?.id,
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Logo upload state
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>(initialData?.logoUrl || '')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoMsg, setLogoMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setSuccess(false)
    setError('')
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      setLogoMsg({ type: 'error', text: 'Formato no válido. Use PNG, JPG, WEBP o SVG.' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoMsg({ type: 'error', text: 'El archivo supera 5MB.' })
      return
    }

    setLogoFile(file)
    setLogoMsg(null)
    // Show local preview immediately
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleLogoUpload() {
    if (!logoFile) return
    setUploadingLogo(true)
    setLogoMsg(null)

    try {
      const fd = new FormData()
      fd.append('file', logoFile)

      const res = await fetch('/api/configuracion/logo', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error al subir')

      setForm((prev) => ({ ...prev, logoUrl: data.logoUrl }))
      setLogoPreview(data.logoUrl)
      setLogoFile(null)
      setLogoMsg({ type: 'ok', text: 'Logo subido correctamente.' })
    } catch (err: unknown) {
      setLogoMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al subir' })
    } finally {
      setUploadingLogo(false)
    }
  }

  function handleRemoveLogo() {
    setLogoFile(null)
    setLogoPreview('')
    setForm((prev) => ({ ...prev, logoUrl: '' }))
    setLogoMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)
    setError('')
    try {
      const res = await fetch('/api/configuracion/empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Error al guardar')
      const data = await res.json()
      setForm((prev) => ({ ...prev, id: data.id }))
      setSuccess(true)
    } catch {
      setError('Ocurrió un error al guardar. Intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <Building2 className="w-5 h-5 text-blue-600" />
          Datos de la empresa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── LOGO UPLOAD SECTION ── */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Logo de la empresa
            </p>

            {/* Current logo preview */}
            {logoPreview ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreview}
                  alt="Logo"
                  className="h-20 w-auto max-w-[160px] object-contain border border-slate-200 rounded-lg p-2 bg-white shadow-sm"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Logo actual</p>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 transition-colors">
                      Reemplazar
                    </button>
                    <button type="button" onClick={handleRemoveLogo}
                      className="text-xs px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-200 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer">
                <Upload className="w-8 h-8 text-slate-300" />
                <span className="text-sm font-medium text-slate-500">Haz clic para subir logo</span>
                <span className="text-xs text-slate-400">PNG, JPG, WEBP o SVG · máx. 5MB</span>
              </button>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* File selected but not yet uploaded */}
            {logoFile && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-xs text-blue-700 font-medium truncate">{logoFile.name}</span>
                <button type="button"
                  onClick={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="ml-3 flex-shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                  <Upload className="w-3 h-3" />
                  {uploadingLogo ? 'Subiendo...' : 'Subir logo'}
                </button>
              </div>
            )}

            {/* Logo messages */}
            {logoMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg ${logoMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {logoMsg.text}
              </p>
            )}
          </div>

          {/* ── COMPANY INFO FIELDS ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre de la empresa *</Label>
              <Input id="nombre" name="nombre" value={form.nombre} onChange={handleChange} required placeholder="Gonzalva Group" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rut">RNC / RUT</Label>
              <Input id="rut" name="rut" value={form.rut || ''} onChange={handleChange} placeholder="123-456789-1" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="slogan">Eslogan o descripción</Label>
              <Input id="slogan" name="slogan" value={form.slogan || ''} onChange={handleChange} placeholder="Construyendo sus sueños" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" name="direccion" value={form.direccion || ''} onChange={handleChange} placeholder="Av. Principal 123, Santo Domingo" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" name="telefono" value={form.telefono || ''} onChange={handleChange} placeholder="+1 809 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="correo">Correo electrónico</Label>
              <Input id="correo" name="correo" type="email" value={form.correo || ''} onChange={handleChange} placeholder="info@gonzalvagroup.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sitioWeb">Sitio web</Label>
              <Input id="sitioWeb" name="sitioWeb" value={form.sitioWeb || ''} onChange={handleChange} placeholder="https://gonzalvagroup.com" />
            </div>
          </div>

          {success && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Configuración guardada correctamente
            </div>
          )}
          {error && (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">{error}</div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
