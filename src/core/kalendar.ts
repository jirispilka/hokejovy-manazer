import { NAZEV_TRENINKU } from './trenink'
import type { GameState } from './types'

export type TypUdalosti = 'zapas' | 'trenink' | 'uzaverka'

export interface UdalostKalendare {
  den: number
  typ: TypUdalosti
  popis: string
}

export function jeTreninkovyDen(den: number): boolean {
  return den > 0 && den % 7 === 0
}

export function dalsiTreninkovyDen(odDne: number): number {
  if (odDne <= 0) return 7
  const zbytek = odDne % 7
  return zbytek === 0 ? odDne : odDne + (7 - zbytek)
}

export function dalsiUdalosti(hra: GameState, pocetDnu: number): UdalostKalendare[] {
  const udalosti: UdalostKalendare[] = []
  const liga = hra.ligy.find((l) => l.tymy.includes(hra.mujKlubId))!
  const mojeZapasy = liga.zapasy
    .filter((z) => !z.vysledek && (z.domaci === hra.mujKlubId || z.hoste === hra.mujKlubId))
    .sort((a, b) => a.den - b.den)

  for (let d = hra.den + 1; d <= hra.den + pocetDnu; d++) {
    const zapas = mojeZapasy.find((z) => z.den === d)
    if (zapas) {
      const doma = zapas.domaci === hra.mujKlubId
      const souper = hra.tymy[doma ? zapas.hoste : zapas.domaci].nazev
      udalosti.push({ den: d, typ: 'zapas', popis: doma ? `Domácí zápas vs ${souper}` : `Venkovní zápas @ ${souper}` })
    }
    const seance = hra.treninkovyTyden?.[d]
    if (seance?.length) {
      const popis = seance.map((td) => NAZEV_TRENINKU(td.typ, td.intenzita ?? 'tezka')).join(', ')
      udalosti.push({ den: d, typ: 'trenink', popis: `Trénink: ${popis}` })
    }
    if (d - hra.posledniUzaverka >= 30 && d > hra.posledniUzaverka) {
      udalosti.push({ den: d, typ: 'uzaverka', popis: 'Měsíční uzávěrka' })
    }
  }
  return udalosti
}

export function tydenniProuzek(hra: GameState): UdalostKalendare[] {
  return dalsiUdalosti(hra, 7)
}
