import rivalove from './data/rivalove.json'
import { nabidkySponzora } from './hodnoty'
import { overall } from './sestava'
import { spocitejTabulku } from './tabulka'
import type { CekajiciZapas, CilSezony, GameState, TypCile, Vysledek } from './types'

const PARY = rivalove as [string, string][]
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const ligaKlubu = (s: GameState, klubId: string) => s.ligy.find((l) => l.tymy.includes(klubId))!

export function jeDerby(a: string, b: string): boolean {
  return PARY.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

export function prumernyOverall(s: GameState, klubId: string): number {
  const tym = s.tymy[klubId]
  return tym.hraci.reduce((sum, h) => sum + overall(h), 0) / tym.hraci.length
}

export function urciCilSezony(s: GameState, klubId: string): CilSezony {
  const liga = ligaKlubu(s, klubId)
  const poradi = [...liga.tymy].sort((a, b) => prumernyOverall(s, b) - prumernyOverall(s, a))
  const rank = poradi.indexOf(klubId) + 1
  const typ: TypCile =
    rank <= 2
      ? liga.uroven === 0
        ? 'titul'
        : 'postup'
      : rank <= 8
        ? 'playoff'
        : rank <= 11
          ? 'stred'
          : 'zachrana'
  const popisy: Record<TypCile, string> = {
    titul: 'Vedení chce titul mistra extraligy!',
    postup: 'Vedení očekává postup do vyšší soutěže!',
    playoff: 'Cíl sezóny: dostat se do playoff.',
    stred: 'Cíl sezóny: klidný střed tabulky.',
    zachrana: 'Cíl sezóny: zachránit se, neskončit poslední.',
  }
  return { typ, popis: popisy[typ] }
}

export function poMemZapase(s: GameState, v: Vysledek, cz: CekajiciZapas): void {
  const mujDomaci = cz.domaci === s.mujKlubId
  const souperId = mujDomaci ? cz.hoste : cz.domaci
  const vyhra = mujDomaci ? v.golyDomaci > v.golyHoste : v.golyHoste > v.golyDomaci
  const poProdlouzeni = v.prodlouzeni || v.najezdy
  const rozdilSily = prumernyOverall(s, souperId) - prumernyOverall(s, s.mujKlubId)
  let duveraDelta = vyhra ? (rozdilSily > 3 ? 5 : 3) : rozdilSily < -3 ? -5 : -3
  let naladaDelta = vyhra ? 4 : -4
  if (poProdlouzeni) {
    duveraDelta = Math.round(duveraDelta / 2)
    naladaDelta = naladaDelta / 2
  }
  if (cz.derby) {
    duveraDelta *= 2
    naladaDelta *= 2
    s.zpravy.unshift(vyhra ? '🔥 Derby je naše! Město slaví.' : '🔥 Prohrané derby. Ve městě je dusno.')
  }
  s.trener.duvera = clamp(s.trener.duvera + duveraDelta, 0, 100)
  s.naladaFanousku = clamp(s.naladaFanousku + naladaDelta, 0, 100)
  s.trener.kariera.zapasy++
  if (vyhra) s.trener.kariera.vyhry++
  if (s.trener.duvera === 0) vyhazov(s)
  else if (s.trener.duvera <= 20) s.zpravy.unshift('⚠️ Vedení ztrácí trpělivost!')
}

export function vyhazov(s: GameState): void {
  s.trener.kariera.vyhazovy++
  const ostatni = Object.keys(s.tymy)
    .filter((id) => id !== s.mujKlubId)
    .sort((a, b) => prumernyOverall(s, a) - prumernyOverall(s, b)) // vzestupně (nejslabší první)
  const mujPrumer = prumernyOverall(s, s.mujKlubId)
  const slabsi = ostatni.filter((id) => prumernyOverall(s, id) < mujPrumer)
  s.nabidky = slabsi.length >= 3 ? slabsi.slice(-3) : ostatni.slice(0, 3)
  s.zpravy.unshift('📰 KONEC! Vedení tě odvolalo. Na stole jsou nabídky jiných klubů.')
}

export function prijmiNabidku(state: GameState, klubId: string): GameState {
  if (!state.nabidky?.includes(klubId)) throw new Error('Tento klub nabídku nedal.')
  const s = structuredClone(state)
  s.mujKlubId = klubId
  s.trener.duvera = 50
  s.nabidky = null
  s.cilSezony = urciCilSezony(s, klubId)
  // nový klub = nový sponzor a čistý trh — nic se nesmí přenést ze starého angažmá
  s.sponzor = { typ: 'jistota', mesicne: 0, zaVyhru: 0 }
  s.sponzorNabidka = true
  s.nabidkyProdeje = []
  s.prichoziNabidka = null
  s.otazkaMedii = null
  s.zpravy.unshift(`Nová výzva! Přebíráš ${s.tymy[klubId].nazev}.`)
  return s
}

export function odmitniNabidky(state: GameState): GameState {
  const s = structuredClone(state)
  s.nabidky = null
  s.konecKariery = true
  s.zpravy.unshift('Odmítl jsi všechny nabídky. Trenérská kariéra končí.')
  return s
}

export function splnenCil(s: GameState): boolean {
  const liga = ligaKlubu(s, s.mujKlubId)
  const tabulka = spocitejTabulku(liga.tymy, liga.zapasy)
  const umisteni = tabulka.findIndex((r) => r.tymId === s.mujKlubId) + 1
  switch (s.cilSezony.typ) {
    case 'titul':
    case 'postup':
      return liga.playoff?.vitez === s.mujKlubId
    case 'playoff':
      return umisteni <= 8
    case 'stred':
      return umisteni <= 10
    case 'zachrana':
      return umisteni < 14
  }
}

export function vyhodnotCilPoSezone(s: GameState): boolean {
  const splnen = splnenCil(s)
  s.trener.duvera = clamp(s.trener.duvera + (splnen ? 15 : -20), 0, 100)
  s.zpravy.unshift(splnen ? '✅ Cíl sezóny splněn! Vedení je spokojené.' : '❌ Cíl sezóny nesplněn. Vedení zuří.')
  if (s.trener.duvera === 0 && !s.nabidky) vyhazov(s)
  return splnen
}
