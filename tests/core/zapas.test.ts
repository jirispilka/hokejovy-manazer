import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import type { Klub, Tym } from '../../src/core/types'
import {
  aplikujProslov,
  autoNahrada,
  nahradZraneneho,
  odvolejBrankare,
  pokracujPoPauze,
  pouzijTimeout,
  pouzijZetonTrenera,
  potvrdKlicovyMoment,
  prevedNaVysledek,
  simulujCelyZapas,
  simulujDoKonce,
  simulujMinutu,
  zacniZapas,
  zmenTaktiku,
} from '../../src/core/zapas'

const tym = (id: string, liga: number, seed: number, zakladId: number): Tym => {
  resetIdCitac(zakladId)
  return generujTym(createRng(seed), { id, nazev: id, liga } as Klub)
}
const domaci = (liga = 0) => tym('x', liga, 1, 0)
const hoste = (liga = 0) => tym('y', liga, 2, 1000)

// odehraje celý zápas přes simulujDoKonce a vrátí stav
const cely = (d: Tym, h: Tym, seed: number) =>
  simulujDoKonce(zacniZapas(d, h), d, h, createRng(seed))

describe('determinismus a základní invarianty', () => {
  it('stejný seed → stejný průběh (bez zásahů)', () => {
    const a = cely(domaci(), hoste(), 99)
    const b = cely(domaci(), hoste(), 99)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
  it('nikdy nekončí remízou', () => {
    for (let s = 0; s < 100; s++) {
      const v = simulujCelyZapas(domaci(1), hoste(1), createRng(s))
      expect(v.golyDomaci).not.toBe(v.golyHoste)
    }
  })
  it('výrazně silnější tým vyhrává většinu zápasů', () => {
    let vyhry = 0
    for (let s = 0; s < 200; s++) {
      const v = simulujCelyZapas(domaci(0), hoste(2), createRng(s))
      if (v.golyDomaci > v.golyHoste) vyhry++
    }
    expect(vyhry).toBeGreaterThan(140)
  })
  it('dává realistické počty gólů (průměr 3–9 celkem)', () => {
    let goly = 0
    for (let s = 0; s < 200; s++) {
      const v = simulujCelyZapas(domaci(), hoste(), createRng(s))
      goly += v.golyDomaci + v.golyHoste
    }
    expect(goly / 200).toBeGreaterThan(3)
    expect(goly / 200).toBeLessThan(9)
  })
  it('gólové události sedí na skóre, střely mají šanci v %', () => {
    const v = simulujCelyZapas(domaci(), hoste(), createRng(7))
    const goly = v.udalosti.filter((u) => u.typ === 'gol')
    expect(goly.length).toBe(v.golyDomaci + v.golyHoste)
    const strelove = v.udalosti.filter((u) => ['gol', 'strela', 'zakrok'].includes(u.typ))
    for (const u of strelove.slice(0, -1)) {
      if (u.typ === 'gol' && u.text.includes('nájezd')) continue // rozhodující nájezd šanci nemá
      expect(u.sance).toBeGreaterThanOrEqual(0)
      expect(u.sance).toBeLessThanOrEqual(100)
    }
  })
  it('vstupní stav ani týmy se nemutují', () => {
    const d = domaci()
    const h = hoste()
    const stav = zacniZapas(d, h)
    const otisk = JSON.stringify({ stav, d, h })
    simulujMinutu(stav, d, h, createRng(1))
    expect(JSON.stringify({ stav, d, h })).toBe(otisk)
  })
})

describe('třetiny a pauzy', () => {
  const doPauzy = (seed: number) => {
    const d = domaci()
    const h = hoste()
    const rng = createRng(seed)
    let stav = zacniZapas(d, h)
    while (stav.faze === 'hraje') {
      if (stav.cekaNaNahradu) stav = autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? d : h)
      else stav = simulujMinutu(stav, d, h, rng)
    }
    // zranění přesně na konci třetiny: vyřešit, ať je pauza „čistá"
    if (stav.cekaNaNahradu) stav = autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? d : h)
    return { stav, d, h, rng }
  }
  it('po 20. minutě je pauza1 a simulace bez pokračování hází chybu', () => {
    const { stav, d, h, rng } = doPauzy(5)
    expect(stav.faze).toBe('pauza1')
    expect(stav.minuta).toBe(20)
    expect(() => simulujMinutu(stav, d, h, rng)).toThrow()
    const dal = pokracujPoPauze(stav)
    expect(dal.faze).toBe('hraje')
  })
  it('celý zápas projde fázemi až do konce', () => {
    const stav = cely(domaci(), hoste(), 11)
    expect(stav.faze).toBe('konec')
    expect(stav.minuta).toBeGreaterThanOrEqual(60)
  })
})

describe('zásahy trenéra', () => {
  it('útočná taktika obou stran zvýší počet gólů oproti obranné', () => {
    const golu = (taktika: 'velmi_utocna' | 'velmi_obranna') => {
      let goly = 0
      for (let s = 0; s < 150; s++) {
        const d = domaci()
        const h = hoste()
        const rng = createRng(s)
        let stav = zacniZapas(d, h)
        stav = zmenTaktiku(stav, 'domaci', taktika)
        stav = zmenTaktiku(stav, 'hoste', taktika)
        stav = simulujDoKonce(stav, d, h, rng)
        goly += stav.domaci.goly + stav.hoste.goly
      }
      return goly
    }
    expect(golu('velmi_utocna')).toBeGreaterThan(golu('velmi_obranna'))
  })
  it('změna taktiky během zápasu zapíše událost', () => {
    const d = domaci()
    const h = hoste()
    let stav = zacniZapas(d, h)
    stav = zmenTaktiku(stav, 'domaci', 'velmi_utocna')
    const u = stav.udalosti.find((x) => x.text.includes('Pressing'))
    expect(u?.typ).toBe('info')
  })
  it('time-out posune momentum a druhý time-out hází chybu', () => {
    const d = domaci()
    const h = hoste()
    let stav = zacniZapas(d, h)
    const pred = stav.momentum
    stav = pouzijTimeout(stav, 'hoste')
    expect(stav.momentum).toBeLessThan(pred)
    expect(stav.hoste.timeoutPouzit).toBe(true)
    expect(() => pouzijTimeout(stav, 'hoste')).toThrow()
  })
  it('odvolaný brankář znamená góly do prázdné brány', () => {
    // domácí hrají celý zápas bez brankáře → dostanou výrazně víc gólů než normálně
    const golyProti = (bezBrankare: boolean) => {
      let goly = 0
      for (let s = 0; s < 100; s++) {
        const d = domaci()
        const h = hoste()
        let stav = zacniZapas(d, h)
        if (bezBrankare) stav = odvolejBrankare(stav, 'domaci', true)
        stav = simulujDoKonce(stav, d, h, createRng(s))
        goly += stav.hoste.goly
      }
      return goly
    }
    expect(golyProti(true)).toBeGreaterThan(golyProti(false) * 1.8)
  })
  it('proslov jde jen v pauze a nastaví bonus', () => {
    const d = domaci()
    const h = hoste()
    let stav = zacniZapas(d, h)
    expect(() => aplikujProslov(stav, 'domaci', 'povzbudit', createRng(1))).toThrow()
    const rng = createRng(3)
    while (stav.faze === 'hraje') {
      if (stav.cekaNaNahradu) stav = autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? d : h)
      else stav = simulujMinutu(stav, d, h, rng)
    }
    if (stav.cekaNaNahradu) stav = autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? d : h)
    const po = aplikujProslov(stav, 'domaci', 'klid', rng)
    expect(po.domaci.proslovBonus).toBe(1)
    expect(po.udalosti.some((u) => u.typ === 'proslov')).toBe(true)
  })

  it('proaktivní žeton uplatní bonus až při střele, ne při pauze klíčového momentu', () => {
    const d = domaci()
    const h = hoste()
    let stav = zacniZapas(d, h)
    stav = pouzijZetonTrenera(stav, 'domaci')
    expect(stav.domaci.bonusDalsiSance).toBe(0.15)
    stav.cekaNaKlicovyMoment = {
      utocnik: 'domaci',
      pGol: 0.4,
      strelecId: d.sestava.utoky[0][0],
      obrance: 'hoste',
      tretina: 1,
    }
    const rng = createRng(5)
    const predZetony = stav.domaci.zbyvajiciZetony
    stav = potvrdKlicovyMoment(stav, 'nechat', d, h, rng)
    expect(stav.domaci.bonusDalsiSance).toBe(0)
    expect(stav.domaci.zbyvajiciZetony).toBe(predZetony)
    expect(stav.udalosti.some((u) => u.text.includes('Bonus z žetonu'))).toBe(true)
  })

  it('zapalit v klíčovém momentu sníží žetony', () => {
    const d = domaci()
    const h = hoste()
    let stav = zacniZapas(d, h)
    stav.cekaNaKlicovyMoment = {
      utocnik: 'domaci',
      pGol: 0.35,
      strelecId: d.sestava.utoky[0][0],
      obrance: 'hoste',
      tretina: 1,
    }
    stav = potvrdKlicovyMoment(stav, 'zapalit', d, h, createRng(9))
    expect(stav.domaci.zbyvajiciZetony).toBe(2)
    expect(stav.cekaNaKlicovyMoment).toBeNull()
  })
})

describe('zranění', () => {
  // najdi seed, kde dojde ke zranění, deterministicky projitím seedů
  const najdiZapasSeZranenim = () => {
    for (let s = 0; s < 300; s++) {
      const d = domaci()
      const h = hoste()
      const rng = createRng(s)
      let stav = zacniZapas(d, h)
      while (stav.faze !== 'konec') {
        if (stav.cekaNaNahradu) return { stav, d, h, rng }
        if (stav.faze !== 'hraje') stav = pokracujPoPauze(stav)
        else stav = simulujMinutu(stav, d, h, rng)
      }
    }
    throw new Error('Ve 300 zápasech nedošlo ke zranění — zkontroluj pravděpodobnost.')
  }
  it('zranění zastaví hru, náhrada ji odblokuje a zraněný zmizí ze sestavy', () => {
    const { stav, d, h, rng } = najdiZapasSeZranenim()
    const info = stav.cekaNaNahradu!
    expect(() => simulujMinutu(stav, d, h, rng)).toThrow()
    const tymStrany = info.strana === 'domaci' ? d : h
    const dal = autoNahrada(stav, tymStrany)
    expect(dal.cekaNaNahradu).toBeNull()
    const sestava = dal[info.strana].sestava
    expect([...sestava.utoky.flat(), ...sestava.obrany.flat(), sestava.brankar]).not.toContain(info.hracId)
    expect(dal[info.strana].zraneni).toContain(info.hracId)
    expect(dal.udalosti.some((u) => u.typ === 'zraneni')).toBe(true)
  })
  it('nahradZraneneho odmítne hráče jiné pozice', () => {
    const { stav, d, h } = najdiZapasSeZranenim()
    const info = stav.cekaNaNahradu!
    const tymStrany = info.strana === 'domaci' ? d : h
    const zraneny = tymStrany.hraci.find((x) => x.id === info.hracId)!
    const spatny = tymStrany.hraci.find((x) => x.pozice !== zraneny.pozice && x.pozice !== 'G')!
    expect(() => nahradZraneneho(stav, tymStrany, spatny.id)).toThrow()
  })
  it('pauza s čekající náhradou nejde přeskočit bez vyřešení', () => {
    // zranění přesně ve 20./40. minutě nastaví pauzu i čekající náhradu zároveň
    const { stav } = najdiZapasSeZranenim()
    const vPauze = { ...stav, faze: 'pauza1' as const }
    expect(() => pokracujPoPauze(vPauze)).toThrow()
    expect(() => simulujMinutu(vPauze, domaci(), hoste(), createRng(1))).toThrow(/náhradu/)
  })
})

describe('prevedNaVysledek', () => {
  it('odpovídá stavu zápasu', () => {
    const stav = cely(domaci(), hoste(), 21)
    const v = prevedNaVysledek(stav)
    expect(v.golyDomaci).toBe(stav.domaci.goly)
    expect(v.golyHoste).toBe(stav.hoste.goly)
    expect(v.strelyDomaci).toBe(stav.domaci.strely)
    expect(v.udalosti).toEqual(stav.udalosti)
    expect(v.prodlouzeni).toBe(stav.prodlouzeni)
    expect(v.najezdy).toBe(stav.najezdy)
  })
})
