import { vyhazov } from './kariera'
import { kc, nabidkySponzora, SPONZOR_FIX, urovenKlubu } from './hodnoty'
import { zapisFinance } from './platy'
import { hodnotaHrace, MINIMA, odeberZTymu, pocetNaPozici } from './prestupy'
import { spocitejTabulku } from './tabulka'
import type { DomaciTrzby, GameState, MarketingSmlouva, ReklamaTyp, StadionNastaveni, StadionVylepseniTyp, TypSponzora } from './types'

export { nabidkySponzora, SPONZOR_FIX, SPONZOR_BONUS_VYHRA } from './hodnoty'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export const ZAKLAD_DIVAKU = [8000, 3500, 1200]
export const CENA_LISTKU_ZAKLAD = [150, 100, 60]
export const CENA_JIDLA_ZAKLAD = 80
export const CENA_PITI_ZAKLAD = 50
export const CENA_MERCH_ZAKLAD = 250

const MAX_UROVEN_VYLEPSENI = 3
const LIGA_NASOBEK = [2.5, 1.5, 1]

const NAKLADY_VYLEPSENI: Record<StadionVylepseniTyp, number[]> = {
  tribuny: [800_000, 2_000_000, 5_000_000],
  obcerstveni: [400_000, 1_000_000, 2_500_000],
  obchod: [300_000, 800_000, 2_000_000],
}

const KONVERZE_JIDLA = [0.22, 0.28, 0.34, 0.4]
const KONVERZE_PITI = [0.18, 0.24, 0.3, 0.36]
const KONVERZE_MERCH = [0.05, 0.07, 0.09, 0.11]
const KAPACITA_TRIBUNY = [1, 1.08, 1.16, 1.24]

export const POPISY_VYLEPSENI: Record<StadionVylepseniTyp, string[]> = {
  tribuny: ['Základní tribuny', 'Rozšířené sektory', 'Nová tribuna', 'Moderní aréna'],
  obcerstveni: ['Jedno okénko', 'Více stánků', 'Food court', 'Prémiové občerstvení'],
  obchod: ['Stánek u vchodu', 'Větší fan shop', 'Klubový obchod', 'Megastore'],
}

export function vychoziStadion(liga: number): StadionNastaveni {
  return {
    cenaListku: CENA_LISTKU_ZAKLAD[liga] ?? 60,
    cenaJidla: CENA_JIDLA_ZAKLAD,
    cenaPiti: CENA_PITI_ZAKLAD,
    cenaMerch: CENA_MERCH_ZAKLAD,
    vylepseni: { tribuny: 0, obcerstveni: 0, obchod: 0 },
  }
}

function urovenVylepseni(s: GameState, typ: StadionVylepseniTyp): number {
  return s.stadion.vylepseni?.[typ] ?? 0
}

export function cenaVylepseniStadionu(s: GameState, typ: StadionVylepseniTyp): number | null {
  const lvl = urovenVylepseni(s, typ)
  if (lvl >= MAX_UROVEN_VYLEPSENI) return null
  const u = urovenKlubu(s, s.mujKlubId)
  return Math.round(NAKLADY_VYLEPSENI[typ][lvl] * (LIGA_NASOBEK[u] ?? 1))
}

/** Elasticita prodeje — vyšší úroveň občerstvení/obchodu sníží penalizaci za vysokou cenu. */
export function faktorCenyProdeje(cena: number, zaklad: number, uroven: number): number {
  const pomer = cena / zaklad
  const elasticita = Math.max(0.35, 0.6 - uroven * 0.07)
  return Math.pow(1 / pomer, elasticita)
}

/** Levnější lístky přitáhnou víc lidí, dražší odradí (elasticita ~0.65). */
export function faktorCenyVstupneho(s: GameState): number {
  const u = urovenKlubu(s, s.mujKlubId)
  const zaklad = CENA_LISTKU_ZAKLAD[u] ?? 60
  const pomer = s.stadion.cenaListku / zaklad
  return Math.pow(1 / pomer, 0.65)
}

export function navstevnostDomaciho(s: GameState, derby: boolean): number {
  const u = urovenKlubu(s, s.mujKlubId)
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  const tab = spocitejTabulku(liga.tymy, liga.zapasy)
  const pozice = tab.findIndex((r) => r.tymId === s.mujKlubId) + 1
  const faktorTabulky = pozice <= 3 ? 1.15 : pozice >= 12 ? 0.8 : 1
  const naladaFaktor = 0.6 + s.naladaFanousku / 250 + bonusNavstevnostiZReklamy(s)
  const zaklad = ZAKLAD_DIVAKU[u] * naladaFaktor * (derby ? 1.3 : 1) * faktorTabulky
  const poptavka = Math.round(zaklad * faktorCenyVstupneho(s))
  const kapacita = Math.round(ZAKLAD_DIVAKU[u] * KAPACITA_TRIBUNY[urovenVylepseni(s, 'tribuny')])
  return Math.min(poptavka, kapacita)
}

export function pocetDomacichZapasu(s: GameState, dnu = 30): number {
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  const doDne = s.den + dnu
  return liga.zapasy.filter(
    (z) => !z.vysledek && z.domaci === s.mujKlubId && z.den > s.den && z.den <= doDne,
  ).length
}

export function efektivniSponzorMesicne(s: GameState): number {
  if (s.sponzorNabidka) return 0
  return Math.round(s.sponzor.mesicne * (0.8 + s.trener.duvera / 250))
}

export function mesicniCashflow(s: GameState): {
  prijmy: number
  vydaje: number
  bilance: number
  sponzor: number
  stadion: number
  marketing: number
  platy: number
  dnuDoUzaverky: number
} {
  const muj = s.tymy[s.mujKlubId]
  const platy = muj.hraci.reduce((sum, h) => sum + h.plat, 0)
  const sponzor = efektivniSponzorMesicne(s)
  const domaci = pocetDomacichZapasu(s, 30)
  const stadion = vypocetDomacichTrzeb(s, false).celkem * domaci
  const marketing = s.marketing.reduce((sum, m) => sum + m.mesicne, 0)
  const prijmy = sponzor + stadion + marketing
  const dnuDoUzaverky = s.posledniUzaverka + 30 - s.den
  return { prijmy, vydaje: platy, bilance: prijmy - platy, sponzor, stadion, marketing, platy, dnuDoUzaverky }
}

export function oslovSponzory(s: GameState): GameState {
  if (s.den - s.posledniOslovSponzory < 30) throw new Error('Sponzory lze oslovit jen jednou za 30 dní.')
  const ns = structuredClone(s)
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  const tab = spocitejTabulku(liga.tymy, liga.zapasy)
  const pozice = tab.findIndex((r) => r.tymId === s.mujKlubId) + 1
  const faktor = (pozice <= 6 ? 1.2 : pozice >= 12 ? 0.6 : 1) * (0.8 + s.naladaFanousku / 250)
  const u = urovenKlubu(s, s.mujKlubId)
  const zaklad = Math.round(SPONZOR_FIX[u] * 0.15 * faktor)
  const nabidky: MarketingSmlouva[] = [
    { typ: 'dres', nazev: 'Partner na dresu', mesicne: zaklad, doSezony: s.sezona },
    { typ: 'led', nazev: 'LED reklama', mesicne: Math.round(zaklad * 0.6), doSezony: s.sezona },
  ]
  if (pozice <= 8 && u === 0) {
    nabidky.push({ typ: 'tvp', nazev: 'Regionální TV partner', mesicne: Math.round(zaklad * 0.4), doSezony: s.sezona })
  }
  ns.marketing = [...ns.marketing, ...nabidky]
  ns.posledniOslovSponzory = s.den
  ns.zpravy.unshift(`🤝 Noví sponzoři: ${nabidky.map((n) => n.nazev).join(', ')}.`)
  ns.zpravy = ns.zpravy.slice(0, 50)
  return ns
}

export interface ReklamaKanal {
  typ: ReklamaTyp
  nazev: string
  popis: string
  dnu: number
  naladaOkamzite: number
  bonusNavstevnost: number
}

export const REKLAMA_KANALY: ReklamaKanal[] = [
  { typ: 'noviny', nazev: 'Noviny', popis: 'Inzerát v regionálních novinách', dnu: 10, naladaOkamzite: 4, bonusNavstevnost: 0.03 },
  { typ: 'radio', nazev: 'Rádio', popis: 'Reklamní spot v rádiu', dnu: 14, naladaOkamzite: 5, bonusNavstevnost: 0.05 },
  { typ: 'tv', nazev: 'TV', popis: 'Spot v regionální televizi', dnu: 21, naladaOkamzite: 8, bonusNavstevnost: 0.1 },
]

const CENA_REKLAMY: Record<ReklamaTyp, number[]> = {
  noviny: [120_000, 50_000, 20_000],
  radio: [180_000, 75_000, 30_000],
  tv: [450_000, 180_000, 70_000],
}

export function cenaReklamy(s: GameState, typ: ReklamaTyp): number {
  const u = urovenKlubu(s, s.mujKlubId)
  return CENA_REKLAMY[typ][u] ?? CENA_REKLAMY[typ][2]
}

export function aktivniReklama(s: GameState, typ: ReklamaTyp): AktivniReklama | null {
  return (s.reklama ?? []).find((r) => r.typ === typ && r.doDne > s.den) ?? null
}

export function bonusNavstevnostiZReklamy(s: GameState): number {
  let bonus = 0
  for (const r of s.reklama ?? []) {
    if (r.doDne <= s.den) continue
    const kanal = REKLAMA_KANALY.find((k) => k.typ === r.typ)
    if (kanal) bonus += kanal.bonusNavstevnost
  }
  return bonus
}

export function kupReklamu(state: GameState, typ: ReklamaTyp): GameState {
  if (aktivniReklama(state, typ)) throw new Error('Tahle kampaň už běží — počkej, až vyprší.')
  const kanal = REKLAMA_KANALY.find((k) => k.typ === typ)!
  const cena = cenaReklamy(state, typ)
  const muj = state.tymy[state.mujKlubId]
  if (muj.rozpocet < cena) throw new Error('Na reklamu nemáš rozpočet.')
  const s = structuredClone(state)
  s.tymy[s.mujKlubId].rozpocet -= cena
  if (!s.reklama) s.reklama = []
  s.reklama.push({ typ, doDne: s.den + kanal.dnu })
  s.naladaFanousku = clamp(s.naladaFanousku + kanal.naladaOkamzite, 0, 100)
  zapisFinance(s, `Reklama — ${kanal.nazev}`, -cena)
  s.zpravy.unshift(
    `📣 Reklama v ${kanal.nazev.toLowerCase()} na ${kanal.dnu} dní (+${kanal.naladaOkamzite} nálada fanoušků, víc diváků na stadionu).`,
  )
  s.zpravy = s.zpravy.slice(0, 50)
  return s
}

export function prodejTvPrav(s: GameState): GameState {
  if (s.marketing.some((m) => m.typ === 'tvp' && m.doSezony === s.sezona)) {
    throw new Error('TV práva už máš prodaná tuto sezónu.')
  }
  const ns = structuredClone(s)
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  const tab = spocitejTabulku(liga.tymy, liga.zapasy)
  const pozice = tab.findIndex((r) => r.tymId === s.mujKlubId) + 1
  const u = urovenKlubu(s, s.mujKlubId)
  const jednoraz = Math.round(SPONZOR_FIX[u] * (pozice <= 6 ? 2 : pozice >= 12 ? 0.5 : 1))
  const mesicne = Math.round(SPONZOR_FIX[u] * 0.25 * (pozice <= 6 ? 1.5 : 0.8))
  ns.tymy[ns.mujKlubId].rozpocet += jednoraz
  zapisFinance(ns, 'Prodej TV práv (jednorázově)', jednoraz)
  ns.marketing.push({ typ: 'tvp', nazev: 'TV práva', mesicne, doSezony: s.sezona })
  ns.zpravy.unshift(`📺 TV práva prodána za ${kc(jednoraz)} + ${kc(mesicne)}/měs.`)
  ns.zpravy = ns.zpravy.slice(0, 50)
  return ns
}

export function vypocetDomacichTrzeb(s: GameState, derby: boolean): DomaciTrzby {
  const navstevnost = navstevnostDomaciho(s, derby)
  const vstupne = navstevnost * s.stadion.cenaListku
  const lvlObc = urovenVylepseni(s, 'obcerstveni')
  const lvlObch = urovenVylepseni(s, 'obchod')
  const jidlo = Math.round(
    navstevnost * KONVERZE_JIDLA[lvlObc] * s.stadion.cenaJidla * faktorCenyProdeje(s.stadion.cenaJidla, CENA_JIDLA_ZAKLAD, lvlObc),
  )
  const piti = Math.round(
    navstevnost * KONVERZE_PITI[lvlObc] * s.stadion.cenaPiti * faktorCenyProdeje(s.stadion.cenaPiti, CENA_PITI_ZAKLAD, lvlObc),
  )
  const merch = Math.round(
    navstevnost *
      KONVERZE_MERCH[lvlObch] *
      s.stadion.cenaMerch *
      faktorCenyProdeje(s.stadion.cenaMerch, CENA_MERCH_ZAKLAD, lvlObch) *
      (0.8 + s.naladaFanousku / 500),
  )
  return { navstevnost, vstupne, jidlo, piti, merch, celkem: vstupne + jidlo + piti + merch }
}

/** @deprecated použij vypocetDomacichTrzeb */
export function vstupne(s: GameState, derby: boolean): number {
  return vypocetDomacichTrzeb(s, derby).celkem
}

export function zmenStadion(state: GameState, zmeny: Partial<StadionNastaveni>): GameState {
  const s = structuredClone(state)
  const u = urovenKlubu(s, s.mujKlubId)
  const zaklad = CENA_LISTKU_ZAKLAD[u]
  const lvlObc = urovenVylepseni(s, 'obcerstveni')
  const lvlObch = urovenVylepseni(s, 'obchod')
  if (zmeny.cenaListku !== undefined) {
    const min = Math.round(zaklad * 0.6)
    const max = Math.round(zaklad * 1.4)
    s.stadion.cenaListku = clamp(zmeny.cenaListku, min, max)
  }
  if (zmeny.cenaJidla !== undefined) {
    const max = 200 + lvlObc * 30
    s.stadion.cenaJidla = clamp(zmeny.cenaJidla, 40, max)
  }
  if (zmeny.cenaPiti !== undefined) {
    const max = 120 + lvlObc * 20
    s.stadion.cenaPiti = clamp(zmeny.cenaPiti, 30, max)
  }
  if (zmeny.cenaMerch !== undefined) {
    const max = 600 + lvlObch * 70
    s.stadion.cenaMerch = clamp(zmeny.cenaMerch, 100, max)
  }
  return s
}

export function vylepsiStadion(state: GameState, typ: StadionVylepseniTyp): GameState {
  const lvl = urovenVylepseni(state, typ)
  if (lvl >= MAX_UROVEN_VYLEPSENI) throw new Error('Tahle část stadionu je už na maximální úrovni.')
  const cena = cenaVylepseniStadionu(state, typ)!
  const muj = state.tymy[state.mujKlubId]
  if (muj.rozpocet < cena) throw new Error(`Na vylepšení chybí ${kc(cena - muj.rozpocet)}.`)
  const s = structuredClone(state)
  if (!s.stadion.vylepseni) s.stadion.vylepseni = { tribuny: 0, obcerstveni: 0, obchod: 0 }
  s.stadion.vylepseni[typ] = lvl + 1
  s.tymy[s.mujKlubId].rozpocet -= cena
  const nazev = POPISY_VYLEPSENI[typ][lvl + 1]
  zapisFinance(s, `Vylepšení stadionu — ${nazev}`, -cena)
  s.zpravy.unshift(`🏗️ Stadion vylepšen: ${nazev} (−${kc(cena)}).`)
  s.zpravy = s.zpravy.slice(0, 50)
  return s
}

export function zvolSponzora(state: GameState, typ: TypSponzora): GameState {
  const s = structuredClone(state)
  s.sponzor = nabidkySponzora(s)[typ]
  s.sponzorNabidka = false
  s.zpravy.unshift(
    typ === 'jistota'
      ? '🤝 Podepsána sponzorská smlouva s jistotou.'
      : '🤝 Podepsána bonusová smlouva — každá výhra se počítá!',
  )
  return s
}

export function aplikujDomaciTrzby(s: GameState, derby: boolean): DomaciTrzby {
  const trzby = vypocetDomacichTrzeb(s, derby)
  s.tymy[s.mujKlubId].rozpocet += trzby.celkem
  s.posledniDomaci = {
    den: s.den,
    navstevnost: trzby.navstevnost,
    vstupne: trzby.vstupne,
    jidlo: trzby.jidlo,
    piti: trzby.piti,
    merch: trzby.merch,
  }
  zapisFinance(s, `Stadion (${trzby.navstevnost} diváků)`, trzby.celkem)
  s.zpravy.unshift(
    `🏟️ Stadion: ${trzby.navstevnost.toLocaleString('cs-CZ')} diváků · vstupné +${kc(trzby.vstupne)} · jídlo +${kc(trzby.jidlo)} · pití +${kc(trzby.piti)} · merch +${kc(trzby.merch)}`,
  )
  s.zpravy = s.zpravy.slice(0, 50)
  return trzby
}

// mutuje klon — volá advanceDay
export function mesicniUzaverka(s: GameState): void {
  for (const t of Object.values(s.tymy)) {
    const platy = t.hraci.reduce((sum, h) => sum + h.plat, 0)
    t.rozpocet -= platy
    const u = urovenKlubu(s, t.klubId)
    if (t.klubId === s.mujKlubId) {
      const fix = efektivniSponzorMesicne(s)
      const marketing = s.marketing.reduce((sum, m) => sum + m.mesicne, 0)
      t.rozpocet += fix + marketing
      zapisFinance(s, 'Měsíční uzávěrka — sponzor', fix)
      if (marketing > 0) zapisFinance(s, 'Měsíční uzávěrka — marketing', marketing)
      zapisFinance(s, 'Měsíční uzávěrka — platy', -platy)
      s.zpravy.unshift(
        `📒 Měsíční uzávěrka: sponzor +${kc(fix)}${marketing > 0 ? `, marketing +${kc(marketing)}` : ''}, platy −${kc(platy)}. Zůstatek ${kc(t.rozpocet)}.`,
      )
    } else {
      t.rozpocet += SPONZOR_FIX[u] + Math.round(ZAKLAD_DIVAKU[u] * CENA_LISTKU_ZAKLAD[u] * 4 * 0.8)
    }
  }
  s.posledniUzaverka = s.den
  s.zpravy = s.zpravy.slice(0, 50)
}

// mutuje klon — volá dokonciZapas po mé výhře
export function bonusZaVyhru(s: GameState): void {
  if (s.sponzor.typ !== 'bonus' || s.sponzor.zaVyhru <= 0) return
  s.tymy[s.mujKlubId].rozpocet += s.sponzor.zaVyhru
  zapisFinance(s, 'Bonus za výhru', s.sponzor.zaVyhru)
}

// mutuje klon — volá advanceDay
export function zkontrolujBankrot(s: GameState): void {
  const muj = s.tymy[s.mujKlubId]
  if (muj.rozpocet >= 0) return
  if (muj.rozpocet > -5_000_000) {
    if (s.den % 7 === 0) {
      s.zpravy.unshift(`⚠️ Klub je v mínusu (${kc(muj.rozpocet)})! Prodej hráče, nebo přijdou následky.`)
      s.zpravy = s.zpravy.slice(0, 50)
    }
    return
  }
  const prodejni = muj.hraci
    .filter((h) => pocetNaPozici(muj, h.pozice) > MINIMA[h.pozice])
    .sort((a, b) => hodnotaHrace(b) - hodnotaHrace(a))
  if (prodejni.length === 0) {
    if (s.den % 7 === 0) {
      s.zpravy.unshift(`🚨 Klub je hluboko v mínusu (${kc(muj.rozpocet)}) a není koho prodat — sežeň peníze prodejem po posilách z akademie, nebo čekej na uzávěrku.`)
      s.zpravy = s.zpravy.slice(0, 50)
    }
    return
  }
  const obetovany = prodejni[0]
  const cena = hodnotaHrace(obetovany)
  odeberZTymu(muj, obetovany.id)
  muj.rozpocet += cena
  zapisFinance(s, `Nucený prodej ${obetovany.prijmeni}`, cena)
  s.nabidkyProdeje = s.nabidkyProdeje.filter((n) => n.hracId !== obetovany.id)
  if (s.prichoziNabidka?.hracId === obetovany.id) s.prichoziNabidka = null
  s.trener.duvera = clamp(s.trener.duvera - 10, 0, 100)
  s.zpravy.unshift(
    `🚨 Vedení zasáhlo: ${obetovany.jmeno} ${obetovany.prijmeni} prodán do zahraničí za ${kc(cena)}. Důvěra klesá.`,
  )
  s.zpravy = s.zpravy.slice(0, 50)
  if (s.trener.duvera === 0 && !s.nabidky) vyhazov(s)
}
