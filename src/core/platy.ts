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

const MIN_PLAT = 10_000

function zaokrouhliPlat(castka: number): number {
  return Math.max(MIN_PLAT, Math.round(castka / 1000) * 1000)
}

export type ZmenaPlatuTymu =
  | { typ: 'delta'; castka: number }
  | { typ: 'procenta'; hodnota: number }

function novyPlatHrace(hrac: Hrac, zmena: ZmenaPlatuTymu): number {
  if (zmena.typ === 'delta') return zaokrouhliPlat(hrac.plat + zmena.castka)
  const faktor = 1 + zmena.hodnota / 100
  return zaokrouhliPlat(hrac.plat * faktor)
}

/** Změní plat všem hráčům soupisky najednou (delta v Kč nebo procenta). */
export function zmenPlatyVsech(state: GameState, zmena: ZmenaPlatuTymu): GameState {
  const s = structuredClone(state)
  const muj = s.tymy[s.mujKlubId]
  let celkemStary = 0
  let celkemNovy = 0
  let moralkaDelta = 0
  let zmeneno = 0
  let stiznosti = 0
  let spokojenosti = 0

  for (const hrac of muj.hraci) {
    const stary = hrac.plat
    const novy = novyPlatHrace(hrac, zmena)
    if (novy === stary) continue
    const dopad = dopadPlatuHrace(hrac, novy)
    hrac.plat = novy
    hrac.forma = clamp(hrac.forma + dopad.forma, 30, 70)
    moralkaDelta += dopad.moralka
    zmeneno++
    if (dopad.stiznost) stiznosti++
    else if (dopad.forma > 0) spokojenosti++
    celkemStary += stary
    celkemNovy += novy
  }

  if (zmeneno === 0) throw new Error('Žádný plat by se nezměnil — minimum je 10 000 Kč/měs.')

  muj.moralka = clamp(muj.moralka + Math.round(moralkaDelta / zmeneno), 30, 70)
  const popisZmeny =
    zmena.typ === 'delta'
      ? `${zmena.castka >= 0 ? '+' : ''}${zmena.castka.toLocaleString('cs-CZ')} Kč/měs`
      : `${zmena.hodnota >= 0 ? '+' : ''}${zmena.hodnota} %`
  zapisFinance(
    s,
    `Platy celého týmu (${popisZmeny}): ${celkemStary.toLocaleString('cs-CZ')} → ${celkemNovy.toLocaleString('cs-CZ')} Kč/měs`,
    0,
  )
  s.zpravy.unshift(
    `💰 Platy upraveny pro ${zmeneno} hráčů (${popisZmeny}). Nové náklady ${celkemNovy.toLocaleString('cs-CZ')} Kč/měs.`,
  )
  if (stiznosti > 0) {
    s.zpravy.unshift(`😤 ${stiznosti} hráčů si stěžuje na nízký plat.`)
  } else if (spokojenosti > 0) {
    s.zpravy.unshift(`✅ ${spokojenosti} hráčů je spokojených s navýšením.`)
  }
  s.zpravy = s.zpravy.slice(0, 50)
  return s
}

export type SpokojenostPlatu = 'velmi_spokojeny' | 'spokojeny' | 'nespokojeny' | 'stiznost'

export const POPIS_SPOKOJENOSTI_PLATU: Record<SpokojenostPlatu, string> = {
  velmi_spokojeny: 'Velmi spokojený',
  spokojeny: 'Spokojený',
  nespokojeny: 'Nespokojený',
  stiznost: 'Stěžuje si',
}

function spokojenostZPomeru(pomer: number): SpokojenostPlatu {
  if (pomer >= 1.1) return 'velmi_spokojeny'
  if (pomer >= 0.9) return 'spokojeny'
  if (pomer >= 0.7) return 'nespokojeny'
  return 'stiznost'
}

export function dopadPlatuHrace(
  h: Hrac,
  novyPlat: number,
): { forma: number; moralka: number; stiznost: boolean; spokojenost: SpokojenostPlatu } {
  const ocek = ocekavanyPlat(h)
  const pomer = novyPlat / Math.max(1, ocek)
  const spokojenost = spokojenostZPomeru(pomer)
  if (pomer >= 1.1) return { forma: 3, moralka: 2, stiznost: false, spokojenost }
  if (pomer >= 0.9) return { forma: 0, moralka: 0, stiznost: false, spokojenost }
  if (pomer >= 0.7) return { forma: -4, moralka: -3, stiznost: false, spokojenost }
  return { forma: -4, moralka: -3, stiznost: true, spokojenost }
}

export function souhrnSpokojenostiPlatu(
  hraci: Hrac[],
  navrhy: Record<string, number>,
): Record<SpokojenostPlatu, number> {
  const souhrn: Record<SpokojenostPlatu, number> = {
    velmi_spokojeny: 0,
    spokojeny: 0,
    nespokojeny: 0,
    stiznost: 0,
  }
  for (const h of hraci) {
    const plat = navrhy[h.id] ?? h.plat
    souhrn[dopadPlatuHrace(h, plat).spokojenost]++
  }
  return souhrn
}

export function navrhOptimalnichPlatu(hraci: Hrac[]): Record<string, number> {
  return Object.fromEntries(hraci.map((h) => [h.id, ocekavanyPlat(h)]))
}

/** Nastaví každému hráči očekávaný plat — spokojenost bez zbytečného přeplácení. */
export function optimalizujPlaty(state: GameState): GameState {
  const muj = state.tymy[state.mujKlubId]
  const navrhy = navrhOptimalnichPlatu(muj.hraci)
  const s = structuredClone(state)
  const tym = s.tymy[s.mujKlubId]
  let celkemStary = 0
  let celkemNovy = 0
  let moralkaDelta = 0
  let zmeneno = 0
  let zvyseno = 0
  let snizeno = 0

  for (const hrac of tym.hraci) {
    const stary = hrac.plat
    const novy = navrhy[hrac.id]!
    if (novy === stary) continue
    const dopad = dopadPlatuHrace(hrac, novy)
    hrac.plat = novy
    hrac.forma = clamp(hrac.forma + dopad.forma, 30, 70)
    moralkaDelta += dopad.moralka
    zmeneno++
    if (novy > stary) zvyseno++
    else snizeno++
    celkemStary += stary
    celkemNovy += novy
  }

  if (zmeneno === 0) throw new Error('Platy už jsou optimalizované — každý má očekávaný plat.')

  tym.moralka = clamp(tym.moralka + Math.round(moralkaDelta / zmeneno), 30, 70)
  const rozdil = celkemNovy - celkemStary
  zapisFinance(
    s,
    `Optimalizace platů: ${celkemStary.toLocaleString('cs-CZ')} → ${celkemNovy.toLocaleString('cs-CZ')} Kč/měs`,
    0,
  )
  s.zpravy.unshift(
    `⚖️ Platy optimalizované pro ${zmeneno} hráčů (${zvyseno} navýšeno, ${snizeno} sníženo). Náklady ${rozdil >= 0 ? '+' : ''}${rozdil.toLocaleString('cs-CZ')} Kč/měs.`,
  )
  s.zpravy.unshift('✅ Všichni hráči mají teď férový plat — spokojení bez zbytečného přeplácení.')
  s.zpravy = s.zpravy.slice(0, 50)
  return s
}

export function zapisFinance(s: GameState, popis: string, castka: number): void {
  s.financeHistorie.unshift({ den: s.den, popis, castka })
  s.financeHistorie = s.financeHistorie.slice(0, 50)
}

export function zmenPlat(state: GameState, hracId: string, novyPlat: number): GameState {
  if (novyPlat < MIN_PLAT) throw new Error('Plat musí být alespoň 10 000 Kč/měs.')
  const s = structuredClone(state)
  const muj = s.tymy[s.mujKlubId]
  const hrac = muj.hraci.find((h) => h.id === hracId)
  if (!hrac) throw new Error('Hráč nenalezen.')
  const dopad = dopadPlatuHrace(hrac, novyPlat)
  const stary = hrac.plat
  hrac.plat = zaokrouhliPlat(novyPlat)
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
