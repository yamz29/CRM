import { z } from 'zod'
import { NextResponse } from 'next/server'

// ── Helper ─────────────────────────────────────────────────────────────────────

export function zodError(error: z.ZodError) {
  const message = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  return NextResponse.json({ error: message }, { status: 400 })
}

// Fecha opcional: string ISO o vacío → null
const fechaOpcional = z.string().optional().nullable().transform(v => v || null)

// ── Clientes ───────────────────────────────────────────────────────────────────

export const ClienteSchema = z.object({
  nombre:      z.string().min(1, 'El nombre es requerido').max(200),
  rnc:         z.string().max(20).optional().nullable(),
  telefono:    z.string().max(30).optional().nullable(),
  whatsapp:    z.string().max(30).optional().nullable(),
  correo:      z.union([z.string().email('Correo inválido').max(200), z.literal(''), z.null()]).optional(),
  direccion:   z.string().max(500).optional().nullable(),
  tipoCliente: z.enum(['Particular', 'Empresa', 'Arquitecto', 'Inmobiliaria']).default('Particular'),
  fuente:      z.enum(['Referido', 'Web', 'Instagram', 'Facebook', 'Directo', 'Otro']).default('Directo'),
  notas:       z.string().max(2000).optional().nullable(),
})

export type ClienteInput = z.infer<typeof ClienteSchema>

// ── Proyectos ──────────────────────────────────────────────────────────────────

export const ProyectoSchema = z.object({
  nombre:              z.string().min(1, 'El nombre es requerido').max(300),
  clienteId:           z.coerce.number().int().positive('Cliente requerido'),
  tipoProyecto:        z.string().max(100).default('Remodelación'),
  ubicacion:           z.string().max(500).optional().nullable(),
  fechaInicio:         fechaOpcional,
  fechaEstimada:       fechaOpcional,
  estado:              z.enum(['Prospecto', 'Adjudicado', 'En Ejecución', 'Pausado', 'Finalizado', 'Cancelado']).default('Prospecto'),
  descripcion:         z.string().max(2000).optional().nullable(),
  responsable:         z.string().max(200).optional().nullable(),
  presupuestoEstimado: z.coerce.number().min(0).optional().nullable(),
})

export type ProyectoInput = z.infer<typeof ProyectoSchema>

// ── Oportunidades ──────────────────────────────────────────────────────────────

export const OportunidadSchema = z.object({
  clienteId:      z.coerce.number().int().positive('Cliente requerido'),
  nombre:         z.string().min(1, 'El nombre es requerido').max(300),
  etapa:          z.enum(['Lead', 'Levantamiento', 'Cotización', 'Negociación', 'Ganado', 'Perdido']).default('Lead'),
  valor:          z.coerce.number().min(0).optional().nullable(),
  moneda:         z.string().max(10).default('DOP'),
  probabilidad:   z.coerce.number().int().min(0).max(100).optional().nullable(),
  fechaCierreEst: fechaOpcional,
  responsable:    z.string().max(200).optional().nullable(),
  motivoPerdida:  z.string().max(500).optional().nullable(),
  notas:          z.string().max(2000).optional().nullable(),
  presupuestoIds: z.array(z.coerce.number().int()).optional(),
})

export type OportunidadInput = z.infer<typeof OportunidadSchema>

// ── Tareas ─────────────────────────────────────────────────────────────────────

export const TareaSchema = z.object({
  titulo:      z.string().min(1, 'El título es requerido').max(300),
  descripcion: z.string().max(2000).optional().nullable(),
  clienteId:   z.coerce.number().int().positive().optional().nullable(),
  proyectoId:  z.coerce.number().int().positive().optional().nullable(),
  asignadoId:  z.coerce.number().int().positive().optional().nullable(),
  fechaLimite: fechaOpcional,
  prioridad:   z.enum(['Alta', 'Media', 'Baja']).default('Media'),
  estado:      z.enum(['Pendiente', 'En proceso', 'Completada', 'Cancelada']).default('Pendiente'),
  avance:      z.coerce.number().int().min(0).max(100).default(0),
  responsable: z.string().max(200).optional().nullable(),
})

export type TareaInput = z.infer<typeof TareaSchema>
