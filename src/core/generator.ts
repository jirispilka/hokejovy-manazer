import kluby from './data/kluby.json'
import soupiskyData from './data/soupisky.json'
import { JMENA, PRIJMENI } from './jmena'
import { createRng, pick, randInt, type Rng } from './rng'
import type { Atributy, HistorickaStatistika, Hrac, Klub, Pozice, Tym } from './types'
import { vychoziSestava, overall, otiskLajn } from './sestava'

// rozsah atributů podle úrovně ligy (0 = extraliga nejsilnější)
const ROZSAHY: [number, number][] = [
  [55, 88],
  [45, 75],
  [35, 65],
]

export const START_ROZPOCET = [20_000_000, 8_000_000, 3_000_000]

export interface RealnyHrac {
  jmeno: string
  prijmeni: string
  pozice: Pozice
  vek: number
  zapasy: number
  goly: number
  asistence: number
  trzniCena?: number
  historieStatistik?: HistorickaStatistika[]
}

const SOUPISKY = soupiskyData as Record<string, RealnyHrac[]>
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const bodyNaZapas = (r: RealnyHrac) => (r.goly + r.asistence) / Math.max(1, r.zapasy)

let dalsiId = 0
const noveId = () => `h${(dalsiId++).toString(36)}`
export const resetIdCitac = (n = 0) => (dalsiId = n)

export function generujHrace(rng: Rng, pozice: Pozice, uroven: number, vek?: number): Hrac {
  const [lo, hi] = ROZSAHY[uroven]
  const attr = () => randInt(rng, lo, hi)
  const slaby = () => randInt(rng, 10, 30)
  const atributy: Atributy =
    pozice === 'G'
      ? { strelba: slaby(), prihravky: slaby(), brusleni: attr(), obrana: attr(), fyzicka: attr(), chytani: attr(), vydrz: attr(), technika: slaby() }
      : pozice === 'D'
        ? { strelba: randInt(rng, lo - 10, hi - 10), prihravky: attr(), brusleni: attr(), obrana: attr(), fyzicka: attr(), chytani: slaby(), vydrz: attr(), technika: attr() }
        : { strelba: attr(), prihravky: attr(), brusleni: attr(), obrana: randInt(rng, lo - 10, hi - 10), fyzicka: attr(), chytani: slaby(), vydrz: attr(), technika: attr() }
  const hrac: Hrac = {
    id: noveId(),
    jmeno: pick(rng, JMENA),
    prijmeni: pick(rng, PRIJMENI),
    vek: vek ?? randInt(rng, 17, 38),
    pozice,
    atributy,
    potencial: 0,
    forma: 50,
    unava: 0,
    goly: 0,
    asistence: 0,
    zranenZapasu: 0,
    odehranoSezona: 0,
    plat: 0,
  }
  const o = overall(hrac)
  hrac.potencial = hrac.vek < 24 ? Math.min(99, o + randInt(rng, 3, 15)) : o
  hrac.plat = Math.round((o * o * 25) / 1000) * 1000
  return hrac
}

export function hracZRealnych(rng: Rng, r: RealnyHrac, uroven: number, id: string): Hrac {
  const [lo, hi] = ROZSAHY[uroven]
  const rozpeti = hi - lo
  const vykon =
    r.pozice === 'G'
      ? Math.min(1, r.zapasy / 40) * 0.8 + 0.2
      : Math.min(1.3, bodyNaZapas(r))
  const zaklad = lo + rozpeti * Math.min(1, 0.2 + 0.6 * vykon)
  const kolem = (posun = 0) => clamp(Math.round(zaklad + posun + (rng() - 0.5) * rozpeti * 0.35), 1, 99)
  const slaby = () => randInt(rng, 10, 30)
  const golPodil = (r.goly - r.asistence) / Math.max(1, r.goly + r.asistence)
  const atributy: Atributy =
    r.pozice === 'G'
      ? { strelba: slaby(), prihravky: slaby(), brusleni: kolem(), obrana: kolem(), fyzicka: kolem(), chytani: kolem(3), vydrz: kolem(), technika: slaby() }
      : r.pozice === 'D'
        ? { strelba: kolem(-8 + golPodil * 6), prihravky: kolem(golPodil * -6), brusleni: kolem(), obrana: kolem(4), fyzicka: kolem(), chytani: slaby(), vydrz: kolem(), technika: kolem() }
        : { strelba: kolem(golPodil * 8), prihravky: kolem(golPodil * -8), brusleni: kolem(), obrana: kolem(-10), fyzicka: kolem(), chytani: slaby(), vydrz: kolem(), technika: kolem() }
  const hrac: Hrac = {
    id,
    jmeno: r.jmeno,
    prijmeni: r.prijmeni,
    vek: r.vek,
    pozice: r.pozice,
    atributy,
    potencial: 0,
    forma: 50,
    unava: 0,
    goly: 0,
    asistence: 0,
    zranenZapasu: 0,
    odehranoSezona: 0,
    plat: 0,
    trzniCena: r.trzniCena,
  }
  const o = overall(hrac)
  hrac.potencial = hrac.vek < 24 ? Math.min(99, o + randInt(rng, 3, 15)) : o
  hrac.plat = Math.round((o * o * 25) / 1000) * 1000
  return hrac
}

function realniKandidati(realni: RealnyHrac[], pozice: Pozice, pocet: number): RealnyHrac[] {
  return realni
    .filter((r) => r.pozice === pozice)
    .sort((a, b) =>
      pozice === 'G'
        ? b.zapasy - a.zapasy || bodyNaZapas(b) - bodyNaZapas(a)
        : bodyNaZapas(b) - bodyNaZapas(a) || b.zapasy - a.zapasy,
    )
    .slice(0, pocet)
}

function sestavHrace(rng: Rng, klub: Klub): Hrac[] {
  const realni = SOUPISKY[klub.id] ?? []
  const maData = realni.length >= 10
  const hraci: Hrac[] = []
  const potreba: [Pozice, number][] = [['U', 14], ['D', 7], ['G', 2]]
  for (const [pozice, pocet] of potreba) {
    const kandidati = maData ? realniKandidati(realni, pozice, pocet) : []
    kandidati.forEach((r, i) => hraci.push(hracZRealnych(rng, r, klub.liga, `r-${klub.id}-${pozice}-${i}`)))
    for (let i = kandidati.length; i < pocet; i++) hraci.push(generujHrace(rng, pozice, klub.liga))
  }
  return hraci
}

export function generujTym(rng: Rng, klub: Klub): Tym {
  const hraci = sestavHrace(rng, klub)
  const kapitan = [...hraci].sort((a, b) => overall(b) - overall(a))[0]
  const sestava = vychoziSestava(hraci)
  return {
    klubId: klub.id,
    nazev: klub.nazev,
    hraci,
    sestava,
    moralka: 50,
    kapitanId: kapitan.id,
    taktika: 'vyvazena',
    chemie: { utoky: [30, 30, 30, 30], obrany: [30, 30, 30] },
    slozeni: otiskLajn(sestava),
    rozpocet: START_ROZPOCET[klub.liga],
    vytizeniUtoku: [1, 1, 1, 1],
  }
}

export function generujSvet(seed: number): Record<string, Tym> {
  resetIdCitac()
  const rng = createRng(seed)
  const tymy: Record<string, Tym> = {}
  for (const klub of kluby as Klub[]) tymy[klub.id] = generujTym(rng, klub)
  return tymy
}
