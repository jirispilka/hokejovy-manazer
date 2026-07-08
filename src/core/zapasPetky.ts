import { POPISY_LAJEN } from './lajny'
import type { StranaZapasu, StavZapasu } from './zapas'
import type { Tym } from './types'

/** Pětka = spojená lajna (3 útočníci + 2 obránci), index 0–3 dle sestavy. */
export interface Petka {
  index: number
}

export function utokPetky(petka: Petka): number {
  return petka.index
}

export function obranaPetky(petka: Petka): number {
  return Math.min(petka.index, 2)
}

export function petkaZeIndexu(index: number): Petka {
  return { index: Math.min(Math.max(index, 0), 3) }
}

export interface PrehledLajnyUtoku {
  index: number
  energie: number
  naLedu: boolean
  vytizeni: number
  vypnuta: boolean
  poradi: number
  casNaLedu: number
}

export const VYCHOZI_PORADI_UTOKU: [number, number, number, number] = [0, 1, 2, 3]
export const VYCHOZI_PORADI_OBRAN: [number, number, number] = [0, 1, 2]
export const VYCHOZI_VYTIZENI: [number, number, number, number] = [1, 1, 1, 1]
/** 0 = lajna nehraje; jinak krok 0.5 až MAX. */
export const MIN_VYTIZENI_UTOKU = 0
export const KROK_VYTIZENI_UTOKU = 0.5
export const MAX_VYTIZENI_UTOKU = 2

export function zaokrouhliVytizeniUtoku(w: number): number {
  if (!Number.isFinite(w) || w <= 0) return 0
  const q = Math.round(w * 2) / 2
  return Math.min(MAX_VYTIZENI_UTOKU, Math.max(KROK_VYTIZENI_UTOKU, q))
}

export function normalizujVytizeniUtoku(
  v: [number, number, number, number],
): [number, number, number, number] {
  return v.map(zaokrouhliVytizeniUtoku) as [number, number, number, number]
}

/** Podíl ice timeu útokových lajn (součet = 1) — vypnuté lajny (0) se nepočítají. */
export function vahyUtokuZVytizeni(v: [number, number, number, number]): [number, number, number, number] {
  const n = normalizujVytizeniUtoku(v)
  const sum = n.reduce((a, b) => a + b, 0)
  if (sum <= 0) return [0.35, 0.28, 0.22, 0.15]
  return n.map((w) => w / sum) as [number, number, number, number]
}

/** Váhy obranných dvojic podle vytížení útoků (1. dvojice ↔ 1. lajna). */
export function vahyObranyZVytizeni(v: [number, number, number, number]): [number, number, number] {
  const u = vahyUtokuZVytizeni(v)
  const raw: [number, number, number] = [u[0], u[1], (u[2] + u[3]) / 2]
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map((w) => w / sum) as [number, number, number]
}

export function hraciPetky(strana: StranaZapasu, petka: Petka): string[] {
  const u = utokPetky(petka)
  const o = obranaPetky(petka)
  return [...strana.sestava.utoky[u], ...strana.sestava.obrany[o]].filter(
    (id) => !strana.zraneni.includes(id),
  )
}

export function pocetZdravychVPetce(strana: StranaZapasu, petka: Petka): number {
  return hraciPetky(strana, petka).length
}

export function jePetkaKompletni(strana: StranaZapasu, petka: Petka): boolean {
  return pocetZdravychVPetce(strana, petka) === 5
}

export const MIN_ENERGIE_ZAPAS = 0

export function nastavEnergiu(strana: StranaZapasu, id: string, hodnota: number): void {
  strana.energie[id] = Math.round(Math.min(100, Math.max(MIN_ENERGIE_ZAPAS, hodnota)))
}

export function zmenEnergiu(strana: StranaZapasu, id: string, delta: number): void {
  nastavEnergiu(strana, id, (strana.energie[id] ?? 100) + delta)
}

export function prumerEnergie(ids: string[], strana: StranaZapasu): number {
  if (ids.length === 0) return 100
  const sum = ids.reduce((s, id) => s + (strana.energie[id] ?? 100), 0)
  return Math.round(sum / ids.length)
}

export function energieUtokLajny(strana: StranaZapasu, index: number): number {
  return prumerEnergie(strana.sestava.utoky[index] ?? [], strana)
}

export function energieObranaLajny(strana: StranaZapasu, index: number): number {
  return prumerEnergie(strana.sestava.obrany[index] ?? [], strana)
}

export function energiePetky(strana: StranaZapasu, petka: Petka): number {
  return prumerEnergie(hraciPetky(strana, petka), strana)
}

export function vsechnyPetky(): Petka[] {
  return [0, 1, 2, 3].map((index) => ({ index }))
}

export function popisPetky(petka: Petka): string {
  return POPISY_LAJEN[petka.index] ?? `${petka.index + 1}. lajna`
}

export function popisPetkyDetail(tym: Tym, strana: StranaZapasu, petka: Petka): string {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const ids = hraciPetky(strana, petka)
  const jmena = ids.map((id) => {
    const h = podleId.get(id)!
    const z = strana.zraneni.includes(id) ? '🚑' : ''
    return `${h.prijmeni}${z}`
  })
  return `${popisPetky(petka)} (${jmena.join(', ')})`
}

/** Vážené pořadí — vytíženost 0 = lajna nehraje; 2 = 2× víc slotů než 1. */
export function vahovePoradi(poradi: number[], vahy: number[]): number[] {
  const slots: number[] = []
  for (const idx of poradi) {
    const w = vahy[idx] ?? 0
    if (w <= 0) continue
    const n = Math.max(1, Math.round(w * 4))
    for (let i = 0; i < n; i++) slots.push(idx)
  }
  if (slots.length > 0) return slots
  const aktivni = poradi.filter((idx) => (vahy[idx] ?? 0) > 0)
  return aktivni.length > 0 ? aktivni : [...poradi]
}

export function aktivniPetkaNaLedu(strana: StranaZapasu, minuta: number): Petka {
  if (strana.presilaDo > minuta && strana.aktivniPetka) return strana.aktivniPetka
  return aktivniLajnyEven(strana, minuta)
}

/** Která spojená lajna právě hraje (rotace ~2 min, vážená vytížeností). */
export function aktivniLajnyEven(strana: StranaZapasu, minuta: number): Petka {
  const tick = Math.max(0, Math.floor(minuta / 2))
  const poradiU = strana.poradiUtoku ?? VYCHOZI_PORADI_UTOKU
  const vyt = normalizujVytizeniUtoku(strana.vytizeniUtoku ?? VYCHOZI_VYTIZENI)
  const slotsU = vahovePoradi(poradiU, vyt)
  return { index: slotsU[tick % slotsU.length] }
}

function indexUtoku(strana: StranaZapasu, hracId: string): number | null {
  for (let i = 0; i < 4; i++) if (strana.sestava.utoky[i].includes(hracId)) return i
  return null
}

export function prumerEnergieNaLedu(strana: StranaZapasu, minuta: number): number {
  return prumerEnergie(hraciPetky(strana, aktivniLajnyEven(strana, minuta)), strana)
}

/** Únava a čas na ledě za jednu odehranou minutu. */
export function spotrebujEnergiuStrany(strana: StranaZapasu, tym: Tym, minuta: number): void {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const aktivni = aktivniLajnyEven(strana, minuta)
  const aktivniUtok = utokPetky(aktivni)
  const aktivniObrana = obranaPetky(aktivni)
  const vyt = normalizujVytizeniUtoku(strana.vytizeniUtoku ?? VYCHOZI_VYTIZENI)
  const naLedu = new Set(hraciPetky(strana, aktivni))
  if (strana.aktivniPetka && strana.presilaDo > minuta) {
    for (const id of hraciPetky(strana, strana.aktivniPetka)) naLedu.add(id)
  }
  if (strana.pkPetka) {
    for (const id of hraciPetky(strana, strana.pkPetka)) naLedu.add(id)
  }

  const cu = [...(strana.casNaLeduUtoku ?? [0, 0, 0, 0])] as [number, number, number, number]
  cu[aktivniUtok]++
  strana.casNaLeduUtoku = cu
  const co = [...(strana.casNaLeduObran ?? [0, 0, 0])] as [number, number, number]
  co[aktivniObrana]++
  strana.casNaLeduObran = co

  for (const id of [...strana.sestava.utoky.flat(), ...strana.sestava.obrany.flat()]) {
    if (strana.zraneni.includes(id)) continue
    const vydrz = podleId.get(id)!.atributy.vydrz
    const utIdx = indexUtoku(strana, id)
    const vytHrace = utIdx !== null ? vyt[utIdx] : 1
    if (naLedu.has(id)) {
      const base = 1.05 + ((99 - vydrz) / 99) * 1.15
      const mult = 0.85 + vytHrace * 0.28
      zmenEnergiu(strana, id, -base * mult)
    } else {
      zmenEnergiu(strana, id, 0.05 + (vydrz / 99) * 0.22)
    }
  }
}

export function prehledUtoku(strana: StranaZapasu, minuta: number): PrehledLajnyUtoku[] {
  const aktivni = aktivniLajnyEven(strana, minuta)
  const cas = strana.casNaLeduUtoku ?? [0, 0, 0, 0]
  return [0, 1, 2, 3].map((index) => ({
    index,
    energie: energieUtokLajny(strana, index),
    naLedu: index === aktivni.index,
    vytizeni: normalizujVytizeniUtoku(strana.vytizeniUtoku ?? VYCHOZI_VYTIZENI)[index],
    vypnuta: normalizujVytizeniUtoku(strana.vytizeniUtoku ?? VYCHOZI_VYTIZENI)[index] <= 0,
    poradi: (strana.poradiUtoku ?? VYCHOZI_PORADI_UTOKU).indexOf(index),
    casNaLedu: cas[index],
  }))
}

export function nejlepsiPetkaPP(strana: StranaZapasu, preferIndex = 0): Petka {
  let best: Petka = { index: preferIndex }
  let bestE = -1
  for (const petka of vsechnyPetky()) {
    if (!jePetkaKompletni(strana, petka)) continue
    const e = energiePetky(strana, petka)
    const bonus = petka.index === 0 ? 3 : petka.index === 1 ? 1 : 0
    if (e + bonus > bestE) {
      bestE = e + bonus
      best = petka
    }
  }
  return best
}

export function nastavPoradiUtoku(
  stav: StavZapasu,
  strana: 'domaci' | 'hoste',
  poradi: [number, number, number, number],
): StavZapasu {
  const s = structuredClone(stav)
  s[strana].poradiUtoku = poradi
  return s
}

export function posunUtokVPoradi(stav: StavZapasu, strana: 'domaci' | 'hoste', index: number, smer: -1 | 1): StavZapasu {
  const s = structuredClone(stav)
  const poradi = [...(s[strana].poradiUtoku ?? VYCHOZI_PORADI_UTOKU)] as number[]
  const pos = poradi.indexOf(index)
  if (pos < 0) return s
  const novy = pos + smer
  if (novy < 0 || novy >= 4) return s
  ;[poradi[pos], poradi[novy]] = [poradi[novy], poradi[pos]]
  s[strana].poradiUtoku = poradi as [number, number, number, number]
  return s
}

export function zmenVytizeniUtoku(
  stav: StavZapasu,
  strana: 'domaci' | 'hoste',
  index: number,
  delta: number,
): StavZapasu {
  const s = structuredClone(stav)
  const v = normalizujVytizeniUtoku([...(s[strana].vytizeniUtoku ?? VYCHOZI_VYTIZENI)] as number[])
  const raw = v[index] + delta
  v[index] = raw <= 0 ? 0 : zaokrouhliVytizeniUtoku(raw)
  if (v.every((w) => w <= 0)) v[index] = KROK_VYTIZENI_UTOKU
  s[strana].vytizeniUtoku = v
  return s
}

export function zmenVytizeniTymu(tym: Tym, index: number, delta: number): Tym {
  const v = normalizujVytizeniUtoku([...(tym.vytizeniUtoku ?? VYCHOZI_VYTIZENI)] as number[])
  const raw = v[index] + delta
  v[index] = raw <= 0 ? 0 : zaokrouhliVytizeniUtoku(raw)
  if (v.every((w) => w <= 0)) v[index] = KROK_VYTIZENI_UTOKU
  return { ...tym, vytizeniUtoku: v }
}
