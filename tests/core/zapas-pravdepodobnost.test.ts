import { describe, expect, it } from 'vitest'
import {
  jeKlicovyMoment,
  pGolZeStrelby,
  pNebezpecnaSance,
  pUtokVMinute,
  segmentyKostky,
  sigmoid,
} from '../../src/core/zapasPravdepodobnost'

describe('zapasPravdepodobnost', () => {
  it('sigmoid roste monotónně', () => {
    expect(sigmoid(-5)).toBeLessThan(sigmoid(0))
    expect(sigmoid(0)).toBeCloseTo(0.5)
    expect(sigmoid(5)).toBeGreaterThan(0.99)
  })

  it('silnější útok = vyšší pUtokVMinute', () => {
    const silny = pUtokVMinute(90, 70, 70)
    const slaby = pUtokVMinute(60, 70, 70)
    expect(silny).toBeGreaterThan(slaby)
  })

  it('pNebezpecnaSance roste s rozdílem síly', () => {
    expect(pNebezpecnaSance(90, 60)).toBeGreaterThan(pNebezpecnaSance(70, 70))
  })

  it('pGolZeStrelby roste se střelbou a klesá s brankářem', () => {
    const dobra = pGolZeStrelby(85, 50)
    const spatna = pGolZeStrelby(50, 85)
    expect(dobra).toBeGreaterThan(spatna)
  })

  it('klíčový moment od 35 %', () => {
    expect(jeKlicovyMoment(0.34)).toBe(false)
    expect(jeKlicovyMoment(0.35)).toBe(true)
  })

  it('segmenty kostky reagují na žeton', () => {
    expect(segmentyKostky(0.5, true)).toBeGreaterThanOrEqual(segmentyKostky(0.5, false))
  })
})
