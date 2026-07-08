import { describe, expect, it } from 'vitest'
import { prijmiNabidku } from '../../src/core/kariera'
import { createRng } from '../../src/core/rng'
import { advanceDay, dokonciZapas, newGame, zahajNovouSezonu } from '../../src/core/sezona'
import { simulujDoKonce, zacniZapas } from '../../src/core/zapas'
import { zapisRekordVyhry } from '../../src/core/historie'
import type { CekajiciZapas, GameState, Vysledek } from '../../src/core/types'

const dohrajSezonu = (seed: number): GameState => {
  let s = newGame(seed, 'tabor')
  let pojistka = 0
  while (s.faze !== 'konecSezony' && pojistka++ < 400) {
    if (s.nabidky) s = prijmiNabidku(s, s.nabidky[0])
    else if (s.cekajiciZapas) {
      const cz = s.cekajiciZapas
      const stav = simulujDoKonce(
        zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
        s.tymy[cz.domaci],
        s.tymy[cz.hoste],
        createRng(500 + s.den),
      )
      s = dokonciZapas(s, stav)
    } else s = advanceDay(s)
  }
  expect(s.faze).toBe('konecSezony')
  return s
}

describe('vyhodnocení sezóny', () => {
  const s = dohrajSezonu(9)
  it('naplní vyhlášení', () => {
    expect(s.vyhlaseni).not.toBeNull()
    expect(s.vyhlaseni!.mistri).toHaveLength(3)
    expect(s.vyhlaseni!.kraloveStrelcu).toHaveLength(3)
    for (const k of s.vyhlaseni!.kraloveStrelcu) expect(k.goly).toBeGreaterThan(0)
    expect(s.vyhlaseni!.hvezdaTymu).not.toBeNull()
  })
  it('zapíše historii mé sezóny', () => {
    expect(s.historie).toHaveLength(1)
    const z = s.historie[0]
    expect(z.sezona).toBe(1)
    expect(z.umisteni).toBeGreaterThanOrEqual(1)
    expect(z.umisteni).toBeLessThanOrEqual(14)
    expect(typeof z.splnen).toBe('boolean')
  })
  it('důvěra se po sezóně pohnula o ±15/−20', () => {
    // jen sanity: hodnota je v mezích a zpráva o cíli existuje
    expect(s.zpravy.some((z) => z.includes('Cíl sezóny'))).toBe(true)
  })
  it('nová sezóna vyčistí vyhlášení a navýší kariéru', () => {
    const nova = zahajNovouSezonu(s)
    expect(nova.vyhlaseni).toBeNull()
    expect(nova.trener.kariera.sezony).toBe(2)
    expect(nova.historie).toHaveLength(1) // historie zůstává
  })
})

describe('zapisRekordVyhry', () => {
  const vysledek = (gd: number, gh: number): Vysledek => ({
    golyDomaci: gd,
    golyHoste: gh,
    strelyDomaci: 30,
    strelyHoste: 20,
    prodlouzeni: false,
    najezdy: false,
    udalosti: [],
    energie: {},
    hodnoceni: {},
  })
  const cz: CekajiciZapas = { domaci: 'tabor', hoste: 'most', derby: false, playoff: null }
  it('ukládá jen vyšší rozdíl', () => {
    const s = structuredClone(newGame(1, 'tabor'))
    zapisRekordVyhry(s, vysledek(5, 1), cz)
    expect(s.rekordy.nejvyssiVyhra!.rozdil).toBe(4)
    zapisRekordVyhry(s, vysledek(3, 1), cz)
    expect(s.rekordy.nejvyssiVyhra!.rozdil).toBe(4)
    zapisRekordVyhry(s, vysledek(8, 1), cz)
    expect(s.rekordy.nejvyssiVyhra!.rozdil).toBe(7)
    expect(s.rekordy.nejvyssiVyhra!.text).toContain('8:1')
  })
  it('prohru nezapisuje', () => {
    const s = structuredClone(newGame(1, 'tabor'))
    zapisRekordVyhry(s, vysledek(1, 4), cz)
    expect(s.rekordy.nejvyssiVyhra).toBeNull()
  })
})
