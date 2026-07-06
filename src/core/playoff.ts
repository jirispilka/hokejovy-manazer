import type { Playoff, Serie } from './types'
import type { RadekTabulky } from './tabulka'

export function zalozPlayoff(tabulka: RadekTabulky[]): Playoff {
  const top = tabulka.slice(0, 8).map((r) => r.tymId)
  const serie = (a: number, b: number): Serie => ({
    domaci: top[a],
    hoste: top[b],
    vyhryDomaci: 0,
    vyhryHoste: 0,
  })
  return { kola: [[serie(0, 7), serie(1, 6), serie(2, 5), serie(3, 4)]], vitez: null, poradi: top }
}

const dohrana = (s: Serie) => s.vyhryDomaci === 3 || s.vyhryHoste === 3
export const vitezSerie = (s: Serie) => (s.vyhryDomaci === 3 ? s.domaci : s.hoste)

export function cekajiciSerie(p: Playoff): { kolo: number; index: number; serie: Serie }[] {
  const kolo = p.kola.length - 1
  return p.kola[kolo]
    .map((serie, index) => ({ kolo, index, serie }))
    .filter(({ serie }) => !dohrana(serie))
}

export function domaciLedSerie(s: Serie): string {
  const odehrano = s.vyhryDomaci + s.vyhryHoste // číslo dalšího zápasu − 1
  return [0, 1, 4].includes(odehrano) ? s.domaci : s.hoste
}

export function zapisVysledekSerie(p: Playoff, kolo: number, index: number, vyhralDomaci: boolean): Playoff {
  const novy: Playoff = structuredClone(p)
  const s = novy.kola[kolo][index]
  if (vyhralDomaci) s.vyhryDomaci++
  else s.vyhryHoste++
  const aktualni = novy.kola[novy.kola.length - 1]
  if (aktualni.every(dohrana)) {
    // přenasazení: vítězové se řadí podle umístění v základní části,
    // nejlepší hraje s nejhorším a lépe nasazený má výhodu domácího ledu
    const postupujici = aktualni
      .map(vitezSerie)
      .sort((a, b) => novy.poradi.indexOf(a) - novy.poradi.indexOf(b))
    if (postupujici.length === 1) {
      novy.vitez = postupujici[0]
    } else {
      const dalsi: Serie[] = []
      for (let i = 0; i < postupujici.length / 2; i++) {
        dalsi.push({
          domaci: postupujici[i],
          hoste: postupujici[postupujici.length - 1 - i],
          vyhryDomaci: 0,
          vyhryHoste: 0,
        })
      }
      novy.kola.push(dalsi)
    }
  }
  return novy
}
