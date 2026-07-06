import kluby from './data/kluby.json'
import { JMENA, PRIJMENI } from './jmena'
import { createRng, pick, randInt, type Rng } from './rng'
import type { Atributy, Hrac, Klub, Pozice, Tym } from './types'
import { vychoziSestava, overall } from './sestava'

// rozsah atributů podle úrovně ligy (0 = extraliga nejsilnější)
const ROZSAHY: [number, number][] = [
  [55, 88],
  [45, 75],
  [35, 65],
]

let dalsiId = 0
const noveId = () => `h${(dalsiId++).toString(36)}`
export const resetIdCitac = (n = 0) => (dalsiId = n)

export function generujHrace(rng: Rng, pozice: Pozice, uroven: number, vek?: number): Hrac {
  const [lo, hi] = ROZSAHY[uroven]
  const attr = () => randInt(rng, lo, hi)
  const slaby = () => randInt(rng, 10, 30)
  const atributy: Atributy =
    pozice === 'G'
      ? { strelba: slaby(), prihravky: slaby(), brusleni: attr(), obrana: attr(), fyzicka: attr(), chytani: attr() }
      : pozice === 'D'
        ? { strelba: randInt(rng, lo - 10, hi - 10), prihravky: attr(), brusleni: attr(), obrana: attr(), fyzicka: attr(), chytani: slaby() }
        : { strelba: attr(), prihravky: attr(), brusleni: attr(), obrana: randInt(rng, lo - 10, hi - 10), fyzicka: attr(), chytani: slaby() }
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
  }
  const o = overall(hrac)
  hrac.potencial = hrac.vek < 24 ? Math.min(99, o + randInt(rng, 3, 15)) : o
  return hrac
}

export function generujTym(rng: Rng, klub: Klub): Tym {
  const hraci: Hrac[] = []
  // 14 U + 7 D + 2 G: sestava využije 12+6+1, zbytek jsou náhradníci
  for (let i = 0; i < 14; i++) hraci.push(generujHrace(rng, 'U', klub.liga))
  for (let i = 0; i < 7; i++) hraci.push(generujHrace(rng, 'D', klub.liga))
  for (let i = 0; i < 2; i++) hraci.push(generujHrace(rng, 'G', klub.liga))
  return { klubId: klub.id, nazev: klub.nazev, hraci, sestava: vychoziSestava(hraci), moralka: 50 }
}

export function generujSvet(seed: number): Record<string, Tym> {
  resetIdCitac()
  const rng = createRng(seed)
  const tymy: Record<string, Tym> = {}
  for (const klub of kluby as Klub[]) tymy[klub.id] = generujTym(rng, klub)
  return tymy
}
