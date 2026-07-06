import type { Zapas } from './types'

export const POCET_KOL = 26

// kolo 1 → den 3; pak střídavě +3 / +4 dny (2 zápasy týdně)
export function denKola(kolo: number): number {
  return 3 + Math.floor((kolo - 1) * 3.5)
}

export function vytvorRozpis(tymy: string[]): Zapas[] {
  const n = tymy.length // sudý počet (14)
  const pevny = tymy[0]
  const rotujici = tymy.slice(1)
  const zapasy: Zapas[] = []
  for (let k = 0; k < n - 1; k++) {
    const poradi = [pevny, ...rotujici]
    const pary: [string, string][] = []
    for (let i = 0; i < n / 2; i++) pary.push([poradi[i], poradi[n - 1 - i]])
    for (const [a, b] of pary) {
      // střídání domácího prostředí, ať nikdo nehraje pořád doma
      const [domaci, hoste] = k % 2 === 0 ? [a, b] : [b, a]
      zapasy.push({ kolo: k + 1, den: denKola(k + 1), domaci, hoste, vysledek: null })
      // odveta ve druhé polovině sezóny s prohozeným pořadatelstvím
      zapasy.push({
        kolo: k + n,
        den: denKola(k + n),
        domaci: hoste,
        hoste: domaci,
        vysledek: null,
      })
    }
    rotujici.unshift(rotujici.pop()!)
  }
  return zapasy.sort((x, y) => x.kolo - y.kolo)
}
