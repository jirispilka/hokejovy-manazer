import { describe, expect, it } from 'vitest'
import { createRng, hashSeed, pick, randInt } from '../../src/core/rng'

describe('createRng', () => {
  it('stejný seed dává stejnou sekvenci', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('různé seedy dávají různé sekvence', () => {
    expect(createRng(1)()).not.toBe(createRng(2)())
  })
  it('vrací čísla v [0,1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const x = rng()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('randInt', () => {
  it('drží meze včetně krajů a trefí je', () => {
    const rng = createRng(3)
    const videno = new Set<number>()
    for (let i = 0; i < 1000; i++) videno.add(randInt(rng, 1, 6))
    expect([...videno].sort()).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('pick', () => {
  it('vybírá jen prvky pole', () => {
    const rng = createRng(9)
    for (let i = 0; i < 100; i++) expect(['a', 'b']).toContain(pick(rng, ['a', 'b']))
  })
})

describe('hashSeed', () => {
  it('je deterministický a citlivý na pořadí', () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3))
    expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(3, 2, 1))
  })
})
