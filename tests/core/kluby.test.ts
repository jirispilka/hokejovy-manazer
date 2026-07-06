import { describe, expect, it } from 'vitest'
import kluby from '../../src/core/data/kluby.json'
import type { Klub } from '../../src/core/types'

describe('kluby.json', () => {
  const vsechny = kluby as Klub[]
  it('má 3 ligy po 14 klubech', () => {
    for (const liga of [0, 1, 2]) {
      expect(vsechny.filter((k) => k.liga === liga)).toHaveLength(14)
    }
  })
  it('má unikátní id', () => {
    expect(new Set(vsechny.map((k) => k.id)).size).toBe(42)
  })
})
