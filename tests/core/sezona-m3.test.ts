import { describe, expect, it } from 'vitest'
import { prijmiNabidku } from '../../src/core/kariera'
import { createRng } from '../../src/core/rng'
import { advanceDay, dokonciZapas, newGame, zahajNovouSezonu } from '../../src/core/sezona'
import { simulujDoKonce, zacniZapas } from '../../src/core/zapas'
import { START_ROZPOCET } from '../../src/core/generator'
import type { GameState } from '../../src/core/types'

const krok = (s: GameState): GameState => {
  if (s.nabidky) return prijmiNabidku(s, s.nabidky[0])
  if (!s.cekajiciZapas) return advanceDay(s)
  const cz = s.cekajiciZapas
  const stav = simulujDoKonce(
    zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
    s.tymy[cz.domaci],
    s.tymy[cz.hoste],
    createRng(600 + s.den),
  )
  return dokonciZapas(s, stav)
}

describe('finanční kolo sezóny', () => {
  it('po 30+ dnech proběhne uzávěrka a vstupné teče po domácích zápasech', () => {
    let s = newGame(7, 'tabor')
    let vstupnePrislo = false
    // 35 kroků nestačí: můj klub hraje ~1 zápas/3.5 dne a dokonciZapas den neposouvá,
    // takže po 35 krocích je den jen ~27 — zvětšeno na 40, aby uzávěrka (den≥30) stihla proběhnout.
    for (let i = 0; i < 40; i++) {
      const bylMujDomaci = s.cekajiciZapas?.domaci === 'tabor'
      const pred = s.tymy.tabor.rozpocet
      s = krok(s)
      if (bylMujDomaci && s.tymy.tabor.rozpocet > pred) vstupnePrislo = true
    }
    expect(s.posledniUzaverka).toBeGreaterThanOrEqual(30)
    expect(vstupnePrislo).toBe(true)
    expect(s.zpravy.some((z) => z.includes('uzávěrka'))).toBe(true)
  })
  it('celá sezóna doběhne a AI rozpočty přežijí (žádný klub v extrémním mínusu)', () => {
    let s = newGame(9, 'tabor')
    let pojistka = 0
    while (s.faze !== 'konecSezony' && pojistka++ < 400) s = krok(s)
    expect(s.faze).toBe('konecSezony')
    for (const t of Object.values(s.tymy)) {
      expect(t.rozpocet).toBeGreaterThan(-100_000_000) // sanity: ekonomika neuletěla
      expect(t.hraci.length).toBeGreaterThanOrEqual(20)
    }
  })
  it('nová sezóna resetuje trh a nabídne sponzora', () => {
    let s = newGame(9, 'tabor')
    let pojistka = 0
    while (s.faze !== 'konecSezony' && pojistka++ < 400) s = krok(s)
    const pred = s.tymy.tabor.rozpocet
    const nova = zahajNovouSezonu(s)
    expect(nova.sponzorNabidka).toBe(true)
    expect(nova.nabidkyProdeje).toEqual([])
    expect(nova.prichoziNabidka).toBeNull()
    expect(nova.posledniUzaverka).toBe(0)
    expect(nova.treninkovyTyden).toBeDefined()
    expect(Object.keys(nova.treninkovyTyden).length).toBeGreaterThan(0)
    // rozpočet se už nedoplňuje — zůstane z minulé sezóny
    expect(nova.tymy.tabor.rozpocet).toBe(pred)
  })
})
