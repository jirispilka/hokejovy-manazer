import { describe, expect, it } from 'vitest'
import { spocitejTabulku } from '../../src/core/tabulka'
import type { Vysledek, Zapas } from '../../src/core/types'

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

const zapas = (domaci: string, hoste: string, v: Vysledek | null, kolo = 1): Zapas => ({
  kolo,
  den: 3,
  domaci,
  hoste,
  vysledek: v,
})

describe('spocitejTabulku', () => {
  it('rozdává body 3 / 2 / 1 / 0', () => {
    const zapasy = [
      zapas('a', 'b', vysledek(4, 1)), // a: 3 b., b: 0 b.
      zapas('c', 'd', vysledek(2, 3, true)), // d: 2 b. (v prodl.), c: 1 b.
    ]
    const t = spocitejTabulku(['a', 'b', 'c', 'd'], zapasy)
    const body = Object.fromEntries(t.map((r) => [r.tymId, r.body]))
    expect(body).toEqual({ a: 3, b: 0, c: 1, d: 2 })
  })
  it('ignoruje neodehrané zápasy', () => {
    const t = spocitejTabulku(['a', 'b'], [zapas('a', 'b', null)])
    expect(t[0].zapasy).toBe(0)
  })
  it('řadí podle bodů, pak rozdílu skóre, pak vstřelených', () => {
    const zapasy = [
      zapas('a', 'c', vysledek(5, 0)),
      zapas('b', 'c', vysledek(2, 0), 2),
    ]
    const t = spocitejTabulku(['a', 'b', 'c'], zapasy)
    expect(t.map((r) => r.tymId)).toEqual(['a', 'b', 'c'])
  })
  it('počítá výhry v prodloužení zvlášť', () => {
    const t = spocitejTabulku(['a', 'b'], [zapas('a', 'b', vysledek(2, 1, false, true))])
    const a = t.find((r) => r.tymId === 'a')!
    expect(a.vyhryP).toBe(1)
    expect(a.vyhry).toBe(0)
  })
})
