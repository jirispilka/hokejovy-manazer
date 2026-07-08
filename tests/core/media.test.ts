import { describe, expect, it } from 'vitest'
import { odpovezNaOtazku, zkontrolujOtazku } from '../../src/core/media'
import { createRng } from '../../src/core/rng'
import { newGame } from '../../src/core/sezona'
import type { CekajiciZapas, Vysledek } from '../../src/core/types'

const vysledek = (gd: number, gh: number): Vysledek => ({
  golyDomaci: gd,
  golyHoste: gh,
  strelyDomaci: 30,
  strelyHoste: 30,
  prodlouzeni: false,
  najezdy: false,
  udalosti: [],
  energie: {},
  hodnoceni: {},
})
const cz = (derby = false): CekajiciZapas => ({ domaci: 'tabor', hoste: 'decin', derby, playoff: null })

describe('zkontrolujOtazku', () => {
  it('demolice a debakl vyvolají otázku, těsný zápas ne', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    zkontrolujOtazku(s, vysledek(6, 1), cz())
    expect(s.otazkaMedii).not.toBeNull()
    expect(s.otazkaMedii!.moznosti.length).toBeGreaterThanOrEqual(2)
    zkontrolujOtazku(s, vysledek(2, 1), cz())
    expect(s.otazkaMedii).toBeNull() // stará otázka zaniká dalším zápasem
    zkontrolujOtazku(s, vysledek(0, 5), cz())
    expect(s.otazkaMedii).not.toBeNull()
  })
  it('derby vyvolá otázku vždy', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    zkontrolujOtazku(s, vysledek(2, 1), cz(true))
    expect(s.otazkaMedii).not.toBeNull()
  })
})

describe('odpovezNaOtazku', () => {
  const priprav = () => {
    const s = structuredClone(newGame(7, 'tabor'))
    zkontrolujOtazku(s, vysledek(6, 1), cz())
    return s
  }
  it('bezpečná odpověď aplikuje efekty', () => {
    const s = priprav()
    const bezpecna = s.otazkaMedii!.moznosti.findIndex((m) => !m.riskantni)
    const volba = s.otazkaMedii!.moznosti[bezpecna]
    const moralkaPred = s.tymy.tabor.moralka
    const naladaPred = s.naladaFanousku
    const po = odpovezNaOtazku(s, bezpecna, createRng(1))
    expect(po.tymy.tabor.moralka).toBe(Math.min(70, moralkaPred + volba.efektMoralka))
    expect(po.naladaFanousku).toBe(Math.min(100, naladaPred + volba.efektNalada))
    expect(po.otazkaMedii).toBeNull()
  })
  it('riskantní odpověď se může otočit proti', () => {
    let otocilo = false
    let pomohlo = false
    for (let seed = 0; seed < 40 && !(otocilo && pomohlo); seed++) {
      const s = priprav()
      const riskantni = s.otazkaMedii!.moznosti.findIndex((m) => m.riskantni)
      if (riskantni < 0) throw new Error('Šablona nemá riskantní volbu.')
      const pred = s.naladaFanousku
      const po = odpovezNaOtazku(s, riskantni, createRng(seed))
      if (po.naladaFanousku < pred) otocilo = true
      if (po.naladaFanousku > pred) pomohlo = true
    }
    expect(otocilo).toBe(true)
    expect(pomohlo).toBe(true)
  })
  it('neplatný index a chybějící otázka házejí chybu', () => {
    const s = priprav()
    expect(() => odpovezNaOtazku(s, 99, createRng(1))).toThrow()
    const bez = structuredClone(newGame(7, 'tabor'))
    expect(() => odpovezNaOtazku(bez, 0, createRng(1))).toThrow()
  })
})
