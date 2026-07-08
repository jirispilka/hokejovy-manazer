import { describe, expect, it } from 'vitest'
import { vypocetDomacichTrzeb, vychoziStadion, zmenStadion } from '../../src/core/finance'
import { mesicniPlatyTymu, ocekavanyPlat, rocniPlatyTymu, zmenPlat } from '../../src/core/platy'
import { newGame } from '../../src/core/sezona'
import { overall } from '../../src/core/sestava'

describe('platy', () => {
  it('ocekavanyPlat odpovídá vzorci', () => {
    const s = newGame(1, 'tabor')
    const h = s.tymy.tabor.hraci[0]
    const o = overall(h)
    expect(ocekavanyPlat(h)).toBe(Math.round((o * o * 25) / 1000) * 1000)
  })
  it('mesicniPlatyTymu sečte platy soupisky', () => {
    const s = newGame(1, 'tabor')
    const hraci = s.tymy.tabor.hraci
    const rucne = hraci.reduce((sum, h) => sum + h.plat, 0)
    expect(mesicniPlatyTymu(hraci)).toBe(rucne)
    expect(rocniPlatyTymu(hraci)).toBe(rucne * 12)
  })
  it('zmenPlat zvýší formu při štědrém platu', () => {
    const s = newGame(1, 'tabor')
    const h = s.tymy.tabor.hraci[0]
    const staryPlat = h.plat
    const novy = Math.round(ocekavanyPlat(h) * 1.2)
    const po = zmenPlat(s, h.id, novy)
    const hrac = po.tymy.tabor.hraci.find((x) => x.id === h.id)!
    expect(hrac.plat).toBeGreaterThan(staryPlat)
    expect(hrac.forma).toBeGreaterThan(h.forma)
    expect(po.financeHistorie.length).toBeGreaterThan(0)
  })
})

describe('stadion', () => {
  it('vypocetDomacichTrzeb zahrnuje vstupné, jídlo a merch', () => {
    const s = newGame(1, 'tabor')
    const t = vypocetDomacichTrzeb(s, false)
    expect(t.vstupne).toBeGreaterThan(0)
    expect(t.jidlo).toBeGreaterThan(0)
    expect(t.merch).toBeGreaterThan(0)
    expect(t.celkem).toBe(t.vstupne + t.jidlo + t.merch)
  })
  it('zmenStadion drží rozumné meze', () => {
    const s = newGame(1, 'tabor')
    const po = zmenStadion(s, { cenaListku: 999, cenaJidla: 300, cenaMerch: 800 })
    expect(po.stadion.cenaListku).toBeLessThanOrEqual(Math.round(60 * 1.4))
    expect(po.stadion.cenaJidla).toBe(200)
    expect(po.stadion.cenaMerch).toBe(600)
  })
  it('vychoziStadion odpovídá lize', () => {
    expect(vychoziStadion(0).cenaListku).toBe(150)
    expect(vychoziStadion(2).cenaListku).toBe(60)
  })
})
