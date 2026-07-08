import { formaTymu } from './hodnoty'
import { createRng, hashSeed, randInt, type Rng } from './rng'
import { overall } from './sestava'
import { spocitejTabulku } from './tabulka'
import type { GameState, KabinovaUdalost } from './types'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

function hracNaLavicce(tym: import('./types').Tym, hracId: string): boolean {
  const vSestave = new Set([...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat(), tym.sestava.brankar])
  return !vSestave.has(hracId)
}

export function generujKabinovku(s: GameState, rng: Rng): KabinovaUdalost | null {
  if (s.kabinovaUdalost) return null
  if (s.den - s.posledniKabinovaDen < 10) return null
  if (rng() > 0.35) return null

  const tym = s.tymy[s.mujKlubId]

  const stizny = tym.hraci.filter((h) => hracNaLavicce(tym, h.id) && h.odehranoSezona === 0 && overall(h) >= 65)
  if (stizny.length > 0 && rng() < 0.4) {
    const h = stizny[randInt(rng, 0, stizny.length - 1)]
    return {
      id: 'stiznost',
      text: `${h.jmeno} ${h.prijmeni}: „Hraju málo, chci víc času na ledě!"`,
      moznosti: [
        { text: 'Přesunout výš v sestavě', efektMoralka: 5, efektForma: 2 },
        { text: 'Uklidnit — čas přijde', efektMoralka: 2 },
        { text: 'Ignorovat', efektMoralka: -4, efektForma: -2 },
      ],
    }
  }

  // kapitán
  if (tym.kapitanId && rng() < 0.35) {
    const k = tym.hraci.find((h) => h.id === tym.kapitanId)!
    return {
      id: 'kapitan',
      text: `Kapitán ${k.prijmeni} navrhuje změnu v tréninku.`,
      moznosti: [
        { text: 'Tvrdší trénink (víc únavy)', efektMoralka: 3, efektForma: -2 },
        { text: 'Nechat jak je', efektMoralka: 0 },
        { text: 'Více odpočinku', efektMoralka: 4, efektForma: 2 },
      ],
    }
  }

  // hádky v lajně s nízkou chemií
  const slaba = tym.chemie.utoky.findIndex((c) => c < 45)
  if (slaba >= 0 && rng() < 0.3) {
    const lajna = tym.sestava.utoky[slaba]
    const a = tym.hraci.find((h) => h.id === lajna[0])!
    const b = tym.hraci.find((h) => h.id === lajna[1])!
    return {
      id: 'hadka',
      text: `${a.prijmeni} a ${b.prijmeni} si v šatně nerozumí (${slaba + 1}. útok).`,
      moznosti: [
        { text: 'Prohodit v sestavě', efektMoralka: 1, efektChemie: 5 },
        { text: 'Mediovat — týmová schůzka', efektMoralka: 3, efektChemie: 8 },
        { text: 'Nechat být', efektMoralka: -2, efektChemie: -5 },
      ],
    }
  }

  // mladík
  const mladi = tym.hraci.filter((h) => h.vek <= 20 && overall(h) < h.potencial)
  if (mladi.length > 0 && rng() < 0.25) {
    const h = mladi[randInt(rng, 0, mladi.length - 1)]
    return {
      id: 'mladik',
      text: `Mladý ${h.jmeno} ${h.prijmeni} (${h.vek}) září na tréninku!`,
      moznosti: [
        { text: 'Dát šanci v sestavě', efektMoralka: 4, efektForma: 3 },
        { text: 'Nechat dozrát v akademii', efektMoralka: 1 },
        { text: 'Půjčit do nižší ligy', efektMoralka: -1 },
      ],
    }
  }

  return null
}

export function vyresKabinovku(s: GameState, volbaIndex: number): GameState {
  const u = s.kabinovaUdalost
  if (!u) throw new Error('Žádná kabinová událost nečeká.')
  const volba = u.moznosti[volbaIndex]
  if (!volba) throw new Error('Neplatná volba.')
  const ns = structuredClone(s)
  const tym = ns.tymy[ns.mujKlubId]
  tym.moralka = clamp(tym.moralka + volba.efektMoralka, 30, 70)
  if (volba.efektForma) {
    for (const h of tym.hraci) h.forma = clamp(h.forma + volba.efektForma!, 30, 70)
  }
  if (volba.efektChemie) {
    const idx = tym.chemie.utoky.findIndex((c) => c === Math.min(...tym.chemie.utoky))
    if (idx >= 0) tym.chemie.utoky[idx] = clamp(tym.chemie.utoky[idx] + volba.efektChemie!, 0, 100)
  }
  ns.kabinovaUdalost = null
  ns.posledniKabinovaDen = ns.den
  ns.zpravy.unshift(`📋 Kabina: zvolil jsi „${volba.text}".`)
  ns.zpravy = ns.zpravy.slice(0, 50)
  return ns
}

export function kabinovyTick(s: GameState): void {
  if (s.kabinovaUdalost) return
  const rng = createRng(hashSeed(s.seed, s.sezona, s.den, 777))
  const u = generujKabinovku(s, rng)
  if (u) s.kabinovaUdalost = u
}

export function predzapasovyBriefing(s: GameState): {
  souper: string
  pozice: number
  forma: string
  strelec: string
  tip: string
  derby: boolean
} | null {
  const cz = s.cekajiciZapas
  if (!cz) return null
  const mujDomaci = cz.domaci === s.mujKlubId
  const souperId = mujDomaci ? cz.hoste : cz.domaci
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  const tabulka = spocitejTabulku(liga.tymy, liga.zapasy)
  const pozice = tabulka.findIndex((r) => r.tymId === souperId) + 1
  const forma = formaTymu(liga, souperId).join('') || '—'
  const souperTym = s.tymy[souperId]
  const strelec = [...souperTym.hraci].sort((a, b) => b.goly - a.goly)[0]
  const strelecText = strelec && strelec.goly > 0 ? `${strelec.prijmeni} (${strelec.goly} gólů)` : '—'
  const tip =
    pozice <= 3
      ? 'Soupeř je nahoře v tabulce — zavři prostor a rychle protiútoč.'
      : pozice >= 12
        ? 'Slabší soupeř — tlač od začátku.'
        : 'Vyrovnaný soupeř — drž disciplínu v obraně.'
  return {
    souper: souperTym.nazev,
    pozice,
    forma,
    strelec: strelecText,
    tip,
    derby: cz.derby,
  }
}
