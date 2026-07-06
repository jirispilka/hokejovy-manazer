import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { simulujZapas } from '../../src/core/simulace'
import type { Klub } from '../../src/core/types'

// resetIdCitac: id hráčů jsou z globálního čítače — bez resetu by opakované
// generování dalo jiná id a determinismus by nešel porovnat; různý základ
// pro domácí/hosty brání kolizi id mezi týmy
const tym = (id: string, liga: number, seed: number, zakladId: number) => {
  resetIdCitac(zakladId)
  return generujTym(createRng(seed), { id, nazev: id, liga } as Klub)
}
const domaci = (liga = 0) => tym('x', liga, 1, 0)
const hoste = (liga = 0) => tym('y', liga, 2, 1000)

describe('simulujZapas', () => {
  it('je deterministická při stejném seedu', () => {
    const a = simulujZapas(domaci(), hoste(), createRng(99))
    const b = simulujZapas(domaci(), hoste(), createRng(99))
    expect(a).toEqual(b)
  })
  it('nikdy nekončí remízou', () => {
    for (let s = 0; s < 100; s++) {
      const v = simulujZapas(domaci(1), hoste(1), createRng(s))
      expect(v.golyDomaci).not.toBe(v.golyHoste)
    }
  })
  it('výrazně silnější tým vyhrává většinu zápasů', () => {
    let vyhrySilnejsiho = 0
    for (let s = 0; s < 200; s++) {
      const v = simulujZapas(domaci(0), hoste(2), createRng(s))
      if (v.golyDomaci > v.golyHoste) vyhrySilnejsiho++
    }
    expect(vyhrySilnejsiho).toBeGreaterThan(140) // > 70 %
  })
  it('dává realistické počty gólů (průměr 3–9 celkem)', () => {
    let goly = 0
    for (let s = 0; s < 200; s++) {
      const v = simulujZapas(domaci(), hoste(), createRng(s))
      goly += v.golyDomaci + v.golyHoste
    }
    const prumer = goly / 200
    expect(prumer).toBeGreaterThan(3)
    expect(prumer).toBeLessThan(9)
  })
  it('gólové události sedí na skóre a mají střelce', () => {
    const v = simulujZapas(domaci(), hoste(), createRng(7))
    const goly = v.udalosti.filter((u) => u.typ === 'gol')
    expect(goly).toHaveLength(v.golyDomaci + v.golyHoste)
    for (const g of goly) expect(g.hracId).toBeTruthy()
  })
  it('střel je víc než gólů', () => {
    const v = simulujZapas(domaci(), hoste(), createRng(8))
    expect(v.strelyDomaci).toBeGreaterThanOrEqual(v.golyDomaci)
    expect(v.strelyHoste).toBeGreaterThanOrEqual(v.golyHoste)
  })
})
