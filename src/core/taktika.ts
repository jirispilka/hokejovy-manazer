import type { Taktika } from './types'

export const TAKTIKY: { id: Taktika; nazev: string; popis: string }[] = [
  { id: 'velmi_utocna', nazev: 'Pressing', popis: 'Maximum útoku — riziko protiútoků' },
  { id: 'utocna', nazev: 'Útočná', popis: 'Více střel, méně krytí' },
  { id: 'vyvazena', nazev: 'Vyvážená', popis: 'Rovnováha mezi útokem a obranou' },
  { id: 'obranna', nazev: 'Obranná', popis: 'Zamknutá obrana, méně rizika' },
  { id: 'velmi_obranna', nazev: 'Beton', popis: 'Minimum gólů — těžké skórovat' },
]

const FAKTORY: Record<Taktika, { utok: number; obrana: number }> = {
  velmi_utocna: { utok: 1.35, obrana: 0.75 },
  utocna: { utok: 1.2, obrana: 0.85 },
  vyvazena: { utok: 1.0, obrana: 1.0 },
  obranna: { utok: 0.8, obrana: 1.15 },
  velmi_obranna: { utok: 0.65, obrana: 1.3 },
}

export function taktikaFaktory(t: Taktika): { utok: number; obrana: number } {
  return FAKTORY[t] ?? FAKTORY.vyvazena
}

export function nazevTaktiky(t: Taktika): string {
  return TAKTIKY.find((x) => x.id === t)?.nazev ?? 'Vyvážená'
}

export function normalizujTaktiku(t: unknown): Taktika {
  if (typeof t === 'string' && t in FAKTORY) return t as Taktika
  return 'vyvazena'
}
