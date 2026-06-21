import { describe, it, expect } from 'vitest'
import {
  PX_POR_DIA,
  ANCHO_COLUMNA,
  formatHeaderDia,
  formatHeaderSemana,
  inicioDeSemana,
  esFinDeSemana,
  diasEntre,
  fechaAPixel,
  pixelAFecha,
  generarColumnas,
  rangoCronograma,
  origenEje,
  type Escala,
} from '../cronograma-escala'

// Fechas de calendario se manejan en UTC midnight (igual que el resto del CRM).
function d(iso: string): Date {
  return new Date(iso + 'T00:00:00Z')
}

describe('cronograma-escala', () => {
  // ─── Formato de encabezado por día ──────────────────────────────
  describe('formatHeaderDia', () => {
    it('formatea "dom 21/06" con cero a la izquierda', () => {
      // 2026-06-21 es domingo
      expect(formatHeaderDia(d('2026-06-21'))).toBe('dom 21/06')
    })

    it('usa abreviaturas en español con tilde para miércoles y sábado', () => {
      // 2026-06-17 miércoles, 2026-06-20 sábado
      expect(formatHeaderDia(d('2026-06-17'))).toBe('mié 17/06')
      expect(formatHeaderDia(d('2026-06-20'))).toBe('sáb 20/06')
    })

    it('cubre todos los días de la semana en orden dom..sáb', () => {
      // 2026-06-21 (dom) .. 2026-06-27 (sáb)
      expect(formatHeaderDia(d('2026-06-21'))).toBe('dom 21/06')
      expect(formatHeaderDia(d('2026-06-22'))).toBe('lun 22/06')
      expect(formatHeaderDia(d('2026-06-23'))).toBe('mar 23/06')
      expect(formatHeaderDia(d('2026-06-24'))).toBe('mié 24/06')
      expect(formatHeaderDia(d('2026-06-25'))).toBe('jue 25/06')
      expect(formatHeaderDia(d('2026-06-26'))).toBe('vie 26/06')
      expect(formatHeaderDia(d('2026-06-27'))).toBe('sáb 27/06')
    })

    it('día y mes de dos dígitos', () => {
      expect(formatHeaderDia(d('2026-12-05'))).toBe('sáb 05/12')
    })
  })

  // ─── Formato de encabezado por semana ───────────────────────────
  describe('formatHeaderSemana', () => {
    it('muestra la fecha de inicio de semana como "dd/mm"', () => {
      expect(formatHeaderSemana(d('2026-06-22'))).toBe('22/06')
    })
  })

  // ─── inicio de semana (lunes) ───────────────────────────────────
  describe('inicioDeSemana', () => {
    it('devuelve el lunes de la semana para un miércoles', () => {
      // 2026-06-24 miércoles → lunes 2026-06-22
      expect(inicioDeSemana(d('2026-06-24')).toISOString().slice(0, 10)).toBe('2026-06-22')
    })
    it('un domingo pertenece a la semana que empezó el lunes anterior', () => {
      // 2026-06-21 domingo → lunes 2026-06-15
      expect(inicioDeSemana(d('2026-06-21')).toISOString().slice(0, 10)).toBe('2026-06-15')
    })
    it('un lunes se devuelve a sí mismo', () => {
      expect(inicioDeSemana(d('2026-06-22')).toISOString().slice(0, 10)).toBe('2026-06-22')
    })
  })

  // ─── fin de semana ──────────────────────────────────────────────
  describe('esFinDeSemana', () => {
    it('sábado y domingo son fin de semana', () => {
      expect(esFinDeSemana(d('2026-06-20'))).toBe(true) // sáb
      expect(esFinDeSemana(d('2026-06-21'))).toBe(true) // dom
    })
    it('los días entre semana no lo son', () => {
      expect(esFinDeSemana(d('2026-06-22'))).toBe(false) // lun
      expect(esFinDeSemana(d('2026-06-19'))).toBe(false) // vie
    })
  })

  // ─── diasEntre ──────────────────────────────────────────────────
  describe('diasEntre', () => {
    it('cuenta días calendario entre dos fechas', () => {
      expect(diasEntre(d('2026-06-21'), d('2026-06-24'))).toBe(3)
    })
    it('mismo día = 0', () => {
      expect(diasEntre(d('2026-06-21'), d('2026-06-21'))).toBe(0)
    })
    it('ignora la hora del día', () => {
      const a = new Date('2026-06-21T23:00:00Z')
      const b = new Date('2026-06-22T01:00:00Z')
      expect(diasEntre(a, b)).toBe(1)
    })
  })

  // ─── mapeo fecha ↔ pixel ────────────────────────────────────────
  describe('fechaAPixel / pixelAFecha (escala día)', () => {
    const origen = d('2026-06-21')
    const escala: Escala = 'dia'

    it('el origen está en pixel 0', () => {
      expect(fechaAPixel(d('2026-06-21'), origen, escala)).toBe(0)
    })

    it('un día después está a PX_POR_DIA.dia px', () => {
      expect(fechaAPixel(d('2026-06-22'), origen, escala)).toBe(PX_POR_DIA.dia)
    })

    it('10 días después', () => {
      expect(fechaAPixel(d('2026-07-01'), origen, escala)).toBe(10 * PX_POR_DIA.dia)
    })

    it('pixelAFecha es la inversa (redondeando al día)', () => {
      const px = fechaAPixel(d('2026-06-30'), origen, escala)
      expect(pixelAFecha(px, origen, escala).toISOString().slice(0, 10)).toBe('2026-06-30')
    })

    it('pixelAFecha redondea al día más cercano', () => {
      const px = 3 * PX_POR_DIA.dia + Math.floor(PX_POR_DIA.dia / 2) + 1
      expect(pixelAFecha(px, origen, escala).toISOString().slice(0, 10)).toBe('2026-06-25')
    })
  })

  describe('fechaAPixel (escala semana)', () => {
    const origen = d('2026-06-21')
    const escala: Escala = 'semana'

    it('7 días = ANCHO_COLUMNA.semana px', () => {
      expect(fechaAPixel(d('2026-06-28'), origen, escala)).toBe(ANCHO_COLUMNA.semana)
    })
  })

  // ─── generación de columnas ─────────────────────────────────────
  describe('generarColumnas (día)', () => {
    it('genera una columna por día inclusive en ambos extremos', () => {
      const cols = generarColumnas(d('2026-06-21'), d('2026-06-23'), 'dia')
      expect(cols).toHaveLength(3)
      expect(cols[0].label).toBe('dom 21/06')
      expect(cols[0].diaSemana).toBe('dom')
      expect(cols[0].fechaCorta).toBe('21/06')
      expect(cols[0].x).toBe(0)
      expect(cols[1].x).toBe(PX_POR_DIA.dia)
      expect(cols[2].label).toBe('mar 23/06')
      expect(cols.every(c => c.ancho === ANCHO_COLUMNA.dia)).toBe(true)
    })

    it('marca fines de semana', () => {
      const cols = generarColumnas(d('2026-06-19'), d('2026-06-22'), 'dia')
      // vie, sáb, dom, lun
      expect(cols.map(c => c.finDeSemana)).toEqual([false, true, true, false])
    })
  })

  describe('generarColumnas (semana)', () => {
    it('genera columnas semanales alineadas al lunes', () => {
      // del miércoles 24 jun al lunes 6 jul → semanas que empiezan 22-jun, 29-jun, 6-jul
      const cols = generarColumnas(d('2026-06-24'), d('2026-07-06'), 'semana')
      expect(cols).toHaveLength(3)
      expect(cols[0].label).toBe('22/06')
      expect(cols[1].label).toBe('29/06')
      expect(cols[2].label).toBe('06/07')
      expect(cols[0].x).toBe(0)
      expect(cols[1].x).toBe(ANCHO_COLUMNA.semana)
      expect(cols.every(c => c.ancho === ANCHO_COLUMNA.semana)).toBe(true)
    })
  })

  // ─── origen del eje ─────────────────────────────────────────────
  describe('origenEje', () => {
    it('en día es el propio inicio', () => {
      expect(origenEje(d('2026-06-24'), 'dia').toISOString().slice(0, 10)).toBe('2026-06-24')
    })
    it('en semana es el lunes de la semana de inicio', () => {
      expect(origenEje(d('2026-06-24'), 'semana').toISOString().slice(0, 10)).toBe('2026-06-22')
    })
  })

  // ─── rango del cronograma con padding ───────────────────────────
  describe('rangoCronograma', () => {
    it('devuelve min/max con padding de días', () => {
      const fechas = [
        { fechaInicio: d('2026-06-21'), fechaFin: d('2026-06-25') },
        { fechaInicio: d('2026-06-23'), fechaFin: d('2026-07-02') },
      ]
      const { inicio, fin } = rangoCronograma(fechas, 2)
      expect(inicio.toISOString().slice(0, 10)).toBe('2026-06-19')
      expect(fin.toISOString().slice(0, 10)).toBe('2026-07-04')
    })

    it('lista vacía devuelve un rango alrededor de hoy sin fallar', () => {
      const { inicio, fin } = rangoCronograma([], 2)
      expect(inicio).toBeInstanceOf(Date)
      expect(fin).toBeInstanceOf(Date)
      expect(fin.getTime()).toBeGreaterThan(inicio.getTime())
    })
  })
})
