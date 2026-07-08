import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { celkovaChemie, popisChemie, silaTymu, vymenVSestave, zmenSestavuKlubu } from '../../src/core/sestava'
import { advanceDay, dokonciZapas, newGame } from '../../src/core/sezona'
import { simulujDoKonce, zacniZapas } from '../../src/core/zapas'
import type { Klub } from '../../src/core/types'

const tym = () => {
  resetIdCitac()
  return generujTym(createRng(5), { id: 'tabor', nazev: 'HC Tábor', liga: 2 } as Klub)
}

describe('zmenSestavuKlubu', () => {
  it('resetuje chemii jen změněné lajny', () => {
    const t = tym()
    t.chemie.utoky = [80, 70, 60, 50]
    t.chemie.obrany = [90, 85, 80]
    // prohození hráče mezi 1. a 2. útokem změní obě lajny
    const nova = vymenVSestave(t.sestava, t.sestava.utoky[0][0], t.sestava.utoky[1][0])
    const po = zmenSestavuKlubu(t, nova)
    expect(po.chemie.utoky[0]).toBeGreaterThan(30)
    expect(po.chemie.utoky[0]).toBeLessThan(80)
    expect(po.chemie.utoky[1]).toBeGreaterThan(30)
    expect(po.chemie.utoky[1]).toBeLessThan(70)
    expect(po.chemie.obrany).toEqual([90, 85, 80])
    expect(po.slozeni.utoky[0]).not.toBe(t.slozeni.utoky[0])
    expect(t.chemie.utoky[0]).toBe(80) // vstup nemutován
  })
  it('prohození pořadí uvnitř lajny chemii nemění', () => {
    const t = tym()
    t.chemie.utoky = [80, 70, 60, 50]
    const nova = { ...t.sestava, utoky: t.sestava.utoky.map((l) => [...l].reverse()) }
    expect(zmenSestavuKlubu(t, nova).chemie.utoky).toEqual([80, 70, 60, 50])
  })
})

describe('chemie ovlivňuje sílu', () => {
  it('sehraný tým je silnější', () => {
    const t = tym()
    const sehrany = structuredClone(t)
    sehrany.chemie = { utoky: [100, 100, 100, 100], obrany: [100, 100, 100] }
    t.chemie = { utoky: [30, 30, 30, 30], obrany: [30, 30, 30] }
    expect(silaTymu(sehrany).utok).toBeGreaterThan(silaTymu(t).utok)
    expect(silaTymu(sehrany).obrana).toBeGreaterThan(silaTymu(t).obrana)
  })
})

describe('celkovaChemie', () => {
  it('vážený průměr v mezích', () => {
    const t = tym()
    expect(celkovaChemie(t)).toBe(30)
    t.chemie = { utoky: [100, 100, 100, 100], obrany: [100, 100, 100] }
    expect(celkovaChemie(t)).toBe(100)
  })
})

describe('popisChemie', () => {
  it('vrací text a bonus', () => {
    const p = popisChemie(80)
    expect(p.text).toBeTruthy()
    expect(p.bonus).toContain('%')
  })
})

describe('chemie roste hraním', () => {
  it('po odehraném kole mají AI týmy chemii 36', () => {
    let s = newGame(7, 'tabor')
    for (let i = 0; i < 3; i++) s = advanceDay(s)
    // AI tým, který hrál (a neměl zraněného → sestava beze změny)
    const hral = s.ligy[0].zapasy.find((z) => z.vysledek)!
    const t = s.tymy[hral.domaci]
    expect(Math.max(...t.chemie.utoky)).toBeGreaterThanOrEqual(36)
  })

  it('po živém zápase roste chemie hráčova týmu', () => {
    let s = newGame(5, 'tabor')
    while (!s.cekajiciZapas) s = advanceDay(s)
    const chemiePred = Math.max(...s.tymy[s.mujKlubId].chemie.utoky)
    const cz = s.cekajiciZapas!
    const domaci = s.tymy[cz.domaci]
    const hoste = s.tymy[cz.hoste]
    const stav = simulujDoKonce(zacniZapas(domaci, hoste), domaci, hoste, createRng(77))
    const po = dokonciZapas(s, stav)
    const chemiePo = Math.max(...po.tymy[s.mujKlubId].chemie.utoky)
    expect(chemiePo).toBeGreaterThan(chemiePred)
  })
})
