import { describe, expect, it } from 'vitest'
import { mesicniCashflow } from '../../src/core/finance'
import { prijmiNabidku } from '../../src/core/kariera'
import { advanceDay, dokonciZapas, newGame, zahajNovouSezonu } from '../../src/core/sezona'
import { simulujDoKonce, zacniZapas } from '../../src/core/zapas'
import { createRng as rngPro } from '../../src/core/rng'
import type { GameState } from '../../src/core/types'

const dohrajMujZapas = (s: GameState): GameState => {
  const cz = s.cekajiciZapas!
  const domaci = s.tymy[cz.domaci]
  const hoste = s.tymy[cz.hoste]
  const rng = rngPro(1000 + s.den)
  const stav = simulujDoKonce(zacniZapas(domaci, hoste), domaci, hoste, rng)
  return dokonciZapas(s, stav)
}

const dohraj = (s: GameState): GameState => {
  let pojistka = 0
  while (s.faze !== 'konecSezony' && pojistka++ < 400) {
    s = s.nabidky ? prijmiNabidku(s, s.nabidky[0]) : s.cekajiciZapas ? dohrajMujZapas(s) : advanceDay(s)
  }
  return s
}

describe('M5 ekonomika', () => {
  it('mesicniCashflow vrací rozpad příjmů a výdajů', () => {
    const s = newGame(1, 'tabor')
    const cf = mesicniCashflow(s)
    expect(cf.prijmy).toBe(cf.sponzor + cf.stadion + cf.marketing)
    expect(cf.vydaje).toBe(cf.platy)
    expect(cf.bilance).toBe(cf.prijmy - cf.vydaje)
    expect(cf.dnuDoUzaverky).toBeGreaterThan(0)
  })

  it('nová sezóna nedoplní rozpočet na startovní minimum', () => {
    const konec = dohraj(newGame(99, 'tabor'))
    konec.tymy[konec.mujKlubId].rozpocet = 500_000
    const nova = zahajNovouSezonu(konec)
    expect(nova.tymy[nova.mujKlubId].rozpocet).toBe(500_000)
  })
})
