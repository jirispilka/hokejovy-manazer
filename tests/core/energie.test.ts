import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import type { Klub, Tym } from '../../src/core/types'
import {
  autoNahrada,
  osobniProslov,
  pokracujPoPauze,
  prevedNaVysledek,
  simulujDoKonce,
  simulujMinutu,
  upravSestavuVZapase,
  vymenHraceVZapase,
  zacniZapas,
} from '../../src/core/zapas'
import { vymenVSestave } from '../../src/core/sestava'

const tym = (id: string, seed: number, zakladId: number): Tym => {
  resetIdCitac(zakladId)
  return generujTym(createRng(seed), { id, nazev: id, liga: 1 } as Klub)
}
const sVydrzi = (t: Tym, vydrz: number): Tym => ({
  ...t,
  hraci: t.hraci.map((h) => ({ ...h, atributy: { ...h.atributy, vydrz } })),
})

const doPauzy = (d: Tym, h: Tym, seed: number) => {
  const rng = createRng(seed)
  let stav = zacniZapas(d, h)
  while (stav.faze === 'hraje') {
    if (stav.cekaNaNahradu) stav = autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? d : h)
    else stav = simulujMinutu(stav, d, h, rng)
  }
  if (stav.cekaNaNahradu) stav = autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? d : h)
  return { stav, rng }
}

describe('energie', () => {
  it('klesá hraním a výdrž rozhoduje o tempu', () => {
    const slabi = sVydrzi(tym('x', 1, 0), 10)
    const silni = sVydrzi(tym('y', 2, 1000), 99)
    const { stav } = doPauzy(slabi, silni, 7)
    const prvniSlaby = stav.domaci.sestava.utoky[0][0]
    const prvniSilny = stav.hoste.sestava.utoky[0][0]
    expect(stav.domaci.energie[prvniSlaby]).toBeLessThan(stav.hoste.energie[prvniSilny])
    expect(stav.domaci.energie[prvniSlaby]).toBeLessThan(98)
  })
  it('náhradníci energii neztrácejí a pauza vrací +5 (ne plný reset)', () => {
    const d = tym('x', 1, 0)
    const h = tym('y', 2, 1000)
    const { stav } = doPauzy(d, h, 7)
    const vSestave = new Set([...stav.domaci.sestava.utoky.flat(), ...stav.domaci.sestava.obrany.flat()])
    const nahradnik = d.hraci.find((x) => x.pozice === 'U' && !vSestave.has(x.id) && !stav.domaci.zraneni.includes(x.id))
    if (nahradnik) expect(stav.domaci.energie[nahradnik.id]).toBe(100)
    const hracVSestave = stav.domaci.sestava.utoky[0][0]
    const pred = stav.domaci.energie[hracVSestave]
    expect(pred).toBeLessThan(98)
    const po = pokracujPoPauze(stav)
    expect(po.domaci.energie[hracVSestave]).toBeCloseTo(Math.min(100, pred + 5), 5)
    expect(po.domaci.energie[hracVSestave]).toBeLessThan(100)
  })
})

describe('hodnocení', () => {
  it('střelec gólu dostane bonus, hodnocení v mezích 4–10', () => {
    const d = tym('x', 1, 0)
    const h = tym('y', 2, 1000)
    const stav = simulujDoKonce(zacniZapas(d, h), d, h, createRng(11))
    const gol = stav.udalosti.find((u) => u.typ === 'gol' && u.hracId)
    if (gol) expect(stav.domaci.hodnoceni[gol.hracId!] ?? stav.hoste.hodnoceni[gol.hracId!]).toBeGreaterThan(6)
    for (const hod of [...Object.values(stav.domaci.hodnoceni), ...Object.values(stav.hoste.hodnoceni)]) {
      expect(hod).toBeGreaterThanOrEqual(4)
      expect(hod).toBeLessThanOrEqual(10)
    }
  })
  it('rozhodující nájezd zvedne střelci hodnocení', () => {
    let nalezeno = false
    for (let seed = 0; seed < 200 && !nalezeno; seed++) {
      const d = tym('x', 1, 0)
      const h = tym('y', 2, 1000)
      const stav = simulujDoKonce(zacniZapas(d, h), d, h, createRng(seed))
      if (!stav.najezdy) continue
      const gol = [...stav.udalosti].reverse().find((u) => u.typ === 'gol')!
      const hodnoceni = stav.domaci.hodnoceni[gol.hracId!] ?? stav.hoste.hodnoceni[gol.hracId!]
      if (hodnoceni > 6) nalezeno = true
    }
    expect(nalezeno).toBe(true)
  })
  it('prevedNaVysledek nese energie a hodnocení obou týmů', () => {
    const d = tym('x', 1, 0)
    const h = tym('y', 2, 1000)
    const stav = simulujDoKonce(zacniZapas(d, h), d, h, createRng(3))
    const v = prevedNaVysledek(stav)
    expect(Object.keys(v.energie).length).toBe(d.hraci.length + h.hraci.length)
    expect(v.hodnoceni[d.hraci[0].id]).toBeDefined()
  })
})

describe('osobní proslov', () => {
  it('jde jen v pauze a max 1× na hráče', () => {
    const d = tym('x', 1, 0)
    const h = tym('y', 2, 1000)
    const { stav, rng } = doPauzy(d, h, 7)
    const hrac = stav.domaci.sestava.utoky[0][0]
    expect(() => osobniProslov(zacniZapas(d, h), 'domaci', d, hrac, 'povzbudit', rng)).toThrow()
    const po = osobniProslov(stav, 'domaci', d, hrac, 'povzbudit', rng)
    expect(po.domaci.osobniProslovPouzit === undefined).toBe(false)
    expect(po.domaci.osobniProslovPouzit).toContain(hrac)
    expect(po.udalosti.some((u) => u.typ === 'proslov' && u.hracId === hrac)).toBe(true)
    expect(() => osobniProslov(po, 'domaci', d, hrac, 'zdrbat', rng)).toThrow()
  })
})

describe('úprava lajn v zápase', () => {
  it('prohodí hráče, resetuje chemii jen v zápase; mimo pozici sníží chemii', () => {
    const d = tym('x', 1, 0)
    const h = tym('y', 2, 1000)
    const { stav } = doPauzy(d, h, 7)
    const puvodniChemie = [...stav.domaci.chemie.petky]
    const a = stav.domaci.sestava.utoky[0][0]
    const b = stav.domaci.sestava.utoky[1][0]
    const po = upravSestavuVZapase(stav, 'domaci', d, vymenVSestave(stav.domaci.sestava, a, b))
    expect(po.domaci.sestava.utoky[0][0]).toBe(b)
    expect(po.domaci.chemie.petky[0]).toBe(30)
    expect(po.domaci.chemie.petky[2]).toBe(puvodniChemie[2])
    expect(d.chemie.petky[0]).toBe(30) // klubová chemie nedotčena (start je 30, hlavně: tym nemutován)
    const obrance = d.hraci.find((x) => x.pozice === 'D')!
    const spatna = vymenVSestave(stav.domaci.sestava, a, obrance.id)
    const poSpatne = upravSestavuVZapase(stav, 'domaci', d, spatna)
    expect(poSpatne.domaci.sestava.utoky.flat()).toContain(obrance.id)
    expect(poSpatne.domaci.chemie.petky[0]).toBeLessThan(30)
  })
  it('mimo pauzu hází chybu', () => {
    const d = tym('x', 1, 0)
    const h = tym('y', 2, 1000)
    const stav = zacniZapas(d, h)
    expect(() => upravSestavuVZapase(stav, 'domaci', d, stav.domaci.sestava)).toThrow()
  })
  it('vymenHraceVZapase funguje během hry a dosadí náhradníka', () => {
    const d = tym('x', 1, 0)
    const h = tym('y', 2, 1000)
    let stav = zacniZapas(d, h)
    stav.minuta = 15
    const zraneny = stav.domaci.sestava.utoky[0][0]
    stav.domaci.zraneni.push(zraneny)
    const nahradnik = d.hraci.find((x) => x.pozice === 'U' && !stav.domaci.sestava.utoky.flat().includes(x.id))!
    const po = vymenHraceVZapase(stav, 'domaci', d, zraneny, nahradnik.id)
    expect(po.domaci.sestava.utoky[0][0]).toBe(nahradnik.id)
    expect(po.udalosti.some((u) => u.text.includes('Střídání'))).toBe(true)
  })
  it('zraněný usazený v sestavě neblokuje výměnu zdravých', () => {
    const d = tym('x', 1, 0)
    const h = tym('y', 2, 1000)
    // simuluj „uvízlého" zraněného z minulého zápasu: první útočník sestavy má zranenZapasu
    const uvizly = d.hraci.find((x) => x.id === d.sestava.utoky[0][0])!
    uvizly.zranenZapasu = 2
    const { stav } = doPauzy(d, h, 7)
    const a = stav.domaci.sestava.utoky[1][0]
    const b = stav.domaci.sestava.utoky[2][0]
    const po = upravSestavuVZapase(stav, 'domaci', d, vymenVSestave(stav.domaci.sestava, a, b))
    expect(po.domaci.sestava.utoky[1][0]).toBe(b)
    // ale zraněný náhradník do sestavy nesmí
    const vSestave = new Set([...stav.domaci.sestava.utoky.flat(), ...stav.domaci.sestava.obrany.flat()])
    const zranenyNahradnik = d.hraci.find((x) => x.pozice === 'U' && !vSestave.has(x.id))!
    zranenyNahradnik.zranenZapasu = 1
    expect(() =>
      upravSestavuVZapase(stav, 'domaci', d, vymenVSestave(stav.domaci.sestava, a, zranenyNahradnik.id)),
    ).toThrow(/zraněný/)
  })
})
