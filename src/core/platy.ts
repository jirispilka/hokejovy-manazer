import { overall } from './sestava'
import type { GameState, Hrac } from './types'

export function ocekavanyPlat(h: Hrac): number {
  const o = overall(h)
  return Math.round((o * o * 25) / 1000) * 1000
}

/** Součet měsíčních platů celé soupisky. */
export function mesicniPlatyTymu(hraci: Hrac[]): number {
  return hraci.reduce((sum, h) => sum + h.plat, 0)
}

/** Roční náklad na platy (12 měsíců). */
export function rocniPlatyTymu(hraci: Hrac[]): number {
  return mesicniPlatyTymu(hraci) * 12
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function dopadPlatuHrace(h: Hrac, novyPlat: number): { forma: number; moralka: number; stiznost: boolean } {
  const ocek = ocekavanyPlat(h)
  const pomer = novyPlat / Math.max(1, ocek)
  if (pomer >= 1.1) return { forma: 3, moralka: 2, stiznost: false }
  if (pomer >= 0.9) return { forma: 0, moralka: 0, stiznost: false }
  if (pomer >= 0.7) return { forma: -4, moralka: -3, stiznost: false }
  return { forma: -4, moralka: -3, stiznost: true }
}

export function zapisFinance(s: GameState, popis: string, castka: number): void {
  s.financeHistorie.unshift({ den: s.den, popis, castka })
  s.financeHistorie = s.financeHistorie.slice(0, 50)
}

export function zmenPlat(state: GameState, hracId: string, novyPlat: number): GameState {
  if (novyPlat < 10_000) throw new Error('Plat musí být alespoň 10 000 Kč/měs.')
  const s = structuredClone(state)
  const muj = s.tymy[s.mujKlubId]
  const hrac = muj.hraci.find((h) => h.id === hracId)
  if (!hrac) throw new Error('Hráč nenalezen.')
  const dopad = dopadPlatuHrace(hrac, novyPlat)
  const stary = hrac.plat
  hrac.plat = Math.round(novyPlat / 1000) * 1000
  muj.moralka = clamp(muj.moralka + dopad.moralka, 30, 70)
  hrac.forma = clamp(hrac.forma + dopad.forma, 30, 70)
  zapisFinance(s, `Plat ${hrac.jmeno} ${hrac.prijmeni}: ${stary} → ${hrac.plat}`, 0)
  if (dopad.stiznost) {
    s.zpravy.unshift(`😤 ${hrac.jmeno} ${hrac.prijmeni} si stěžuje na nízký plat.`)
    s.zpravy = s.zpravy.slice(0, 50)
  } else if (dopad.forma > 0) {
    s.zpravy.unshift(`💰 ${hrac.jmeno} ${hrac.prijmeni} je spokojený s novým platem.`)
    s.zpravy = s.zpravy.slice(0, 50)
  }
  return s
}
