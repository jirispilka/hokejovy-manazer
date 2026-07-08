import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { souhrnSestavy } from '../../src/core/sestava'
import type { Klub, Tym } from '../../src/core/types'
import {
  aplikujBonusMinihry,
  bonusMinihryZKvality,
  pNebezpecnaSance,
} from '../../src/core/zapasPravdepodobnost'
import { simulujCelyZapas, simulujDoKonce, zacniZapas } from '../../src/core/zapas'

const tym = (id: string, liga: number, seed: number, zakladId: number): Tym => {
  resetIdCitac(zakladId)
  return generujTym(createRng(seed), { id, nazev: id, liga } as Klub)
}

function posilTym(t: Tym, delta: number): Tym {
  const kopie = structuredClone(t)
  for (const h of kopie.hraci) {
    for (const k of Object.keys(h.atributy) as (keyof typeof h.atributy)[]) {
      h.atributy[k] = Math.min(99, Math.max(1, h.atributy[k] + delta))
    }
  }
  return kopie
}

function prumerOvr(t: Tym): number {
  return souhrnSestavy(t).prumerOvr
}

describe('zapas balance M6', () => {
  it('pNebezpecnaSance monotónní vůči rozdílu síly', () => {
    expect(pNebezpecnaSance(90, 60)).toBeGreaterThan(pNebezpecnaSance(75, 65))
    expect(pNebezpecnaSance(75, 65)).toBeGreaterThan(pNebezpecnaSance(60, 60))
  })

  it('3-krokový model má méně střel než přímá střela po útoku', () => {
    const domaci = tym('a', 1, 1, 0)
    const hoste = tym('b', 1, 2, 1000)
    let strely3k = 0
    for (let s = 0; s < 80; s++) {
      const v = simulujCelyZapas(domaci, hoste, createRng(s))
      strely3k += v.strelyDomaci + v.strelyHoste
    }
    expect(strely3k / 80).toBeLessThan(55)
  })

  it('favorit o ~4 OVR vyhrává ~70–80 % (300 zápasů)', () => {
    const silny = posilTym(tym('silny', 1, 10, 0), 4)
    const slaby = tym('slaby', 1, 11, 2000)
    const delta = prumerOvr(silny) - prumerOvr(slaby)
    expect(delta).toBeGreaterThanOrEqual(3)
    expect(delta).toBeLessThanOrEqual(6)
    let vyhry = 0
    for (let s = 0; s < 300; s++) {
      const v = simulujCelyZapas(silny, slaby, createRng(s))
      if (v.golyDomaci > v.golyHoste) vyhry++
    }
    expect(vyhry).toBeGreaterThanOrEqual(195)
    expect(vyhry).toBeLessThanOrEqual(250)
  })

  it('výrazně silnější tým (+8 OVR) dominuje', () => {
    const silny = posilTym(tym('silny2', 1, 12, 0), 8)
    const slaby = tym('slaby2', 1, 13, 3000)
    expect(prumerOvr(silny) - prumerOvr(slaby)).toBeGreaterThanOrEqual(6)
    let vyhry = 0
    for (let s = 0; s < 300; s++) {
      const v = simulujCelyZapas(silny, slaby, createRng(s))
      if (v.golyDomaci > v.golyHoste) vyhry++
    }
    expect(vyhry).toBeGreaterThanOrEqual(210)
  })

  it('rovnováha OVR dá ~45–55 % výher domácích', () => {
    const domaci = tym('d', 1, 20, 0)
    const hoste = tym('h', 1, 21, 1000)
    let vyhry = 0
    for (let s = 0; s < 300; s++) {
      const v = simulujCelyZapas(domaci, hoste, createRng(s + 5000))
      if (v.golyDomaci > v.golyHoste) vyhry++
    }
    expect(vyhry).toBeGreaterThan(120)
    expect(vyhry).toBeLessThan(180)
  })

  it('extrémně silnější tým (+50 OVR) vyhrává ≥90 %', () => {
    const silny = posilTym(tym('mega', 0, 30, 0), 50)
    const slaby = tym('mini', 2, 31, 3000)
    let vyhry = 0
    for (let s = 0; s < 200; s++) {
      const v = simulujCelyZapas(silny, slaby, createRng(s))
      if (v.golyDomaci > v.golyHoste) vyhry++
    }
    expect(vyhry).toBeGreaterThanOrEqual(180)
  })

  it('průměr gólů 4–7 celkem', () => {
    const domaci = tym('x', 1, 40, 0)
    const hoste = tym('y', 1, 41, 1000)
    let goly = 0
    for (let s = 0; s < 200; s++) {
      const v = simulujCelyZapas(domaci, hoste, createRng(s))
      goly += v.golyDomaci + v.golyHoste
    }
    const prumer = goly / 200
    expect(prumer).toBeGreaterThan(3.5)
    expect(prumer).toBeLessThan(8)
  })

  it('bonus minihry posune pGol deterministicky', () => {
    const pred = 0.4
    expect(aplikujBonusMinihry(pred, bonusMinihryZKvality(0.5))).toBeCloseTo(0.48)
    expect(aplikujBonusMinihry(pred, bonusMinihryZKvality(0))).toBeCloseTo(0.32)
  })

  it('vyšší vytížení 1. lajny zvyšuje čas na ledě', () => {
    const domaci = tym('dom', 1, 50, 0)
    const hoste = tym('host', 1, 51, 1000)
    let stav = zacniZapas(domaci, hoste)
    stav.domaci.vytizeniUtoku = [2, 1, 1, 0.5]
    stav = simulujDoKonce(stav, domaci, hoste, createRng(1))
    expect(stav.domaci.casNaLeduUtoku![0]).toBeGreaterThan(stav.domaci.casNaLeduUtoku![3])
  })
})
