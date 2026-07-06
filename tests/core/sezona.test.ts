import { describe, expect, it } from 'vitest'
import { denKola, POCET_KOL } from '../../src/core/rozpis'
import {
  advanceDay,
  dalsiMujZapas,
  mojeLiga,
  newGame,
  zahajNovouSezonu,
} from '../../src/core/sezona'
import { spocitejTabulku } from '../../src/core/tabulka'
import type { GameState } from '../../src/core/types'

const dohraj = (s: GameState): GameState => {
  let pojistka = 0
  while (s.faze !== 'konecSezony' && pojistka++ < 300) s = advanceDay(s)
  expect(pojistka).toBeLessThan(300)
  return s
}

describe('newGame', () => {
  const s = newGame(7, 'tabor')
  it('založí 42 týmů a 3 ligy po 182 zápasech', () => {
    expect(Object.keys(s.tymy)).toHaveLength(42)
    expect(s.ligy).toHaveLength(3)
    for (const l of s.ligy) expect(l.zapasy).toHaveLength(182)
  })
  it('můj klub je ve 2. lize', () => {
    expect(mojeLiga(s).uroven).toBe(2)
    expect(dalsiMujZapas(s)?.den).toBe(3)
  })
})

describe('advanceDay', () => {
  it('v den 3 odehraje 1. kolo ve všech ligách', () => {
    let s = newGame(7, 'tabor')
    for (let i = 0; i < 3; i++) s = advanceDay(s)
    for (const l of s.ligy) {
      expect(l.zapasy.filter((z) => z.vysledek)).toHaveLength(7)
    }
    expect(s.posledniZapas).not.toBeNull() // můj klub hrál v 1. kole
  })
  it('je deterministický', () => {
    const hraj = () => {
      let s = newGame(11, 'decin')
      for (let i = 0; i < 20; i++) s = advanceDay(s)
      return s
    }
    expect(JSON.stringify(hraj())).toBe(JSON.stringify(hraj()))
  })
  it('po základní části startuje playoff a sezóna doběhne do konce', () => {
    let s = newGame(3, 'kobra')
    while (s.den < denKola(POCET_KOL)) s = advanceDay(s)
    expect(s.faze).toBe('playoff')
    for (const l of s.ligy) expect(l.playoff?.kola[0]).toHaveLength(4)
    s = dohraj(s)
    for (const l of s.ligy) expect(l.playoff?.vitez).toBeTruthy()
  })
})

describe('zahajNovouSezonu', () => {
  const konec = dohraj(newGame(5, 'tabor'))
  const nova = zahajNovouSezonu(konec)
  it('prohodí postupující a sestupující', () => {
    for (const uroven of [1, 2]) {
      const postupujici = konec.ligy[uroven].playoff!.vitez!
      const tabulka = spocitejTabulku(konec.ligy[uroven - 1].tymy, konec.ligy[uroven - 1].zapasy)
      const sestupujici = tabulka[tabulka.length - 1].tymId
      expect(nova.ligy[uroven - 1].tymy).toContain(postupujici)
      expect(nova.ligy[uroven].tymy).toContain(sestupujici)
      expect(nova.ligy[uroven].tymy).toHaveLength(14)
    }
  })
  it('resetuje kalendář a statistiky, hráči stárnou', () => {
    expect(nova.sezona).toBe(2)
    expect(nova.den).toBe(0)
    expect(nova.faze).toBe('zakladniCast')
    for (const l of nova.ligy) expect(l.zapasy.every((z) => !z.vysledek)).toBe(true)
    const stary = konec.tymy.tabor.hraci[0]
    const novy = nova.tymy.tabor.hraci[0]
    expect(novy.vek).toBe(stary.vek + 1)
    expect(novy.goly).toBe(0)
  })
})
