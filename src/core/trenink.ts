import { overall } from './sestava'
import type { Atributy, GameState, Hrac, TreninkDen, TreninkIntenzita, TreninkTyp, Tym } from './types'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

const NAZVY: Record<TreninkTyp, string> = {
  strelba: 'střelba',
  utok: 'útok',
  obrana: 'obrana',
  kondice: 'kondice',
  taktika: 'taktika',
  odpocinek: 'odpočinek',
  volno: 'volno',
  zabava: 'zábava',
  parta: 'team building',
  sponzor: 'akce se sponzory',
}

export const BEZ_INTENZITY: TreninkTyp[] = ['odpocinek', 'volno', 'zabava', 'parta', 'sponzor']

const INTENZITA_NAZEV: Record<TreninkIntenzita, string> = { lehka: 'lehký', tezka: 'těžký' }

export const IKONY_TRENINKU: Record<TreninkTyp, string> = {
  strelba: '🎯',
  utok: '⚡',
  obrana: '🛡',
  kondice: '💪',
  taktika: '📋',
  odpocinek: '😴',
  volno: '☀',
  zabava: '🎉',
  parta: '🤝',
  sponzor: '🤵',
}

export const NAZVY_UI_TRENINKU: Record<TreninkTyp, string> = {
  strelba: 'Střelba',
  utok: 'Útok',
  obrana: 'Obrana',
  kondice: 'Kondice',
  taktika: 'Taktika',
  odpocinek: 'Odpočinek',
  volno: 'Volno',
  zabava: 'Zábava',
  parta: 'Team building',
  sponzor: 'Akce se sponzory',
}

export const TYPY_AKTIVIT: TreninkTyp[] = [
  'strelba',
  'utok',
  'obrana',
  'kondice',
  'taktika',
  'odpocinek',
  'volno',
  'zabava',
  'parta',
  'sponzor',
]

export const NAZEV_TRENINKU = (t: TreninkTyp, intenzita: TreninkIntenzita = 'tezka') =>
  BEZ_INTENZITY.includes(t) ? NAZVY[t] : `${INTENZITA_NAZEV[intenzita]} ${NAZVY[t]}`

export function intenzita(td: TreninkDen): TreninkIntenzita {
  return td.intenzita ?? 'tezka'
}

/** Migrace starých typů z ukládání v6. */
export function normalizujSeanci(td: TreninkDen): TreninkDen {
  const raw = td.typ as string
  const typ: TreninkTyp =
    raw === 'led' ? 'strelba' : raw === 'posilovna' ? 'kondice' : (raw as TreninkTyp)
  return { ...td, typ }
}

export function jeLedovyTyp(typ: TreninkTyp): boolean {
  return typ === 'strelba' || typ === 'utok' || typ === 'obrana'
}

export function jeKondiceTyp(typ: TreninkTyp): boolean {
  return typ === 'kondice'
}

export function potrebujeHrace(typ: TreninkTyp): 'dva' | 'jeden' | 'lajna' | null {
  if (jeLedovyTyp(typ)) return 'dva'
  if (jeKondiceTyp(typ)) return 'jeden'
  if (typ === 'taktika' || typ === 'parta') return 'lajna'
  return null
}

function bonusSponzorAkce(s: GameState): number {
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!.uroven
  return [800_000, 400_000, 200_000][liga]
}

export interface DenKalendare {
  den: number
  typ: 'zapas' | 'volny' | 'po_zapase'
  popis?: string
}

export interface TreninkVarovani {
  typ: 'info' | 'varovani'
  text: string
}

export interface RustDen {
  den: number
  polozky: string[]
}

export interface TreninkPreview {
  unavaPred: number
  unavaPo: number
  rust: string[]
  rustPoDnech: RustDen[]
  narocnost: number
  varovani: TreninkVarovani[]
}

export interface PreviewDne {
  unavaPred: number
  unavaPo: number
  formaPred: number
  formaPo: number
  moralkaPred: number
  moralkaPo: number
  naladaPred: number
  naladaPo: number
  rozpoctPred: number
  rozpoctPo: number
  rust: string[]
  narocnost: number
  varovani: TreninkVarovani[]
}

export function mojeZapasyDny(s: GameState): Set<number> {
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  return new Set(
    liga.zapasy
      .filter((z) => !z.vysledek && (z.domaci === s.mujKlubId || z.hoste === s.mujKlubId))
      .map((z) => z.den),
  )
}

export function dnyKalendare(s: GameState, pocet = 7): DenKalendare[] {
  const zapasy = mojeZapasyDny(s)
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  const dny: DenKalendare[] = []
  for (let d = s.den + 1; d <= s.den + pocet; d++) {
    if (zapasy.has(d)) {
      const z = liga.zapasy.find((x) => x.den === d && (x.domaci === s.mujKlubId || x.hoste === s.mujKlubId))!
      const doma = z.domaci === s.mujKlubId
      const souper = s.tymy[doma ? z.hoste : z.domaci].nazev
      dny.push({ den: d, typ: 'zapas', popis: doma ? `vs ${souper}` : `@ ${souper}` })
    } else if ([...zapasy].some((zd) => zd === d - 1)) {
      dny.push({ den: d, typ: 'po_zapase' })
    } else {
      dny.push({ den: d, typ: 'volny' })
    }
  }
  return dny
}

export function dalsiDen(s: GameState): DenKalendare {
  const dny = dnyKalendare(s, 1)
  if (dny.length === 0) throw new Error('Sezóna skončila.')
  return dny[0]
}

export function potrebujeVolbuDne(s: GameState): boolean {
  return dalsiDen(s).typ !== 'zapas'
}

function prumernaUnava(tym: Tym): number {
  if (tym.hraci.length === 0) return 0
  return Math.round(tym.hraci.reduce((sum, h) => sum + h.unava, 0) / tym.hraci.length)
}

export function prumernaUnavaTymu(tym: Tym): number {
  return prumernaUnava(tym)
}

function prumernaForma(tym: Tym): number {
  if (tym.hraci.length === 0) return 50
  return Math.round(tym.hraci.reduce((sum, h) => sum + h.forma, 0) / tym.hraci.length)
}

/** Únava po volném dni bez plánu — každý den automaticky −10 (advanceDay). */
export function unavaPoVolnemDnu(tym: Tym): number {
  const k = structuredClone(tym)
  for (const h of k.hraci) h.unava = clamp(h.unava - 10, 0, 100)
  return prumernaUnava(k)
}

/** Únava po dni s odpočinkem v plánu — denní −10 + trénink odpočinek −8. */
export function unavaPoOdpocinku(tym: Tym): number {
  const k = structuredClone(tym)
  for (const h of k.hraci) h.unava = clamp(h.unava - 10, 0, 100)
  for (const h of k.hraci) {
    h.unava = clamp(h.unava - 8, 0, 100)
    h.forma = clamp(h.forma + 2, 30, 70)
  }
  return prumernaUnava(k)
}

function planBudoucichDnu(s: GameState): Record<number, TreninkDen[]> {
  const plan: Record<number, TreninkDen[]> = {}
  for (const [denStr, seance] of Object.entries(s.treninkovyTyden ?? {})) {
    const den = Number(denStr)
    if (den > s.den) plan[den] = seance.map(normalizujSeanci)
  }
  return plan
}

function deltaUnavySeance(td: TreninkDen): number {
  const int = intenzita(td)
  if (jeLedovyTyp(td.typ)) return int === 'lehka' ? 5 : 12
  if (jeKondiceTyp(td.typ)) return (int === 'lehka' ? 2 : 5) - (int === 'lehka' ? 8 : 15)
  if (td.typ === 'taktika') return int === 'lehka' ? 1 : 3
  if (td.typ === 'odpocinek') return -8
  if (td.typ === 'zabava') return -4
  if (td.typ === 'parta') return 2
  if (td.typ === 'sponzor') return 4
  return 0
}

/** Souhrnný efekt únavy za den (všechny seance dohromady). */
export function efektUnavyDne(seance: TreninkDen[]): string {
  const delta = seance.reduce((s, td) => s + deltaUnavySeance(normalizujSeanci(td)), 0)
  const maOdpočinek = seance.some((td) => normalizujSeanci(td).typ === 'odpocinek')
  if (maOdpočinek && seance.length === 1) return '↓ únava, ↑ forma'
  const znamenko = delta > 0 ? '+' : ''
  if (delta <= -6) return `↓ únava týmu (${znamenko}${delta} %)`
  if (delta < -1) return `↓ mírně (${znamenko}${delta} %)`
  if (delta >= -1 && delta <= 1) return '≈ únava beze změny'
  if (delta <= 10) return `↑ únava týmu (${znamenko}${delta} %)`
  return `↑↑ únava týmu (${znamenko}${delta} %)`
}

export interface RadekDnePrehledu {
  den: number
  typ: 'zapas' | 'volny' | 'po_zapase'
  popisZapasu?: string
  treninkPopis: string | null
  efektUnavy: string | null
}

export interface PrehledKondice {
  unava: number
  forma: number
  unavaPoPlanu: number
  narocnost: number
  rust: string[]
  varovani: TreninkVarovani[]
  dny: RadekDnePrehledu[]
  odpocinek: { den: number; unavaPoVolny: number; unavaPoOdpoinku: number; vPlanu: boolean } | null
  nejviceUnaveni: { jmeno: string; unava: number }[]
  posledniTrenink: GameState['posledniTrenink']
}

export function prehledKondice(s: GameState): PrehledKondice {
  const muj = s.tymy[s.mujKlubId]
  const plan = planBudoucichDnu(s)
  const preview = previewTydne(s, plan)
  const kalend = dnyKalendare(s, 7)

  const dny: RadekDnePrehledu[] = kalend.map((d) => {
    const seance = (s.treninkovyTyden?.[d.den] ?? []).map(normalizujSeanci)
    const treninkPopis =
      seance.length > 0
        ? seance.map((td) => NAZEV_TRENINKU(td.typ, intenzita(td))).join(' · ')
        : d.typ === 'zapas'
          ? null
          : '— volno (bez plánu)'
    let efektUnavy: string | null = null
    if (d.typ === 'zapas') efektUnavy = '↑↑ únava ze zápasu'
    else if (seance.length > 0) efektUnavy = efektUnavyDne(seance)
    else if (d.typ === 'volny' || d.typ === 'po_zapase') efektUnavy = '−10 % únava'
    return {
      den: d.den,
      typ: d.typ,
      popisZapasu: d.popis,
      treninkPopis,
      efektUnavy,
    }
  })

  let odpocinek: PrehledKondice['odpocinek'] = null
  const prumUnava = prumernaUnava(muj)
  for (const d of dnyKalendare(s, 14)) {
    if (d.typ === 'zapas') continue
    const seance = (s.treninkovyTyden?.[d.den] ?? []).map(normalizujSeanci)
    if (seance.some((td) => td.typ === 'odpocinek')) {
      odpocinek = {
        den: d.den,
        unavaPoVolny: unavaPoVolnemDnu(muj),
        unavaPoOdpoinku: unavaPoOdpocinku(muj),
        vPlanu: true,
      }
      break
    }
  }
  if (!odpocinek && prumUnava > 12) {
    for (const d of dnyKalendare(s, 14)) {
      if (d.typ === 'zapas') continue
      const seance = s.treninkovyTyden?.[d.den] ?? []
      if (!seance.length && (d.typ === 'volny' || d.typ === 'po_zapase')) {
        odpocinek = {
          den: d.den,
          unavaPoVolny: unavaPoVolnemDnu(muj),
          unavaPoOdpoinku: unavaPoOdpocinku(muj),
          vPlanu: false,
        }
        break
      }
    }
  }

  const nejviceUnaveni = [...muj.hraci]
    .sort((a, b) => b.unava - a.unava)
    .slice(0, 3)
    .filter((h) => h.unava >= 35)
    .map((h) => ({ jmeno: h.prijmeni, unava: h.unava }))

  return {
    unava: prumernaUnava(muj),
    forma: prumernaForma(muj),
    unavaPoPlanu: preview.unavaPo,
    narocnost: preview.narocnost,
    rust: preview.rust.slice(0, 5),
    varovani: preview.varovani.slice(0, 3),
    dny,
    odpocinek,
    nejviceUnaveni,
    posledniTrenink: s.posledniTrenink,
  }
}

function vsechnySeance(plan: Record<number, TreninkDen[]>): { den: number; td: TreninkDen }[] {
  const out: { den: number; td: TreninkDen }[] = []
  for (const [denStr, seance] of Object.entries(plan)) {
    const den = Number(denStr)
    for (const td of seance ?? []) out.push({ den, td: normalizujSeanci(td) })
  }
  return out.sort((a, b) => a.den - b.den || 0)
}

function pocetLedovych(plan: Record<number, TreninkDen[]>): number {
  return vsechnySeance(plan).filter(({ td }) => jeLedovyTyp(td.typ)).length
}

/** Vážená náročnost týdne. */
export function narocnostTydne(plan: Record<number, TreninkDen[]>): number {
  let sum = 0
  for (const { td } of vsechnySeance(plan)) {
    if (td.typ === 'odpocinek' || td.typ === 'volno') continue
    const int = intenzita(td)
    if (td.typ === 'taktika') sum += int === 'lehka' ? 0.3 : 0.6
    else if (jeKondiceTyp(td.typ)) sum += int === 'lehka' ? 0.5 : 1
    else if (jeLedovyTyp(td.typ)) sum += int === 'lehka' ? 0.7 : 1
    else if (td.typ === 'zabava' || td.typ === 'parta' || td.typ === 'sponzor') sum += 0.2
  }
  return Math.round(sum * 10) / 10
}

const LIMIT_NAROCNOST_VAROVANI = 7
const LIMIT_NAROCNOST_POKUTA = 8

export function validujPlan(s: GameState, plan: Record<number, TreninkDen[]>): TreninkVarovani[] {
  const varovani: TreninkVarovani[] = []
  const zapasy = mojeZapasyDny(s)
  const narocnost = narocnostTydne(plan)
  if (narocnost >= LIMIT_NAROCNOST_POKUTA) {
    varovani.push({
      typ: 'varovani',
      text: `Přetrénink — náročnost ${narocnost}/${LIMIT_NAROCNOST_POKUTA} sníží formu celého týmu.`,
    })
  } else if (narocnost >= LIMIT_NAROCNOST_VAROVANI) {
    varovani.push({
      typ: 'info',
      text: `Náročný týden (${narocnost}/${LIMIT_NAROCNOST_POKUTA}) — hlídej únavu a zápasy.`,
    })
  }

  const ledCelkem = pocetLedovych(plan)
  if (ledCelkem >= 2) {
    varovani.push({
      typ: 'info',
      text: `${ledCelkem}× led v týdnu — od 2. tréninku na ledě je růst atributů poloviční.`,
    })
  }

  const ledBezHracu: number[] = []
  const kondiceBezHrace: number[] = []

  for (const [denStr, seance] of Object.entries(plan)) {
    const den = Number(denStr)
    const treninkove = (seance ?? []).filter((td) => {
      const t = normalizujSeanci(td).typ
      return t !== 'odpocinek' && t !== 'volno'
    })
    const tezke = treninkove.filter((td) => intenzita(td) === 'tezka')
    if (tezke.length >= 2) {
      varovani.push({ typ: 'varovani', text: `Den ${den}: dva těžké tréninky v jeden den — velké riziko únavy.` })
    }
    for (const raw of seance ?? []) {
      const td = normalizujSeanci(raw)
      if (jeLedovyTyp(td.typ) && intenzita(td) === 'tezka' && zapasy.has(den + 1)) {
        varovani.push({ typ: 'varovani', text: `Den ${den}: těžký led před zápasem — riskantní.` })
      }
      if (jeLedovyTyp(td.typ) && (!td.hraci || td.hraci.length < 2)) ledBezHracu.push(den)
      if (jeKondiceTyp(td.typ) && (!td.hraci || td.hraci.length < 1)) kondiceBezHrace.push(den)
    }
  }

  if (ledBezHracu.length > 0) {
    varovani.push({
      typ: 'info',
      text: `Vyber 2 hráče na led: ${ledBezHracu.map((d) => `den ${d}`).join(', ')}.`,
    })
  }
  if (kondiceBezHrace.length > 0) {
    varovani.push({
      typ: 'info',
      text: `Vyber hráče do kondice: ${kondiceBezHrace.map((d) => `den ${d}`).join(', ')}.`,
    })
  }

  const muj = s.tymy[s.mujKlubId]
  for (const h of muj.hraci) {
    const naLed = vsechnySeance(plan).some(({ td }) => jeLedovyTyp(td.typ) && td.hraci?.includes(h.id))
    if (h.unava > 70 && naLed) {
      varovani.push({ typ: 'varovani', text: `${h.prijmeni} je unavený (${h.unava}) — led může vést ke zranění.` })
    }
  }
  return varovani
}

function atributProLed(h: Hrac, typ: TreninkTyp, rng: () => number): keyof Atributy {
  if (typ === 'strelba') return rng() < 0.5 ? 'strelba' : 'technika'
  if (typ === 'utok') {
    if (h.pozice === 'D') return rng() < 0.5 ? 'prihravky' : 'technika'
    return rng() < 0.33 ? 'strelba' : rng() < 0.5 ? 'prihravky' : 'technika'
  }
  if (typ === 'obrana') {
    if (h.pozice === 'D') return rng() < 0.5 ? 'obrana' : 'brusleni'
    return rng() < 0.5 ? 'obrana' : 'fyzicka'
  }
  return rng() < 0.5 ? 'strelba' : 'technika'
}

function nazevAtributu(k: keyof Atributy): string {
  const map: Record<keyof Atributy, string> = {
    strelba: 'střelbu',
    prihravky: 'přihrávky',
    technika: 'techniku',
    obrana: 'obranu',
    brusleni: 'bruslení',
    fyzicka: 'fyzičku',
    vydrz: 'výdrž',
    chytani: 'chytání',
  }
  return map[k]
}

function previewAtributu(h: Hrac, typ: TreninkTyp): string {
  if (typ === 'strelba') return 'střelbu'
  if (typ === 'utok') return h.pozice === 'D' ? 'přihrávky' : 'střelbu/přihrávky'
  if (typ === 'obrana') return h.pozice === 'D' ? 'obranu' : 'obranu/fyzičku'
  return 'střelbu'
}

interface PreviewKontext {
  muj: Tym
  s: GameState
  rust: string[]
}

function aplikujSeanciPreview(
  ctx: PreviewKontext,
  td: TreninkDen,
  ledPoradi: number,
): number {
  const { muj } = ctx
  const int = intenzita(td)
  const rustFaktor = int === 'lehka' ? 0.5 : 1

  if (jeLedovyTyp(td.typ)) {
    ledPoradi++
    const unava = int === 'lehka' ? 5 : 12
    for (const id of td.hraci ?? []) {
      const h = muj.hraci.find((x) => x.id === id)
      if (!h || overall(h) >= h.potencial) continue
      const polovicni = ledPoradi >= 2 ? ' (poloviční)' : ''
      const lehky = int === 'lehka' ? ' (lehký)' : ''
      if (rustFaktor >= 1 || ledPoradi < 2) {
        ctx.rust.push(`${h.prijmeni} +1 ${previewAtributu(h, td.typ)}${polovicni}${lehky}`)
      }
    }
    for (const h of muj.hraci) h.unava = clamp(h.unava + unava, 0, 100)
  } else if (jeKondiceTyp(td.typ)) {
    const unavaPlus = int === 'lehka' ? 2 : 5
    const unavaMinus = int === 'lehka' ? 8 : 15
    for (const h of muj.hraci) h.unava = clamp(h.unava + unavaPlus - unavaMinus, 0, 100)
    const id = td.hraci?.[0]
    const h = id ? muj.hraci.find((x) => x.id === id) : null
    if (!h) ctx.rust.push('Kondice: vyber hráče')
    else if (overall(h) >= h.potencial) ctx.rust.push(`${h.prijmeni}: na stropu potenciálu`)
    else ctx.rust.push(`${h.prijmeni} +1 výdrž nebo fyzička${int === 'lehka' ? ' (lehký)' : ''}`)
  } else if (td.typ === 'taktika') {
    for (const h of muj.hraci) h.unava = clamp(h.unava + (int === 'lehka' ? 1 : 3), 0, 100)
    ctx.rust.push(`Taktika: +forma 2 hráčům, +chemie lajně${int === 'lehka' ? ' (lehká)' : ''}`)
  } else if (td.typ === 'odpocinek') {
    for (const h of muj.hraci) {
      h.unava = clamp(h.unava - 8, 0, 100)
      h.forma = clamp(h.forma + 2, 30, 70)
    }
    ctx.rust.push('Odpočinek: −únava, +forma celému týmu')
  } else if (td.typ === 'volno') {
    ctx.rust.push('Volno — jen denní regenerace')
  } else if (td.typ === 'zabava') {
    for (const h of muj.hraci) {
      h.unava = clamp(h.unava - 4, 0, 100)
      h.forma = clamp(h.forma + 3, 30, 70)
    }
    muj.moralka = clamp(muj.moralka + 3, 30, 70)
    ctx.rust.push('Zábava: +forma, +morálka, mírná regenerace')
  } else if (td.typ === 'parta') {
    for (const h of muj.hraci) h.unava = clamp(h.unava + 2, 0, 100)
    muj.moralka = clamp(muj.moralka + 4, 30, 70)
    const idx = td.lajna ?? 0
    if (idx <= 3) muj.chemie.utoky[idx] = Math.min(100, muj.chemie.utoky[idx] + 5)
    else muj.chemie.obrany[idx - 4] = Math.min(100, muj.chemie.obrany[idx - 4] + 5)
    ctx.rust.push('Team building: +chemie lajny, +morálka')
  } else if (td.typ === 'sponzor') {
    for (const h of muj.hraci) h.unava = clamp(h.unava + 4, 0, 100)
    ctx.s.trener.duvera = clamp(ctx.s.trener.duvera + 2, 0, 100)
    ctx.s.naladaFanousku = clamp(ctx.s.naladaFanousku + 4, 0, 100)
    muj.rozpocet += bonusSponzorAkce(ctx.s)
    ctx.rust.push(`Akce se sponzory: +${Math.round(bonusSponzorAkce(ctx.s) / 1000)} tis. Kč, +nálada, +důvěra`)
  }
  return ledPoradi
}

function simulujDenRegenerace(muj: Tym): void {
  for (const h of muj.hraci) h.unava = clamp(h.unava - 10, 0, 100)
}

export function previewDne(s: GameState, den: number, seance: TreninkDen[]): PreviewDne {
  const muj = structuredClone(s.tymy[s.mujKlubId])
  const sim = structuredClone(s)
  sim.tymy[s.mujKlubId] = muj
  simulujDenRegenerace(muj)

  const moralkaPred = muj.moralka
  const naladaPred = sim.naladaFanousku
  const rozpoctPred = muj.rozpocet
  const unavaPred = prumernaUnava(muj)
  const formaPred = prumernaForma(muj)

  const plan = { [den]: seance.map(normalizujSeanci) }
  const ctx: PreviewKontext = { muj, s: sim, rust: [] }
  let ledPoradi = 0
  for (const td of seance.map(normalizujSeanci)) {
    ledPoradi = aplikujSeanciPreview(ctx, td, ledPoradi)
  }
  const narocnost = narocnostTydne(plan)
  if (narocnost >= LIMIT_NAROCNOST_POKUTA) {
    for (const h of muj.hraci) h.forma = clamp(h.forma - 3, 30, 70)
  }

  return {
    unavaPred,
    unavaPo: prumernaUnava(muj),
    formaPred,
    formaPo: prumernaForma(muj),
    moralkaPred,
    moralkaPo: muj.moralka,
    naladaPred,
    naladaPo: sim.naladaFanousku,
    rozpoctPred,
    rozpoctPo: muj.rozpocet,
    rust: ctx.rust,
    narocnost,
    varovani: validujPlan(s, plan),
  }
}

export function previewTydne(s: GameState, plan: Record<number, TreninkDen[]>): TreninkPreview {
  const muj = structuredClone(s.tymy[s.mujKlubId])
  const unavaPred = prumernaUnava(muj)
  const rust: string[] = []
  const rustPoDnech: RustDen[] = []
  const sim = structuredClone(s)
  sim.tymy[s.mujKlubId] = muj
  let ledPoradi = 0
  for (const [denStr, seance] of Object.entries(plan).sort(([a], [b]) => Number(a) - Number(b))) {
    const den = Number(denStr)
    simulujDenRegenerace(muj)
    const polozky: string[] = []
    const ctx: PreviewKontext = { muj, s: sim, rust: polozky }
    for (const td of (seance ?? []).map(normalizujSeanci)) {
      ledPoradi = aplikujSeanciPreview(ctx, td, ledPoradi)
    }
    if (polozky.length > 0) {
      rustPoDnech.push({ den, polozky })
      rust.push(...polozky)
    }
  }
  const narocnost = narocnostTydne(plan)
  if (narocnost >= LIMIT_NAROCNOST_POKUTA) for (const h of muj.hraci) h.forma = clamp(h.forma - 3, 30, 70)
  return {
    unavaPred,
    unavaPo: prumernaUnava(muj),
    rust,
    rustPoDnech,
    narocnost,
    varovani: validujPlan(s, plan),
  }
}

export function doporucenyPlan(s: GameState): Record<number, TreninkDen[]> {
  const plan: Record<number, TreninkDen[]> = {}
  const muj = s.tymy[s.mujKlubId]
  const kandidati = muj.hraci
    .filter((h) => overall(h) < h.potencial && h.pozice !== 'G')
    .sort((a, b) => b.potencial - overall(b) - (a.potencial - overall(a)))
  const volne = dnyKalendare(s, 7).filter((d) => d.typ === 'volny' || d.typ === 'po_zapase')
  let treninku = 0
  for (const d of volne) {
    if (treninku >= 3) break
    if (d.typ === 'po_zapase') {
      plan[d.den] = [{ typ: 'odpocinek' }]
      continue
    }
    const zapasy = mojeZapasyDny(s)
    if (zapasy.has(d.den + 1)) {
      plan[d.den] = [{ typ: 'taktika', intenzita: 'lehka', lajna: 0 }]
    } else if (treninku === 0 && kandidati.length >= 2) {
      plan[d.den] = [{ typ: 'strelba', intenzita: 'tezka', hraci: [kandidati[0].id, kandidati[1].id] }]
    } else if (treninku === 1) {
      plan[d.den] = [{ typ: 'kondice', intenzita: 'tezka', hraci: [kandidati[0]?.id ?? muj.hraci[0].id] }]
    } else {
      plan[d.den] = [{ typ: 'taktika', intenzita: 'lehka', lajna: 1 }]
    }
    treninku++
  }
  return plan
}

export function potvrdTreninkovyPlan(s: GameState, plan: Record<number, TreninkDen[]>): GameState {
  const ns = structuredClone(s)
  const normalizovany: Record<number, TreninkDen[]> = {}
  for (const [denStr, seance] of Object.entries(plan)) {
    normalizovany[Number(denStr)] = seance.map(normalizujSeanci)
  }
  ns.treninkovyTyden = normalizovany
  ns.treninkovyTydenOd = s.den
  return ns
}

export function potvrdDen(s: GameState, den: number, seance: TreninkDen[]): GameState {
  const ns = structuredClone(s)
  if (!ns.treninkovyTyden) ns.treninkovyTyden = {}
  ns.treninkovyTyden[den] = seance.map(normalizujSeanci)
  return ns
}

function zlepsAtribut(h: Hrac, klic: keyof Atributy, rng: () => number, faktor = 1): boolean {
  if (overall(h) >= h.potencial) return false
  if (h.atributy[klic] >= 99) return false
  if (faktor < 1 && rng() >= faktor) return false
  h.atributy[klic]++
  return true
}

function poradiLedove(plan: Record<number, TreninkDen[]>, den: number, index: number): number {
  let poradi = 0
  for (const [denStr, seance] of Object.entries(plan).sort(([a], [b]) => Number(a) - Number(b))) {
    const d = Number(denStr)
    for (let i = 0; i < (seance ?? []).length; i++) {
      const td = normalizujSeanci(seance[i])
      if (jeLedovyTyp(td.typ)) {
        poradi++
        if (d === den && i === index) return poradi
      }
    }
  }
  return poradi
}

function aplikujSeanci(s: GameState, den: number, td: TreninkDen, index: number, rng: () => number): string[] {
  const muj = s.tymy[s.mujKlubId]
  const typ = normalizujSeanci(td).typ
  const int = intenzita(td)
  const zlepseni: string[] = []
  const zprava = (h: Hrac, co: string) => {
    zlepseni.push(`${h.jmeno} ${h.prijmeni} — ${co}`)
    s.zpravy.unshift(`📈 Trénink (${NAZEV_TRENINKU(typ, int)}): ${h.jmeno} ${h.prijmeni} zlepšil ${co}.`)
  }

  const ledPoradi = jeLedovyTyp(typ) ? poradiLedove(s.treninkovyTyden, den, index) : 0
  const ledFaktor = (ledPoradi >= 2 ? 0.5 : 1) * (int === 'lehka' ? 0.5 : 1)

  if (jeLedovyTyp(typ)) {
    const unava = int === 'lehka' ? 5 : 12
    for (const h of muj.hraci) h.unava = clamp(h.unava + unava, 0, 100)
    const riziko = int === 'lehka' ? 0.01 : 0.03
    for (const id of td.hraci ?? []) {
      const h = muj.hraci.find((x) => x.id === id)
      if (!h) continue
      if (h.unava > 70 && rng() < riziko) {
        h.zranenZapasu = 1 + Math.floor(rng() * 2)
        s.zpravy.unshift(`🚑 ${h.jmeno} ${h.prijmeni} se zranil na tréninku.`)
      }
      const klic = atributProLed(h, typ, rng)
      if (zlepsAtribut(h, klic, rng, ledFaktor)) zprava(h, nazevAtributu(klic))
    }
  } else if (jeKondiceTyp(typ)) {
    const unavaPlus = int === 'lehka' ? 2 : 5
    const unavaMinus = int === 'lehka' ? 8 : 15
    for (const h of muj.hraci) h.unava = clamp(h.unava + unavaPlus - unavaMinus, 0, 100)
    const id = td.hraci?.[0]
    const h = id ? muj.hraci.find((x) => x.id === id) : null
    if (h) {
      const klic: keyof Atributy = rng() < 0.5 ? 'vydrz' : 'fyzicka'
      const faktor = int === 'lehka' ? 0.5 : 1
      if (zlepsAtribut(h, klic, rng, faktor)) zprava(h, nazevAtributu(klic))
    }
  } else if (typ === 'taktika') {
    const formaBonus = int === 'lehka' ? 2 : 3
    const chemieBonus = int === 'lehka' ? 2 : 4
    for (const h of muj.hraci) h.unava = clamp(h.unava + (int === 'lehka' ? 1 : 3), 0, 100)
    const pole = muj.hraci.filter((h) => h.pozice !== 'G')
    for (let i = 0; i < 2 && pole.length > 0; i++) {
      const h = pole[Math.floor(rng() * pole.length)]
      h.forma = clamp(h.forma + formaBonus, 30, 70)
      zlepseni.push(`${h.jmeno} ${h.prijmeni} — forma`)
    }
    const idx = td.lajna ?? 0
    if (idx <= 3) muj.chemie.utoky[idx] = Math.min(100, muj.chemie.utoky[idx] + chemieBonus)
    else muj.chemie.obrany[idx - 4] = Math.min(100, muj.chemie.obrany[idx - 4] + chemieBonus)
  } else if (typ === 'odpocinek') {
    for (const h of muj.hraci) {
      h.unava = clamp(h.unava - 8, 0, 100)
      h.forma = clamp(h.forma + 2, 30, 70)
    }
  } else if (typ === 'volno') {
    // jen denní regenerace z advanceDay
  } else if (typ === 'zabava') {
    for (const h of muj.hraci) {
      h.unava = clamp(h.unava - 4, 0, 100)
      h.forma = clamp(h.forma + 3, 30, 70)
    }
    muj.moralka = clamp(muj.moralka + 3, 30, 70)
    zlepseni.push('Tým — +forma, +morálka')
  } else if (typ === 'parta') {
    for (const h of muj.hraci) h.unava = clamp(h.unava + 2, 0, 100)
    muj.moralka = clamp(muj.moralka + 4, 30, 70)
    const idx = td.lajna ?? 0
    if (idx <= 3) muj.chemie.utoky[idx] = Math.min(100, muj.chemie.utoky[idx] + 5)
    else muj.chemie.obrany[idx - 4] = Math.min(100, muj.chemie.obrany[idx - 4] + 5)
    zlepseni.push('Lajna — +chemie, +morálka')
  } else if (typ === 'sponzor') {
    for (const h of muj.hraci) h.unava = clamp(h.unava + 4, 0, 100)
    s.trener.duvera = clamp(s.trener.duvera + 2, 0, 100)
    s.naladaFanousku = clamp(s.naladaFanousku + 4, 0, 100)
    const bonus = bonusSponzorAkce(s)
    muj.rozpocet += bonus
    zlepseni.push(`Klub — +${Math.round(bonus / 1000)} tis. Kč od sponzorů`)
  }
  return zlepseni
}

export function aplikujTrenink(s: GameState, den: number, rng: () => number): void {
  const seance = s.treninkovyTyden[den]
  if (!seance?.length) return
  const vsechnaZlepseni: string[] = []
  seance.forEach((td, index) => {
    vsechnaZlepseni.push(...aplikujSeanci(s, den, td, index, rng))
  })
  if (narocnostTydne(s.treninkovyTyden) >= LIMIT_NAROCNOST_POKUTA) {
    for (const h of s.tymy[s.mujKlubId].hraci) h.forma = clamp(h.forma - 3, 30, 70)
  }
  const posledni = normalizujSeanci(seance[seance.length - 1])
  s.posledniTrenink = { den, zamereni: posledni.typ, zlepseni: vsechnaZlepseni }
  s.zpravy = s.zpravy.slice(0, 50)
}

/** Doplní vybrané hráče do seancí bez přiřazení (led / kondice) v daném dni. */
export function doplnHraciDoSeanci(
  plan: Record<number, TreninkDen[]>,
  den: number,
  hraci: string[],
): Record<number, TreninkDen[]> {
  const seance = plan[den]
  if (!seance?.length || hraci.length === 0) return plan
  let kondicePrirazena = false
  let ledOffset = 0
  const updated = seance.map((raw) => {
    const td = normalizujSeanci(raw)
    if (jeKondiceTyp(td.typ) && (!td.hraci || td.hraci.length === 0) && !kondicePrirazena) {
      kondicePrirazena = true
      return { ...td, hraci: [hraci[0]] }
    }
    if (jeLedovyTyp(td.typ) && (!td.hraci || td.hraci.length < 2) && hraci.length - ledOffset >= 2) {
      const par = hraci.slice(ledOffset, ledOffset + 2)
      ledOffset += 2
      return { ...td, hraci: par }
    }
    return td
  })
  if (JSON.stringify(updated) === JSON.stringify(seance)) return plan
  return { ...plan, [den]: updated }
}

/** Migrace starého formátu (1 trénink/den) na pole seancí. */
export function normalizujTreninkovyPlan(plan: Record<number, TreninkDen | TreninkDen[]>): Record<number, TreninkDen[]> {
  const out: Record<number, TreninkDen[]> = {}
  for (const [denStr, val] of Object.entries(plan ?? {})) {
    if (!val) continue
    const seance = Array.isArray(val) ? val : [val]
    out[Number(denStr)] = seance.map(normalizujSeanci)
  }
  return out
}
