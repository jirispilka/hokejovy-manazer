import { describe, expect, it } from 'vitest'
import { prijmiNabidku } from '../../src/core/kariera'
import { createRng } from '../../src/core/rng'
import { potvrdTreninkovyPlan } from '../../src/core/trenink'
import { advanceDay, dokonciZapas, newGame, zahajNovouSezonu } from '../../src/core/sezona'
import { simulujDoKonce, zacniZapas } from '../../src/core/zapas'
import type { GameState, Hrac } from '../../src/core/types'

const krok = (s: GameState): GameState => {
  if (s.nabidky) return prijmiNabidku(s, s.nabidky[0])
  if (!s.cekajiciZapas) return advanceDay(s)
  const cz = s.cekajiciZapas
  const stav = simulujDoKonce(
    zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
    s.tymy[cz.domaci],
    s.tymy[cz.hoste],
    createRng(700 + s.den),
  )
  return dokonciZapas(s, stav)
}

const souctyAtributu = (h: Hrac) => Object.values(h.atributy).reduce((a, b) => a + b, 0)

describe('odehranoSezona a růst hraním', () => {
  it('hráč v sestavě sbírá zápasy a mladík s prostorem roste po 5. zápase', () => {
    let s = potvrdTreninkovyPlan(newGame(21, 'tabor'), {})
    // vyber mladíka v sestavě a zaruč mu prostor růstu
    const tym = s.tymy.tabor
    const vSestave = new Set([...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat()])
    const mladik = tym.hraci.find((h) => vSestave.has(h.id) && h.vek <= 23)
    // když v sestavě mladík není, prohoď nejmladšího útočníka do 1. lajny? — jednodušší: uprav věk hráče 1. lajny
    const cil = mladik ?? tym.hraci.find((h) => h.id === tym.sestava.utoky[0][0])!
    cil.vek = 20
    cil.potencial = 99
    const pred = souctyAtributu(cil)
    let pojistka = 0
    while (s.tymy.tabor.hraci.find((h) => h.id === cil.id)!.odehranoSezona < 5 && pojistka++ < 40) {
      s = krok(s)
    }
    const po = s.tymy.tabor.hraci.find((h) => h.id === cil.id)!
    expect(po.odehranoSezona).toBe(5)
    expect(souctyAtributu(po)).toBe(pred + 1)
  })
  it('náhradník mimo sestavu zápasy nesbírá', () => {
    let s = potvrdTreninkovyPlan(newGame(21, 'tabor'), {})
    const tym = s.tymy.tabor
    const vSestave = new Set([...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat(), tym.sestava.brankar])
    const nahradnik = tym.hraci.find((h) => !vSestave.has(h.id))!
    for (let i = 0; i < 8; i++) s = krok(s)
    expect(s.tymy.tabor.hraci.find((h) => h.id === nahradnik.id)!.odehranoSezona).toBe(0)
  })
  it('únava po zápase odpovídá energii (ne paušál 15)', () => {
    let s = potvrdTreninkovyPlan(newGame(21, 'tabor'), {})
    while (!s.cekajiciZapas) s = advanceDay(s)
    const cz = s.cekajiciZapas!
    const stav = simulujDoKonce(
      zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
      s.tymy[cz.domaci],
      s.tymy[cz.hoste],
      createRng(9),
    )
    const hracId = stav.domaci.sestava.utoky[0][0]
    const energie = stav.domaci.energie[hracId]
    const po = dokonciZapas(s, stav)
    const hrac = po.tymy[cz.domaci].hraci.find((h) => h.id === hracId)!
    expect(hrac.unava).toBe(Math.min(100, Math.round((100 - energie) / 4)))
  })
})

describe('nová sezóna', () => {
  it('resetuje odehranoSezona všem', () => {
    let s = newGame(22, 'tabor')
    let pojistka = 0
    while (s.faze !== 'konecSezony' && pojistka++ < 400) s = krok(s)
    if (s.nabidky) s = prijmiNabidku(s, s.nabidky[0])
    const nova = zahajNovouSezonu(s)
    for (const t of Object.values(nova.tymy)) {
      for (const h of t.hraci) expect(h.odehranoSezona).toBe(0)
    }
  }, 20000) // celá sezóna simulovaná krok po kroku — CPU náročné pod paralelní zátěží celé sady
})
