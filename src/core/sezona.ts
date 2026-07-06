import kluby from './data/kluby.json'
import { generujSvet } from './generator'
import { cekajiciSerie, domaciLedSerie, zalozPlayoff, zapisVysledekSerie } from './playoff'
import { createRng, hashSeed, randInt, type Rng } from './rng'
import { denKola, POCET_KOL, vytvorRozpis } from './rozpis'
import { overall, vychoziSestava } from './sestava'
import { simulujZapas } from './simulace'
import { spocitejTabulku } from './tabulka'
import type { Atributy, GameState, Klub, Liga, Tym, Vysledek } from './types'

const NAZVY_LIG = ['Extraliga', 'Chance liga', '2. liga']
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function newGame(seed: number, mujKlubId: string): GameState {
  const tymy = generujSvet(seed)
  const ligy: Liga[] = [0, 1, 2].map((uroven) => {
    const idKlubu = (kluby as Klub[]).filter((k) => k.liga === uroven).map((k) => k.id)
    return { uroven, nazev: NAZVY_LIG[uroven], tymy: idKlubu, zapasy: vytvorRozpis(idKlubu), playoff: null }
  })
  return {
    seed,
    sezona: 1,
    den: 0,
    faze: 'zakladniCast',
    mujKlubId,
    tymy,
    ligy,
    zpravy: [`Vítej na střídačce klubu ${tymy[mujKlubId].nazev}! Cíl: probojovat se do extraligy.`],
    posledniZapas: null,
  }
}

export const mojeLiga = (s: GameState): Liga => s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!

export function dalsiMujZapas(s: GameState): { den: number; domaci: string; hoste: string } | null {
  if (s.faze === 'zakladniCast') {
    const z = mojeLiga(s)
      .zapasy.filter((z) => !z.vysledek && (z.domaci === s.mujKlubId || z.hoste === s.mujKlubId))
      .sort((a, b) => a.den - b.den)[0]
    return z ? { den: z.den, domaci: z.domaci, hoste: z.hoste } : null
  }
  if (s.faze === 'playoff') {
    const playoff = mojeLiga(s).playoff
    if (!playoff || playoff.vitez) return null
    const moje = cekajiciSerie(playoff).find(
      ({ serie }) => serie.domaci === s.mujKlubId || serie.hoste === s.mujKlubId,
    )
    if (!moje) return null
    const domaci = domaciLedSerie(moje.serie)
    const hoste = domaci === moje.serie.domaci ? moje.serie.hoste : moje.serie.domaci
    return { den: s.den % 2 === 0 ? s.den + 2 : s.den + 1, domaci, hoste }
  }
  return null
}

function aplikujDopadyZapasu(rng: Rng, t: Tym, vyhra: boolean): void {
  t.moralka = clamp(t.moralka + (vyhra ? 3 : -3), 30, 70)
  // morálka ovlivňuje výkon nepřímo: táhne formu hráčů nahoru/dolů
  const bonusMoralky = t.moralka > 60 ? 1 : t.moralka < 40 ? -1 : 0
  const vSestave = new Set([...t.sestava.utoky.flat(), ...t.sestava.obrany.flat(), t.sestava.brankar])
  for (const h of t.hraci) {
    const drift = vyhra ? randInt(rng, -1, 3) : randInt(rng, -3, 1)
    h.forma = clamp(h.forma + drift + bonusMoralky, 30, 70)
    if (vSestave.has(h.id)) h.unava = Math.min(100, h.unava + 15)
  }
}

function odehrajZapas(s: GameState, domaciId: string, hosteId: string, poradi: number): Vysledek {
  const rng = createRng(hashSeed(s.seed, s.sezona, s.den, poradi))
  const domaci = s.tymy[domaciId]
  const hoste = s.tymy[hosteId]
  const v = simulujZapas(domaci, hoste, rng)
  for (const u of v.udalosti) {
    if (u.typ !== 'gol') continue
    for (const t of [domaci, hoste]) {
      const strelec = t.hraci.find((h) => h.id === u.hracId)
      if (strelec) strelec.goly++
      const asistent = t.hraci.find((h) => h.id === u.asistentId)
      if (asistent) asistent.asistence++
    }
  }
  const vyhralDomaci = v.golyDomaci > v.golyHoste
  aplikujDopadyZapasu(rng, domaci, vyhralDomaci)
  aplikujDopadyZapasu(rng, hoste, !vyhralDomaci)
  if (domaciId === s.mujKlubId || hosteId === s.mujKlubId) {
    s.posledniZapas = { den: s.den, domaci: domaciId, hoste: hosteId, vysledek: v }
    const dodatek = v.najezdy ? ' (sn)' : v.prodlouzeni ? ' (pp)' : ''
    s.zpravy.unshift(`${domaci.nazev} – ${hoste.nazev} ${v.golyDomaci}:${v.golyHoste}${dodatek}`)
  }
  return v
}

export function advanceDay(state: GameState): GameState {
  const s = structuredClone(state)
  s.den++
  // den odpočinku regeneruje únavu (před případným zápasem)
  for (const t of Object.values(s.tymy)) for (const h of t.hraci) h.unava = Math.max(0, h.unava - 10)

  if (s.faze === 'zakladniCast') {
    for (const liga of s.ligy) {
      liga.zapasy
        .filter((z) => z.den === s.den && !z.vysledek)
        .forEach((z, i) => {
          z.vysledek = odehrajZapas(s, z.domaci, z.hoste, liga.uroven * 100 + i)
        })
    }
    if (s.den >= denKola(POCET_KOL)) {
      s.faze = 'playoff'
      for (const liga of s.ligy) liga.playoff = zalozPlayoff(spocitejTabulku(liga.tymy, liga.zapasy))
      s.zpravy.unshift('Základní část skončila — začíná playoff!')
    }
  } else if (s.faze === 'playoff' && s.den % 2 === 0) {
    for (const liga of s.ligy) {
      if (!liga.playoff || liga.playoff.vitez) continue
      let playoff = liga.playoff
      for (const { kolo, index, serie } of cekajiciSerie(playoff)) {
        const domaci = domaciLedSerie(serie)
        const hoste = domaci === serie.domaci ? serie.hoste : serie.domaci
        const v = odehrajZapas(s, domaci, hoste, liga.uroven * 100 + kolo * 10 + index)
        const vitezZapasu = v.golyDomaci > v.golyHoste ? domaci : hoste
        playoff = zapisVysledekSerie(playoff, kolo, index, vitezZapasu === serie.domaci)
      }
      liga.playoff = playoff
    }
    if (s.ligy.every((l) => l.playoff?.vitez)) {
      s.faze = 'konecSezony'
      const mistrId = s.ligy[0].playoff!.vitez!
      s.zpravy.unshift(
        mistrId === s.mujKlubId
          ? '🏆 MISTŘI! Vyhráli jste extraligu!'
          : `Mistrem extraligy se stal ${s.tymy[mistrId].nazev}.`,
      )
    }
  }
  return s
}

export function zahajNovouSezonu(state: GameState): GameState {
  const s = structuredClone(state)
  // postup a sestup mezi sousedními úrovněmi
  // tabulky je nutné spočítat PŘED výměnami — po swapu už tymy nesedí na zapasy
  const tabulky = s.ligy.map((liga) => spocitejTabulku(liga.tymy, liga.zapasy))
  for (const uroven of [1, 2]) {
    const nizsi = s.ligy[uroven]
    const vyssi = s.ligy[uroven - 1]
    const postupujici = nizsi.playoff!.vitez!
    const tabulka = tabulky[uroven - 1]
    const sestupujici = tabulka[tabulka.length - 1].tymId
    nizsi.tymy = [...nizsi.tymy.filter((t) => t !== postupujici), sestupujici]
    vyssi.tymy = [...vyssi.tymy.filter((t) => t !== sestupujici), postupujici]
    s.zpravy.unshift(
      `${s.tymy[postupujici].nazev} postupuje do ${vyssi.nazev}, ${s.tymy[sestupujici].nazev} sestupuje.`,
    )
  }
  s.sezona++
  s.den = 0
  s.faze = 'zakladniCast'
  s.posledniZapas = null
  // letní vývoj hráčů
  const rng = createRng(hashSeed(s.seed, s.sezona, 999))
  for (const tym of Object.values(s.tymy)) {
    for (const h of tym.hraci) {
      h.vek++
      let posun =
        h.vek <= 23 ? randInt(rng, 0, 3) : h.vek <= 29 ? randInt(rng, -1, 1) : randInt(rng, -3, -1)
      if (h.vek <= 23 && overall(h) >= h.potencial) posun = 0
      for (const k of Object.keys(h.atributy) as (keyof Atributy)[]) {
        h.atributy[k] = clamp(h.atributy[k] + posun, 1, 99)
      }
      h.forma = 50
      h.unava = 0
      h.goly = 0
      h.asistence = 0
    }
    tym.moralka = 50
    // AI kluby si přeskládají sestavu; hráčova (upravovaná ručně) zůstává
    if (tym.klubId !== s.mujKlubId) tym.sestava = vychoziSestava(tym.hraci)
  }
  for (const liga of s.ligy) {
    liga.zapasy = vytvorRozpis(liga.tymy)
    liga.playoff = null
  }
  return s
}
