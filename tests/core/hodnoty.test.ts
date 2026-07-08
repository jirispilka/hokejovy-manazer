import { describe, expect, it } from 'vitest'
import {
  formaTymu,
  kanadskeBodovani,
  obranneLadeni,
  roleHrace,
  utocneLadeni,
} from '../../src/core/hodnoty'
import { newGame } from '../../src/core/sezona'
import type { Hrac, Liga, Vysledek, Zapas } from '../../src/core/types'

const hrac = (a: Partial<Hrac['atributy']>, pozice: Hrac['pozice'] = 'U'): Hrac => ({
  id: 'x',
  jmeno: 'Test',
  prijmeni: 'Hráč',
  vek: 25,
  pozice,
  atributy: {
    strelba: 50,
    prihravky: 50,
    brusleni: 50,
    obrana: 50,
    fyzicka: 50,
    chytani: 20,
    vydrz: 50,
    technika: 50,
    ...a,
  },
  potencial: 60,
  forma: 50,
  unava: 0,
  goly: 0,
  asistence: 0,
  zranenZapasu: 0,
  odehranoSezona: 0,
  plat: 0,
})

describe('ladění', () => {
  it('počítá vážené průměry', () => {
    const h = hrac({ strelba: 80, technika: 60, prihravky: 70 })
    expect(utocneLadeni(h)).toBe(Math.round(80 * 0.4 + 60 * 0.3 + 70 * 0.3))
    const o = hrac({ obrana: 80, fyzicka: 60, brusleni: 40 })
    expect(obranneLadeni(o)).toBe(Math.round(80 * 0.5 + 60 * 0.3 + 40 * 0.2))
  })
})

describe('roleHrace', () => {
  it('rozlišuje role a brankář roli nemá', () => {
    expect(roleHrace(hrac({ strelba: 80, prihravky: 50 }))).toBe('Střelec')
    expect(roleHrace(hrac({ strelba: 50, prihravky: 80 }))).toBe('Tvůrce hry')
    expect(roleHrace(hrac({ obrana: 90, fyzicka: 90, brusleni: 90, strelba: 55, prihravky: 50, technika: 20 }))).toBe('Dvoucestný')
    expect(roleHrace(hrac({}, 'G'))).toBeNull()
  })
})

describe('formaTymu', () => {
  const vysledek = (gd: number, gh: number, prodlouzeni = false, najezdy = false): Vysledek => ({
    golyDomaci: gd,
    golyHoste: gh,
    strelyDomaci: 30,
    strelyHoste: 30,
    prodlouzeni,
    najezdy,
    udalosti: [],
    energie: {},
    hodnoceni: {},
  })
  const zapas = (den: number, domaci: string, hoste: string, v: Vysledek | null): Zapas => ({
    kolo: 1,
    den,
    domaci,
    hoste,
    vysledek: v,
  })
  const liga = {
    uroven: 2,
    nazev: '2. liga',
    tymy: ['a', 'b'],
    zapasy: [
      zapas(3, 'a', 'b', vysledek(3, 1)), // V
      zapas(6, 'b', 'a', vysledek(2, 1, true)), // a: PP
      zapas(10, 'a', 'b', vysledek(1, 2, false, true)), // a: PP? ne — prohra v nájezdech = PP
      zapas(13, 'b', 'a', vysledek(0, 4)), // a: V
      zapas(17, 'a', 'b', vysledek(2, 3)), // a: P
      zapas(20, 'a', 'b', vysledek(5, 0)), // a: V
      zapas(24, 'a', 'b', null), // neodehraný — ignorovat
    ],
    playoff: null,
  } as Liga
  it('vrací posledních 5 odehraných chronologicky', () => {
    expect(formaTymu(liga, 'a')).toEqual(['PP', 'PP', 'V', 'P', 'V'])
    expect(formaTymu(liga, 'b')).toEqual(['VP', 'VP', 'P', 'V', 'P'])
  })
})

describe('kanadskeBodovani', () => {
  it('řadí podle bodů a gólů, max 10, jen s body', () => {
    const s = newGame(7, 'tabor')
    const liga = s.ligy[2]
    const hraci = s.tymy.tabor.hraci.filter((h) => h.pozice === 'U').slice(0, 3)
    hraci[0].goly = 5
    hraci[0].asistence = 2
    hraci[1].goly = 3
    hraci[1].asistence = 4
    hraci[2].goly = 7
    hraci[2].asistence = 0
    const tabulka = kanadskeBodovani(s, liga)
    expect(tabulka[0].body).toBe(7)
    expect(tabulka[0].goly).toBe(7) // při shodě bodů rozhodují góly
    expect(tabulka[1].body).toBe(7)
    expect(tabulka.length).toBeLessThanOrEqual(10)
    for (const r of tabulka) expect(r.body).toBeGreaterThan(0)
  })
})
