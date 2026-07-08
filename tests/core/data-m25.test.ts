import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { otiskPetek } from '../../src/core/sestava'
import type { Klub } from '../../src/core/types'

const tym = () => {
  resetIdCitac()
  return generujTym(createRng(5), { id: 'tabor', nazev: 'HC Tábor', liga: 2 } as Klub)
}

describe('nové atributy M2.5', () => {
  const t = tym()
  it('všichni hráči mají výdrž a techniku v 1–99 a odehranoSezona 0', () => {
    for (const h of t.hraci) {
      expect(h.atributy.vydrz).toBeGreaterThanOrEqual(1)
      expect(h.atributy.vydrz).toBeLessThanOrEqual(99)
      expect(h.atributy.technika).toBeGreaterThanOrEqual(1)
      expect(h.atributy.technika).toBeLessThanOrEqual(99)
      expect(h.odehranoSezona).toBe(0)
    }
  })
  it('brankář má techniku výrazně nižší než útočník (slabý atribut)', () => {
    const g = t.hraci.find((h) => h.pozice === 'G')!
    expect(g.atributy.technika).toBeLessThanOrEqual(30)
  })
})

describe('chemie a otisk složení', () => {
  const t = tym()
  it('startuje na 30 a otisk sedí na sestavu', () => {
    expect(t.chemie.petky).toEqual([30, 30, 30, 30])
    expect(t.slozeni).toEqual({ petky: otiskPetek(t.sestava) })
  })
  it('otisk je nezávislý na pořadí v lajně', () => {
    const o1 = otiskPetek(t.sestava)
    const prohozena = {
      ...t.sestava,
      utoky: t.sestava.utoky.map((l) => [...l].reverse()),
    }
    expect(otiskPetek(prohozena)).toEqual(o1)
  })
})
