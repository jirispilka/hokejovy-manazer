import { describe, expect, it } from 'vitest'
import { generujTym } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { overall, overallProRoli, silaTymu, vychoziSestava, vymenVSestave } from '../../src/core/sestava'
import type { Hrac } from '../../src/core/types'

const tym = () => generujTym(createRng(11), { id: 'tabor', nazev: 'HC Tábor', liga: 2 })

describe('overall', () => {
  it('u brankáře je tažený chytáním', () => {
    const t = tym()
    const g = t.hraci.find((h) => h.pozice === 'G')!
    const silny = { ...g, atributy: { ...g.atributy, chytani: 90 } }
    const slaby = { ...g, atributy: { ...g.atributy, chytani: 20 } }
    expect(overall(silny)).toBeGreaterThan(overall(slaby) + 20)
  })
})

describe('vychoziSestava', () => {
  it('řadí útočníky podle overall do lajn (1. lajna nejsilnější)', () => {
    const t = tym()
    const podleId = new Map(t.hraci.map((h) => [h.id, h]))
    const prumerLajny = (l: string[]) =>
      l.reduce((s, id) => s + overall(podleId.get(id)!), 0) / l.length
    expect(prumerLajny(t.sestava.utoky[0])).toBeGreaterThanOrEqual(prumerLajny(t.sestava.utoky[3]))
  })
  it('nepoužije žádného hráče dvakrát', () => {
    const s = tym().sestava
    const vsichni = [...s.utoky.flat(), ...s.obrany.flat(), s.brankar]
    expect(new Set(vsichni).size).toBe(vsichni.length)
  })
})

describe('overallProRoli', () => {
  it('obránce v útoku má nižší OVR než na obraně', () => {
    const t = tym()
    const obr = t.hraci.find((h) => h.pozice === 'D')!
    expect(overallProRoli(obr, 'utok')).toBeLessThan(overallProRoli(obr, 'obrana'))
  })
  it('útočník v obraně má nižší OVR než v útoku', () => {
    const t = tym()
    const ut = t.hraci.find((h) => h.pozice === 'U')!
    expect(overallProRoli(ut, 'obrana')).toBeLessThan(overallProRoli(ut, 'utok'))
  })
})

describe('silaTymu', () => {
  it('vrací hodnoty v rozumném rozsahu 1–99', () => {
    const s = silaTymu(tym())
    for (const v of [s.utok, s.obrana, s.brankar]) {
      expect(v).toBeGreaterThan(1)
      expect(v).toBeLessThan(99)
    }
  })
  it('vyšší forma zvyšuje sílu', () => {
    const t = tym()
    const silnejsi = structuredClone(t)
    for (const h of silnejsi.hraci) h.forma = 70
    for (const h of t.hraci) h.forma = 30
    expect(silaTymu(silnejsi).utok).toBeGreaterThan(silaTymu(t).utok)
  })
})

describe('vymenVSestave', () => {
  it('prohodí hráče v lajně za náhradníka', () => {
    const t = tym()
    const vSestave = t.sestava.utoky[0][0]
    const mimo = t.hraci.find(
      (h) => h.pozice === 'U' && !t.sestava.utoky.flat().includes(h.id),
    )!
    const nova = vymenVSestave(t.sestava, vSestave, mimo.id)
    expect(nova.utoky[0][0]).toBe(mimo.id)
    expect(nova.utoky.flat()).not.toContain(vSestave)
  })
  it('prohodí dva hráče uvnitř sestavy', () => {
    const s = tym().sestava
    const a = s.utoky[0][0]
    const b = s.utoky[2][1]
    const nova = vymenVSestave(s, a, b)
    expect(nova.utoky[0][0]).toBe(b)
    expect(nova.utoky[2][1]).toBe(a)
  })
})
