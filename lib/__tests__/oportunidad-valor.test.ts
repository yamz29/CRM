import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock completo de prisma. Debe estar ANTES de importar el módulo bajo test.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    presupuesto: {
      findMany: vi.fn(),
    },
    oportunidad: {
      update: vi.fn(),
    },
  },
}))

// Import después del mock para que la referencia a prisma esté ya interceptada.
import { recalcValorOportunidad } from '../oportunidad-valor'
import { prisma } from '@/lib/prisma'

const mockedFindMany = prisma.presupuesto.findMany as unknown as ReturnType<typeof vi.fn>
const mockedUpdate = prisma.oportunidad.update as unknown as ReturnType<typeof vi.fn>

describe('recalcValorOportunidad', () => {
  beforeEach(() => {
    mockedFindMany.mockReset()
    mockedUpdate.mockReset()
  })

  it('usa el total del presupuesto Aprobado cuando existe', async () => {
    mockedFindMany.mockResolvedValue([
      { total: 1000, estado: 'Borrador' },
      { total: 2500, estado: 'Aprobado' },
      { total: 5000, estado: 'Enviado' },
    ])
    mockedUpdate.mockResolvedValue({})

    await recalcValorOportunidad(42)

    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { valor: 2500 },
    })
  })

  it('usa el total más alto cuando no hay Aprobado', async () => {
    mockedFindMany.mockResolvedValue([
      { total: 1000, estado: 'Borrador' },
      { total: 3200, estado: 'Enviado' },
      { total: 2100, estado: 'Borrador' },
    ])
    mockedUpdate.mockResolvedValue({})

    await recalcValorOportunidad(7)

    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { valor: 3200 },
    })
  })

  it('no actualiza nada si no hay presupuestos vinculados', async () => {
    mockedFindMany.mockResolvedValue([])

    await recalcValorOportunidad(99)

    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('filtra Rechazados en la query (usan where.estado.not)', async () => {
    mockedFindMany.mockResolvedValue([{ total: 500, estado: 'Enviado' }])
    mockedUpdate.mockResolvedValue({})

    await recalcValorOportunidad(10)

    const call = mockedFindMany.mock.calls[0][0]
    expect(call.where.oportunidadId).toBe(10)
    expect(call.where.estado).toEqual({ not: 'Rechazado' })
  })

  it('Aprobado tiene prioridad aunque haya otros con total más alto', async () => {
    mockedFindMany.mockResolvedValue([
      { total: 1000, estado: 'Aprobado' },
      { total: 9999, estado: 'Enviado' },
    ])
    mockedUpdate.mockResolvedValue({})

    await recalcValorOportunidad(1)

    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { valor: 1000 },
    })
  })

  it('con un solo presupuesto no-Aprobado usa ese total', async () => {
    mockedFindMany.mockResolvedValue([{ total: 750, estado: 'Borrador' }])
    mockedUpdate.mockResolvedValue({})

    await recalcValorOportunidad(5)

    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { valor: 750 },
    })
  })

  it('el primer Aprobado encontrado gana si por alguna razón hay más de uno', async () => {
    mockedFindMany.mockResolvedValue([
      { total: 800, estado: 'Aprobado' },
      { total: 1200, estado: 'Aprobado' },
    ])
    mockedUpdate.mockResolvedValue({})

    await recalcValorOportunidad(3)

    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { valor: 800 },
    })
  })
})
