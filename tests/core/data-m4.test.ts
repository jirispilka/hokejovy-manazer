import { describe, expect, it } from 'vitest'
import soupisky from '../../src/core/data/soupisky.json'
import kluby from '../../src/core/data/kluby.json'
import { generujSvet, generujTym, hracZRealnych, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { overall } from '../../src/core/sestava'
import type { Klub, Pozice } from '../../src/core/types'

interface ZaznamSoupisky {
  jmeno: string
  prijmeni: string
  pozice: Pozice
  vek: number
  zapasy: number
  goly: number
  asistence: number
  trzniCena?: number
  detailPozice?: 'LW' | 'C' | 'RW' | 'LD' | 'RD'
  historieStatistik?: {
    sezona: string
    soutez: string
    tym: string
    zapasy: number
    goly: number
    asistence: number
    body: number
  }[]
}

const DATA = soupisky as Record<string, ZaznamSoupisky[]>

describe('reálné soupisky', () => {
  it('obsahují validní data pro všechny kluby', () => {
    const idKlubu = new Set((kluby as Klub[]).map((k) => k.id))
    const vsechnyKluby = (kluby as Klub[]).map((k) => k.id)
    expect(Object.keys(DATA).sort()).toEqual(vsechnyKluby.sort())

    for (const [klubId, hraci] of Object.entries(DATA)) {
      expect(idKlubu.has(klubId)).toBe(true)
      expect(hraci.length).toBeGreaterThanOrEqual(10)
      for (const h of hraci) {
        expect(h.jmeno.length).toBeGreaterThan(0)
        expect(h.prijmeni.length).toBeGreaterThan(0)
        expect(['U', 'D', 'G']).toContain(h.pozice)
        expect(h.vek).toBeGreaterThanOrEqual(16)
        expect(h.vek).toBeLessThanOrEqual(45)
        expect(h.zapasy).toBeGreaterThanOrEqual(0)
        expect(h.goly).toBeGreaterThanOrEqual(0)
        expect(h.asistence).toBeGreaterThanOrEqual(0)
        if (h.trzniCena !== undefined) expect(h.trzniCena).toBeGreaterThan(0)
        if (h.detailPozice !== undefined) expect(['LW', 'C', 'RW', 'LD', 'RD']).toContain(h.detailPozice)
        for (const s of h.historieStatistik ?? []) {
          expect(s.sezona.length).toBeGreaterThan(0)
          expect(s.zapasy).toBeGreaterThanOrEqual(0)
          expect(s.body).toBe(s.goly + s.asistence)
        }
      }
    }
  })

  it('hracZRealnych přenese identitu a lepší statistiky zvednou overall', () => {
    const vzor = {
      jmeno: 'Test',
      prijmeni: 'Hvězda',
      pozice: 'U' as Pozice,
      vek: 24,
      zapasy: 50,
      goly: 30,
      asistence: 30,
      trzniCena: 12_340_000,
      historieStatistik: [{ sezona: '2024/25', soutez: 'ELH', tym: 'Test', zapasy: 50, goly: 30, asistence: 30, body: 60 }],
    }
    const hvezda = hracZRealnych(createRng(1), vzor, 0, 'r-x-U-0')
    const okraj = hracZRealnych(createRng(1), { ...vzor, goly: 1, asistence: 1 }, 0, 'r-x-U-1')
    expect(hvezda.jmeno).toBe('Test')
    expect(hvezda.prijmeni).toBe('Hvězda')
    expect(hvezda.id).toBe('r-x-U-0')
    expect(hvezda.trzniCena).toBe(12_340_000)
    expect(hvezda.historieStatistik).toBeUndefined()
    expect(overall(hvezda)).toBeGreaterThan(overall(okraj))
  })

  it('nevyrábí falešnou historii u starších dat bez historie', () => {
    const vzor = { jmeno: 'Test', prijmeni: 'BezHistorie', pozice: 'U' as Pozice, vek: 24, zapasy: 42, goly: 11, asistence: 17 }
    const h = hracZRealnych(createRng(1), vzor, 0, 'r-x-U-2')
    expect(h.historieStatistik).toBeUndefined()
  })

  it('extraliga má historii a tržní cenu u většiny hráčů', () => {
    const extraliga = (kluby as Klub[]).filter((k) => k.liga === 0).map((k) => k.id)
    let sHistorii = 0
    let celkem = 0
    for (const id of extraliga) {
      for (const h of DATA[id]) {
        celkem++
        if ((h.historieStatistik?.length ?? 0) >= 1 && (h.trzniCena ?? 0) > 0) sHistorii++
      }
    }
    expect(sHistorii / celkem).toBeGreaterThanOrEqual(0.5)
  })

  it('pokrytý klub dostane reálná jména a svět zůstane deterministický', () => {
    const klub = (kluby as Klub[]).find((k) => k.id === 'sparta')!
    resetIdCitac()
    const tym = generujTym(createRng(5), klub)
    const realna = new Set(DATA.sparta.map((r) => `${r.jmeno} ${r.prijmeni}`))

    expect(tym.hraci.filter((h) => h.pozice === 'U')).toHaveLength(14)
    expect(tym.hraci.filter((h) => h.pozice === 'D')).toHaveLength(7)
    expect(tym.hraci.filter((h) => h.pozice === 'G')).toHaveLength(2)
    expect(tym.hraci.filter((h) => realna.has(`${h.jmeno} ${h.prijmeni}`))).toHaveLength(DATA.sparta.length)
    expect(tym.hraci.some((h) => h.id.startsWith('r-sparta-'))).toBe(true)
    expect(JSON.stringify(generujSvet(42))).toBe(JSON.stringify(generujSvet(42)))
  })
})
