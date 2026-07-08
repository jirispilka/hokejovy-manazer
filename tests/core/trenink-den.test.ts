import { describe, expect, it } from 'vitest'
import {
  dalsiDen,
  normalizujSeanci,
  normalizujTreninkovyPlan,
  potrebujeVolbuDne,
  potvrdDen,
  previewDne,
} from '../../src/core/trenink'
import { advanceDay, newGame } from '../../src/core/sezona'

describe('denní plánování', () => {
  it('dalsiDen vrátí den s.typem', () => {
    const s = newGame(31, 'tabor')
    const d = dalsiDen(s)
    expect(d.den).toBe(1)
    expect(['zapas', 'volny', 'po_zapase']).toContain(d.typ)
  })

  it('potrebujeVolbuDne je false před zápasem', () => {
    let s = newGame(31, 'tabor')
    while (dalsiDen(s).typ !== 'zapas') s = advanceDay(s)
    expect(potrebujeVolbuDne(s)).toBe(false)
  })

  it('previewDne — strelba zvedne únavu', () => {
    const s = newGame(31, 'tabor')
    const hraci = s.tymy[s.mujKlubId].hraci.filter((h) => h.pozice !== 'G').slice(0, 2)
    const den = s.den + 1
    const p = previewDne(s, den, [{ typ: 'strelba', intenzita: 'tezka', hraci: hraci.map((h) => h.id) }])
    expect(p.unavaPo).toBeGreaterThanOrEqual(p.unavaPred)
    expect(p.rust.some((r) => r.includes('střelbu') || r.includes('střelba'))).toBe(true)
  })

  it('previewDne — zabava zvedne formu', () => {
    const s = newGame(31, 'tabor')
    const p = previewDne(s, s.den + 1, [{ typ: 'zabava' }])
    expect(p.formaPo).toBeGreaterThanOrEqual(p.formaPred)
    expect(p.moralkaPo).toBeGreaterThan(p.moralkaPred)
  })

  it('previewDne — sponzor přidá rozpočet', () => {
    const s = newGame(31, 'tabor')
    const pred = s.tymy[s.mujKlubId].rozpocet
    const p = previewDne(s, s.den + 1, [{ typ: 'sponzor' }])
    expect(p.rozpoctPo).toBeGreaterThan(pred)
  })

  it('potvrdDen uloží seance', () => {
    const s = newGame(31, 'tabor')
    const den = s.den + 2
    const seance = [{ typ: 'odpocinek' as const }]
    const po = potvrdDen(s, den, seance)
    expect(po.treninkovyTyden[den][0].typ).toBe('odpocinek')
  })

  it('normalizujSeanci mapuje legacy typy', () => {
    expect(normalizujSeanci({ typ: 'led' as never }).typ).toBe('strelba')
    expect(normalizujSeanci({ typ: 'posilovna' as never }).typ).toBe('kondice')
  })

  it('integrace — potvrdDen + advanceDay aplikuje aktivitu', () => {
    let s = newGame(31, 'tabor')
    while (dalsiDen(s).typ === 'zapas') s = advanceDay(s)
    const den = dalsiDen(s).den
    const pred = s.tymy[s.mujKlubId].moralka
    s = potvrdDen(s, den, [{ typ: 'zabava' }])
    s = advanceDay(s)
    expect(s.tymy[s.mujKlubId].moralka).toBeGreaterThan(pred)
  })
})

describe('migrace typů v plánu', () => {
  it('normalizujTreninkovyPlan přemapuje led a posilovna', () => {
    const plan = normalizujTreninkovyPlan({
      5: [{ typ: 'led' as never, hraci: ['a', 'b'] }],
      6: [{ typ: 'posilovna' as never, hraci: ['a'] }],
    })
    expect(plan[5][0].typ).toBe('strelba')
    expect(plan[6][0].typ).toBe('kondice')
  })
})
