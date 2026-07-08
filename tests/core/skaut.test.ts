import { describe, expect, it } from 'vitest'
import { newGame } from '../../src/core/sezona'
import { filtrujHrace, SABLONY_FILTRU, skautReport, type RadekTrhu } from '../../src/core/skaut'

describe('skaut', () => {
  it('šablona mladý talent filtruje věk a potenciál', () => {
    const s = newGame(42, 'tabor')
    const radky: RadekTrhu[] = []
    for (const liga of s.ligy) {
      for (const klubId of liga.tymy) {
        if (klubId === s.mujKlubId) continue
        for (const hrac of s.tymy[klubId].hraci) radky.push({ hrac, klubId })
      }
    }
    const filtr = { liga: -1, pozice: 'vse' as const, ...SABLONY_FILTRU.mlady }
    const vysledek = filtrujHrace(s, radky, filtr, s.mujKlubId)
    expect(vysledek.length).toBeGreaterThan(0)
    for (const { hrac } of vysledek) {
      expect(hrac.vek).toBeLessThanOrEqual(22)
    }
  })

  it('skaut report má rozsah potenciálu a doporučení', () => {
    const s = newGame(1, 'tabor')
    const cizí = s.ligy[0].tymy.find((id) => id !== s.mujKlubId)!
    const hrac = s.tymy[cizí].hraci[0]
    const report = skautReport(s, hrac, cizí)
    expect(report.potencialDo).toBeGreaterThanOrEqual(report.potencialOd)
    expect(report.doporuceni).toContain('Doporučení')
    expect(report.hvezdy).toBeGreaterThanOrEqual(1)
  })
})
