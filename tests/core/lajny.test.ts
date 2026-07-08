import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac } from '../../src/core/generator'
import {
  detailPoziceHrace,
  mapujDetailPozici,
  popisDetailPozice,
  popisZarazeni,
  seradObrance,
  seradUtocniky,
  spojeneLajny,
} from '../../src/core/lajny'
import { createRng } from '../../src/core/rng'
import type { DetailPozice, Hrac, Sestava } from '../../src/core/types'

const hrac = (overrides: Partial<Hrac> = {}): Hrac => ({
  id: 'h1',
  jmeno: 'Test',
  prijmeni: 'Hráč',
  vek: 25,
  pozice: 'U',
  atributy: {
    strelba: 50,
    prihravky: 50,
    brusleni: 50,
    obrana: 50,
    fyzicka: 50,
    chytani: 20,
    vydrz: 50,
    technika: 50,
  },
  potencial: 60,
  forma: 50,
  unava: 0,
  goly: 0,
  asistence: 0,
  zranenZapasu: 0,
  odehranoSezona: 0,
  plat: 100_000,
  ...overrides,
})

const sestava: Sestava = {
  utoky: [
    ['u1', 'u2', 'u3'],
    ['u4', 'u5', 'u6'],
    ['u7', 'u8', 'u9'],
    ['u10', 'u11', 'u12'],
  ],
  obrany: [
    ['d1', 'd2'],
    ['d3', 'd4'],
    ['d5', 'd6'],
  ],
  brankar: 'g1',
}

describe('spojeneLajny', () => {
  it('spáruje 1–3. útok s odpovídající obranou, 4. útok sdílí 3. dvojici', () => {
    const lajny = spojeneLajny(sestava)
    expect(lajny).toHaveLength(4)
    expect(lajny[0].utok).toEqual(['u1', 'u2', 'u3'])
    expect(lajny[0].obrana).toEqual(['d1', 'd2'])
    expect(lajny[1].obrana).toEqual(['d3', 'd4'])
    expect(lajny[2].obrana).toEqual(['d5', 'd6'])
    expect(lajny[3].utok).toEqual(['u10', 'u11', 'u12'])
    expect(lajny[3].obrana).toEqual(['d5', 'd6'])
    expect(lajny[3].popis).toContain('sdílí')
  })
})

describe('detailPoziceHrace', () => {
  it('použije uloženou detailPozici', () => {
    expect(detailPoziceHrace(hrac({ detailPozice: 'C' }))).toBe('C')
  })

  it('odvodí pozici z atributů', () => {
    expect(detailPoziceHrace(hrac({ atributy: { ...hrac().atributy, strelba: 80, prihravky: 50 } }))).toMatch(/LW|RW/)
    expect(detailPoziceHrace(hrac({ atributy: { ...hrac().atributy, prihravky: 85, strelba: 50 } }))).toBe('C')
    expect(detailPoziceHrace(hrac({ pozice: 'D', atributy: { ...hrac().atributy, strelba: 70, obrana: 50 } }))).toBe('LD')
    expect(detailPoziceHrace(hrac({ pozice: 'G' }))).toBeNull()
  })

  it('je deterministická pro stejné id', () => {
    const a = detailPoziceHrace(hrac({ id: 'abc', atributy: { ...hrac().atributy, strelba: 55, prihravky: 55 } }))
    const b = detailPoziceHrace(hrac({ id: 'abc', atributy: { ...hrac().atributy, strelba: 55, prihravky: 55 } }))
    expect(a).toBe(b)
  })
})

describe('mapujDetailPozici', () => {
  it('mapuje EP zkratky', () => {
    const map: [string, DetailPozice][] = [
      ['C', 'C'],
      ['LW', 'LW'],
      ['RW', 'RW'],
      ['LD', 'LD'],
      ['RD', 'RD'],
      ['F', undefined as unknown as DetailPozice],
    ]
    expect(mapujDetailPozici('C')).toBe('C')
    expect(mapujDetailPozici('lw')).toBe('LW')
    expect(mapujDetailPozici('F')).toBeUndefined()
  })
})

describe('seradUtocniky', () => {
  it('řadí LW – C – RW', () => {
    const podleId = new Map<string, Hrac>([
      ['a', hrac({ id: 'a', detailPozice: 'RW' })],
      ['b', hrac({ id: 'b', detailPozice: 'LW' })],
      ['c', hrac({ id: 'c', detailPozice: 'C' })],
    ])
    expect(seradUtocniky(['a', 'b', 'c'], podleId)).toEqual(['b', 'c', 'a'])
  })
})

describe('seradObrance', () => {
  it('řadí LD – RD', () => {
    const podleId = new Map<string, Hrac>([
      ['a', hrac({ id: 'a', pozice: 'D', detailPozice: 'RD' })],
      ['b', hrac({ id: 'b', pozice: 'D', detailPozice: 'LD' })],
    ])
    expect(seradObrance(['a', 'b'], podleId)).toEqual(['b', 'a'])
  })
})

describe('popisZarazeni', () => {
  it('rozliší brankáře, lajnu a střídačku', () => {
    expect(popisZarazeni(sestava, 'g1')).toBe('Brankář')
    expect(popisZarazeni(sestava, 'u1')).toBe('1. lajna')
    expect(popisZarazeni(sestava, 'bench')).toBe('Střídačka')
  })
})

describe('serializace', () => {
  it('Hrac s detailPozice projde JSON', () => {
    const h = hrac({ detailPozice: 'LW' })
    const parsed = JSON.parse(JSON.stringify(h)) as Hrac
    expect(parsed.detailPozice).toBe('LW')
    expect(popisDetailPozice('LW')).toBe('LK')
  })
})

describe('integrace s týmem', () => {
  it('vygenerovaný tým má 4 spojené lajny', () => {
    resetIdCitac()
    const tym = generujTym(createRng(1), { id: 'tabor', nazev: 'HC Tábor', liga: 2, barvy: ['#000', '#fff'] })
    const lajny = spojeneLajny(tym.sestava)
    expect(lajny).toHaveLength(4)
    expect(lajny[0].utok.length + lajny[0].obrana.length).toBe(5)
  })
})
