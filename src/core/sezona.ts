import kluby from './data/kluby.json'
import { generujHrace, generujSvet } from './generator'
import { aplikujDomaciTrzby, bonusZaVyhru, mesicniUzaverka, nabidkySponzora, vychoziStadion, zkontrolujBankrot } from './finance'
import { vyhodnotSezonu, zapisRekordVyhry } from './historie'
import { jeDerby, poMemZapase, urciCilSezony } from './kariera'
import { zkontrolujOtazku } from './media'
import { aplikujTrenink, doporucenyPlan } from './trenink'
import { kabinovyTick } from './kabinovka'
import { trhTick } from './prestupy'
import { cekajiciSerie, domaciLedSerie, zalozPlayoff, zapisVysledekSerie } from './playoff'
import { createRng, hashSeed, pick, randInt, type Rng } from './rng'
import { denKola, POCET_KOL, vytvorRozpis } from './rozpis'
import { jeZdravy, overall, vychoziSestava, zmenSestavuKlubu, navrhPoZapase, aplikujSehravaniChemie } from './sestava'
import { prevedNaVysledek, simulujCelyZapas, type StavZapasu } from './zapas'
import { spocitejTabulku } from './tabulka'
import type { Atributy, GameState, Klub, Liga, Pozice, Tym, TreninkZamereni, Vysledek } from './types'

const NAZVY_LIG = ['Extraliga', 'Chance liga', '2. liga']
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const NAZVY_ATRIBUTU: Record<keyof Atributy, string> = {
  strelba: 'střelba',
  prihravky: 'přihrávky',
  brusleni: 'bruslení',
  obrana: 'obrana',
  fyzicka: 'fyzička',
  chytani: 'chytání',
  vydrz: 'výdrž',
  technika: 'technika',
}

export function zmenTrenink(state: GameState, zamereni: TreninkZamereni): GameState {
  const s = structuredClone(state)
  s.treninkZamereni = zamereni
  return s
}

// mutuje klon — volá advanceDay v naplánovaný tréninkový den
function treninkovyTick(s: GameState, rng: Rng): void {
  const seance = s.treninkovyTyden[s.den]
  if (!seance?.length) return
  aplikujTrenink(s, s.den, rng)
}

export function newGame(seed: number, mujKlubId: string): GameState {
  const tymy = generujSvet(seed)
  const ligy: Liga[] = [0, 1, 2].map((uroven) => {
    const idKlubu = (kluby as Klub[]).filter((k) => k.liga === uroven).map((k) => k.id)
    return { uroven, nazev: NAZVY_LIG[uroven], tymy: idKlubu, zapasy: vytvorRozpis(idKlubu), playoff: null }
  })
  const ligaMehoKlubu = (kluby as Klub[]).find((k) => k.id === mujKlubId)!.liga
  const uvodniCil =
    ligaMehoKlubu === 0
      ? 'Cíl: prosadit se mezi elitou a zaútočit na titul.'
      : ligaMehoKlubu === 1
        ? 'Cíl: vybojovat postup do extraligy.'
        : 'Cíl: probojovat se z nižší soutěže až do extraligy.'
  const s: GameState = {
    seed,
    sezona: 1,
    den: 0,
    faze: 'zakladniCast',
    mujKlubId,
    tymy,
    ligy,
    zpravy: [`Vítej na střídačce klubu ${tymy[mujKlubId].nazev}! ${uvodniCil}`],
    posledniZapas: null,
    trener: { duvera: 50, kariera: { zapasy: 0, vyhry: 0, trofeje: [], vyhazovy: 0, sezony: 1 } },
    cilSezony: { typ: 'playoff', popis: 'Dočasný cíl — nahradí kariera.ts (Task 5)' },
    naladaFanousku: 50,
    historie: [],
    vyhlaseni: null,
    rekordy: { nejvyssiVyhra: null, nejlepsiStrelec: null },
    nabidky: null,
    konecKariery: false,
    cekajiciZapas: null,
    sponzor: { typ: 'jistota', mesicne: 0, zaVyhru: 0 },
    sponzorNabidka: true,
    treninkZamereni: 'kondice',
    treninkovyTyden: {},
    treninkovyTydenOd: 0,
    nabidkyProdeje: [],
    prichoziNabidka: null,
    prichoziNabidky: [],
    otazkaMedii: null,
    kabinovaUdalost: null,
    posledniKabinovaDen: 0,
    oblibenyHracId: null,
    marketing: [],
    reklama: [],
    navrhSestavy: null,
    posledniOslovSponzory: 0,
    posledniUzaverka: 0,
    stadion: vychoziStadion(ligaMehoKlubu),
    posledniDomaci: null,
    financeHistorie: [],
    posledniTrenink: null,
    nastaveni: { minihryZapnuto: true },
  }
  s.cilSezony = urciCilSezony(s, mujKlubId)
  s.treninkovyTyden = doporucenyPlan(s)
  return s
}

export const mojeLiga = (s: GameState): Liga => s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!

export function dalsiMujZapas(s: GameState): { den: number; domaci: string; hoste: string } | null {
  if (s.faze === 'zakladniCast') {
    const z = mojeLiga(s)
      .zapasy.filter((z) => !z.vysledek && (z.domaci === s.mujKlubId || z.hoste === s.mujKlubId))
      .sort((a, b) => a.den - b.den)[0]
    return z ? { den: z.den, domaci: z.domaci, hoste: z.hoste } : null
  }
  if (s.faze === 'playoff') {
    const playoff = mojeLiga(s).playoff
    if (!playoff || playoff.vitez) return null
    const moje = cekajiciSerie(playoff).find(
      ({ serie }) => serie.domaci === s.mujKlubId || serie.hoste === s.mujKlubId,
    )
    if (!moje) return null
    const domaci = domaciLedSerie(moje.serie)
    const hoste = domaci === moje.serie.domaci ? moje.serie.hoste : moje.serie.domaci
    return { den: s.den % 2 === 0 ? s.den + 2 : s.den + 1, domaci, hoste }
  }
  return null
}

function aplikujDopadyZapasu(rng: Rng, t: Tym, vyhra: boolean, energie: Record<string, number>): void {
  t.moralka = clamp(t.moralka + (vyhra ? 3 : -3), 30, 70)
  // morálka ovlivňuje výkon nepřímo: táhne formu hráčů nahoru/dolů
  const bonusMoralky = t.moralka > 60 ? 1 : t.moralka < 40 ? -1 : 0
  const vSestave = new Set([...t.sestava.utoky.flat(), ...t.sestava.obrany.flat(), t.sestava.brankar])
  const kapitan = t.kapitanId ? t.hraci.find((h) => h.id === t.kapitanId) : null
  const maKapitana = !!kapitan && kapitan.zranenZapasu === 0
  for (const h of t.hraci) {
    const drift = vyhra ? randInt(rng, -1, 3) : randInt(rng, maKapitana ? -2 : -3, 1)
    h.forma = clamp(h.forma + drift + bonusMoralky, 30, 70)
    if (vSestave.has(h.id)) {
      h.unava = Math.min(100, h.unava + Math.round((100 - (energie[h.id] ?? 40)) / 4))
    }
  }
}

function pripravSestavuAI(s: GameState, klubId: string): void {
  if (klubId === s.mujKlubId) return
  const tym = s.tymy[klubId]
  const vSestave = [...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat(), tym.sestava.brankar]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  if (vSestave.some((id) => !jeZdravy(podleId.get(id)!)))
    s.tymy[klubId] = zmenSestavuKlubu(tym, vychoziSestava(tym.hraci))
}

function zapisDopadyZapasu(s: GameState, domaciId: string, hosteId: string, v: Vysledek, rng: Rng): void {
  const domaci = s.tymy[domaciId]
  const hoste = s.tymy[hosteId]
  for (const u of v.udalosti) {
    if (u.typ !== 'gol') continue
    for (const t of [domaci, hoste]) {
      const strelec = t.hraci.find((h) => h.id === u.hracId)
      if (strelec) strelec.goly++
      const asistent = t.hraci.find((h) => h.id === u.asistentId)
      if (asistent) asistent.asistence++
    }
  }
  const vyhralDomaci = v.golyDomaci > v.golyHoste
  aplikujDopadyZapasu(rng, domaci, vyhralDomaci, v.energie)
  aplikujDopadyZapasu(rng, hoste, !vyhralDomaci, v.energie)
  // léčení: odehraný zápas týmu ubírá zraněným jeden zápas
  for (const t of [domaci, hoste]) {
    for (const h of t.hraci) if (h.zranenZapasu > 0) h.zranenZapasu--
  }
  // sehrávání: chemie roste u lajn, které v zápase hrály (nízká energie = čas na ledě)
  for (const [id, t] of [
    [domaciId, domaci],
    [hosteId, hoste],
  ] as const) {
    if (id === s.mujKlubId) continue // hráčův tým — po propisu sestavy z živého zápasu
    aplikujSehravaniChemie(t, v.energie)
  }
  // zápasová praxe: kdo hraje, sbírá zápasy — a mladíci s prostorem rostou
  for (const t of [domaci, hoste]) {
    const vSestave = new Set([...t.sestava.utoky.flat(), ...t.sestava.obrany.flat(), t.sestava.brankar])
    for (const h of t.hraci) {
      if (!vSestave.has(h.id)) continue
      h.odehranoSezona++
      if (h.vek <= 23 && overall(h) < h.potencial && h.odehranoSezona % 5 === 0) {
        const klice = Object.keys(h.atributy) as (keyof Atributy)[]
        const ktery = klice[randInt(rng, 0, klice.length - 1)]
        h.atributy[ktery] = Math.min(99, h.atributy[ktery] + 1)
        if (t.klubId === s.mujKlubId) {
          s.zpravy.unshift(`🌟 ${h.jmeno} ${h.prijmeni} se zápasovou praxí zlepšuje (${NAZVY_ATRIBUTU[ktery]}).`)
        }
      }
    }
  }
  // nová zranění z tohoto zápasu
  for (const u of v.udalosti) {
    if (u.typ !== 'zraneni' || !u.hracId) continue
    for (const t of [domaci, hoste]) {
      const hrac = t.hraci.find((h) => h.id === u.hracId)
      if (hrac) {
        hrac.zranenZapasu = randInt(rng, 1, 3)
        if (t.klubId === s.mujKlubId) {
          s.zpravy.unshift(`🚑 ${hrac.jmeno} ${hrac.prijmeni} se zranil — mimo hru na ${hrac.zranenZapasu} zápas(y).`)
        }
      }
    }
  }
  if (domaciId === s.mujKlubId || hosteId === s.mujKlubId) {
    s.posledniZapas = { den: s.den, domaci: domaciId, hoste: hosteId, vysledek: v }
    const dodatek = v.najezdy ? ' (sn)' : v.prodlouzeni ? ' (pp)' : ''
    s.zpravy.unshift(`${domaci.nazev} – ${hoste.nazev} ${v.golyDomaci}:${v.golyHoste}${dodatek}`)
    if (s.oblibenyHracId) {
      const obl = [...domaci.hraci, ...hoste.hraci].find((h) => h.id === s.oblibenyHracId)
      const golyVZapase = v.udalosti.filter((u) => u.typ === 'gol' && u.hracId === s.oblibenyHracId).length
      if (obl && golyVZapase > 0) {
        const muj = s.tymy[s.mujKlubId]
        if (golyVZapase >= 3) {
          s.zpravy.unshift(`⭐ Hat-trick oblíbeného ${obl.prijmeni}! Kabina bouří.`)
          muj.moralka = Math.min(70, muj.moralka + 3)
        } else if (obl.goly === golyVZapase) {
          s.zpravy.unshift(`⭐ První gól sezóny pro ${obl.jmeno} ${obl.prijmeni}!`)
          muj.moralka = Math.min(70, muj.moralka + 2)
        } else if (obl.goly === 10) {
          s.zpravy.unshift(`⭐ ${obl.prijmeni} dal 10. gól sezóny!`)
        }
      }
    }
  }
  s.zpravy = s.zpravy.slice(0, 50)
}

function odehrajZapas(s: GameState, domaciId: string, hosteId: string, poradi: number): Vysledek {
  pripravSestavuAI(s, domaciId)
  pripravSestavuAI(s, hosteId)
  const rng = createRng(hashSeed(s.seed, s.sezona, s.den, poradi))
  const domaci = s.tymy[domaciId]
  const hoste = s.tymy[hosteId]
  const v = simulujCelyZapas(domaci, hoste, rng)
  zapisDopadyZapasu(s, domaciId, hosteId, v, rng)
  return v
}

function zkontrolujKonecZakladniCasti(s: GameState): void {
  if (s.faze !== 'zakladniCast') return
  if (s.cekajiciZapas) return // můj zápas posledního kola se teprve dohrává
  if (s.den < denKola(POCET_KOL)) return
  if (!s.ligy.every((l) => l.zapasy.every((z) => z.vysledek))) return
  s.faze = 'playoff'
  for (const liga of s.ligy) liga.playoff = zalozPlayoff(spocitejTabulku(liga.tymy, liga.zapasy))
  s.zpravy.unshift('Základní část skončila — začíná playoff!')
}

function zkontrolujKonecSezony(s: GameState): void {
  if (s.faze !== 'playoff') return
  if (!s.ligy.every((l) => l.playoff?.vitez)) return
  s.faze = 'konecSezony'
  const mistrId = s.ligy[0].playoff!.vitez!
  s.zpravy.unshift(
    mistrId === s.mujKlubId ? '🏆 MISTŘI! Vyhráli jste extraligu!' : `Mistrem extraligy se stal ${s.tymy[mistrId].nazev}.`,
  )
  vyhodnotSezonu(s)
}

export function advanceDay(state: GameState): GameState {
  if (state.cekajiciZapas) throw new Error('Nejdřív dohraj čekající zápas.')
  if (state.nabidky) throw new Error('Nejdřív vyřeš nabídky klubů.')
  if (state.konecKariery) throw new Error('Kariéra skončila.')
  const s = structuredClone(state)
  s.den++
  // den odpočinku regeneruje únavu (před případným zápasem)
  for (const t of Object.values(s.tymy)) for (const h of t.hraci) h.unava = Math.max(0, h.unava - 10)

  if (s.faze === 'zakladniCast') {
    for (const liga of s.ligy) {
      liga.zapasy
        .filter((z) => z.den === s.den && !z.vysledek)
        .forEach((z, i) => {
          if (z.domaci === s.mujKlubId || z.hoste === s.mujKlubId) {
            s.cekajiciZapas = { domaci: z.domaci, hoste: z.hoste, derby: jeDerby(z.domaci, z.hoste), playoff: null }
          } else {
            z.vysledek = odehrajZapas(s, z.domaci, z.hoste, liga.uroven * 100 + i)
          }
        })
    }
    zkontrolujKonecZakladniCasti(s)
  } else if (s.faze === 'playoff' && s.den % 2 === 0) {
    for (const liga of s.ligy) {
      if (!liga.playoff || liga.playoff.vitez) continue
      let playoff = liga.playoff
      for (const { kolo, index, serie } of cekajiciSerie(playoff)) {
        const domaci = domaciLedSerie(serie)
        const hoste = domaci === serie.domaci ? serie.hoste : serie.domaci
        if (domaci === s.mujKlubId || hoste === s.mujKlubId) {
          s.cekajiciZapas = { domaci, hoste, derby: jeDerby(domaci, hoste), playoff: { kolo, index } }
          continue
        }
        const v = odehrajZapas(s, domaci, hoste, liga.uroven * 100 + kolo * 10 + index)
        const vitezZapasu = v.golyDomaci > v.golyHoste ? domaci : hoste
        playoff = zapisVysledekSerie(playoff, kolo, index, vitezZapasu === serie.domaci)
      }
      liga.playoff = playoff
    }
    zkontrolujKonecSezony(s)
  }
  const rngDne = createRng(hashSeed(s.seed, s.sezona, s.den, 333))
  treninkovyTick(s, rngDne)
  kabinovyTick(s)
  trhTick(s, rngDne)
  if (s.den - s.posledniUzaverka >= 30) mesicniUzaverka(s)
  zkontrolujBankrot(s)
  return s
}

export const atmosferaZapasu = (s: GameState): number => (s.naladaFanousku - 50) / 5

export function dokonciZapas(state: GameState, stavZapasu: StavZapasu): GameState {
  const cz = state.cekajiciZapas
  if (!cz) throw new Error('Žádný zápas nečeká na dohrání.')
  if (stavZapasu.faze !== 'konec') throw new Error('Zápas ještě neskončil.')
  if (stavZapasu.domaci.klubId !== cz.domaci || stavZapasu.hoste.klubId !== cz.hoste)
    throw new Error('Stav zápasu neodpovídá čekajícímu zápasu.')
  const s = structuredClone(state)
  const v = prevedNaVysledek(stavZapasu)
  const rng = createRng(hashSeed(s.seed, s.sezona, s.den, 555))
  if (cz.playoff) {
    const liga = mojeLiga(s)
    const serie = liga.playoff!.kola[cz.playoff.kolo][cz.playoff.index]
    const vitezZapasu = v.golyDomaci > v.golyHoste ? cz.domaci : cz.hoste
    liga.playoff = zapisVysledekSerie(liga.playoff!, cz.playoff.kolo, cz.playoff.index, vitezZapasu === serie.domaci)
  } else {
    const zapas = mojeLiga(s).zapasy.find(
      (z) => z.den === s.den && z.domaci === cz.domaci && z.hoste === cz.hoste,
    )!
    zapas.vysledek = v
  }
  zapisDopadyZapasu(s, cz.domaci, cz.hoste, v, rng)
  // propis sestavy a chemie hráčova týmu ze živého zápasu
  const mojeStrana = cz.domaci === s.mujKlubId ? 'domaci' : 'hoste'
  const strana = stavZapasu[mojeStrana]
  const mujTym = s.tymy[s.mujKlubId]
  const poSestave = zmenSestavuKlubu(mujTym, strana.sestava)
  poSestave.chemie = structuredClone(strana.chemie)
  aplikujSehravaniChemie(poSestave, v.energie)
  s.tymy[s.mujKlubId] = poSestave
  const tip = navrhPoZapase(poSestave, v.hodnoceni)
  s.navrhSestavy = tip
  poMemZapase(s, v, cz)
  zapisRekordVyhry(s, v, cz)
  zkontrolujOtazku(s, v, cz)
  if (cz.domaci === s.mujKlubId) aplikujDomaciTrzby(s, cz.derby)
  const mojeVyhra = (cz.domaci === s.mujKlubId) === (v.golyDomaci > v.golyHoste)
  if (mojeVyhra) bonusZaVyhru(s)
  s.cekajiciZapas = null
  zkontrolujKonecZakladniCasti(s) // můj poslední zápas základní části mohl uzavřít tabulku
  zkontrolujKonecSezony(s)
  return s
}

export function zahajNovouSezonu(state: GameState): GameState {
  if (state.nabidky) throw new Error('Nejdřív vyřeš nabídky klubů.')
  if (state.konecKariery) throw new Error('Kariéra skončila.')
  const s = structuredClone(state)
  const nazevKlubu = s.tymy[s.mujKlubId].nazev
  for (const tym of Object.values(s.tymy)) {
    for (const h of tym.hraci) {
      if (h.odehranoSezona > 0 || h.goly > 0 || h.asistence > 0) {
        h.herniHistorie = h.herniHistorie ?? []
        h.herniHistorie.unshift({
          sezona: s.sezona,
          klub: tym.klubId === s.mujKlubId ? nazevKlubu : tym.nazev,
          zapasy: h.odehranoSezona,
          goly: h.goly,
          asistence: h.asistence,
        })
        h.herniHistorie = h.herniHistorie.slice(0, 8)
      }
    }
  }
  // postup a sestup mezi sousedními úrovněmi
  // tabulky je nutné spočítat PŘED výměnami — po swapu už tymy nesedí na zapasy
  const tabulky = s.ligy.map((liga) => spocitejTabulku(liga.tymy, liga.zapasy))
  for (const uroven of [1, 2]) {
    const nizsi = s.ligy[uroven]
    const vyssi = s.ligy[uroven - 1]
    const postupujici = nizsi.playoff!.vitez!
    const tabulka = tabulky[uroven - 1]
    const sestupujici = tabulka[tabulka.length - 1].tymId
    nizsi.tymy = [...nizsi.tymy.filter((t) => t !== postupujici), sestupujici]
    vyssi.tymy = [...vyssi.tymy.filter((t) => t !== sestupujici), postupujici]
    s.zpravy.unshift(
      `${s.tymy[postupujici].nazev} postupuje do ${vyssi.nazev}, ${s.tymy[sestupujici].nazev} sestupuje.`,
    )
  }
  s.sezona++
  s.den = 0
  s.faze = 'zakladniCast'
  s.posledniZapas = null
  s.vyhlaseni = null
  // letní vývoj hráčů
  const rng = createRng(hashSeed(s.seed, s.sezona, 999))
  for (const tym of Object.values(s.tymy)) {
    for (const h of tym.hraci) {
      h.vek++
      let posun =
        h.vek <= 23 ? randInt(rng, 0, 3) : h.vek <= 29 ? randInt(rng, -1, 1) : randInt(rng, -3, -1)
      if (h.vek <= 23 && overall(h) >= h.potencial) posun = 0
      if (h.vek <= 23 && h.odehranoSezona < 10) posun = 0 // seděl na lavičce — letní růst nedostane
      for (const k of Object.keys(h.atributy) as (keyof Atributy)[]) {
        h.atributy[k] = clamp(h.atributy[k] + posun, 1, 99)
      }
      h.forma = 50
      h.unava = 0
      h.goly = 0
      h.asistence = 0
      h.zranenZapasu = 0
      h.odehranoSezona = 0
    }
    tym.moralka = 50
    // AI kluby si přeskládají sestavu; hráčova (upravovaná ručně) zůstává
    if (tym.klubId !== s.mujKlubId) tym.sestava = vychoziSestava(tym.hraci)
  }
  // akademie: odchovanci (AŽ ZA letním stárnutím — odchovanci tak nestárnou hned o rok)
  const rngAkademie = createRng(hashSeed(s.seed, s.sezona, 777))
  for (const liga of s.ligy) {
    for (const klubId of liga.tymy) {
      const tym = s.tymy[klubId]
      const jeMuj = klubId === s.mujKlubId
      if (!jeMuj && tym.hraci.length >= 23) continue
      const pocet = jeMuj ? randInt(rngAkademie, 1, 2) : 1
      for (let i = 0; i < pocet && tym.hraci.length < 26; i++) {
        const pozice = pick(rngAkademie, ['U', 'U', 'D'] as Pozice[])
        const mladik = generujHrace(rngAkademie, pozice, liga.uroven, randInt(rngAkademie, 17, 18))
        mladik.id = `ak-${s.sezona}-${klubId}-${i}` // NE globální čítač — po načtení hry by kolidoval
        mladik.potencial = Math.min(99, overall(mladik) + randInt(rngAkademie, 5, 20))
        mladik.plat = 20_000
        tym.hraci.push(mladik)
        if (jeMuj) {
          s.zpravy.unshift(
            `🎓 Akademie přivedla talent: ${mladik.jmeno} ${mladik.prijmeni} (${pozice === 'U' ? 'útočník' : 'obránce'}, ${mladik.vek} let).`,
          )
        }
      }
    }
  }
  for (const liga of s.ligy) {
    liga.zapasy = vytvorRozpis(liga.tymy)
    liga.playoff = null
  }
  s.trener.kariera.sezony++
  s.cilSezony = urciCilSezony(s, s.mujKlubId)
  s.sponzorNabidka = true
  s.sponzor = { typ: 'jistota', mesicne: 0, zaVyhru: 0 }
  s.nabidkyProdeje = []
  s.prichoziNabidka = null
  s.prichoziNabidky = []
  s.otazkaMedii = null
  s.kabinovaUdalost = null
  s.navrhSestavy = null
  s.treninkovyTyden = doporucenyPlan(s)
  s.treninkovyTydenOd = 0
  s.posledniUzaverka = 0
  s.posledniDomaci = null
  s.posledniTrenink = null
  const ligaMeho = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!.uroven
  s.stadion = vychoziStadion(ligaMeho)
  return s
}
