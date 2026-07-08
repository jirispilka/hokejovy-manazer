import type { GameState, Hrac, Liga, Sponzor } from './types'

export const SPONZOR_FIX = [3_000_000, 1_200_000, 500_000]
export const SPONZOR_BONUS_VYHRA = [400_000, 150_000, 60_000]

export const urovenKlubu = (s: GameState, klubId: string): number =>
  s.ligy.find((l) => l.tymy.includes(klubId))!.uroven

export function nabidkySponzora(s: GameState): { jistota: Sponzor; bonus: Sponzor } {
  const u = urovenKlubu(s, s.mujKlubId)
  return {
    jistota: { typ: 'jistota', mesicne: SPONZOR_FIX[u], zaVyhru: 0 },
    bonus: { typ: 'bonus', mesicne: Math.round(SPONZOR_FIX[u] * 0.6), zaVyhru: SPONZOR_BONUS_VYHRA[u] },
  }
}

export function kc(n: number): string {
  const znamenko = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const mil = abs / 1_000_000
    const text = (Math.round(mil * 10) / 10).toString().replace('.', ',').replace(/,0$/, '')
    return `${znamenko}${text} mil. Kč`
  }
  return `${znamenko}${Math.round(abs / 1000)} tis. Kč`
}

export function utocneLadeni(h: Hrac): number {
  const a = h.atributy
  return Math.round(a.strelba * 0.4 + a.technika * 0.3 + a.prihravky * 0.3)
}

export function obranneLadeni(h: Hrac): number {
  const a = h.atributy
  return Math.round(a.obrana * 0.5 + a.fyzicka * 0.3 + a.brusleni * 0.2)
}

export type Role = 'Střelec' | 'Tvůrce hry' | 'Dvoucestný' | 'Univerzál'

export function roleHrace(h: Hrac): Role | null {
  if (h.pozice === 'G') return null
  if (h.atributy.strelba >= h.atributy.prihravky + 10) return 'Střelec'
  if (h.atributy.prihravky >= h.atributy.strelba + 10) return 'Tvůrce hry'
  if (obranneLadeni(h) >= utocneLadeni(h) - 5) return 'Dvoucestný'
  return 'Univerzál'
}

export type VysledekZnak = 'V' | 'VP' | 'PP' | 'P'

export function formaTymu(liga: Liga, klubId: string): VysledekZnak[] {
  return liga.zapasy
    .filter((z) => z.vysledek && (z.domaci === klubId || z.hoste === klubId))
    .sort((a, b) => a.den - b.den)
    .slice(-5)
    .map((z) => {
      const v = z.vysledek!
      const domaci = z.domaci === klubId
      const vyhra = domaci ? v.golyDomaci > v.golyHoste : v.golyHoste > v.golyDomaci
      const poProdlouzeni = v.prodlouzeni || v.najezdy
      return vyhra ? (poProdlouzeni ? 'VP' : 'V') : poProdlouzeni ? 'PP' : 'P'
    })
}

export interface RadekBodovani {
  jmeno: string
  klubId: string
  goly: number
  asistence: number
  body: number
}

export function kanadskeBodovani(s: GameState, liga: Liga): RadekBodovani[] {
  const radky: RadekBodovani[] = []
  for (const klubId of liga.tymy) {
    for (const h of s.tymy[klubId].hraci) {
      if (h.goly + h.asistence === 0) continue
      radky.push({
        jmeno: `${h.jmeno} ${h.prijmeni}`,
        klubId,
        goly: h.goly,
        asistence: h.asistence,
        body: h.goly + h.asistence,
      })
    }
  }
  return radky.sort((a, b) => b.body - a.body || b.goly - a.goly).slice(0, 10)
}
