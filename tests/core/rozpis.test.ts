import { describe, expect, it } from 'vitest'
import { denKola, POCET_KOL, vytvorRozpis } from '../../src/core/rozpis'

const tymy = Array.from({ length: 14 }, (_, i) => `t${i}`)

describe('vytvorRozpis', () => {
  const rozpis = vytvorRozpis(tymy)
  it('má 26 kol po 7 zápasech', () => {
    expect(rozpis).toHaveLength(26 * 7)
    for (let k = 1; k <= POCET_KOL; k++) {
      expect(rozpis.filter((z) => z.kolo === k)).toHaveLength(7)
    }
  })
  it('každý tým hraje 26 zápasů, 13 doma a 13 venku', () => {
    for (const t of tymy) {
      expect(rozpis.filter((z) => z.domaci === t)).toHaveLength(13)
      expect(rozpis.filter((z) => z.hoste === t)).toHaveLength(13)
    }
  })
  it('každá dvojice se potká právě 2×, jednou doma a jednou venku', () => {
    for (const a of tymy)
      for (const b of tymy) {
        if (a === b) continue
        expect(rozpis.filter((z) => z.domaci === a && z.hoste === b)).toHaveLength(1)
      }
  })
  it('žádný tým nehraje 2 zápasy v jednom kole', () => {
    for (let k = 1; k <= POCET_KOL; k++) {
      const vKole = rozpis.filter((z) => z.kolo === k).flatMap((z) => [z.domaci, z.hoste])
      expect(new Set(vKole).size).toBe(14)
    }
  })
  it('dny kol rostou a odpovídají denKola', () => {
    for (const z of rozpis) expect(z.den).toBe(denKola(z.kolo))
    expect(denKola(1)).toBe(3)
    expect(denKola(2)).toBeGreaterThan(denKola(1))
  })
})
