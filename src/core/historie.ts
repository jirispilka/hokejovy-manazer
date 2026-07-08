import { vyhodnotCilPoSezone } from './kariera'
import { spocitejTabulku } from './tabulka'
import type { CekajiciZapas, GameState, Vysledek } from './types'

export function vyhodnotSezonu(s: GameState): void {
  const mistri = s.ligy.map((l) => ({ nazevLigy: l.nazev, klubId: l.playoff!.vitez! }))
  const kraloveStrelcu = s.ligy.map((l) => {
    let top = { nazevLigy: l.nazev, jmeno: '', klubId: '', goly: -1 }
    for (const klubId of l.tymy) {
      for (const h of s.tymy[klubId].hraci) {
        if (h.goly > top.goly) {
          top = { nazevLigy: l.nazev, jmeno: `${h.jmeno} ${h.prijmeni}`, klubId, goly: h.goly }
        }
      }
    }
    return top
  })
  const mujTym = s.tymy[s.mujKlubId]
  const hvezda = [...mujTym.hraci].sort((a, b) => b.goly + b.asistence - (a.goly + a.asistence))[0]
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  const tabulka = spocitejTabulku(liga.tymy, liga.zapasy)
  const umisteni = tabulka.findIndex((r) => r.tymId === s.mujKlubId) + 1
  const splnen = vyhodnotCilPoSezone(s)
  const vyhralPlayoff = liga.playoff?.vitez === s.mujKlubId
  const trofej = vyhralPlayoff
    ? liga.uroven === 0
      ? `Mistr extraligy (sezóna ${s.sezona})`
      : `Vítěz ${liga.nazev} a postup (sezóna ${s.sezona})`
    : null
  if (trofej) s.trener.kariera.trofeje.push(trofej)
  s.vyhlaseni = {
    sezona: s.sezona,
    mistri,
    kraloveStrelcu,
    hvezdaTymu: hvezda
      ? { jmeno: `${hvezda.jmeno} ${hvezda.prijmeni}`, goly: hvezda.goly, asistence: hvezda.asistence }
      : null,
  }
  s.historie.push({
    sezona: s.sezona,
    klubId: s.mujKlubId,
    nazevLigy: liga.nazev,
    umisteni,
    cil: s.cilSezony.typ,
    splnen,
    trofej,
  })
  const strelec = [...mujTym.hraci].sort((a, b) => b.goly - a.goly)[0]
  if (strelec && (!s.rekordy.nejlepsiStrelec || strelec.goly > s.rekordy.nejlepsiStrelec.goly)) {
    s.rekordy.nejlepsiStrelec = { jmeno: `${strelec.jmeno} ${strelec.prijmeni}`, goly: strelec.goly }
  }
}

export function zapisRekordVyhry(s: GameState, v: Vysledek, cz: CekajiciZapas): void {
  const mujDomaci = cz.domaci === s.mujKlubId
  const moje = mujDomaci ? v.golyDomaci : v.golyHoste
  const jeho = mujDomaci ? v.golyHoste : v.golyDomaci
  const rozdil = moje - jeho
  if (rozdil <= 0) return
  if (s.rekordy.nejvyssiVyhra && s.rekordy.nejvyssiVyhra.rozdil >= rozdil) return
  const domaci = s.tymy[cz.domaci].nazev
  const hoste = s.tymy[cz.hoste].nazev
  s.rekordy.nejvyssiVyhra = {
    text: `${domaci} ${v.golyDomaci}:${v.golyHoste} ${hoste} (sezóna ${s.sezona})`,
    rozdil,
  }
}
