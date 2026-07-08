import { pick, type Rng } from './rng'
import { chemiePoZmeneLajny, dosadDoLajny, otiskLajn, silaTymu, vymenVSestave, chemieZaPoziceNaLede } from './sestava'
import { nazevTaktiky, taktikaFaktory } from './taktika'
import {
  clamp,
  jeKlicovyMoment,
  pGolZeStrelby,
  pNebezpecnaSance,
  pUtokVMinute,
  predikceUtoku,
  segmentyKostky,
  tretinaZMinuty,
  aplikujBonusMinihry,
} from './zapasPravdepodobnost'
import type { Hrac, Sestava, Taktika, Tym, Udalost, Vysledek } from './types'
import {
  aktivniLajnyEven,
  aktivniPetkaNaLedu,
  energiePetky,
  hraciPetky,
  nejlepsiPetkaPP,
  nastavEnergiu,
  normalizujVytizeniUtoku,
  prumerEnergieNaLedu,
  spotrebujEnergiuStrany,
  vahyObranyZVytizeni,
  vahyUtokuZVytizeni,
  VYCHOZI_PORADI_OBRAN,
  VYCHOZI_PORADI_UTOKU,
  VYCHOZI_VYTIZENI,
  type Petka,
} from './zapasPetky'

export type { Petka } from './zapasPetky'
export {
  energieObranaLajny,
  energiePetky,
  energieUtokLajny,
  jePetkaKompletni,
  MIN_ENERGIE_ZAPAS,
  popisPetky,
  popisPetkyDetail,
  pocetZdravychVPetce,
  posunUtokVPoradi,
  prehledUtoku,
  vsechnyPetky,
  zmenVytizeniUtoku,
  zmenVytizeniTymu,
} from './zapasPetky'

export type VolbaKlicovehoMomentu = 'zapalit' | 'bezpecne' | 'nechat' | 'timeout' | 'beton'
export type VolbaPresilovky = { petka?: Petka; pkAgresivni?: boolean; ppLajna?: number; pkObrana?: number }

export interface CekaNaPresilovku {
  strana: 'domaci' | 'hoste'
  typ: 'pp' | 'pk'
  minutDo: number
  provinilecId: string
}

export interface CekaNaKlicovyMoment {
  utocnik: 'domaci' | 'hoste'
  pGol: number
  strelecId: string
  obrance: 'domaci' | 'hoste'
  tretina: 1 | 2 | 3
  bonusMinihry?: number
}

// Typy stavu zápasu žijí tady (engine-specifické, GameState je neobsahuje —
// rozehraný zápas se neukládá).
export interface StranaZapasu {
  klubId: string
  sestava: Sestava // pracovní kopie — změny během zápasu se NEpropisují do GameState
  taktika: Taktika
  odvolanyBrankar: boolean
  timeoutPouzit: boolean
  proslovBonus: number // 0.94–1.10, násobí útok; 1 = neutrální
  goly: number
  strely: number
  presilaDo: number
  zraneni: string[] // id hráčů zraněných v tomto zápase
  chemie: { utoky: number[]; obrany: number[] } // pracovní kopie — zápasové úpravy lajn ji resetují jen v zápase
  energie: Record<string, number> // 0–100 per hráč (i náhradníci — ti neklesají)
  hodnoceni: Record<string, number> // 4–10 per hráč, start 6
  osobniBonus: Record<string, number> // 0.94–1.10, default chybí = 1
  osobniProslovPouzit: string[] // hracIds — max 1 osobní proslov na hráče a zápas
  zbyvajiciZetony: number
  aktivniPetka: Petka | null // nasazená pětka v přesilovce
  pkPetka: Petka | null // pětka v oslabení (PK)
  pkAgresivni: boolean
  poradiUtoku: [number, number, number, number] // pořadí střídání útoků
  poradiObran: [number, number, number]
  vytizeniUtoku: [number, number, number, number] // 0 = vypnuto, 0.5–2 krok 0.5
  casNaLeduUtoku: [number, number, number, number]
  casNaLeduObran: [number, number, number]
  bonusDalsiSance: number // bonus z žetonu trenéra na příští šanci
}

export type FazeZapasu = 'hraje' | 'pauza1' | 'pauza2' | 'konec'

export interface StavZapasu {
  minuta: number // poslední odehraná minuta, 0 = před zápasem
  faze: FazeZapasu
  momentum: number // −100..+100, kladné = domácí
  derby: boolean
  cekaNaNahradu: { strana: 'domaci' | 'hoste'; hracId: string } | null
  prodlouzeni: boolean
  najezdy: boolean
  domaci: StranaZapasu
  hoste: StranaZapasu
  udalosti: Udalost[]
  cekaNaPresilovku: CekaNaPresilovku | null
  cekaNaKlicovyMoment: CekaNaKlicovyMoment | null
  klicoveMomentyVTretine: [number, number, number]
  protiutokBonus: number
}

const NEUTRALNI_AKCE = [
  (m: number) => `${m}. min: Bezpečná přihrávka v pásmu.`,
  (m: number) => `${m}. min: Ofsajd — útok končí.`,
  (m: number) => `${m}. min: Vyhrané vhazování, hra pokračuje.`,
  (m: number) => `${m}. min: Obrana zblokuje průnik do slotu.`,
]
const jmeno = (h: Hrac) => `${h.jmeno} ${h.prijmeni}`

function stranaKlubu(stav: StavZapasu, klubId: string): 'domaci' | 'hoste' | null {
  if (stav.domaci.klubId === klubId) return 'domaci'
  if (stav.hoste.klubId === klubId) return 'hoste'
  return null
}

function novaStrana(tym: Tym): StranaZapasu {
  const vyt = tym.vytizeniUtoku?.length === 4 ? [...tym.vytizeniUtoku] as [number, number, number, number] : [...VYCHOZI_VYTIZENI]
  return {
    klubId: tym.klubId,
    sestava: structuredClone(tym.sestava),
    taktika: tym.taktika,
    odvolanyBrankar: false,
    timeoutPouzit: false,
    proslovBonus: 1,
    goly: 0,
    strely: 0,
    presilaDo: 0,
    zraneni: [],
    chemie: structuredClone(tym.chemie),
    energie: Object.fromEntries(tym.hraci.map((h) => [h.id, 100])),
    hodnoceni: Object.fromEntries(tym.hraci.map((h) => [h.id, 6])),
    osobniBonus: {},
    osobniProslovPouzit: [],
    zbyvajiciZetony: 3,
    aktivniPetka: null,
    pkPetka: null,
    pkAgresivni: false,
    poradiUtoku: [...VYCHOZI_PORADI_UTOKU],
    poradiObran: [...VYCHOZI_PORADI_OBRAN],
    vytizeniUtoku: normalizujVytizeniUtoku(vyt),
    casNaLeduUtoku: [0, 0, 0, 0],
    casNaLeduObran: [0, 0, 0],
    bonusDalsiSance: 0,
  }
}

export function zacniZapas(
  domaci: Tym,
  hoste: Tym,
  moznosti: { derby?: boolean; atmosfera?: number } = {},
): StavZapasu {
  const derby = moznosti.derby ?? false
  return {
    minuta: 0,
    faze: 'hraje',
    momentum: clamp(moznosti.atmosfera ?? 0, -10, 10),
    derby,
    cekaNaNahradu: null,
    prodlouzeni: false,
    najezdy: false,
    domaci: novaStrana(domaci),
    hoste: novaStrana(hoste),
    udalosti: [
      {
        minuta: 0,
        typ: 'info',
        tymId: '',
        text: derby ? '🔥 DERBY! Rivalové na ledě, atmosféra vře!' : 'Zápas začíná!',
      },
    ],
    cekaNaPresilovku: null,
    cekaNaKlicovyMoment: null,
    klicoveMomentyVTretine: [0, 0, 0],
    protiutokBonus: 0,
  }
}

const bruslariIds = (s: Sestava) => [...s.utoky.flat(), ...s.obrany.flat()]

function upravHodnoceni(strana: StranaZapasu, hracId: string | undefined, delta: number): void {
  if (!hracId || strana.zraneni.includes(hracId)) return // zranění hodnocení zmrazí
  strana.hodnoceni[hracId] = clamp((strana.hodnoceni[hracId] ?? 6) + delta, 4, 10)
}

function prumer(hodnoty: number[]): number {
  return hodnoty.reduce((a, b) => a + b, 0) / hodnoty.length
}

// efektivní síly strany: sestava + vytížení lajn + taktika + proslov + energie na ledě
function sily(strana: StranaZapasu, tym: Tym, minuta = 0): { utok: number; obrana: number; brankar: number } {
  const vyt = normalizujVytizeniUtoku(strana.vytizeniUtoku ?? VYCHOZI_VYTIZENI)
  const zaklad = silaTymu(
    { ...tym, sestava: strana.sestava, chemie: strana.chemie },
    vahyUtokuZVytizeni(vyt),
    vahyObranyZVytizeni(vyt),
  )
  const { utok: utokTaktika, obrana: obranaTaktika } = taktikaFaktory(strana.taktika)
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const ids = bruslariIds(strana.sestava)
  const energiePrumer =
    minuta > 0 ? prumerEnergieNaLedu(strana, minuta) : prumer(ids.map((id) => strana.energie[id] ?? 100))
  const energieFaktor = 0.65 + 0.35 * (energiePrumer / 100)
  const osobniFaktor = prumer(ids.map((id) => strana.osobniBonus[id] ?? 1))
  const technikaFaktor = 0.9 + prumer(ids.map((id) => podleId.get(id)!.atributy.technika)) / 500
  const utokFaktor = utokTaktika * strana.proslovBonus * osobniFaktor * technikaFaktor
  const obranaFaktor = obranaTaktika
  return {
    utok: zaklad.utok * utokFaktor * energieFaktor * (strana.odvolanyBrankar ? 1.5 : 1),
    obrana: zaklad.obrana * obranaFaktor * energieFaktor,
    brankar: zaklad.brankar,
  }
}

function bruslariVSestave(strana: StranaZapasu, tym: Tym): Hrac[] {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  return [...strana.sestava.utoky.flat(), ...strana.sestava.obrany.flat()]
    .map((id) => podleId.get(id)!)
    .filter((h) => !strana.zraneni.includes(h.id))
}

function strelbaVaha(strana: StranaZapasu, hracId: string, strelba: number): number {
  for (const lajna of strana.sestava.utoky) {
    if (lajna.includes(hracId)) return strelba
  }
  return strelba * 0.35
}

function vyberStrelce(rng: Rng, strana: StranaZapasu, tym: Tym, minuta: number): Hrac {
  const petka = aktivniPetkaNaLedu(strana, minuta)
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const bruslari = hraciPetky(strana, petka)
    .filter((id) => !strana.zraneni.includes(id))
    .map((id) => podleId.get(id)!)
  if (bruslari.length === 0) return bruslariVSestave(strana, tym)[0]
  const celkem = bruslari.reduce((s, h) => s + strelbaVaha(strana, h.id, h.atributy.strelba), 0)
  let los = rng() * celkem
  for (const h of bruslari) {
    los -= strelbaVaha(strana, h.id, h.atributy.strelba)
    if (los <= 0) return h
  }
  return bruslari[bruslari.length - 1]
}

interface Kontext {
  s: StavZapasu
  domaciTym: Tym
  hosteTym: Tym
  rng: Rng
  hracuvKlubId?: string
}

function energieFaktor(strana: StranaZapasu, hracId: string): number {
  return 0.7 + 0.3 * ((strana.energie[hracId] ?? 100) / 100)
}

function chemieStrelce(strana: StranaZapasu, hracId: string): number {
  for (let i = 0; i < strana.sestava.utoky.length; i++) {
    if (strana.sestava.utoky[i].includes(hracId)) return 0.95 + strana.chemie.utoky[i] / 1000
  }
  for (let i = 0; i < strana.sestava.obrany.length; i++) {
    if (strana.sestava.obrany[i].includes(hracId)) return 0.95 + strana.chemie.obrany[i] / 1000
  }
  return 1
}

function spocitejPGol(
  s: StavZapasu,
  utocici: 'domaci' | 'hoste',
  strelec: Hrac,
  domaciTym: Tym,
  hosteTym: Tym,
  bonus = 0,
  spotrebovatZeton = true,
): number {
  const u = s[utocici]
  if (bonus === 0 && spotrebovatZeton && u.bonusDalsiSance > 0) {
    bonus = u.bonusDalsiSance
    u.bonusDalsiSance = 0
    s.udalosti.push({
      minuta: s.minuta,
      typ: 'info',
      tymId: u.klubId,
      text: '🔥 Bonus z žetonu trenéra se propsal do šance!',
    })
  }
  const b = s[utocici === 'domaci' ? 'hoste' : 'domaci']
  const bTym = utocici === 'domaci' ? hosteTym : domaciTym
  if (b.odvolanyBrankar) return clamp(0.4 + bonus, 0.03, 0.75)
  const brankar = sily(b, bTym, s.minuta).brankar
  return pGolZeStrelby(
    strelec.atributy.strelba * energieFaktor(u, strelec.id),
    brankar,
    chemieStrelce(u, strelec.id),
    1,
    bonus,
  )
}

/** Čekající bonus z proaktivního žetonu — uplatní se až při vyhodnocení střely. */
function uplatniCekajiciZetonBonus(s: StavZapasu, utocici: 'domaci' | 'hoste', pGol: number): number {
  const u = s[utocici]
  if (u.bonusDalsiSance <= 0) return pGol
  const bonus = u.bonusDalsiSance
  u.bonusDalsiSance = 0
  s.udalosti.push({
    minuta: s.minuta,
    typ: 'info',
    tymId: u.klubId,
    text: '🔥 Bonus z žetonu trenéra se propsal do šance!',
  })
  return clamp(pGol + bonus, 0.03, 0.75)
}

function maCekatNaHrace(s: StavZapasu, strana: 'domaci' | 'hoste', klubId?: string): boolean {
  if (!klubId) return false
  return stranaKlubu(s, klubId) === strana
}

function petkaZVolby(volba: VolbaPresilovky, typ: 'pp' | 'pk'): Petka {
  if (volba.petka) return volba.petka
  if (typ === 'pp') return { utok: volba.ppLajna ?? 0, obrana: 0 }
  return { utok: 3, obrana: volba.pkObrana ?? 0 }
}

function aplikujPresilovkuDefault(s: StavZapasu, strana: 'domaci' | 'hoste', typ: 'pp' | 'pk'): void {
  const st = s[strana]
  if (typ === 'pp') {
    st.aktivniPetka = nejlepsiPetkaPP(st)
    st.pkPetka = null
  } else {
    st.pkPetka = { utok: 3, obrana: 0 }
    st.pkAgresivni = false
    st.aktivniPetka = null
  }
}

export function potvrdPresilovku(stav: StavZapasu, volba: VolbaPresilovky): StavZapasu {
  const info = stav.cekaNaPresilovku
  if (!info) throw new Error('Nečeká se na volbu přesilovky.')
  const s = structuredClone(stav)
  const st = s[info.strana]
  if (info.typ === 'pp') {
    st.aktivniPetka = petkaZVolby(volba, 'pp')
    st.pkPetka = null
  } else {
    st.pkPetka = petkaZVolby(volba, 'pk')
    st.pkAgresivni = volba.pkAgresivni ?? false
    st.aktivniPetka = null
  }
  s.cekaNaPresilovku = null
  return s
}

function dokonciUtocnouAkci(
  ctx: Kontext,
  utocici: 'domaci' | 'hoste',
  strelec: Hrac,
  pGol: number,
  volba?: VolbaKlicovehoMomentu,
  bonusMinihry = 0,
): void {
  const { s, rng } = ctx
  const u = s[utocici]
  const b = s[utocici === 'domaci' ? 'hoste' : 'domaci']
  const uTym = utocici === 'domaci' ? ctx.domaciTym : ctx.hosteTym
  const bTym = utocici === 'domaci' ? ctx.hosteTym : ctx.domaciTym
  const smer = utocici === 'domaci' ? 1 : -1
  let bonus = 0
  if (volba === 'zapalit') {
    if (u.zbyvajiciZetony <= 0) throw new Error('Došly žetony trenéra.')
    bonus = 0.15
    u.zbyvajiciZetony--
    s.udalosti.push({
      minuta: s.minuta,
      typ: 'info',
      tymId: u.klubId,
      text: `🔥 Trenér zapálil útok! Zbývá ${u.zbyvajiciZetony} žeton${u.zbyvajiciZetony === 1 ? '' : u.zbyvajiciZetony >= 2 && u.zbyvajiciZetony <= 4 ? 'y' : 'ů'}.`,
    })
  } else if (volba === 'bezpecne') {
    bonus = -0.18
  } else if (volba === 'timeout') {
    if (u.zbyvajiciZetony <= 0) throw new Error('Došly žetony trenéra.')
    bonus = -0.08
    u.zbyvajiciZetony--
    s.momentum = clamp(s.momentum + (utocici === 'domaci' ? 20 : -20), -100, 100)
    s.udalosti.push({
      minuta: s.minuta,
      typ: 'timeout',
      tymId: u.klubId,
      text: `⏱ Trenér volá time-out v klíčovém momentu! Zbývá ${u.zbyvajiciZetony} žeton${u.zbyvajiciZetony === 1 ? '' : 'y'}.`,
    })
  } else if (volba === 'beton') {
    bonus = -0.1
    u.taktika = 'velmi_obranna'
  }
  const efektivni = aplikujBonusMinihry(clamp(pGol + bonus, 0.03, 0.75), bonusMinihry)
  const sance = Math.round(efektivni * 100)
  if (rng() < efektivni) {
    u.goly++
    s.momentum = clamp(s.momentum + smer * 25, -100, 100)
    const spoluhraci = bruslariVSestave(u, uTym).filter((h) => h.id !== strelec.id)
    const asistent = rng() < 0.8 && spoluhraci.length > 0 ? pick(rng, spoluhraci) : null
    upravHodnoceni(u, strelec.id, 1.0)
    upravHodnoceni(u, asistent?.id, 0.5)
    s.udalosti.push({
      minuta: s.minuta,
      typ: 'gol',
      tymId: u.klubId,
      hracId: strelec.id,
      asistentId: asistent?.id,
      sance,
      text: `${s.minuta}. min — GÓL${b.odvolanyBrankar ? ' DO PRÁZDNÉ BRÁNY' : ''}! ${jmeno(strelec)} (${uTym.nazev})${asistent ? `, asistence ${jmeno(asistent)}` : ''}${volba === 'zapalit' ? ' 🔥' : ''}`,
    })
  } else {
    s.momentum = clamp(s.momentum + smer * 3, -100, 100)
    const chytil = rng() < 0.5
    s.udalosti.push({
      minuta: s.minuta,
      typ: chytil ? 'zakrok' : 'strela',
      tymId: chytil ? b.klubId : u.klubId,
      sance,
      text: chytil
        ? `${s.minuta}. min: ${jmeno(strelec)} pálí — brankář ${bTym.nazev} skvěle chytá!`
        : `${s.minuta}. min: střela ${jmeno(strelec)} letí vedle.`,
    })
  }
}

export function potvrdKlicovyMoment(
  stav: StavZapasu,
  volba: VolbaKlicovehoMomentu,
  domaci: Tym,
  hoste: Tym,
  rng: Rng,
  bonusMinihry = 0,
): StavZapasu {
  const info = stav.cekaNaKlicovyMoment
  if (!info) throw new Error('Nečeká se na klíčový moment.')
  const s = structuredClone(stav)
  const ctx: Kontext = { s, domaciTym: domaci, hosteTym: hoste, rng }
  const uTym = info.utocnik === 'domaci' ? domaci : hoste
  const strelec = uTym.hraci.find((h) => h.id === info.strelecId)!
  const pGol = uplatniCekajiciZetonBonus(s, info.utocnik, info.pGol)
  const minihra = bonusMinihry || info.bonusMinihry || 0
  dokonciUtocnouAkci(ctx, info.utocnik, strelec, pGol, volba, minihra)
  s.cekaNaKlicovyMoment = null
  return s
}

function zkusUtocnaAkce(ctx: Kontext, utocici: 'domaci' | 'hoste'): void {
  const { s, rng } = ctx
  const u = s[utocici]
  const uTym = utocici === 'domaci' ? ctx.domaciTym : ctx.hosteTym
  u.strely++
  const strelec = vyberStrelce(rng, u, uTym, s.minuta)
  upravHodnoceni(u, strelec.id, 0.2)
  const pGolZaklad = spocitejPGol(s, utocici, strelec, ctx.domaciTym, ctx.hosteTym, 0, false)
  const tretina = tretinaZMinuty(s.minuta)
  const idx = tretina - 1
  const hracUtoci = maCekatNaHrace(s, utocici, ctx.hracuvKlubId)
  const hracBrani = maCekatNaHrace(s, utocici === 'domaci' ? 'hoste' : 'domaci', ctx.hracuvKlubId)
  const ceka =
    jeKlicovyMoment(pGolZaklad) &&
    s.klicoveMomentyVTretine[idx] < 2 &&
    (hracUtoci || hracBrani)
  if (ceka) {
    s.klicoveMomentyVTretine[idx]++
    s.cekaNaKlicovyMoment = {
      utocnik: utocici,
      pGol: pGolZaklad,
      strelecId: strelec.id,
      obrance: utocici === 'domaci' ? 'hoste' : 'domaci',
      tretina,
    }
    s.udalosti.push({
      minuta: s.minuta,
      typ: 'info',
      tymId: u.klubId,
      hracId: strelec.id,
      sance: Math.round(pGolZaklad * 100),
      text: `🔥 ${s.minuta}. min — ${jmeno(strelec)} má velkou šanci (${Math.round(pGolZaklad * 100)} % gól)!`,
    })
    return
  }
  const pGol = uplatniCekajiciZetonBonus(s, utocici, pGolZaklad)
  dokonciUtocnouAkci(ctx, utocici, strelec, pGol)
}

function minutaHry(ctx: Kontext): void {
  const { s, rng } = ctx
  for (const strana of ['domaci', 'hoste'] as const) {
    const u = s[strana]
    const b = s[strana === 'domaci' ? 'hoste' : 'domaci']
    const uTym = strana === 'domaci' ? ctx.domaciTym : ctx.hosteTym
    const bTym = strana === 'domaci' ? ctx.hosteTym : ctx.domaciTym
    const smer = strana === 'domaci' ? 1 : -1

    if (rng() < 0.04 && b.presilaDo <= s.minuta) {
      const provinilec = pick(rng, bruslariVSestave(u, uTym))
      b.presilaDo = s.minuta + 2
      s.momentum = clamp(s.momentum - smer * 10, -100, 100)
      upravHodnoceni(u, provinilec.id, -0.5)
      s.udalosti.push({
        minuta: s.minuta,
        typ: 'vylouceni',
        tymId: u.klubId,
        hracId: provinilec.id,
        text: `${s.minuta}. min: ${jmeno(provinilec)} (${uTym.nazev}) — 2 minuty. Přesilovka ${bTym.nazev}!`,
      })
      const ppStrana = strana === 'domaci' ? 'hoste' : 'domaci'
      if (maCekatNaHrace(s, ppStrana, ctx.hracuvKlubId)) {
        s.cekaNaPresilovku = { strana: ppStrana, typ: 'pp', minutDo: s.minuta + 2, provinilecId: provinilec.id }
        return
      }
      if (maCekatNaHrace(s, strana, ctx.hracuvKlubId)) {
        s.cekaNaPresilovku = { strana, typ: 'pk', minutDo: s.minuta + 2, provinilecId: provinilec.id }
        return
      }
      aplikujPresilovkuDefault(s, ppStrana, 'pp')
      aplikujPresilovkuDefault(s, strana, 'pk')
    }

    if (rng() < 0.0025 && !s.cekaNaNahradu) {
      const chudak = pick(rng, bruslariVSestave(u, uTym))
      u.zraneni.push(chudak.id)
      s.cekaNaNahradu = { strana, hracId: chudak.id }
      s.udalosti.push({
        minuta: s.minuta,
        typ: 'zraneni',
        tymId: u.klubId,
        hracId: chudak.id,
        text: `${s.minuta}. min: ${jmeno(chudak)} (${uTym.nazev}) zůstává ležet na ledě a střídá! 🚑`,
      })
      return
    }
  }

  const sd = sily(s.domaci, ctx.domaciTym, s.minuta)
  const sh = sily(s.hoste, ctx.hosteTym, s.minuta)
  const utocici: 'domaci' | 'hoste' = rng() < sd.utok / (sd.utok + sh.utok) ? 'domaci' : 'hoste'
  const u = s[utocici]
  const b = s[utocici === 'domaci' ? 'hoste' : 'domaci']
  const uTym = utocici === 'domaci' ? ctx.domaciTym : ctx.hosteTym
  const bTym = utocici === 'domaci' ? ctx.hosteTym : ctx.domaciTym
  const su = sily(u, uTym, s.minuta)
  const sb = sily(b, bTym, s.minuta)
  const smer = utocici === 'domaci' ? 1 : -1
  let presila = 1
  if (u.presilaDo > s.minuta) {
    presila = u.aktivniPetka ? 1.85 + energiePetky(u, u.aktivniPetka) / 500 : 1.8
  }
  if (u.presilaDo > s.minuta && b.pkPetka) presila *= b.pkAgresivni ? 0.85 : 0.75
  const momentumBonus = smer * (s.momentum / 100) * 2
  const pUtok = clamp(pUtokVMinute(su.utok, sb.utok, sb.obrana) * presila * (1 + momentumBonus * 0.12), 0.5, 0.95)
  if (rng() >= pUtok) return
  const pNebezpeci = pNebezpecnaSance(su.utok, sb.obrana, momentumBonus)
  if (rng() >= pNebezpeci) {
    const popis = pick(rng, NEUTRALNI_AKCE)(s.minuta)
    s.momentum = clamp(s.momentum + smer * 2, -100, 100)
    s.udalosti.push({
      minuta: s.minuta,
      typ: 'info',
      tymId: u.klubId,
      sance: Math.round(pNebezpeci * 100),
      text: popis,
    })
    return
  }
  zkusUtocnaAkce(ctx, utocici)
}

export function simulujMinutu(
  stav: StavZapasu,
  domaci: Tym,
  hoste: Tym,
  rng: Rng,
  opts: { hracuvKlubId?: string } = {},
): StavZapasu {
  if (stav.faze === 'konec') throw new Error('Zápas už skončil.')
  if (stav.cekaNaNahradu) throw new Error('Čeká se na náhradu zraněného hráče.')
  if (stav.cekaNaPresilovku || stav.cekaNaKlicovyMoment)
    throw new Error('Čeká se na rozhodnutí trenéra.')
  if (stav.faze === 'pauza1' || stav.faze === 'pauza2')
    throw new Error('Zápas je v pauze — zavolej pokracujPoPauze.')
  const s = structuredClone(stav)
  const ctx: Kontext = { s, domaciTym: domaci, hosteTym: hoste, rng, hracuvKlubId: opts.hracuvKlubId }
  s.minuta++
  s.momentum *= 0.92
  minutaHry(ctx)
  if (s.cekaNaPresilovku || s.cekaNaKlicovyMoment) return s

  // únava a čas na ledě
  for (const strana of [s.domaci, s.hoste]) {
    const tymStrany = strana === s.domaci ? domaci : hoste
    spotrebujEnergiuStrany(strana, tymStrany, s.minuta)
  }

  if (s.domaci.presilaDo <= s.minuta) {
    s.domaci.aktivniPetka = null
    s.hoste.pkPetka = null
  }
  if (s.hoste.presilaDo <= s.minuta) {
    s.hoste.aktivniPetka = null
    s.domaci.pkPetka = null
  }

  const remiza = s.domaci.goly === s.hoste.goly
  if (s.minuta === 20) {
    s.faze = 'pauza1'
    s.udalosti.push({ minuta: 20, typ: 'info', tymId: '', text: 'Konec 1. třetiny.' })
  } else if (s.minuta === 40) {
    s.faze = 'pauza2'
    s.udalosti.push({ minuta: 40, typ: 'info', tymId: '', text: 'Konec 2. třetiny.' })
  } else if (s.minuta === 60) {
    if (remiza) {
      s.prodlouzeni = true
      s.udalosti.push({ minuta: 60, typ: 'info', tymId: '', text: 'Nerozhodně — prodloužení! Náhlá smrt.' })
    } else {
      s.faze = 'konec'
      s.udalosti.push({ minuta: 60, typ: 'info', tymId: '', text: 'Konec zápasu.' })
    }
  } else if (s.minuta > 60) {
    if (!remiza) {
      s.faze = 'konec'
      s.udalosti.push({ minuta: s.minuta, typ: 'info', tymId: '', text: 'Rozhodnuto v prodloužení!' })
    } else if (s.minuta === 65) {
      // nájezdy
      s.najezdy = true
      s.prodlouzeni = false
      const sd = sily(s.domaci, domaci, s.minuta)
      const sh = sily(s.hoste, hoste, s.minuta)
      const sanceDomacich = clamp(0.5 + (sd.utok / sh.brankar - sh.utok / sd.brankar) * 0.1, 0.05, 0.95)
      const vitez = rng() < sanceDomacich ? 'domaci' : 'hoste'
      const vitezTym = vitez === 'domaci' ? domaci : hoste
      s[vitez].goly++
      const strelec = vyberStrelce(rng, s[vitez], vitezTym, s.minuta)
      upravHodnoceni(s[vitez], strelec.id, 1.0)
      s.udalosti.push({
        minuta: 65,
        typ: 'gol',
        tymId: s[vitez].klubId,
        hracId: strelec.id,
        text: `Rozhodující nájezd proměňuje ${vitezTym.nazev}!`,
      })
      s.faze = 'konec'
    }
  }
  return s
}

export function pokracujPoPauze(stav: StavZapasu): StavZapasu {
  if (stav.faze !== 'pauza1' && stav.faze !== 'pauza2') throw new Error('Zápas není v pauze.')
  if (stav.cekaNaNahradu) throw new Error('Nejdřív vyřeš náhradu zraněného hráče.')
  const s = structuredClone(stav)
  s.faze = 'hraje'
  s.udalosti.push({
    minuta: s.minuta,
    typ: 'info',
    tymId: '',
    text: `Začíná ${s.minuta === 20 ? '2.' : '3.'} třetina.`,
  })
  for (const strana of [s.domaci, s.hoste]) {
    for (const id of bruslariIds(strana.sestava)) {
      nastavEnergiu(strana, id, strana.energie[id] + 5)
    }
    strana.casNaLeduUtoku = [0, 0, 0, 0]
    strana.casNaLeduObran = [0, 0, 0]
  }
  return s
}

export function zmenTaktiku(stav: StavZapasu, strana: 'domaci' | 'hoste', taktika: Taktika): StavZapasu {
  const s = structuredClone(stav)
  const pred = s[strana].taktika
  if (pred === taktika) return s
  s[strana].taktika = taktika
  if (s.faze === 'hraje' || s.faze === 'pauza1' || s.faze === 'pauza2') {
    s.udalosti.push({
      minuta: s.minuta,
      typ: 'info',
      tymId: s[strana].klubId,
      text: `${s.minuta}. min: Trenér mění taktiku → ${nazevTaktiky(taktika)}.`,
    })
  }
  return s
}

export function pouzijTimeout(stav: StavZapasu, strana: 'domaci' | 'hoste'): StavZapasu {
  if (stav[strana].timeoutPouzit) throw new Error('Time-out už byl vyčerpán.')
  const s = structuredClone(stav)
  s[strana].timeoutPouzit = true
  s.momentum = clamp(s.momentum + (strana === 'domaci' ? 20 : -20), -100, 100)
  s.udalosti.push({
    minuta: s.minuta,
    typ: 'timeout',
    tymId: s[strana].klubId,
    text: `${s.minuta}. min: Time-out! Trenér uklidňuje hru a burcuje lavičku.`,
  })
  return s
}

export function odvolejBrankare(stav: StavZapasu, strana: 'domaci' | 'hoste', odvolat: boolean): StavZapasu {
  const s = structuredClone(stav)
  if (s[strana].odvolanyBrankar === odvolat) return s
  s[strana].odvolanyBrankar = odvolat
  s.udalosti.push({
    minuta: s.minuta,
    typ: 'info',
    tymId: s[strana].klubId,
    text: odvolat ? '⚠️ Brankář jede na střídačku — hra bez gólmana!' : 'Brankář se vrací do brány.',
  })
  return s
}

/** Proaktivní žeton — bonus +15 % na příští střeleckou šanci týmu. */
export function pouzijZetonTrenera(stav: StavZapasu, strana: 'domaci' | 'hoste'): StavZapasu {
  if (stav.faze !== 'hraje') throw new Error('Žeton jde použít jen během hry.')
  if (stav.cekaNaPresilovku || stav.cekaNaKlicovyMoment)
    throw new Error('Nejdřív vyřeš přesilovku nebo klíčový moment.')
  const st = stav[strana]
  if (st.zbyvajiciZetony <= 0) throw new Error('Došly žetony trenéra.')
  if (st.bonusDalsiSance > 0) throw new Error('Bonus z žetonu už čeká na využití.')
  const s = structuredClone(stav)
  const cil = s[strana]
  cil.zbyvajiciZetony--
  cil.bonusDalsiSance = 0.15
  s.udalosti.push({
    minuta: s.minuta,
    typ: 'info',
    tymId: cil.klubId,
    text: `🔥 Trenér spálil žeton — příští šance +15 %! Zbývá ${cil.zbyvajiciZetony} žetonů.`,
  })
  return s
}

export function aplikujProslov(
  stav: StavZapasu,
  strana: 'domaci' | 'hoste',
  volba: 'povzbudit' | 'zdrbat' | 'klid',
  rng: Rng,
): StavZapasu {
  if (stav.faze !== 'pauza1' && stav.faze !== 'pauza2')
    throw new Error('Proslov jde jen v pauze mezi třetinami.')
  const s = structuredClone(stav)
  const smer = strana === 'domaci' ? 1 : -1
  let bonus = 1
  let text = 'Trenér nechává kabinu vydechnout.'
  if (volba === 'povzbudit') {
    if (rng() < 0.6) {
      bonus = 1.06
      s.momentum = clamp(s.momentum + smer * 10, -100, 100)
      text = 'Trenér povzbuzuje kabinu — hráči se hecují! 💪'
    } else {
      text = 'Trenér povzbuzuje, kabina zůstává vlažná.'
    }
  } else if (volba === 'zdrbat') {
    const r = rng()
    if (r < 0.4) {
      bonus = 1.1
      s.momentum = clamp(s.momentum + smer * 15, -100, 100)
      text = 'Trenér seřval kabinu — a tým se probudil! 🔥'
    } else if (r < 0.75) {
      text = 'Ostrá slova v kabině. Uvidíme, co to udělá.'
    } else {
      bonus = 0.94
      s.momentum = clamp(s.momentum - smer * 10, -100, 100)
      text = 'Trenér to přehnal — kabina je zaražená. 😬'
    }
  }
  s[strana].proslovBonus = bonus
  s.udalosti.push({ minuta: s.minuta, typ: 'proslov', tymId: s[strana].klubId, text })
  return s
}

export function osobniProslov(
  stav: StavZapasu,
  strana: 'domaci' | 'hoste',
  tym: Tym,
  hracId: string,
  volba: 'povzbudit' | 'zdrbat',
  rng: Rng,
): StavZapasu {
  if (stav.faze !== 'pauza1' && stav.faze !== 'pauza2')
    throw new Error('Osobní proslov jde jen v pauze mezi třetinami.')
  if (stav[strana].osobniProslovPouzit.includes(hracId))
    throw new Error('S tímto hráčem už trenér v zápase mluvil.')
  const hrac = tym.hraci.find((h) => h.id === hracId)
  if (!hrac) throw new Error('Hráč není v týmu.')
  const s = structuredClone(stav)
  const st = s[strana]
  st.osobniProslovPouzit.push(hracId)
  let bonus = 1
  let energieDelta = 0
  let text = `${hrac.jmeno} ${hrac.prijmeni} bere slova trenéra na vědomí.`
  if (volba === 'povzbudit') {
    if (rng() < 0.6) {
      bonus = 1.06
      energieDelta = 8
      text = `💪 ${hrac.jmeno} ${hrac.prijmeni} po povzbuzení viditelně ožil!`
    }
  } else {
    const r = rng()
    if (r < 0.4) {
      bonus = 1.1
      energieDelta = 10
      text = `🔥 ${hrac.jmeno} ${hrac.prijmeni} dostal kartáč — a jde si to vyříkat s puky!`
    } else if (r >= 0.75) {
      bonus = 0.94
      energieDelta = -5
      text = `😬 ${hrac.jmeno} ${hrac.prijmeni} kritiku nese špatně.`
    }
  }
  st.osobniBonus[hracId] = bonus
  nastavEnergiu(st, hracId, (st.energie[hracId] ?? 100) + energieDelta)
  s.udalosti.push({ minuta: s.minuta, typ: 'proslov', tymId: st.klubId, hracId, text })
  return s
}

function lzeMenitSestavuVZapase(stav: StavZapasu, strana: 'domaci' | 'hoste'): boolean {
  if (stav.faze === 'pauza1' || stav.faze === 'pauza2' || stav.faze === 'hraje') return true
  if (stav.cekaNaPresilovku?.strana === strana) return true
  return false
}

function aplikujNovouSestavu(
  stav: StavZapasu,
  strana: 'domaci' | 'hoste',
  tym: Tym,
  novaSestava: Sestava,
  textUdalosti: string,
): StavZapasu {
  const st = stav[strana]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const vsichni = [...novaSestava.utoky.flat(), ...novaSestava.obrany.flat(), novaSestava.brankar]
  if (novaSestava.utoky.length !== 4) throw new Error('Sestava musí mít 4 útoky.')
  if (novaSestava.obrany.length !== 3) throw new Error('Sestava musí mít 3 obrany.')
  if (novaSestava.utoky.some((l) => l.length > 3)) throw new Error('Útok má max 3 hráče.')
  if (novaSestava.obrany.some((l) => l.length > 2)) throw new Error('Obrana má max 2 hráče.')
  if (new Set(vsichni).size !== vsichni.length) throw new Error('Hráč nesmí být v sestavě dvakrát.')
  const soucasni = new Set([
    ...st.sestava.utoky.flat(),
    ...st.sestava.obrany.flat(),
    st.sestava.brankar,
  ])
  for (const id of vsichni) {
    const h = podleId.get(id)
    if (!h) throw new Error('Hráč není v týmu.')
    if (!soucasni.has(id) && (h.zranenZapasu > 0 || st.zraneni.includes(id)))
      throw new Error(`${h.jmeno} ${h.prijmeni} je zraněný.`)
  }
  for (const l of novaSestava.utoky) for (const id of l) {
    if (podleId.get(id)!.pozice === 'G') throw new Error('Brankář nemůže hrát v poli.')
  }
  if (podleId.get(novaSestava.brankar)!.pozice !== 'G') throw new Error('V bráně musí být brankář.')

  const s = structuredClone(stav)
  const cil = s[strana]
  const stary = otiskLajn(cil.sestava)
  const novy = otiskLajn(novaSestava)
  cil.chemie = {
    utoky: novy.utoky.map((o, i) => {
      const c =
        o === stary.utoky[i]
          ? cil.chemie.utoky[i]
          : chemiePoZmeneLajny(cil.sestava.utoky[i], novaSestava.utoky[i], cil.chemie.utoky[i])
      return chemieZaPoziceNaLede(novaSestava.utoky[i], podleId, 'utok', c)
    }),
    obrany: novy.obrany.map((o, i) => {
      const c =
        o === stary.obrany[i]
          ? cil.chemie.obrany[i]
          : chemiePoZmeneLajny(cil.sestava.obrany[i], novaSestava.obrany[i], cil.chemie.obrany[i])
      return chemieZaPoziceNaLede(novaSestava.obrany[i], podleId, 'obrana', c)
    }),
  }
  cil.sestava = structuredClone(novaSestava)
  s.udalosti.push({ minuta: s.minuta, typ: 'info', tymId: cil.klubId, text: textUdalosti })
  return s
}

/** Okamžitá výměna dvou hráčů stejné pozice — během hry i při volbě přesilovky. */
export function vymenHraceVZapase(
  stav: StavZapasu,
  strana: 'domaci' | 'hoste',
  tym: Tym,
  idA: string,
  idB: string,
): StavZapasu {
  if (!lzeMenitSestavuVZapase(stav, strana))
    throw new Error('Teď nejde měnit sestavu.')
  const st = stav[strana]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const a = podleId.get(idA)
  const b = podleId.get(idB)
  if (!a || !b) throw new Error('Hráč není v týmu.')
  if ((a.pozice === 'G') !== (b.pozice === 'G')) throw new Error('Brankáře vyměň jen za jiného brankáře.')
  const vSestave = new Set([...st.sestava.utoky.flat(), ...st.sestava.obrany.flat(), st.sestava.brankar])
  const aZraneny = st.zraneni.includes(idA) || a.zranenZapasu > 0
  const bZraneny = st.zraneni.includes(idB) || b.zranenZapasu > 0
  if (aZraneny && bZraneny) throw new Error('Oba hráči jsou zranění.')
  const aNovy = !vSestave.has(idA)
  const bNovy = !vSestave.has(idB)
  if (aNovy && aZraneny) throw new Error(`${a.jmeno} ${a.prijmeni} je zraněný.`)
  if (bNovy && bZraneny) throw new Error(`${b.jmeno} ${b.prijmeni} je zraněný.`)
  return aplikujNovouSestavu(
    stav,
    strana,
    tym,
    vymenVSestave(st.sestava, idA, idB),
    `${stav.minuta}. min: Střídání — ${a.prijmeni} ↔ ${b.prijmeni}.`,
  )
}

/** Dosadí hráče z lavičky do lajny s volným místem. */
export function dosadHraceVZapase(
  stav: StavZapasu,
  strana: 'domaci' | 'hoste',
  tym: Tym,
  hracId: string,
  typ: 'utok' | 'obrana',
  lajna: number,
): StavZapasu {
  if (!lzeMenitSestavuVZapase(stav, strana)) throw new Error('Teď nejde měnit sestavu.')
  const st = stav[strana]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const h = podleId.get(hracId)
  if (!h) throw new Error('Hráč není v týmu.')
  if (h.pozice === 'G') throw new Error('Brankáře do pole nedosadíš.')
  const vSestave = new Set([...st.sestava.utoky.flat(), ...st.sestava.obrany.flat(), st.sestava.brankar])
  if (!vSestave.has(hracId) && (h.zranenZapasu > 0 || st.zraneni.includes(hracId)))
    throw new Error(`${h.jmeno} ${h.prijmeni} je zraněný.`)
  return aplikujNovouSestavu(
    stav,
    strana,
    tym,
    dosadDoLajny(st.sestava, hracId, typ, lajna),
    `${stav.minuta}. min: Do ${lajna + 1}. ${typ === 'utok' ? 'útoku' : 'obrany'} nastoupil ${h.prijmeni}.`,
  )
}

export function upravSestavuVZapase(
  stav: StavZapasu,
  strana: 'domaci' | 'hoste',
  tym: Tym,
  novaSestava: Sestava,
): StavZapasu {
  if (stav.faze !== 'pauza1' && stav.faze !== 'pauza2')
    throw new Error('Lajny jdou přeskládat jen v pauze mezi třetinami.')
  return aplikujNovouSestavu(stav, strana, tym, novaSestava, 'Trenér přeskládal lajny.')
}

export function nahradZraneneho(stav: StavZapasu, tym: Tym, nahradnikId: string): StavZapasu {
  const info = stav.cekaNaNahradu
  if (!info) throw new Error('Nikdo nečeká na náhradu.')
  const s = structuredClone(stav)
  const strana = s[info.strana]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const zraneny = podleId.get(info.hracId)!
  const nahradnik = podleId.get(nahradnikId)
  const vSestave = new Set([...strana.sestava.utoky.flat(), ...strana.sestava.obrany.flat(), strana.sestava.brankar])
  if (!nahradnik) throw new Error('Náhradník není v týmu.')
  if (nahradnik.pozice !== zraneny.pozice) throw new Error('Náhradník musí hrát stejnou pozici.')
  if (vSestave.has(nahradnikId)) throw new Error('Náhradník už je v sestavě.')
  if (nahradnik.zranenZapasu > 0 || strana.zraneni.includes(nahradnikId)) throw new Error('Náhradník je zraněný.')
  strana.sestava = vymenVSestave(strana.sestava, info.hracId, nahradnikId)
  s.cekaNaNahradu = null
  s.udalosti.push({
    minuta: s.minuta,
    typ: 'info',
    tymId: strana.klubId,
    text: `Do hry jde ${jmeno(nahradnik)} místo zraněného ${jmeno(zraneny)}.`,
  })
  return s
}

export function autoNahrada(stav: StavZapasu, tym: Tym): StavZapasu {
  const info = stav.cekaNaNahradu
  if (!info) throw new Error('Nikdo nečeká na náhradu.')
  const strana = stav[info.strana]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const zraneny = podleId.get(info.hracId)!
  const vSestave = new Set([...strana.sestava.utoky.flat(), ...strana.sestava.obrany.flat(), strana.sestava.brankar])
  const kandidati = tym.hraci
    .filter(
      (h) =>
        h.pozice === zraneny.pozice &&
        !vSestave.has(h.id) &&
        h.zranenZapasu === 0 &&
        !strana.zraneni.includes(h.id),
    )
    .sort((a, b) => b.atributy.strelba + b.atributy.obrana - (a.atributy.strelba + a.atributy.obrana))
  if (kandidati.length === 0) {
    // ponytail: bez náhradníka hraje zraněný dál (oslabení řeší M3 s širšími soupiskami)
    const s = structuredClone(stav)
    s.cekaNaNahradu = null
    return s
  }
  return nahradZraneneho(stav, tym, kandidati[0].id)
}

export function autoRozhodniCekani(stav: StavZapasu, domaci: Tym, hoste: Tym, rng: Rng): StavZapasu {
  if (stav.cekaNaPresilovku) {
    const info = stav.cekaNaPresilovku
    return potvrdPresilovku(
      stav,
      info.typ === 'pp'
        ? { petka: nejlepsiPetkaPP(stav[info.strana]) }
        : { petka: { utok: 3, obrana: 0 }, pkAgresivni: false },
    )
  }
  if (stav.cekaNaKlicovyMoment) return potvrdKlicovyMoment(stav, 'nechat', domaci, hoste, rng)
  return stav
}

export function simulujDoKonce(stav: StavZapasu, domaci: Tym, hoste: Tym, rng: Rng): StavZapasu {
  let s = stav
  let pojistka = 0
  while (s.faze !== 'konec' && pojistka++ < 300) {
    if (s.cekaNaNahradu) s = autoNahrada(s, s.cekaNaNahradu.strana === 'domaci' ? domaci : hoste)
    else if (s.cekaNaPresilovku || s.cekaNaKlicovyMoment) s = autoRozhodniCekani(s, domaci, hoste, rng)
    else if (s.faze === 'pauza1' || s.faze === 'pauza2') s = pokracujPoPauze(s)
    else s = simulujMinutu(s, domaci, hoste, rng)
  }
  return s
}

export function prevedNaVysledek(stav: StavZapasu): Vysledek {
  return {
    golyDomaci: stav.domaci.goly,
    golyHoste: stav.hoste.goly,
    strelyDomaci: stav.domaci.strely,
    strelyHoste: stav.hoste.strely,
    prodlouzeni: stav.prodlouzeni,
    najezdy: stav.najezdy,
    udalosti: stav.udalosti,
    energie: { ...stav.domaci.energie, ...stav.hoste.energie },
    hodnoceni: { ...stav.domaci.hodnoceni, ...stav.hoste.hodnoceni },
  }
}

export { segmentyKostky, predikceUtoku, bonusMinihryZKvality, aplikujBonusMinihry } from './zapasPravdepodobnost'
export { aktivniPetkaNaLedu } from './zapasPetky'

export function silaStran(stav: StavZapasu, domaci: Tym, hoste: Tym) {
  return {
    domaci: sily(stav.domaci, domaci, stav.minuta),
    hoste: sily(stav.hoste, hoste, stav.minuta),
  }
}

export function simulujCelyZapas(
  domaci: Tym,
  hoste: Tym,
  rng: Rng,
  moznosti: { derby?: boolean; atmosfera?: number } = {},
): Vysledek {
  return prevedNaVysledek(simulujDoKonce(zacniZapas(domaci, hoste, moznosti), domaci, hoste, rng))
}
