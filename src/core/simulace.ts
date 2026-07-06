import { pick, type Rng } from './rng'
import { silaTymu } from './sestava'
import type { Hrac, Tym, Udalost, Vysledek } from './types'

interface Strana {
  tym: Tym
  utok: number
  obrana: number
  brankar: number
  goly: number
  strely: number
  presilaDo: number // minuta, do které hraje přesilovku (0 = ne)
}

const jmeno = (h: Hrac) => `${h.jmeno} ${h.prijmeni}`

function vyberStrelce(rng: Rng, tym: Tym): Hrac {
  // váha podle střelby — hvězdy střílí častěji
  const bruslari = tym.hraci.filter((h) => h.pozice !== 'G')
  const celkem = bruslari.reduce((s, h) => s + h.atributy.strelba, 0)
  let los = rng() * celkem
  for (const h of bruslari) {
    los -= h.atributy.strelba
    if (los <= 0) return h
  }
  return bruslari[bruslari.length - 1]
}

function utocnaAkce(rng: Rng, utocici: Strana, branici: Strana, minuta: number, udalosti: Udalost[]): void {
  utocici.strely++
  const strelec = vyberStrelce(rng, utocici.tym)
  // šance na gól ze střely ~9 % při vyrovnaných silách, škáluje střelbou vs. brankářem
  const sance = 0.09 * (strelec.atributy.strelba / branici.brankar)
  if (rng() < sance) {
    utocici.goly++
    const spoluhraci = utocici.tym.hraci.filter((h) => h.pozice !== 'G' && h.id !== strelec.id)
    const asistent = rng() < 0.8 ? pick(rng, spoluhraci) : null
    udalosti.push({
      minuta,
      typ: 'gol',
      tymId: utocici.tym.klubId,
      hracId: strelec.id,
      asistentId: asistent?.id,
      text: `${minuta}. min — GÓL! ${jmeno(strelec)} (${utocici.tym.nazev})${asistent ? `, asistence ${jmeno(asistent)}` : ''}`,
    })
  } else if (rng() < 0.5) {
    udalosti.push({
      minuta,
      typ: 'zakrok',
      tymId: branici.tym.klubId,
      text: `${minuta}. min: ${jmeno(strelec)} střílí, ale brankář ${branici.tym.nazev} chytá.`,
    })
  } else {
    udalosti.push({
      minuta,
      typ: 'strela',
      tymId: utocici.tym.klubId,
      text: `${minuta}. min: střela ${jmeno(strelec)} vedle.`,
    })
  }
}

function minutaHry(rng: Rng, a: Strana, b: Strana, minuta: number, udalosti: Udalost[]): void {
  for (const [utocici, branici] of [
    [a, b],
    [b, a],
  ] as [Strana, Strana][]) {
    // vyloučení: ~1 za 25 minut na tým
    if (rng() < 0.04 && branici.presilaDo <= minuta) {
      const provinilec = pick(rng, utocici.tym.hraci.filter((h) => h.pozice !== 'G'))
      branici.presilaDo = minuta + 2
      udalosti.push({
        minuta,
        typ: 'vylouceni',
        tymId: utocici.tym.klubId,
        hracId: provinilec.id,
        text: `${minuta}. min: ${jmeno(provinilec)} (${utocici.tym.nazev}) — 2 minuty.`,
      })
    }
    // pravděpodobnost útočné akce podle poměru sil, ~0,4/min; přesilovka +60 %
    const presila = utocici.presilaDo > minuta ? 1.6 : 1
    const pomer = utocici.utok / (utocici.utok + branici.obrana)
    if (rng() < 0.8 * pomer * presila) utocnaAkce(rng, utocici, branici, minuta, udalosti)
  }
}

export function simulujZapas(domaci: Tym, hoste: Tym, rng: Rng): Vysledek {
  const sd = silaTymu(domaci)
  const sh = silaTymu(hoste)
  const a: Strana = { tym: domaci, ...sd, utok: sd.utok * 1.05, goly: 0, strely: 0, presilaDo: 0 } // výhoda domácího ledu +5 %
  const b: Strana = { tym: hoste, ...sh, goly: 0, strely: 0, presilaDo: 0 }
  const udalosti: Udalost[] = []

  for (let minuta = 1; minuta <= 60; minuta++) minutaHry(rng, a, b, minuta, udalosti)

  let prodlouzeni = false
  let najezdy = false
  if (a.goly === b.goly) {
    prodlouzeni = true
    udalosti.push({ minuta: 60, typ: 'info', tymId: '', text: 'Nerozhodně — jde se do prodloužení!' })
    for (let minuta = 61; minuta <= 65 && a.goly === b.goly; minuta++) minutaHry(rng, a, b, minuta, udalosti)
    if (a.goly === b.goly) {
      najezdy = true
      prodlouzeni = false
      // nájezdy: rozhodne poměr útoku a brankářů + náhoda
      const sancaDomacich = 0.5 + (a.utok / b.brankar - b.utok / a.brankar) * 0.1
      const vitez = rng() < sancaDomacich ? a : b
      vitez.goly++
      udalosti.push({
        minuta: 65,
        typ: 'gol',
        tymId: vitez.tym.klubId,
        hracId: vyberStrelce(rng, vitez.tym).id,
        text: `Rozhodující nájezd proměňuje ${vitez.tym.nazev}!`,
      })
    }
  }

  return {
    golyDomaci: a.goly,
    golyHoste: b.goly,
    strelyDomaci: a.strely,
    strelyHoste: b.strely,
    prodlouzeni,
    najezdy,
    udalosti,
  }
}
