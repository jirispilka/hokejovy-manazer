import type { Zapas } from './types'

export interface RadekTabulky {
  tymId: string
  zapasy: number
  vyhry: number // v normální hrací době
  vyhryP: number // v prodloužení / nájezdech
  prohryP: number
  prohry: number
  vstrelene: number
  obdrzene: number
  body: number
}

export function spocitejTabulku(tymy: string[], zapasy: Zapas[]): RadekTabulky[] {
  const radky = new Map<string, RadekTabulky>(
    tymy.map((t) => [
      t,
      { tymId: t, zapasy: 0, vyhry: 0, vyhryP: 0, prohryP: 0, prohry: 0, vstrelene: 0, obdrzene: 0, body: 0 },
    ]),
  )
  for (const z of zapasy) {
    const v = z.vysledek
    if (!v) continue
    const d = radky.get(z.domaci)!
    const h = radky.get(z.hoste)!
    const poProdlouzeni = v.prodlouzeni || v.najezdy
    const [vitez, porazeny] = v.golyDomaci > v.golyHoste ? [d, h] : [h, d]
    d.zapasy++, h.zapasy++
    d.vstrelene += v.golyDomaci, d.obdrzene += v.golyHoste
    h.vstrelene += v.golyHoste, h.obdrzene += v.golyDomaci
    if (poProdlouzeni) {
      vitez.vyhryP++, vitez.body += 2
      porazeny.prohryP++, porazeny.body += 1
    } else {
      vitez.vyhry++, vitez.body += 3
      porazeny.prohry++
    }
  }
  return [...radky.values()].sort(
    (a, b) =>
      b.body - a.body ||
      b.vstrelene - b.obdrzene - (a.vstrelene - a.obdrzene) ||
      b.vstrelene - a.vstrelene,
  )
}
