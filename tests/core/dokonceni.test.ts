import { describe, expect, it } from 'vitest'
import { createRng } from '../../src/core/rng'
import { denKola, POCET_KOL } from '../../src/core/rozpis'
import { advanceDay, atmosferaZapasu, dokonciZapas, mojeLiga, newGame } from '../../src/core/sezona'
import { prijmiNabidku } from '../../src/core/kariera'
import { prevedNaVysledek, simulujDoKonce, zacniZapas } from '../../src/core/zapas'
import type { GameState } from '../../src/core/types'

const kMemuZapasu = (seed: number): GameState => {
  let s = newGame(seed, 'tabor')
  while (!s.cekajiciZapas) s = advanceDay(s)
  return s
}

describe('cekajiciZapas', () => {
  it('advanceDay s čekajícím zápasem hází chybu', () => {
    const s = kMemuZapasu(5)
    expect(() => advanceDay(s)).toThrow()
  })
  it('dokonciZapas zapíše výsledek, statistiky a uvolní kalendář', () => {
    const s = kMemuZapasu(5)
    const cz = s.cekajiciZapas!
    const domaci = s.tymy[cz.domaci]
    const hoste = s.tymy[cz.hoste]
    const rng = createRng(77)
    const stav = simulujDoKonce(zacniZapas(domaci, hoste), domaci, hoste, rng)
    const po = dokonciZapas(s, stav)
    expect(po.cekajiciZapas).toBeNull()
    expect(po.posledniZapas).not.toBeNull()
    const zapas = mojeLiga(po).zapasy.find((z) => z.den === po.den && (z.domaci === 'tabor' || z.hoste === 'tabor'))!
    expect(zapas.vysledek).not.toBeNull()
    const goly = stav.udalosti.filter((u) => u.typ === 'gol' && u.hracId)
    const vsichniHraci = [...po.tymy[cz.domaci].hraci, ...po.tymy[cz.hoste].hraci]
    const nastrileno = vsichniHraci.reduce((sum, h) => sum + h.goly, 0)
    expect(nastrileno).toBeGreaterThanOrEqual(Math.min(1, goly.length)) // statistiky se připsaly
    expect(advanceDay(po).den).toBe(po.den + 1) // kalendář zase běží
  })
  it('dokonciZapas odmítne nedohraný zápas', () => {
    const s = kMemuZapasu(5)
    const cz = s.cekajiciZapas!
    const stav = zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste])
    expect(() => dokonciZapas(s, stav)).toThrow()
  })
  it('bez čekajícího zápasu dokonciZapas hází chybu', () => {
    const s = newGame(5, 'tabor')
    const stav = zacniZapas(s.tymy.tabor, s.tymy.decin)
    expect(() => dokonciZapas(s, stav)).toThrow()
  })
})

describe('přechod do playoff', () => {
  const dohrajMujZapasHelper = (s: GameState): GameState => {
    const cz = s.cekajiciZapas!
    const stav = simulujDoKonce(
      zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
      s.tymy[cz.domaci],
      s.tymy[cz.hoste],
      createRng(900 + s.den),
    )
    return dokonciZapas(s, stav)
  }
  it('playoff se nenasadí, dokud můj poslední zápas základní části není dohraný', () => {
    let s = newGame(7, 'tabor')
    while (s.den < denKola(POCET_KOL)) {
      s = s.nabidky ? prijmiNabidku(s, s.nabidky[0]) : s.cekajiciZapas ? dohrajMujZapasHelper(s) : advanceDay(s)
    }
    // den posledního kola: můj zápas čeká, playoff ještě neexistuje
    expect(s.faze).toBe('zakladniCast')
    expect(s.cekajiciZapas).not.toBeNull()
    for (const l of s.ligy) expect(l.playoff).toBeNull()
    s = dohrajMujZapasHelper(s)
    expect(s.faze).toBe('playoff')
    for (const l of s.ligy) expect(l.playoff?.kola[0]).toHaveLength(4)
  })
})

describe('playoff přes dokonciZapas', () => {
  it('celá sezóna včetně mého playoff doběhne', () => {
    let s = newGame(9, 'tabor')
    let pojistka = 0
    let hranychPlayoff = 0
    while (s.faze !== 'konecSezony' && pojistka++ < 400) {
      if (s.nabidky) {
        s = prijmiNabidku(s, s.nabidky[0])
      } else if (s.cekajiciZapas) {
        if (s.cekajiciZapas.playoff) hranychPlayoff++
        const cz = s.cekajiciZapas
        const stav = simulujDoKonce(
          zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
          s.tymy[cz.domaci],
          s.tymy[cz.hoste],
          createRng(500 + s.den),
        )
        s = dokonciZapas(s, stav)
      } else {
        s = advanceDay(s)
      }
    }
    expect(s.faze).toBe('konecSezony')
    for (const l of s.ligy) expect(l.playoff?.vitez).toBeTruthy()
    // tabor je v playoff jen když se kvalifikuje — ale sezóna musí doběhnout vždy
  })
})

describe('atmosferaZapasu', () => {
  it('odvozuje se z nálady fanoušků', () => {
    const s = newGame(1, 'tabor')
    expect(atmosferaZapasu(s)).toBe(0)
    s.naladaFanousku = 80
    expect(atmosferaZapasu(s)).toBe(6)
  })
})
