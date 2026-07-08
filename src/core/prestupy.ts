import { kc } from './hodnoty'
import { zapisFinance } from './platy'
import { createRng, hashSeed, pick, type Rng } from './rng'
import { overall, vychoziSestava, zmenSestavuKlubu } from './sestava'
import type { GameState, Hrac, Pozice, Tym } from './types'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const na10tis = (n: number) => Math.round(n / 10_000) * 10_000

export const MINIMA = { U: 12, D: 6, G: 2 } as const

export const pocetNaPozici = (t: Tym, pozice: Pozice): number =>
  t.hraci.filter((h) => h.pozice === pozice).length

const faktorVeku = (vek: number) =>
  vek <= 21 ? 1.8 : vek <= 25 ? 1.4 : vek <= 29 ? 1.0 : vek <= 32 ? 0.6 : 0.35

export function hodnotaHrace(h: Hrac): number {
  const o = overall(h)
  const zaklad = h.trzniCena ?? o * o * 4000 * faktorVeku(h.vek)
  return na10tis(zaklad * (1 + (h.forma - 50) / 200))
}

export function odhadPotencialu(h: Hrac, seed: number): [number, number] {
  let idHash = 0
  for (const znak of h.id) idHash = (idHash * 31 + znak.charCodeAt(0)) >>> 0
  const sum = (hashSeed(seed, idHash) % 9) - 4 // ±4 → skutečnost je vždy v rozmezí ±5
  const stred = clamp(h.potencial + sum, 1, 99)
  return [Math.max(1, stred - 5), Math.min(99, stred + 5)]
}

export const prestupoveOknoOtevrene = (s: GameState): boolean => s.faze !== 'playoff'

export function faktorOchoty(tym: Tym, hracId: string): number {
  const poradi = [...tym.hraci]
    .sort((a, b) => overall(b) - overall(a))
    .findIndex((h) => h.id === hracId)
  return poradi >= 0 && poradi < 6 ? 1.3 : 0.95
}

/** Cena, za kterou klub hráče okamžitě prodá. */
export function pozadovanaCena(s: GameState, klubId: string, hracId: string): number {
  const tym = s.tymy[klubId]
  const hrac = tym.hraci.find((h) => h.id === hracId)
  if (!hrac) throw new Error('Hráč není v klubu.')
  return na10tis(hodnotaHrace(hrac) * faktorOchoty(tym, hracId))
}

/** Cena, za kterou okamžitě prodáš hráče (90 % tržní hodnoty). */
export function cenaProdeje(h: Hrac): number {
  return na10tis(hodnotaHrace(h) * 0.9)
}

export function odeberZTymu(t: Tym, hracId: string): Hrac {
  const hrac = t.hraci.find((h) => h.id === hracId)
  if (!hrac) throw new Error('Hráč není v týmu.')
  t.hraci = t.hraci.filter((h) => h.id !== hracId)
  const bylVSestave = [...t.sestava.utoky.flat(), ...t.sestava.obrany.flat(), t.sestava.brankar].includes(hracId)
  if (bylVSestave) {
    const prestaveny = zmenSestavuKlubu(t, vychoziSestava(t.hraci))
    t.sestava = prestaveny.sestava
    t.chemie = prestaveny.chemie
    t.slozeni = prestaveny.slozeni
  }
  if (t.kapitanId === hracId) {
    t.kapitanId = [...t.hraci].sort((a, b) => overall(b) - overall(a))[0]?.id ?? null
  }
  return hrac
}

function prestavAI(t: Tym): void {
  const prestaveny = zmenSestavuKlubu(t, vychoziSestava(t.hraci))
  t.sestava = prestaveny.sestava
  t.chemie = prestaveny.chemie
  t.slozeni = prestaveny.slozeni
}

export function kupHrace(state: GameState, odKlubu: string, hracId: string): GameState {
  if (!prestupoveOknoOtevrene(state)) throw new Error('Přestupové okno je v playoff zavřené.')
  const castka = pozadovanaCena(state, odKlubu, hracId)
  const s = structuredClone(state)
  const muj = s.tymy[s.mujKlubId]
  const prodavajici = s.tymy[odKlubu]
  const hrac = prodavajici.hraci.find((h) => h.id === hracId)!
  if (muj.rozpocet < castka) throw new Error('Na tenhle přestup nemáš rozpočet.')
  if (muj.hraci.length >= 26) throw new Error('Soupiska je plná (max 26 hráčů).')
  if (pocetNaPozici(prodavajici, hrac.pozice) - 1 < MINIMA[hrac.pozice])
    throw new Error('Klub hráče neprodá — spadl by pod minimum soupisky.')
  odeberZTymu(prodavajici, hracId)
  hrac.plat = Math.round((hrac.plat * 1.1) / 1000) * 1000
  hrac.forma = 50
  hrac.unava = 0
  muj.hraci.push(hrac)
  muj.rozpocet -= castka
  prodavajici.rozpocet += castka
  zapisFinance(s, `Přestup ${hrac.prijmeni}`, -castka)
  s.zpravy.unshift(`✍️ Přestup! ${hrac.jmeno} ${hrac.prijmeni} přichází z ${prodavajici.nazev} za ${kc(castka)}.`)
  s.zpravy = s.zpravy.slice(0, 50)
  return s
}

export function prodajHrace(state: GameState, hracId: string, rng: Rng): GameState {
  if (!prestupoveOknoOtevrene(state)) throw new Error('Přestupové okno je v playoff zavřené.')
  const s = structuredClone(state)
  const muj = s.tymy[s.mujKlubId]
  const hrac = muj.hraci.find((h) => h.id === hracId)
  if (!hrac) throw new Error('Hráč není v tvém klubu.')
  const castka = cenaProdeje(hrac)
  const zajemci = Object.values(s.tymy).filter(
    (t) => t.klubId !== s.mujKlubId && t.rozpocet >= castka && t.hraci.length < 26,
  )
  if (zajemci.length === 0) throw new Error('Žádný klub momentálně nemá zájem o koupi.')
  const kupec = pick(rng, zajemci)
  odeberZTymu(muj, hrac.id)
  hrac.forma = 50
  hrac.unava = 0
  kupec.hraci.push(hrac)
  prestavAI(kupec)
  kupec.rozpocet -= castka
  muj.rozpocet += castka
  zapisFinance(s, `Prodej ${hrac.prijmeni}`, castka)
  s.nabidkyProdeje = s.nabidkyProdeje.filter((n) => n.hracId !== hrac.id)
  s.prichoziNabidky = s.prichoziNabidky.filter((n) => n.hracId !== hrac.id)
  s.prichoziNabidka = s.prichoziNabidky[0] ?? null
  if (s.oblibenyHracId === hrac.id) {
    s.oblibenyHracId = null
    s.naladaFanousku = Math.max(0, s.naladaFanousku - 10)
    s.zpravy.unshift(`😢 Fanoušci jsou zklamaní prodejem oblíbeného hráče ${hrac.prijmeni}.`)
  }
  s.zpravy.unshift(`💰 ${hrac.jmeno} ${hrac.prijmeni} prodán do ${kupec.nazev} za ${kc(castka)}.`)
  if (pocetNaPozici(muj, hrac.pozice) < MINIMA[hrac.pozice]) {
    const nazev = hrac.pozice === 'G' ? 'brankářů' : hrac.pozice === 'D' ? 'obránců' : 'útočníků'
    s.zpravy.unshift(
      `⚠️ Máš jen ${pocetNaPozici(muj, hrac.pozice)} ${nazev} — minimum ligy je ${MINIMA[hrac.pozice]}. Doplň soupisku!`,
    )
  }
  s.zpravy = s.zpravy.slice(0, 50)
  return s
}

export function prestupovyDeadlineBlizko(s: GameState): boolean {
  if (s.faze !== 'zakladniCast') return false
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  const posledniDen = Math.max(...liga.zapasy.filter((z) => !z.vysledek).map((z) => z.den), 0)
  return posledniDen > 0 && posledniDen - s.den <= 7
}

// tržní tick — volá advanceDay na už naklonovaném stavu (mutuje s)
export function trhTick(s: GameState, rng: Rng): void {
  if (!prestupoveOknoOtevrene(s)) {
    s.prichoziNabidka = null
    s.prichoziNabidky = []
    s.nabidkyProdeje = []
    return
  }
  const deadline = prestupovyDeadlineBlizko(s)
  if (deadline && s.den % 3 === 0) {
    s.zpravy.unshift('🔥 Přestupový deadline za pár dní — trh je živější!')
  }
  // AI ↔ AI přestup ~1× za 10 dní
  if (rng() < 0.1) {
    const aiKluby = Object.values(s.tymy).filter((t) => t.klubId !== s.mujKlubId)
    const prodavajici = pick(rng, aiKluby)
    const kandidati = prodavajici.hraci.filter(
      (h) => pocetNaPozici(prodavajici, h.pozice) > MINIMA[h.pozice],
    )
    if (kandidati.length > 0) {
      const hrac = pick(rng, kandidati)
      const cena = hodnotaHrace(hrac)
      const kupci = aiKluby.filter(
        (t) => t.klubId !== prodavajici.klubId && t.rozpocet >= cena && t.hraci.length < 26,
      )
      if (kupci.length > 0) {
        const kupec = pick(rng, kupci)
        odeberZTymu(prodavajici, hrac.id)
        hrac.forma = 50
        hrac.unava = 0
        kupec.hraci.push(hrac)
        prestavAI(kupec)
        kupec.rozpocet -= cena
        prodavajici.rozpocet += cena
        s.zpravy.unshift(
          `🔁 Přestup v lize: ${hrac.jmeno} ${hrac.prijmeni} mění ${prodavajici.nazev} za ${kupec.nazev} (${kc(cena)}).`,
        )
      }
    }
  }
  s.zpravy = s.zpravy.slice(0, 50)
}

/** Deterministický RNG pro okamžitý prodej z UI. */
export function rngProdeje(s: GameState, hracId: string): Rng {
  return createRng(hashSeed(s.seed, s.den, hracId, 919))
}
