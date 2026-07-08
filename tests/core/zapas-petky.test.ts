import { describe, expect, it } from 'vitest'
import { createRng } from '../../src/core/rng'
import { zacniZapas, potvrdPresilovku, simulujMinutu, pouzijZetonTrenera, simulujDoKonce, silaStran } from '../../src/core/zapas'
import {
  aktivniLajnyEven,
  energiePetky,
  energieUtokLajny,
  jePetkaKompletni,
  nejlepsiPetkaPP,
  nastavEnergiu,
  normalizujVytizeniUtoku,
  posunUtokVPoradi,
  prehledUtoku,
  vahyUtokuZVytizeni,
  vsechnyPetky,
  zmenVytizeniUtoku,
} from '../../src/core/zapasPetky'
import type { Tym } from '../../src/core/types'

function miniTym(id: string): Tym {
  const atributy = {
    strelba: 70,
    prihravky: 70,
    brusleni: 70,
    obrana: 70,
    fyzicka: 70,
    chytani: 20,
    vydrz: 70,
    technika: 70,
  }
  const hraci = Array.from({ length: 20 }, (_, i) => ({
    id: `${id}-h${i}`,
    jmeno: 'H',
    prijmeni: `${i}`,
    pozice: (i < 12 ? 'U' : i < 18 ? 'D' : 'G') as 'U' | 'D' | 'G',
    vek: 25,
    atributy: i >= 18 ? { ...atributy, chytani: 75 } : { ...atributy },
    forma: 50,
    unava: 0,
    goly: 0,
    asistence: 0,
    odehranoSezona: 0,
    potencial: 75,
    cena: 100_000,
    plat: 50_000,
    smlouvaDo: 2030,
    zranenZapasu: 0,
    herniHistorie: [],
  }))
  return {
    klubId: id,
    nazev: id,
    hraci,
    sestava: {
      utoky: [
        [hraci[0].id, hraci[1].id, hraci[2].id],
        [hraci[3].id, hraci[4].id, hraci[5].id],
        [hraci[6].id, hraci[7].id, hraci[8].id],
        [hraci[9].id, hraci[10].id, hraci[11].id],
      ],
      obrany: [
        [hraci[12].id, hraci[13].id],
        [hraci[14].id, hraci[15].id],
        [hraci[16].id, hraci[17].id],
      ],
      brankar: hraci[18].id,
    },
    chemie: { petky: [80, 70, 60, 50] },
    slozeni: { petky: ['', '', '', ''] },
    taktika: 'vyrovana' as const,
  }
}

describe('zapasPetky', () => {
  it('má 4 spojené lajny', () => {
    expect(vsechnyPetky()).toHaveLength(4)
  })

  it('potvrdPresilovku uloží celou pětku', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    let stav = zacniZapas(domaci, hoste)
    stav.cekaNaPresilovku = { strana: 'domaci', typ: 'pp', minutDo: 2, provinilecId: 'x' }
    stav = potvrdPresilovku(stav, { petka: { index: 2 } })
    expect(stav.domaci.aktivniPetka).toEqual({ index: 2 })
    expect(stav.cekaNaPresilovku).toBeNull()
  })

  it('PK volba nastaví pkPetka', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    let stav = zacniZapas(domaci, hoste)
    stav.cekaNaPresilovku = { strana: 'hoste', typ: 'pk', minutDo: 2, provinilecId: 'x' }
    stav = potvrdPresilovku(stav, { petka: { index: 3 }, pkAgresivni: true })
    expect(stav.hoste.pkPetka).toEqual({ index: 3 })
    expect(stav.hoste.pkAgresivni).toBe(true)
  })

  it('posun pořadí útoků funguje', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    const stav = zacniZapas(domaci, hoste)
    const posunuty = posunUtokVPoradi(stav, 'domaci', 3, -1)
    expect(posunuty.domaci.poradiUtoku.indexOf(3)).toBe(2)
  })

  it('vytíženost lajny se mění v rozmezí 0–2 po krocích 0.5', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    let stav = zacniZapas(domaci, hoste)
    stav = zmenVytizeniUtoku(stav, 'domaci', 0, 1)
    expect(stav.domaci.vytizeniUtoku[0]).toBe(2)
    stav = zmenVytizeniUtoku(stav, 'domaci', 0, -0.5)
    expect(stav.domaci.vytizeniUtoku[0]).toBe(1.5)
    stav = zmenVytizeniUtoku(stav, 'domaci', 3, -0.5)
    expect(stav.domaci.vytizeniUtoku[3]).toBe(0.5)
    stav = zmenVytizeniUtoku(stav, 'domaci', 3, -0.5)
    expect(stav.domaci.vytizeniUtoku[3]).toBe(0)
  })

  it('vytíženost 0 vypne lajnu — nehraje v rotaci', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    let stav = zacniZapas(domaci, hoste)
    stav.domaci.vytizeniUtoku = [1, 1, 1, 0]
    expect(normalizujVytizeniUtoku([1, 1, 1, 0])[3]).toBe(0)
    for (let m = 1; m <= 30; m++) {
      expect(aktivniLajnyEven(stav.domaci, m).index).not.toBe(3)
    }
    const rng = createRng(55)
    for (let i = 0; i < 15; i++) stav = simulujMinutu(stav, domaci, hoste, rng)
    expect(stav.domaci.casNaLeduUtoku![3]).toBe(0)
  })

  it('nízká vytíženost = méně minut na ledě než vysoká', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    const rngNizka = createRng(88)
    const rngVysoka = createRng(88)
    let nizka = zacniZapas(domaci, hoste)
    let vysoka = zacniZapas(domaci, hoste)
    nizka.domaci.vytizeniUtoku = [0.5, 1, 1, 1]
    vysoka.domaci.vytizeniUtoku = [2, 1, 1, 1]
    for (let i = 0; i < 20; i++) {
      nizka = simulujMinutu(nizka, domaci, hoste, rngNizka)
      vysoka = simulujMinutu(vysoka, domaci, hoste, rngVysoka)
    }
    expect(nizka.domaci.casNaLeduUtoku![0]).toBeLessThan(vysoka.domaci.casNaLeduUtoku![0])
  })

  it('prehledUtoku vrací energii všech lajn', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    const stav = zacniZapas(domaci, hoste)
    stav.domaci.energie[domaci.hraci[0].id] = 40
    const prehled = prehledUtoku(stav.domaci, 10)
    expect(prehled[0].energie).toBeLessThan(100)
    expect(prehled).toHaveLength(4)
  })

  it('simulace snižuje energii aktivní lajny víc než lavičky', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    const rng = createRng(42)
    let stav = zacniZapas(domaci, hoste)
    stav.domaci.vytizeniUtoku = [2, 1, 1, 1]
    for (let i = 0; i < 15; i++) stav = simulujMinutu(stav, domaci, hoste, rng)
    expect(energieUtokLajny(stav.domaci, 0)).toBeLessThan(energieUtokLajny(stav.domaci, 3))
  })

  it('vyšší vytíženost = víc minut na ledě', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    const rng = createRng(99)
    let stav = zacniZapas(domaci, hoste)
    stav.domaci.vytizeniUtoku = [2, 1, 1, 1]
    for (let i = 0; i < 20; i++) stav = simulujMinutu(stav, domaci, hoste, rng)
    expect(stav.domaci.casNaLeduUtoku![0]).toBeGreaterThan(stav.domaci.casNaLeduUtoku![3])
  })

  it('nejlepsiPetkaPP preferuje svěží lajny', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    const stav = zacniZapas(domaci, hoste)
    for (const id of stav.domaci.sestava.utoky[0]) nastavEnergiu(stav.domaci, id, 20)
    const petka = nejlepsiPetkaPP(stav.domaci)
    expect(petka.index).not.toBe(0)
    expect(energiePetky(stav.domaci, petka)).toBeGreaterThan(20)
  })

  it('energie může klesnout na nulu', () => {
    const stav = zacniZapas(miniTym('dom'), miniTym('host'))
    const id = stav.domaci.sestava.utoky[0][0]
    nastavEnergiu(stav.domaci, id, -10)
    expect(stav.domaci.energie[id]).toBe(0)
  })

  it('vytěžená lajna koncem zápasu výrazně vyčerpá energii', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    for (const id of domaci.sestava.utoky[0]) {
      domaci.hraci.find((h) => h.id === id)!.atributy.vydrz = 1
    }
    let stav = zacniZapas(domaci, hoste)
    stav.domaci.vytizeniUtoku = [2, 0.5, 0.5, 0.5]
    stav = simulujDoKonce(stav, domaci, hoste, createRng(777))
    expect(energieUtokLajny(stav.domaci, 0)).toBeLessThan(energieUtokLajny(stav.domaci, 3))
    expect(energieUtokLajny(stav.domaci, 0)).toBeLessThan(15)
  })

  it('nekompletní pětka (zraněný) se nepočítá', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    const stav = zacniZapas(domaci, hoste)
    stav.domaci.zraneni.push(stav.domaci.sestava.utoky[0][0])
    expect(jePetkaKompletni(stav.domaci, { index: 0 })).toBe(false)
  })

  it('vyšší vytíženost 1. lajny zvyší útokovou sílu v simulaci', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    for (const id of domaci.sestava.utoky[0]) {
      const h = domaci.hraci.find((x) => x.id === id)!
      h.atributy.strelba = 92
      h.atributy.technika = 88
    }
    for (const id of domaci.sestava.utoky[3]) {
      const h = domaci.hraci.find((x) => x.id === id)!
      h.atributy.strelba = 45
      h.atributy.technika = 40
    }
    let stav = zacniZapas(domaci, hoste)
    stav.domaci.vytizeniUtoku = [2, 1, 1, 0.5]
    const hviezdy = silaStran(stav, domaci, hoste).domaci.utok
    stav.domaci.vytizeniUtoku = [0.5, 1, 1, 2]
    const udrzba = silaStran(stav, domaci, hoste).domaci.utok
    expect(hviezdy).toBeGreaterThan(udrzba)
  })

  it('vahyUtokuZVytizeni dá větší podíl vytěžené lajně', () => {
    const v = vahyUtokuZVytizeni([2, 1, 1, 0.5])
    expect(v[0]).toBeGreaterThan(v[3])
    expect(v.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('vyšší vytíženost 1. lajny zvyšuje šanci domácích vyhrát', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    for (const id of domaci.sestava.utoky[0]) {
      const h = domaci.hraci.find((x) => x.id === id)!
      h.atributy.strelba = 92
      h.atributy.technika = 88
    }
    for (const id of domaci.sestava.utoky[3]) {
      const h = domaci.hraci.find((x) => x.id === id)!
      h.atributy.strelba = 45
      h.atributy.technika = 40
    }
    let vyhryHviezdy = 0
    let vyhryUdrzba = 0
    for (let seed = 0; seed < 40; seed++) {
      const rng = createRng(seed)
      let stav = zacniZapas(domaci, hoste)
      stav.domaci.vytizeniUtoku = [2, 1, 1, 0.5]
      stav = simulujDoKonce(stav, domaci, hoste, rng)
      if (stav.domaci.goly > stav.hoste.goly) vyhryHviezdy++
      stav = zacniZapas(domaci, hoste)
      stav.domaci.vytizeniUtoku = [0.5, 1, 1, 2]
      stav = simulujDoKonce(stav, domaci, hoste, createRng(seed + 10_000))
      if (stav.domaci.goly > stav.hoste.goly) vyhryUdrzba++
    }
    expect(vyhryHviezdy).toBeGreaterThan(vyhryUdrzba)
  })

  it('žeton trenéra sníží počet a nastaví bonus', () => {
    const domaci = miniTym('dom')
    const hoste = miniTym('host')
    let stav = zacniZapas(domaci, hoste)
    stav.minuta = 5
    stav = pouzijZetonTrenera(stav, 'domaci')
    expect(stav.domaci.zbyvajiciZetony).toBe(2)
    expect(stav.domaci.bonusDalsiSance).toBe(0.15)
  })
})
