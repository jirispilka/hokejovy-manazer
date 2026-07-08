import { describe, expect, it } from 'vitest'
import { createRng } from '../../src/core/rng'
import { overall } from '../../src/core/sestava'
import { newGame } from '../../src/core/sezona'
import {
  cenaProdeje,
  faktorOchoty,
  hodnotaHrace,
  kupHrace,
  MINIMA,
  odhadPotencialu,
  pocetNaPozici,
  pozadovanaCena,
  prodajHrace,
  rngProdeje,
  trhTick,
} from '../../src/core/prestupy'
import type { GameState } from '../../src/core/types'

const celkovePenize = (s: GameState) =>
  Object.values(s.tymy).reduce((sum, t) => sum + t.rozpocet, 0)

describe('hodnotaHrace a odhad', () => {
  const s = newGame(7, 'tabor')
  it('odpovídá vzorci a je na 10 tisíce', () => {
    const h = { ...s.tymy.sparta.hraci[0], trzniCena: undefined }
    const o = overall(h)
    const faktor = h.vek <= 21 ? 1.8 : h.vek <= 25 ? 1.4 : h.vek <= 29 ? 1.0 : h.vek <= 32 ? 0.6 : 0.35
    const cekana = Math.round((o * o * 4000 * faktor * (1 + (h.forma - 50) / 200)) / 10000) * 10000
    expect(hodnotaHrace(h)).toBe(cekana)
  })
  it('preferuje importovanou tržní cenu a upraví ji podle formy', () => {
    const h = { ...s.tymy.sparta.hraci[0], trzniCena: 12_345_678, forma: 60 }
    expect(hodnotaHrace(h)).toBe(12_960_000)
  })
  it('odhad potenciálu je stabilní a obsahuje skutečnost', () => {
    const h = s.tymy.sparta.hraci[3]
    const [lo, hi] = odhadPotencialu(h, s.seed)
    expect(odhadPotencialu(h, s.seed)).toEqual([lo, hi])
    expect(h.potencial).toBeGreaterThanOrEqual(lo)
    expect(h.potencial).toBeLessThanOrEqual(hi)
  })
})

describe('ceny přestupu', () => {
  const s = newGame(7, 'tabor')
  it('klíčový hráč je dražší', () => {
    const sparta = s.tymy.sparta
    const hvezda = [...sparta.hraci].sort((a, b) => overall(b) - overall(a))[0]
    const okraj = [...sparta.hraci].sort((a, b) => overall(a) - overall(b))[0]
    expect(faktorOchoty(sparta, hvezda.id)).toBe(1.3)
    expect(faktorOchoty(sparta, okraj.id)).toBe(0.95)
    expect(pozadovanaCena(s, 'sparta', hvezda.id)).toBeGreaterThan(hodnotaHrace(hvezda))
    expect(pozadovanaCena(s, 'sparta', okraj.id)).toBeLessThanOrEqual(hodnotaHrace(okraj) * 1.3)
  })
  it('prodej je 90 % hodnoty', () => {
    const h = s.tymy.tabor.hraci[0]
    expect(cenaProdeje(h)).toBe(Math.round((hodnotaHrace(h) * 0.9) / 10000) * 10000)
  })
})

describe('kupHrace', () => {
  it('přesune hráče, peníze i zvedne plat; zachovává celkové peníze', () => {
    let s = newGame(7, 'tabor')
    s.tymy.tabor.rozpocet = 200_000_000
    const pred = celkovePenize(s)
    const cil = s.tymy.decin.hraci.find((h) => h.pozice === 'U')!
    const cena = pozadovanaCena(s, 'decin', cil.id)
    const puvodniPlat = cil.plat
    const po = kupHrace(s, 'decin', cil.id)
    expect(po.tymy.tabor.hraci.some((h) => h.id === cil.id)).toBe(true)
    expect(po.tymy.decin.hraci.some((h) => h.id === cil.id)).toBe(false)
    const novy = po.tymy.tabor.hraci.find((h) => h.id === cil.id)!
    expect(novy.plat).toBe(Math.round((puvodniPlat * 1.1) / 1000) * 1000)
    expect(novy.forma).toBe(50)
    expect(po.tymy.tabor.rozpocet).toBe(200_000_000 - cena)
    expect(celkovePenize(po)).toBe(pred)
  })
  it('odmítne plnou soupisku, chudý klub a playoff', () => {
    const s = newGame(7, 'tabor')
    const cil = s.tymy.decin.hraci.find((h) => h.pozice === 'U')!
    const chudy = structuredClone(s)
    chudy.tymy.tabor.rozpocet = 0
    expect(() => kupHrace(chudy, 'decin', cil.id)).toThrow(/rozpočet/)
    const vPlayoff = structuredClone(s)
    vPlayoff.faze = 'playoff'
    vPlayoff.tymy.tabor.rozpocet = 200_000_000
    expect(() => kupHrace(vPlayoff, 'decin', cil.id)).toThrow(/playoff/i)
  })
  it('prodávající neklesne pod minimum pozice', () => {
    const s = newGame(7, 'tabor')
    s.tymy.tabor.rozpocet = 500_000_000
    const golman = s.tymy.decin.hraci.find((h) => h.pozice === 'G')!
    expect(() => kupHrace(s, 'decin', golman.id)).toThrow(/minimum/)
  })
})

describe('prodajHrace a trhTick', () => {
  it('okamžitě prodá hráče a převede peníze', () => {
    const s = newGame(7, 'tabor')
    const prodavany = s.tymy.tabor.hraci.filter((h) => h.pozice === 'U')[13]
    const pred = celkovePenize(s)
    const cena = cenaProdeje(prodavany)
    const mujPred = s.tymy.tabor.rozpocet
    const po = prodajHrace(s, prodavany.id, rngProdeje(s, prodavany.id))
    expect(po.tymy.tabor.hraci.some((h) => h.id === prodavany.id)).toBe(false)
    expect(po.tymy.tabor.rozpocet).toBe(mujPred + cena)
    expect(celkovePenize(po)).toBe(pred)
    expect(po.zpravy[0]).toContain('prodán')
  })
  it('hráč může prodat i pod minimum — varování v zprávách', () => {
    const s = newGame(7, 'tabor')
    const muj = s.tymy.tabor
    while (pocetNaPozici(muj, 'G') > MINIMA.G) {
      const g = muj.hraci.find((h) => h.pozice === 'G')!
      muj.hraci = muj.hraci.filter((h) => h.id !== g.id)
    }
    const posledni = muj.hraci.find((h) => h.pozice === 'G')!
    const po = prodajHrace(s, posledni.id, rngProdeje(s, posledni.id))
    expect(pocetNaPozici(po.tymy.tabor, 'G')).toBe(MINIMA.G - 1)
    expect(po.zpravy.some((z) => z.includes('Doplň soupisku'))).toBe(true)
  })
  it('AI↔AI přestup zachovává peníze, minima a cap', () => {
    let s = newGame(7, 'tabor')
    const pred = celkovePenize(s)
    let prevodu = 0
    for (let den = 1; den <= 60; den++) {
      const klon = structuredClone(s)
      klon.den++
      const zprav = klon.zpravy.length
      trhTick(klon, createRng(9000 + den))
      if (klon.zpravy.length > zprav && klon.zpravy[0].includes('Přestup v lize')) prevodu++
      s = klon
    }
    expect(prevodu).toBeGreaterThan(0)
    expect(celkovePenize(s)).toBe(pred)
    for (const t of Object.values(s.tymy)) {
      expect(t.hraci.length).toBeLessThanOrEqual(26)
      expect(t.hraci.filter((h) => h.pozice === 'U').length).toBeGreaterThanOrEqual(12)
      expect(t.hraci.filter((h) => h.pozice === 'D').length).toBeGreaterThanOrEqual(6)
      expect(t.hraci.filter((h) => h.pozice === 'G').length).toBeGreaterThanOrEqual(2)
    }
  })
  it('mimo okno trh spí', () => {
    const s = newGame(7, 'tabor')
    s.faze = 'playoff'
    s.nabidkyProdeje = [{ hracId: 'x', denOd: 1 }]
    const klon = structuredClone(s)
    trhTick(klon, createRng(1))
    expect(klon.nabidkyProdeje).toEqual([])
  })
})
