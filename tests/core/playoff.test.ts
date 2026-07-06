import { describe, expect, it } from 'vitest'
import { cekajiciSerie, domaciLedSerie, zalozPlayoff, zapisVysledekSerie } from '../../src/core/playoff'
import type { RadekTabulky } from '../../src/core/tabulka'

const tabulka = Array.from({ length: 14 }, (_, i) => ({ tymId: `t${i + 1}` })) as RadekTabulky[]

describe('zalozPlayoff', () => {
  it('nasadí top 8 křížem', () => {
    const p = zalozPlayoff(tabulka)
    expect(p.kola[0].map((s) => [s.domaci, s.hoste])).toEqual([
      ['t1', 't8'],
      ['t2', 't7'],
      ['t3', 't6'],
      ['t4', 't5'],
    ])
    expect(p.vitez).toBeNull()
  })
})

describe('průběh série a pavouka', () => {
  it('série končí třetí výhrou a vítězové postupují', () => {
    let p = zalozPlayoff(tabulka)
    // všechna čtvrtfinále vyhrají domácí 3:0 na zápasy
    for (let g = 0; g < 3; g++)
      for (let i = 0; i < 4; i++) p = zapisVysledekSerie(p, 0, i, true)
    expect(p.kola[1]).toHaveLength(2)
    expect(p.kola[1][0]).toMatchObject({ domaci: 't1', hoste: 't4' })
    expect(cekajiciSerie(p).every((s) => s.kolo === 1)).toBe(true)
  })
  it('po finále je znám vítěz', () => {
    let p = zalozPlayoff(tabulka)
    for (let kolo = 0; kolo < 3; kolo++)
      for (let g = 0; g < 3; g++)
        for (const { index } of cekajiciSerie(p).filter((s) => s.kolo === kolo))
          p = zapisVysledekSerie(p, kolo, index, true)
    expect(p.vitez).toBe('t1')
  })
  it('po překvapení se vítězové přenasazují podle tabulky', () => {
    let p = zalozPlayoff(tabulka)
    // t8 vyřadí t1, ostatní favorité postupují
    for (let g = 0; g < 3; g++) {
      p = zapisVysledekSerie(p, 0, 0, false)
      p = zapisVysledekSerie(p, 0, 1, true)
      p = zapisVysledekSerie(p, 0, 2, true)
      p = zapisVysledekSerie(p, 0, 3, true)
    }
    // semifinále: nejlépe nasazený t2 hraje s nejhůř nasazeným t8 a je domácí
    expect(p.kola[1].map((s) => [s.domaci, s.hoste])).toEqual([
      ['t2', 't8'],
      ['t3', 't4'],
    ])
  })
})

describe('domaciLedSerie', () => {
  it('zápasy 1, 2 a 5 hraje doma výše nasazený', () => {
    expect(domaciLedSerie({ domaci: 'a', hoste: 'b', vyhryDomaci: 0, vyhryHoste: 0 })).toBe('a')
    expect(domaciLedSerie({ domaci: 'a', hoste: 'b', vyhryDomaci: 1, vyhryHoste: 0 })).toBe('a')
    expect(domaciLedSerie({ domaci: 'a', hoste: 'b', vyhryDomaci: 1, vyhryHoste: 1 })).toBe('b')
    expect(domaciLedSerie({ domaci: 'a', hoste: 'b', vyhryDomaci: 2, vyhryHoste: 2 })).toBe('a')
  })
})
