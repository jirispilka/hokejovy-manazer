import { describe, expect, it } from 'vitest'
import {
  aktivniReklama,
  bonusNavstevnostiZReklamy,
  bonusZaVyhru,
  efektivniSponzorMesicne,
  faktorCenyVstupneho,
  kupReklamu,
  mesicniCashflow,
  mesicniUzaverka,
  nabidkySponzora,
  navstevnostDomaciho,
  SPONZOR_FIX,
  vypocetDomacichTrzeb,
  vychoziStadion,
  zmenStadion,
  zkontrolujBankrot,
  zvolSponzora,
} from '../../src/core/finance'
import { newGame } from '../../src/core/sezona'

describe('sponzor', () => {
  const s = newGame(7, 'tabor')
  it('nabídky odpovídají lize a volba vypne nabídku', () => {
    const { jistota, bonus } = nabidkySponzora(s)
    expect(jistota).toEqual({ typ: 'jistota', mesicne: SPONZOR_FIX[2], zaVyhru: 0 })
    expect(bonus.mesicne).toBe(Math.round(SPONZOR_FIX[2] * 0.6))
    expect(bonus.zaVyhru).toBe(60_000)
    const po = zvolSponzora(s, 'bonus')
    expect(po.sponzor.typ).toBe('bonus')
    expect(po.sponzorNabidka).toBe(false)
  })
  it('cashflow nepočítá sponzora před podpisem smlouvy', () => {
    const pred = mesicniCashflow(s)
    expect(pred.sponzor).toBe(0)
    const po = zvolSponzora(s, 'jistota')
    const poCf = mesicniCashflow(po)
    expect(poCf.sponzor).toBe(efektivniSponzorMesicne(po))
    expect(poCf.sponzor).toBeGreaterThan(0)
  })
  it('bonus za výhru přičítá jen u bonusové smlouvy', () => {
    const bonusovy = structuredClone(zvolSponzora(s, 'bonus'))
    const pred = bonusovy.tymy.tabor.rozpocet
    bonusZaVyhru(bonusovy)
    expect(bonusovy.tymy.tabor.rozpocet).toBe(pred + 60_000)
    const jistotovy = structuredClone(zvolSponzora(s, 'jistota'))
    const pred2 = jistotovy.tymy.tabor.rozpocet
    bonusZaVyhru(jistotovy)
    expect(jistotovy.tymy.tabor.rozpocet).toBe(pred2)
  })
})

describe('vstupné', () => {
  it('roste s náladou a derby', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    s.naladaFanousku = 50
    const zakladni = vypocetDomacichTrzeb(s, false).celkem
    const navstevnost = Math.round(1200 * (0.6 + 50 / 250))
    expect(zakladni).toBeGreaterThan(navstevnost * 60)
    s.naladaFanousku = 100
    expect(vypocetDomacichTrzeb(s, false).celkem).toBeGreaterThan(zakladni)
    expect(vypocetDomacichTrzeb(s, true).navstevnost).toBeGreaterThan(vypocetDomacichTrzeb(s, false).navstevnost)
  })
  it('dražší vstupné sníží návštěvnost, levnější ji zvýší', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    s.naladaFanousku = 60
    const zaklad = vychoziStadion(2).cenaListku
    const normal = navstevnostDomaciho(s, false)
    s.stadion.cenaListku = Math.round(zaklad * 1.4)
    const drazsi = navstevnostDomaciho(s, false)
    s.stadion.cenaListku = Math.round(zaklad * 0.6)
    const levnejsi = navstevnostDomaciho(s, false)
    expect(drazsi).toBeLessThan(normal)
    expect(levnejsi).toBeGreaterThan(normal)
    expect(faktorCenyVstupneho(s)).toBeGreaterThan(1)
  })
})

describe('reklama', () => {
  it('koupě reklamy strhne rozpočet a zvedne náladu', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    s.tymy.tabor.rozpocet = 1_000_000
    const pred = s.naladaFanousku
    const po = kupReklamu(s, 'radio')
    expect(po.tymy.tabor.rozpocet).toBeLessThan(1_000_000)
    expect(po.naladaFanousku).toBeGreaterThan(pred)
    expect(aktivniReklama(po, 'radio')).not.toBeNull()
    expect(bonusNavstevnostiZReklamy(po)).toBeGreaterThan(0)
  })
  it('nelze koupit stejnou kampaň dvakrát', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    s.tymy.tabor.rozpocet = 2_000_000
    const po = kupReklamu(s, 'noviny')
    expect(() => kupReklamu(po, 'noviny')).toThrow(/běží/)
  })
  it('TV reklama zvýší návštěvnost víc než noviny', () => {
    const zaklad = structuredClone(newGame(7, 'tabor'))
    zaklad.naladaFanousku = 50
    const sNoviny = kupReklamu(zaklad, 'noviny')
    const sTv = kupReklamu({ ...zaklad, tymy: { ...zaklad.tymy, tabor: { ...zaklad.tymy.tabor, rozpocet: 2_000_000 } } }, 'tv')
    expect(navstevnostDomaciho(sTv, false)).toBeGreaterThan(navstevnostDomaciho(sNoviny, false))
  })
})

describe('mesicniUzaverka', () => {
  it('strhne platy a přičte sponzory všem klubům', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    const podepsany = zvolSponzora(s, 'jistota')
    podepsany.den = 30
    const mujPred = podepsany.tymy.tabor.rozpocet
    const platy = podepsany.tymy.tabor.hraci.reduce((sum, h) => sum + h.plat, 0)
    const fix = efektivniSponzorMesicne(podepsany)
    const aiPred = podepsany.tymy.sparta.rozpocet
    mesicniUzaverka(podepsany)
    expect(podepsany.tymy.tabor.rozpocet).toBe(mujPred - platy + fix)
    expect(podepsany.posledniUzaverka).toBe(30)
    const aiPlaty = podepsany.tymy.sparta.hraci.reduce((sum, h) => sum + h.plat, 0)
    expect(podepsany.tymy.sparta.rozpocet).toBe(
      aiPred - aiPlaty + SPONZOR_FIX[0] + Math.round(8000 * 150 * 4 * 0.8),
    )
    expect(podepsany.zpravy[0]).toContain('uzávěrka')
  })
})

describe('bankrot', () => {
  it('při hlubokém mínusu prodá nejdražšího prodejného a sníží důvěru', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    s.tymy.tabor.rozpocet = -6_000_000
    const pocetPred = s.tymy.tabor.hraci.length
    const duveraPred = s.trener.duvera
    zkontrolujBankrot(s)
    expect(s.tymy.tabor.hraci.length).toBe(pocetPred - 1)
    expect(s.tymy.tabor.rozpocet).toBeGreaterThan(-6_000_000)
    expect(s.trener.duvera).toBe(duveraPred - 10)
    expect(s.zpravy.some((z) => z.includes('zahraničí'))).toBe(true)
    // minima drží
    expect(s.tymy.tabor.hraci.filter((h) => h.pozice === 'G').length).toBeGreaterThanOrEqual(2)
  })
  it('malé mínus jen varuje v den dělitelný 7', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    s.tymy.tabor.rozpocet = -1_000_000
    s.den = 14
    const pocetPred = s.tymy.tabor.hraci.length
    zkontrolujBankrot(s)
    expect(s.tymy.tabor.hraci.length).toBe(pocetPred)
    expect(s.zpravy[0]).toContain('mínusu')
  })
})
