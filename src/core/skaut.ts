import { odhadPotencialu, hodnotaHrace } from './prestupy'
import { overall } from './sestava'
import type { GameState, Hrac, Pozice } from './types'

export interface FiltrHracu {
  jmeno?: string
  liga?: number
  pozice?: Pozice | 'vse'
  ovrMin?: number
  ovrMax?: number
  vekMin?: number
  vekMax?: number
  potencialMin?: number
  maxCena?: number
  maxPlat?: number
  lepsiNezSlaby?: boolean
  jenZdravi?: boolean
}

export type RazeniTrhu = 'ovr' | 'potencial' | 'cena' | 'vek' | 'forma' | 'pomer'

export interface RadekTrhu {
  hrac: Hrac
  klubId: string
}

export function filtrujHrace(
  s: GameState,
  radky: RadekTrhu[],
  filtr: FiltrHracu,
  mujKlubId: string,
): RadekTrhu[] {
  const muj = s.tymy[mujKlubId]
  const q = filtr.jmeno?.trim().toLowerCase() ?? ''
  return radky.filter(({ hrac, klubId }) => {
    if (filtr.liga !== undefined && filtr.liga >= 0) {
      const liga = s.ligy.find((l) => l.tymy.includes(klubId))!.uroven
      if (liga !== filtr.liga) return false
    }
    if (filtr.pozice && filtr.pozice !== 'vse' && hrac.pozice !== filtr.pozice) return false
    const jmeno = `${hrac.jmeno} ${hrac.prijmeni}`.toLowerCase()
    if (q && !jmeno.includes(q)) return false
    const ovr = overall(hrac)
    if (filtr.ovrMin !== undefined && ovr < filtr.ovrMin) return false
    if (filtr.ovrMax !== undefined && ovr > filtr.ovrMax) return false
    if (filtr.vekMin !== undefined && hrac.vek < filtr.vekMin) return false
    if (filtr.vekMax !== undefined && hrac.vek > filtr.vekMax) return false
    if (filtr.potencialMin !== undefined) {
      const [, maxP] = odhadPotencialu(hrac, s.seed)
      if (maxP < filtr.potencialMin) return false
    }
    const cena = hodnotaHrace(hrac)
    if (filtr.maxCena !== undefined && cena > filtr.maxCena) return false
    if (filtr.maxPlat !== undefined && hrac.plat > filtr.maxPlat) return false
    if (filtr.jenZdravi && hrac.zranenZapasu > 0) return false
    if (filtr.lepsiNezSlaby) {
      const naPozici = muj.hraci.filter((h) => h.pozice === hrac.pozice)
      if (naPozici.length > 0) {
        const nejslabsi = naPozici.reduce((a, b) => (overall(a) <= overall(b) ? a : b))
        if (ovr <= overall(nejslabsi)) return false
      }
    }
    return true
  })
}

export function seradTrh(radky: RadekTrhu[], razeni: RazeniTrhu, _seed: number): RadekTrhu[] {
  const kopie = [...radky]
  kopie.sort((a, b) => {
    switch (razeni) {
      case 'ovr':
        return overall(b.hrac) - overall(a.hrac)
      case 'potencial':
        return b.hrac.potencial - a.hrac.potencial
      case 'cena':
        return hodnotaHrace(a.hrac) - hodnotaHrace(b.hrac)
      case 'vek':
        return a.hrac.vek - b.hrac.vek
      case 'forma':
        return b.hrac.forma - a.hrac.forma
      case 'pomer':
        return overall(b.hrac) / hodnotaHrace(b.hrac) - overall(a.hrac) / hodnotaHrace(a.hrac)
      default:
        return 0
    }
  })
  return kopie
}

export interface SkautReport {
  potencialOd: number
  potencialDo: number
  komentar: string
  hvezdy: number
  doporuceni: string
}

export function skautReport(s: GameState, hrac: Hrac, klubId: string): SkautReport {
  const [od, do_] = odhadPotencialu(hrac, s.seed)
  const liga = s.ligy.find((l) => l.tymy.includes(klubId))!.uroven
  const rozptyl = do_ - od
  const muj = s.tymy[s.mujKlubId]
  const ovr = overall(hrac)
  const nejslabsi = muj.hraci
    .filter((h) => h.pozice === hrac.pozice)
    .reduce<Hrac | null>((min, h) => (!min || overall(h) < overall(min) ? h : min), null)
  const posila = nejslabsi ? ovr - overall(nejslabsi) : ovr - 50
  let hvezdy = posila >= 8 ? 5 : posila >= 5 ? 4 : posila >= 2 ? 3 : posila >= 0 ? 2 : 1
  if (hrac.vek <= 22 && hrac.potencial >= 75) hvezdy = Math.min(5, hvezdy + 1)

  let komentar = ''
  if (rozptyl >= 8) komentar = 'Velká nejistota — hráč málo odehráno v této lize.'
  else if (liga >= 1) komentar = 'Hráč z nižší ligy — potenciál může být jiný po adaptaci.'
  else if (hrac.vek <= 21) komentar = 'Mladý talent s prostorem růstu.'
  else komentar = 'Ověřený hráč — odhad je spolehlivější.'

  if (hrac.pozice === 'U' && hrac.atributy.strelba >= 75) komentar += ' Rychlý forvard.'
  if (hrac.pozice === 'D' && hrac.atributy.obrana >= 75) komentar += ' Silný obránce.'

  const doporuceni =
    hvezdy >= 4
      ? `Doporučení: ${'⭐'.repeat(hvezdy)} — posílí ${hrac.pozice === 'G' ? 'brankářskou' : hrac.pozice === 'D' ? 'obrannou' : 'útočnou'} řadu`
      : hvezdy >= 2
        ? `Doporučení: ${'⭐'.repeat(hvezdy)} — rozumná posila`
        : `Doporučení: ${'⭐'.repeat(hvezdy)} — spíš záloha`

  return { potencialOd: od, potencialDo: do_, komentar, hvezdy, doporuceni }
}

export const SABLONY_FILTRU: Record<string, Partial<FiltrHracu>> = {
  mlady: { vekMax: 22, potencialMin: 75 },
  posila: { jenZdravi: true, lepsiNezSlaby: true },
  loterie: { vekMax: 20, maxCena: 2_000_000 },
  brankar: { pozice: 'G', lepsiNezSlaby: true },
}
