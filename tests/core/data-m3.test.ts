import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac, START_ROZPOCET } from '../../src/core/generator'
import { kc } from '../../src/core/hodnoty'
import { createRng } from '../../src/core/rng'
import { overall } from '../../src/core/sestava'
import { newGame } from '../../src/core/sezona'
import type { Klub } from '../../src/core/types'

describe('platy a rozpočty', () => {
  it('hráč má plat dle overall a klub startovní rozpočet dle ligy', () => {
    resetIdCitac()
    const t = generujTym(createRng(3), { id: 'tabor', nazev: 'HC Tábor', liga: 2 } as Klub)
    expect(t.rozpocet).toBe(START_ROZPOCET[2])
    for (const h of t.hraci) {
      const o = overall(h)
      expect(h.plat).toBe(Math.round((o * o * 25) / 1000) * 1000)
    }
  })
})

describe('newGame M3 pole', () => {
  const s = newGame(7, 'tabor')
  it('inicializuje sponzora, trénink a trh', () => {
    expect(s.sponzor).toEqual({ typ: 'jistota', mesicne: 0, zaVyhru: 0 })
    expect(s.sponzorNabidka).toBe(true)
    expect(s.treninkZamereni).toBe('kondice')
    expect(s.treninkovyTyden).toBeDefined()
    expect(s.prichoziNabidky).toEqual([])
    expect(s.nabidkyProdeje).toEqual([])
    expect(s.prichoziNabidka).toBeNull()
    expect(s.otazkaMedii).toBeNull()
    expect(s.posledniUzaverka).toBe(0)
  })
})

describe('kc', () => {
  it('formátuje koruny česky', () => {
    expect(kc(12_500_000)).toBe('12,5 mil. Kč')
    expect(kc(8_000_000)).toBe('8 mil. Kč')
    expect(kc(850_000)).toBe('850 tis. Kč')
    expect(kc(-3_200_000)).toBe('-3,2 mil. Kč')
  })
})
