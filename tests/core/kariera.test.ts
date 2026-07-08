import { describe, expect, it } from 'vitest'
import {
  jeDerby,
  odmitniNabidky,
  poMemZapase,
  prijmiNabidku,
  prumernyOverall,
  urciCilSezony,
  vyhazov,
} from '../../src/core/kariera'
import { newGame } from '../../src/core/sezona'
import type { CekajiciZapas, GameState, Vysledek } from '../../src/core/types'

const vysledek = (gd: number, gh: number, prodlouzeni = false): Vysledek => ({
  golyDomaci: gd,
  golyHoste: gh,
  strelyDomaci: 30,
  strelyHoste: 30,
  prodlouzeni,
  najezdy: false,
  udalosti: [],
  energie: {},
  hodnoceni: {},
})

const cz = (domaci: string, hoste: string, derby = false): CekajiciZapas => ({
  domaci,
  hoste,
  derby,
  playoff: null,
})

describe('jeDerby', () => {
  it('je symetrické a platí pro dvojice z dat', () => {
    expect(jeDerby('sparta', 'slavia')).toBe(true)
    expect(jeDerby('slavia', 'sparta')).toBe(true)
    expect(jeDerby('sparta', 'tabor')).toBe(false)
  })
})

describe('urciCilSezony', () => {
  const s = newGame(7, 'tabor')
  it('nejsilnější klub extraligy má titul, nejsilnější 2. ligy postup', () => {
    for (const uroven of [0, 2]) {
      const liga = s.ligy[uroven]
      const nejsilnejsi = [...liga.tymy].sort((a, b) => prumernyOverall(s, b) - prumernyOverall(s, a))[0]
      const cil = urciCilSezony(s, nejsilnejsi)
      expect(cil.typ).toBe(uroven === 0 ? 'titul' : 'postup')
      expect(cil.popis.length).toBeGreaterThan(5)
    }
  })
  it('nejslabší klub má záchranu', () => {
    const liga = s.ligy[2]
    const nejslabsi = [...liga.tymy].sort((a, b) => prumernyOverall(s, a) - prumernyOverall(s, b))[0]
    expect(urciCilSezony(s, nejslabsi).typ).toBe('zachrana')
  })
  it('newGame nastavuje skutečný cíl (ne placeholder)', () => {
    expect(s.cilSezony.popis).not.toContain('Dočasný')
  })
})

describe('poMemZapase', () => {
  const zaklad = (): GameState => structuredClone(newGame(7, 'tabor'))
  it('výhra zvedne důvěru i náladu, kariéra počítá', () => {
    const s = zaklad()
    poMemZapase(s, vysledek(4, 1), cz('tabor', 'decin'))
    expect(s.trener.duvera).toBeGreaterThan(50)
    expect(s.naladaFanousku).toBe(54)
    expect(s.trener.kariera.zapasy).toBe(1)
    expect(s.trener.kariera.vyhry).toBe(1)
  })
  it('derby má dvojnásobný dopad', () => {
    const a = zaklad()
    const b = zaklad()
    poMemZapase(a, vysledek(1, 3), cz('tabor', 'decin'))
    poMemZapase(b, vysledek(1, 3), cz('tabor', 'budejovice', true)) // rival z dat
    expect(50 - b.naladaFanousku).toBe((50 - a.naladaFanousku) * 2)
  })
  it('pád důvěry na 0 spustí vyhazov s nabídkami', () => {
    const s = zaklad()
    s.trener.duvera = 2
    poMemZapase(s, vysledek(0, 5), cz('tabor', 'decin'))
    expect(s.trener.duvera).toBe(0)
    expect(s.nabidky).not.toBeNull()
    expect(s.nabidky!.length).toBeGreaterThanOrEqual(1)
    expect(s.nabidky!.length).toBeLessThanOrEqual(3)
    expect(s.nabidky).not.toContain('tabor')
  })
})

describe('vyhazov a nabídky', () => {
  it('nabízí slabší kluby a přijetí přepne klub', () => {
    const s = structuredClone(newGame(7, 'sparta'))
    vyhazov(s)
    expect(s.nabidky!.length).toBe(3)
    for (const id of s.nabidky!) {
      expect(prumernyOverall(s, id)).toBeLessThan(prumernyOverall(s, 'sparta'))
    }
    const po = prijmiNabidku(s, s.nabidky![0])
    expect(po.mujKlubId).toBe(s.nabidky![0])
    expect(po.trener.duvera).toBe(50)
    expect(po.nabidky).toBeNull()
    expect(po.cilSezony.popis).not.toContain('Dočasný')
  })
  it('odmítnutí ukončí kariéru', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    vyhazov(s)
    const po = odmitniNabidky(s)
    expect(po.konecKariery).toBe(true)
    expect(po.nabidky).toBeNull()
  })
  it('přijetí neexistující nabídky hází chybu', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    expect(() => prijmiNabidku(s, 'sparta')).toThrow()
  })
  it('převzetí klubu resetuje sponzora, trh i otázku médií', () => {
    const s = structuredClone(newGame(7, 'sparta'))
    s.nabidkyProdeje = [{ hracId: 'x', denOd: 1 }]
    s.prichoziNabidka = { hracId: 'x', klubId: 'kometa', castka: 1 }
    s.otazkaMedii = { text: 'q', moznosti: [{ text: 'a', efektMoralka: 1, efektNalada: 1, riskantni: false }] }
    vyhazov(s)
    const po = prijmiNabidku(s, s.nabidky![0])
    expect(po.sponzorNabidka).toBe(true)
    expect(po.nabidkyProdeje).toEqual([])
    expect(po.prichoziNabidka).toBeNull()
    expect(po.otazkaMedii).toBeNull()
    const novaLiga = po.ligy.find((l) => l.tymy.includes(po.mujKlubId))!
    expect(po.sponzor.mesicne).toBe(0)
  })
})
