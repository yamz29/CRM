import { describe, it, expect } from 'vitest'
import { pushRecienteList, type Reciente } from '@/lib/recientes'

const mk = (kind: string, id: number): Reciente => ({ kind, id, label: `${kind}-${id}`, sub: '', href: `/${kind}/${id}` })

describe('pushRecienteList', () => {
  it('antepone el nuevo item', () => {
    const res = pushRecienteList([mk('cliente', 1)], mk('proyecto', 2))
    expect(res[0]).toMatchObject({ kind: 'proyecto', id: 2 })
  })

  it('deduplica por (kind,id) moviendo el existente al frente', () => {
    const res = pushRecienteList([mk('cliente', 1), mk('proyecto', 2)], mk('proyecto', 2))
    expect(res).toHaveLength(2)
    expect(res[0]).toMatchObject({ kind: 'proyecto', id: 2 })
  })

  it('no confunde mismo id de distinto kind', () => {
    const res = pushRecienteList([mk('cliente', 1)], mk('proyecto', 1))
    expect(res).toHaveLength(2)
  })

  it('recorta al máximo', () => {
    const base = Array.from({ length: 8 }, (_, i) => mk('cliente', i))
    const res = pushRecienteList(base, mk('proyecto', 99), 8)
    expect(res).toHaveLength(8)
    expect(res[0]).toMatchObject({ kind: 'proyecto', id: 99 })
  })
})
