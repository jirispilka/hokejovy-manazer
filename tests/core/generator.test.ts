import { describe, expect, it } from 'vitest'
import { generujHrace, generujSvet, generujTym } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import type { Klub } from '../../src/core/types'

const klub: Klub = { id: 'tabor', nazev: 'HC Tábor', liga: 2 }

describe('generujHrace', () => {
  it('drží atributy v 1–99 a věk v 17–38', () => {
    const rng = createRng(1)
    for (let i = 0; i < 200; i++) {
      const h = generujHrace(rng, 'U', 0)
      expect(h.vek).toBeGreaterThanOrEqual(17)
      expect(h.vek).toBeLessThanOrEqual(38)
      for (const v of Object.values(h.atributy)) {
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(99)
      }
    }
  })
  it('brankář má chytání výrazně lepší než bruslař', () => {
    const rng = createRng(2)
    const golman = generujHrace(rng, 'G', 0)
    const utocnik = generujHrace(rng, 'U', 0)
    expect(golman.atributy.chytani).toBeGreaterThan(utocnik.atributy.chytani)
  })
  it('extraligoví hráči jsou v průměru silnější než druholigoví', () => {
    const rng = createRng(3)
    const prumer = (uroven: number) => {
      let s = 0
      for (let i = 0; i < 100; i++) s += generujHrace(rng, 'U', uroven).atributy.strelba
      return s / 100
    }
    expect(prumer(0)).toBeGreaterThan(prumer(2) + 10)
  })
})

describe('generujTym', () => {
  it('má 14 útočníků, 7 obránců, 2 brankáře a vyplněnou sestavu', () => {
    const t = generujTym(createRng(4), klub)
    expect(t.hraci.filter((h) => h.pozice === 'U')).toHaveLength(14)
    expect(t.hraci.filter((h) => h.pozice === 'D')).toHaveLength(7)
    expect(t.hraci.filter((h) => h.pozice === 'G')).toHaveLength(2)
    expect(t.sestava.utoky).toHaveLength(4)
    expect(t.sestava.obrany).toHaveLength(3)
    expect(t.sestava.brankar).toBeTruthy()
  })
})

describe('generujSvet', () => {
  it('vytvoří 42 týmů a je deterministický', () => {
    const a = generujSvet(42)
    const b = generujSvet(42)
    expect(Object.keys(a)).toHaveLength(42)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
