import type { GameState, TreninkDen, Tym } from './types'
import { vychoziStadion } from './finance'
import { doporucenyPlan, normalizujSeanci, normalizujTreninkovyPlan } from './trenink'
import { normalizujTaktiku } from './taktika'
import { otiskPetek } from './sestava'

const VERZE = 10

interface UlozenaHra {
  verze: number
  ulozeno: string
  stav: GameState
}

export function serializuj(stav: GameState, ulozeno: string): string {
  const data: UlozenaHra = { verze: VERZE, ulozeno, stav }
  return JSON.stringify(data)
}

function migrujV4(stav: Record<string, unknown>): GameState {
  const s = stav as unknown as GameState
  if (!s.stadion) {
    const liga = s.ligy?.find((l) => l.tymy.includes(s.mujKlubId))?.uroven ?? 2
    s.stadion = vychoziStadion(liga)
  }
  if (!s.financeHistorie) s.financeHistorie = []
  if (s.posledniDomaci === undefined) s.posledniDomaci = null
  if (s.posledniTrenink === undefined) s.posledniTrenink = null
  for (const t of Object.values(s.tymy ?? {})) {
    for (const h of t.hraci) {
      if (!h.herniHistorie) h.herniHistorie = []
    }
  }
  return s
}

function migrujChemiiNaPetky(t: Tym): void {
  const stara = t.chemie as { utoky?: number[]; obrany?: number[]; petky?: number[] }
  if (!stara.petky && stara.utoky && stara.obrany) {
    t.chemie = {
      petky: [0, 1, 2, 3].map((i) => {
        const u = stara.utoky![i] ?? 30
        const o = stara.obrany![Math.min(i, 2)] ?? 30
        return Math.round(i < 3 ? u * 0.5 + o * 0.5 : u * 0.6 + o * 0.4)
      }),
    }
  }
  const staraSlozeni = t.slozeni as { utoky?: string[]; obrany?: string[]; petky?: string[] }
  if (!staraSlozeni.petky && staraSlozeni.utoky) {
    t.slozeni = { petky: otiskPetek(t.sestava) }
  }
}

function migrujV10(s: GameState): GameState {
  if (!s.stadion.vylepseni) {
    s.stadion.vylepseni = { tribuny: 0, obcerstveni: 0, obchod: 0 }
  }
  if (s.stadion.cenaPiti === undefined) {
    s.stadion.cenaPiti = Math.round((s.stadion.cenaJidla ?? 80) * 0.625) || 50
  }
  if (s.posledniDomaci && s.posledniDomaci.piti === undefined) {
    s.posledniDomaci.piti = 0
  }
  return s
}

function migrujV9(s: GameState): GameState {
  for (const t of Object.values(s.tymy ?? {})) migrujChemiiNaPetky(t)
  return s
}

function migrujV8(s: GameState): GameState {
  if (!s.nastaveni) s.nastaveni = { minihryZapnuto: true }
  for (const t of Object.values(s.tymy ?? {})) {
    if (!t.vytizeniUtoku) t.vytizeniUtoku = [1, 1, 1, 1]
  }
  return s
}

function migrujV7(s: GameState): GameState {
  if (!s.treninkovyTyden) s.treninkovyTyden = {}
  const plan: Record<number, TreninkDen[]> = {}
  for (const [denStr, seance] of Object.entries(normalizujTreninkovyPlan(s.treninkovyTyden as Record<number, TreninkDen | TreninkDen[]>))) {
    plan[Number(denStr)] = seance.map(normalizujSeanci)
  }
  s.treninkovyTyden = plan
  return s
}

function migrujV6(s: GameState): GameState {
  if (!s.treninkovyTyden) s.treninkovyTyden = {}
  s.treninkovyTyden = normalizujTreninkovyPlan(s.treninkovyTyden as Record<number, TreninkDen | TreninkDen[]>)
  if (s.treninkovyTydenOd === undefined) s.treninkovyTydenOd = s.den
  if (!s.prichoziNabidky) s.prichoziNabidky = s.prichoziNabidka ? [s.prichoziNabidka] : []
  if (s.kabinovaUdalost === undefined) s.kabinovaUdalost = null
  if (s.posledniKabinovaDen === undefined) s.posledniKabinovaDen = 0
  if (s.oblibenyHracId === undefined) s.oblibenyHracId = null
  if (!s.marketing) s.marketing = []
  if (!s.reklama) s.reklama = []
  if (s.navrhSestavy === undefined) s.navrhSestavy = null
  if (s.posledniOslovSponzory === undefined) s.posledniOslovSponzory = 0
  if (Object.keys(s.treninkovyTyden).length === 0 && s.den >= 0) {
    s.treninkovyTyden = doporucenyPlan(s)
    s.treninkovyTydenOd = s.den
  }
  for (const t of Object.values(s.tymy ?? {})) {
    t.taktika = normalizujTaktiku(t.taktika)
  }
  // okamžité přestupy — staré listiny a nabídky už neplatí
  s.nabidkyProdeje = []
  s.prichoziNabidky = []
  s.prichoziNabidka = null
  return s
}

function parsuj(json: string): UlozenaHra {
  const data = JSON.parse(json) as UlozenaHra
  if (!data.stav?.tymy || !data.stav?.ligy) {
    throw new Error('Nepodporovaný nebo poškozený soubor uložení.')
  }
  if (data.verze === 4) {
    data.stav = migrujV4(data.stav as unknown as Record<string, unknown>)
    data.verze = 5
  }
  if (data.verze === 5) {
    data.stav = migrujV6(data.stav)
    data.verze = 6
  }
  if (data.verze === 6) {
    data.stav = migrujV7(data.stav)
    data.verze = 7
  }
  if (data.verze === 7) {
    data.stav = migrujV8(data.stav)
    data.verze = 8
  }
  if (data.verze === 8) {
    data.stav = migrujV9(data.stav)
    data.verze = 9
  }
  if (data.verze === 9) {
    data.stav = migrujV10(data.stav)
    data.verze = VERZE
  }
  if (data.verze !== VERZE) {
    throw new Error('Nepodporovaný nebo poškozený soubor uložení.')
  }
  return data
}

export function deserializuj(json: string): GameState {
  return parsuj(json).stav
}

export function popisUlozeni(json: string): { ulozeno: string; sezona: number; den: number; klub: string } {
  const { ulozeno, stav } = parsuj(json)
  return { ulozeno, sezona: stav.sezona, den: stav.den, klub: stav.tymy[stav.mujKlubId].nazev }
}
