import { describe, expect, it } from 'vitest'
import { doplnHraciDoSeanci, doplnSeanciProTym, doporucenyPlan, efektUnavyDne, prehledKondice, previewTydne, potvrdTreninkovyPlan, unavaPoOdpocinku, unavaPoVolnemDnu, validujPlan } from '../../src/core/trenink'
import { newGame } from '../../src/core/sezona'

describe('trenink plánovač', () => {
  it('preview zvedne únavu po těžkém ledu', () => {
    const s = newGame(31, 'tabor')
    const muj = s.tymy[s.mujKlubId]
    const hraci = muj.hraci.filter((h) => h.pozice !== 'G').slice(0, 2)
    const plan = { [s.den + 2]: [{ typ: 'strelba' as const, intenzita: 'tezka' as const, hraci: hraci.map((h) => h.id) }] }
    const p = previewTydne(s, plan)
    expect(p.unavaPo).toBeGreaterThanOrEqual(p.unavaPred)
  })

  it('lehký trénink zvedne méně únavy než těžký', () => {
    const s = newGame(31, 'tabor')
    const muj = s.tymy[s.mujKlubId]
    const hraci = muj.hraci.filter((h) => h.pozice !== 'G').slice(0, 2)
    const den = s.den + 2
    const tezky = previewTydne(s, { [den]: [{ typ: 'strelba', intenzita: 'tezka', hraci: hraci.map((h) => h.id) }] })
    const lehky = previewTydne(s, { [den]: [{ typ: 'strelba', intenzita: 'lehka', hraci: hraci.map((h) => h.id) }] })
    expect(lehky.unavaPo).toBeLessThan(tezky.unavaPo)
  })

  it('lze naplánovat více tréninků za den', () => {
    const s = newGame(31, 'tabor')
    const den = s.den + 2
    const plan = {
      [den]: [
        { typ: 'taktika' as const, intenzita: 'lehka' as const, lajna: 0 },
        { typ: 'kondice' as const, intenzita: 'lehka' as const, hraci: [s.tymy[s.mujKlubId].hraci[0].id] },
      ],
    }
    const v = validujPlan(s, plan)
    expect(v.some((x) => x.text.includes('Vyber'))).toBe(false)
    const p = previewTydne(s, plan)
    expect(p.unavaPo).toBeGreaterThanOrEqual(p.unavaPred)
    expect(p.rustPoDnech).toHaveLength(1)
    expect(p.rustPoDnech[0].den).toBe(den)
  })

  it('profi plán se 6 seancemi není přetrénink', () => {
    const s = newGame(31, 'tabor')
    const hraci = s.tymy[s.mujKlubId].hraci.filter((h) => h.pozice !== 'G').slice(0, 2).map((h) => h.id)
    const plan = {
      [s.den + 1]: [{ typ: 'odpocinek' as const }],
      [s.den + 2]: [
        { typ: 'taktika' as const, intenzita: 'lehka' as const, lajna: 0 },
        { typ: 'strelba' as const, intenzita: 'tezka' as const, hraci },
      ],
      [s.den + 4]: [
        { typ: 'kondice' as const, intenzita: 'tezka' as const, hraci: [hraci[0]] },
        { typ: 'taktika' as const, intenzita: 'lehka' as const, lajna: 1 },
      ],
      [s.den + 5]: [{ typ: 'strelba' as const, intenzita: 'tezka' as const, hraci }],
      [s.den + 6]: [{ typ: 'strelba' as const, intenzita: 'tezka' as const, hraci }],
    }
    const v = validujPlan(s, plan)
    expect(v.some((x) => x.text.includes('Přetrénink'))).toBe(false)
    expect(previewTydne(s, plan).narocnost).toBeLessThan(8)
  })

  it('extrémní náročnost varuje před přetréninkem', () => {
    const s = newGame(31, 'tabor')
    const plan = {
      [s.den + 1]: [{ typ: 'strelba' as const, hraci: ['a', 'b'] }],
      [s.den + 2]: [{ typ: 'strelba' as const, hraci: ['a', 'b'] }],
      [s.den + 3]: [{ typ: 'strelba' as const, hraci: ['a', 'b'] }],
      [s.den + 4]: [{ typ: 'kondice' as const, hraci: ['a'] }],
      [s.den + 5]: [{ typ: 'kondice' as const, hraci: ['a'] }],
      [s.den + 6]: [{ typ: 'strelba' as const, hraci: ['a', 'b'] }],
      [s.den + 7]: [
        { typ: 'strelba' as const, hraci: ['a', 'b'] },
        { typ: 'kondice' as const, hraci: ['a'] },
      ],
    }
    const v = validujPlan(s, plan)
    expect(v.some((x) => x.text.includes('Přetrénink'))).toBe(true)
  })

  it('doplnSeanciProTym doplní hráče a sjednotí týmový plán', () => {
    const s = newGame(31, 'tabor')
    const den = s.den + 2
    const plan = {
      [den]: [
        { typ: 'strelba' as const, intenzita: 'tezka' as const },
        { typ: 'kondice' as const, intenzita: 'tezka' as const },
        { typ: 'taktika' as const, intenzita: 'lehka' as const, lajna: 2 },
      ],
    }
    const seance = doplnSeanciProTym(s, plan[den])
    expect(seance[0].hraci).toHaveLength(2)
    expect(seance[1].hraci).toHaveLength(1)
    expect(seance[2].lajna).toBeUndefined()
    expect(validujPlan(s, { [den]: seance }).some((x) => x.text.includes('Vyber'))).toBe(false)
  })

  it('doplnHraciDoSeanci doplní hráče do už přidané kondice', () => {
    const s = newGame(31, 'tabor')
    const hrac = s.tymy[s.mujKlubId].hraci.find((h) => h.pozice !== 'G')!
    const den = s.den + 2
    const plan = { [den]: [{ typ: 'kondice' as const, intenzita: 'tezka' as const }] }
    const po = doplnHraciDoSeanci(plan, den, [hrac.id])
    expect(po[den][0].hraci).toEqual([hrac.id])
    expect(validujPlan(s, po).some((x) => x.text.includes('kondice'))).toBe(false)
    const preview = previewTydne(s, po)
    expect(preview.rust.some((r) => r.includes(hrac.prijmeni))).toBe(true)
  })

  it('doporucenyPlan nepřepíše zápasy', () => {
    const s = newGame(31, 'tabor')
    const plan = doporucenyPlan(s)
    const zapasy = s.ligy[2].zapasy.filter((z) => z.domaci === 'tabor' || z.hoste === 'tabor')
    const prvniZapas = zapasy.find((z) => !z.vysledek)!
    expect(plan[prvniZapas.den]).toBeUndefined()
  })

  it('potvrdTreninkovyPlan uloží plán', () => {
    const s = newGame(31, 'tabor')
    const plan = { 7: [{ typ: 'odpocinek' as const }] }
    const po = potvrdTreninkovyPlan(s, plan)
    expect(po.treninkovyTyden[7][0].typ).toBe('odpocinek')
    expect(po.treninkovyTydenOd).toBe(0)
  })

  it('unavaPoOdpocinku sníží průměrnou únavu víc než volný den', () => {
    const s = newGame(31, 'tabor')
    const muj = s.tymy[s.mujKlubId]
    for (const h of muj.hraci) h.unava = 60
    expect(unavaPoOdpocinku(muj)).toBeLessThan(unavaPoVolnemDnu(muj))
    expect(unavaPoVolnemDnu(muj)).toBe(50)
  })

  it('efektUnavyDne sčítá víc seancí do jednoho výsledku', () => {
    const seance = [
      { typ: 'strelba' as const, intenzita: 'tezka' as const, hraci: ['a', 'b'] },
      { typ: 'kondice' as const, intenzita: 'lehka' as const, hraci: ['a'] },
    ]
    expect(efektUnavyDne(seance)).toBe('↑ únava týmu (+6 %)')
  })

  it('prehledKondice vrátí kalendář a odpočinek v plánu', () => {
    const s = newGame(31, 'tabor')
    const den = s.den + 2
    const s2 = potvrdTreninkovyPlan(s, { [den]: [{ typ: 'odpocinek' as const }] })
    const k = prehledKondice(s2)
    expect(k.dny).toHaveLength(7)
    expect(k.odpocinek?.den).toBe(den)
    expect(k.odpocinek?.vPlanu).toBe(true)
    expect(k.odpocinek!.unavaPoOdpoinku).toBeLessThanOrEqual(k.unava)
  })

  it('prehledKondice navrhne odpočinek na volném dni bez plánu', () => {
    const s = newGame(31, 'tabor')
    for (const h of s.tymy[s.mujKlubId].hraci) h.unava = 45
    const s2 = potvrdTreninkovyPlan(s, {})
    const k = prehledKondice(s2)
    expect(k.odpocinek).not.toBeNull()
    expect(k.odpocinek!.vPlanu).toBe(false)
    expect(k.odpocinek!.unavaPoVolny).toBeLessThan(k.unava)
  })

  it('prehledKondice neřve odpočinek když je tým odpočatý', () => {
    const s = newGame(31, 'tabor')
    for (const h of s.tymy[s.mujKlubId].hraci) h.unava = 5
    const k = prehledKondice(potvrdTreninkovyPlan(s, {}))
    expect(k.odpocinek).toBeNull()
  })

  it('unavaPoVolnemDnu simuluje denní regeneraci', () => {
    const s = newGame(31, 'tabor')
    const muj = s.tymy[s.mujKlubId]
    for (const h of muj.hraci) h.unava = 30
    expect(unavaPoVolnemDnu(muj)).toBe(20)
  })
})
