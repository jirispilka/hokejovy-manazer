import { describe, expect, it } from 'vitest'
import { prijmiNabidku } from '../../src/core/kariera'
import { createRng } from '../../src/core/rng'
import { potvrdTreninkovyPlan } from '../../src/core/trenink'
import { advanceDay, dokonciZapas, newGame, zahajNovouSezonu } from '../../src/core/sezona'
import { simulujDoKonce, zacniZapas } from '../../src/core/zapas'
import type { GameState } from '../../src/core/types'

const krok = (s: GameState): GameState => {
  if (s.nabidky) return prijmiNabidku(s, s.nabidky[0])
  if (!s.cekajiciZapas) return advanceDay(s)
  const cz = s.cekajiciZapas
  const stav = simulujDoKonce(
    zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
    s.tymy[cz.domaci],
    s.tymy[cz.hoste],
    createRng(800 + s.den),
  )
  return dokonciZapas(s, stav)
}

describe('trénink', () => {
  it('naplánovaná posilovna zvedne výdrž brankáře', () => {
    let s = newGame(31, 'tabor')
    const brankar = s.tymy.tabor.hraci.find((h) => h.pozice === 'G')!
    brankar.potencial = 99
    const chytaniPred = brankar.atributy.vydrz
    s = potvrdTreninkovyPlan(s, { 1: [{ typ: 'kondice', hraci: [brankar.id] }] })
    s = advanceDay(s) // den 1 — trénink
    expect(s.tymy.tabor.hraci.find((h) => h.id === brankar.id)!.atributy.vydrz).toBeGreaterThanOrEqual(chytaniPred)
    expect(s.zpravy.some((z) => z.includes('Trénink'))).toBe(true)
  })
  it('odpočinek v plánu snižuje únavu', () => {
    let s = newGame(31, 'tabor')
    for (const h of s.tymy.tabor.hraci) h.unava = 50
    s = potvrdTreninkovyPlan(s, { 1: [{ typ: 'odpocinek' }] })
    s = advanceDay(s)
    const tym = s.tymy.tabor
    const vSestave = new Set([...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat(), tym.sestava.brankar])
    const nahradnik = tym.hraci.find((h) => !vSestave.has(h.id))!
    expect(nahradnik.unava).toBeLessThan(50)
  })
})

describe('akademie', () => {
  it('nová sezóna přivede 1–2 odchovance s unikátními id', () => {
    let s = newGame(33, 'tabor')
    let pojistka = 0
    while (s.faze !== 'konecSezony' && pojistka++ < 400) s = krok(s)
    if (s.nabidky) s = prijmiNabidku(s, s.nabidky[0])
    const pocetPred = s.tymy.tabor.hraci.length
    const nova = zahajNovouSezonu(s)
    const noviMoji = nova.tymy.tabor.hraci.filter((h) => h.id.startsWith('ak-'))
    const prisliOdchovanci = nova.tymy.tabor.hraci.length > pocetPred || nova.zpravy.some((z) => z.includes('Akademie'))
    expect(prisliOdchovanci).toBe(true)
    if (noviMoji.length > 0) {
      expect(noviMoji.length).toBeLessThanOrEqual(2)
      for (const m of noviMoji) {
        expect(m.vek).toBeGreaterThanOrEqual(17)
        expect(m.vek).toBeLessThanOrEqual(18)
        expect(m.plat).toBe(20_000)
        expect(m.potencial).toBeGreaterThanOrEqual(1)
      }
    }
    expect(nova.tymy.tabor.hraci.length).toBeLessThanOrEqual(26)
    const vsechnaId = Object.values(nova.tymy).flatMap((t) => t.hraci.map((h) => h.id))
    expect(new Set(vsechnaId).size).toBe(vsechnaId.length)
    expect(nova.zpravy.some((z) => z.includes('Akademie'))).toBe(true)
  })
})
