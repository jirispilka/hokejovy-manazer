import type { DetailPozice, Hrac, Sestava } from './types'

export type { DetailPozice }

export interface SpojenaLajna {
  index: number // 0–3
  utok: string[]
  obrana: string[] // index 3 → obrana[2] (sdílená 3. dvojice)
  popis: string
}

const POPISY_LAJEN = ['1. lajna', '2. lajna', '3. lajna', '4. útok · sdílí 3. obranu'] as const

const POPIS_DETAIL: Record<DetailPozice, string> = {
  LW: 'LK',
  C: 'ST',
  RW: 'PK',
  LD: 'LO',
  RD: 'PO',
}

const PORADI_UTOKU: Record<DetailPozice, number> = { LW: 0, C: 1, RW: 2, LD: 99, RD: 99 }
const PORADI_OBRANY: Record<DetailPozice, number> = { LD: 0, RD: 1, LW: 99, C: 99, RW: 99 }

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

export function popisDetailPozice(p: DetailPozice): string {
  return POPIS_DETAIL[p]
}

/** Mapuje EP / externí označení na DetailPozice. */
export function mapujDetailPozici(raw: string | undefined | null): DetailPozice | undefined {
  if (!raw) return undefined
  const p = raw.trim().toUpperCase()
  if (p === 'C' || p === 'CENTER') return 'C'
  if (p === 'LW' || p === 'L' || p === 'LEFT WING') return 'LW'
  if (p === 'RW' || p === 'R' || p === 'RIGHT WING') return 'RW'
  if (p === 'LD' || p === 'LEFT DEFENSE' || p === 'LEFT DEFENCE') return 'LD'
  if (p === 'RD' || p === 'D' || p === 'RIGHT DEFENSE' || p === 'RIGHT DEFENCE') return 'RD'
  if (p === 'F' || p === 'W' || p === 'FORWARD') return undefined
  return undefined
}

export function detailPoziceHrace(h: Hrac): DetailPozice | null {
  if (h.pozice === 'G') return null
  if (h.detailPozice) return h.detailPozice
  const a = h.atributy
  if (h.pozice === 'D') {
    if (a.strelba >= a.obrana + 5) return 'LD'
    if (a.obrana >= a.strelba + 5) return 'RD'
    return hashId(h.id) % 2 === 0 ? 'LD' : 'RD'
  }
  if (a.strelba >= a.prihravky + 8) return hashId(h.id) % 2 === 0 ? 'LW' : 'RW'
  if (a.prihravky >= a.strelba + 8) return 'C'
  return hashId(h.id) % 2 === 0 ? 'LW' : 'RW'
}

export function spojeneLajny(sestava: Sestava): SpojenaLajna[] {
  return [0, 1, 2, 3].map((index) => ({
    index,
    utok: [...(sestava.utoky[index] ?? [])],
    obrana: [...(sestava.obrany[Math.min(index, 2)] ?? [])],
    popis: POPISY_LAJEN[index],
  }))
}

function poradiUtocnika(h: Hrac): number {
  const d = detailPoziceHrace(h)
  return d ? PORADI_UTOKU[d] : 1
}

function poradiObrance(h: Hrac): number {
  const d = detailPoziceHrace(h)
  return d ? PORADI_OBRANY[d] : 0
}

export function seradUtocniky(ids: string[], podleId: Map<string, Hrac>): string[] {
  return [...ids].sort((a, b) => {
    const ha = podleId.get(a)!
    const hb = podleId.get(b)!
    const pa = poradiUtocnika(ha)
    const pb = poradiUtocnika(hb)
    if (pa !== pb) return pa - pb
    return a.localeCompare(b)
  })
}

export function seradObrance(ids: string[], podleId: Map<string, Hrac>): string[] {
  return [...ids].sort((a, b) => {
    const ha = podleId.get(a)!
    const hb = podleId.get(b)!
    const pa = poradiObrance(ha)
    const pb = poradiObrance(hb)
    if (pa !== pb) return pa - pb
    return a.localeCompare(b)
  })
}

export type ZarazeniHrace = 'brankar' | 'lajna' | 'stridacka'

export function zarazeniHrace(sestava: Sestava, hracId: string): ZarazeniHrace | number {
  if (sestava.brankar === hracId) return 'brankar'
  for (let i = 0; i < 4; i++) {
    if (sestava.utoky[i]?.includes(hracId)) return i + 1
  }
  for (let i = 0; i < 3; i++) {
    if (sestava.obrany[i]?.includes(hracId)) return i + 1
  }
  return 'stridacka'
}

export function popisZarazeni(sestava: Sestava, hracId: string): string {
  const z = zarazeniHrace(sestava, hracId)
  if (z === 'brankar') return 'Brankář'
  if (z === 'stridacka') return 'Střídačka'
  return `${z}. lajna`
}
