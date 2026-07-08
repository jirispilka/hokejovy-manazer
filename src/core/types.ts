export type Pozice = 'G' | 'D' | 'U'

/** Preferovaná ledová pozice (křídlo, střed, obranná strana). */
export type DetailPozice = 'LW' | 'C' | 'RW' | 'LD' | 'RD'

export type TypSponzora = 'jistota' | 'bonus'

export interface Sponzor {
  typ: TypSponzora
  mesicne: number
  zaVyhru: number
}

export type TreninkZamereni = 'strelba' | 'obrana' | 'kondice' | 'brankari'

export type TreninkTyp =
  | 'strelba'
  | 'utok'
  | 'obrana'
  | 'kondice'
  | 'taktika'
  | 'odpocinek'
  | 'volno'
  | 'zabava'
  | 'parta'
  | 'sponzor'

export type TreninkIntenzita = 'lehka' | 'tezka'

export interface TreninkDen {
  typ: TreninkTyp
  intenzita?: TreninkIntenzita
  hraci?: string[]
  lajna?: number // 0–3 útok, 4–6 obrana
}

export type MarketingTyp = 'dres' | 'led' | 'tvp'

export interface MarketingSmlouva {
  typ: MarketingTyp
  nazev: string
  mesicne: number
  doSezony: number
}

/** Placená reklamní kampaň (výdaj → náladě a návštěvnosti). */
export type ReklamaTyp = 'radio' | 'noviny' | 'tv'

export interface AktivniReklama {
  typ: ReklamaTyp
  doDne: number
}

export interface KabinovaVolba {
  text: string
  efektMoralka: number
  efektForma?: number
  efektChemie?: number
}

export interface KabinovaUdalost {
  id: string
  text: string
  moznosti: KabinovaVolba[]
}

export interface NabidkaProdeje {
  hracId: string
  denOd: number
}

export interface PrichoziNabidka {
  hracId: string
  klubId: string
  castka: number
}

export interface MoznostOdpovedi {
  text: string
  efektMoralka: number
  efektNalada: number
  riskantni: boolean
}

export interface OtazkaMedii {
  text: string
  moznosti: MoznostOdpovedi[]
}

export interface Atributy {
  strelba: number
  prihravky: number
  brusleni: number
  obrana: number
  fyzicka: number
  chytani: number // relevantní jen pro brankáře, ostatní mají nízké
  vydrz: number // jak pomalu ubývá energie v zápase
  technika: number // „hráč na puku" — drží akci
}

export interface Hrac {
  id: string
  jmeno: string
  prijmeni: string
  vek: number
  pozice: Pozice
  atributy: Atributy
  potencial: number // strop overall, u hráčů 24+ rovný aktuálnímu overall
  forma: number // 30–70, výchozí 50
  unava: number // 0–100, výchozí 0
  goly: number // statistiky aktuální sezóny
  asistence: number
  zranenZapasu: number // 0 = zdravý
  odehranoSezona: number // zápasy v sestavě v aktuální sezóně
  plat: number // Kč/měsíc
  trzniCena?: number // Kč, importovaný/externě odhadnutý tržní benchmark
  detailPozice?: DetailPozice // z reálných dat nebo odvozeno z atributů
  historieStatistik?: HistorickaStatistika[]
  herniHistorie?: HernickaHistorie[]
}

export interface HernickaHistorie {
  sezona: number
  klub: string
  zapasy: number
  goly: number
  asistence: number
}

export interface HistorickaStatistika {
  sezona: string
  soutez: string
  tym: string
  zapasy: number
  goly: number
  asistence: number
  body: number
}

export interface Klub {
  id: string
  nazev: string
  liga: number // 0 = Extraliga, 1 = Chance liga, 2 = 2. liga
  barvy: [string, string]
}

export interface Sestava {
  utoky: string[][] // 4 lajny × 3 id hráčů
  obrany: string[][] // 3 dvojice × 2 id hráčů
  brankar: string // id brankáře
}

export type Taktika = 'velmi_utocna' | 'utocna' | 'vyvazena' | 'obranna' | 'velmi_obranna'

export interface Tym {
  klubId: string
  nazev: string
  hraci: Hrac[]
  sestava: Sestava
  moralka: number // 30–70, výchozí 50
  kapitanId: string | null
  taktika: Taktika
  chemie: { utoky: number[]; obrany: number[] } // 0–100 per lajna/dvojice
  slozeni: { utoky: string[]; obrany: string[] } // otisk id pro detekci změn
  rozpocet: number // Kč
  /** Podíl ice timeu útočných lajn (0 = vypnuto, 0.5–2). */
  vytizeniUtoku?: [number, number, number, number]
}

export interface NastaveniHry {
  minihryZapnuto: boolean
}

export interface Udalost {
  minuta: number
  typ: 'gol' | 'strela' | 'zakrok' | 'vylouceni' | 'info' | 'zraneni' | 'timeout' | 'proslov'
  tymId: string
  text: string
  hracId?: string // střelec / vyloučený
  asistentId?: string
  sance?: number // 0–100 % u střel
}

export interface Vysledek {
  golyDomaci: number
  golyHoste: number
  strelyDomaci: number
  strelyHoste: number
  prodlouzeni: boolean
  najezdy: boolean
  udalosti: Udalost[]
  energie: Record<string, number> // závěrečná energie hráčů obou týmů
  hodnoceni: Record<string, number> // zápasové hodnocení hráčů obou týmů
}

export interface Zapas {
  kolo: number
  den: number // herní den sezóny, kdy se hraje
  domaci: string // klubId
  hoste: string
  vysledek: Vysledek | null
}

export interface Serie {
  domaci: string // výše nasazený (má výhodu ledu v zápasech 1, 2, 5)
  hoste: string
  vyhryDomaci: number
  vyhryHoste: number
}

export interface Playoff {
  kola: Serie[][] // [čtvrtfinále(4), semifinále(2), finále(1)]
  vitez: string | null
  poradi: string[] // top 8 podle tabulky základní části — pro přenasazování mezi koly
}

export interface Liga {
  uroven: number
  nazev: string
  tymy: string[] // klubIds
  zapasy: Zapas[]
  playoff: Playoff | null
}

export type Faze = 'zakladniCast' | 'playoff' | 'konecSezony'

export interface PosledniZapas {
  den: number
  domaci: string
  hoste: string
  vysledek: Vysledek
}

export interface KarieraTrenera {
  zapasy: number
  vyhry: number
  trofeje: string[]
  vyhazovy: number
  sezony: number
}

export interface Trener {
  duvera: number
  kariera: KarieraTrenera
}

export type TypCile = 'titul' | 'postup' | 'playoff' | 'stred' | 'zachrana'

export interface CilSezony {
  typ: TypCile
  popis: string
}

export interface ZaznamSezony {
  sezona: number
  klubId: string
  nazevLigy: string
  umisteni: number
  cil: TypCile
  splnen: boolean
  trofej: string | null
}

export interface VyhlaseniSezony {
  sezona: number
  mistri: { nazevLigy: string; klubId: string }[]
  kraloveStrelcu: { nazevLigy: string; jmeno: string; klubId: string; goly: number }[]
  hvezdaTymu: { jmeno: string; goly: number; asistence: number } | null
}

export interface Rekordy {
  nejvyssiVyhra: { text: string; rozdil: number } | null
  nejlepsiStrelec: { jmeno: string; goly: number } | null
}

export interface CekajiciZapas {
  domaci: string
  hoste: string
  derby: boolean
  playoff: { kolo: number; index: number } | null
}

export interface StadionNastaveni {
  cenaListku: number
  cenaJidla: number
  cenaMerch: number
}

export interface DomaciTrzby {
  navstevnost: number
  vstupne: number
  jidlo: number
  merch: number
  celkem: number
}

export interface PosledniDomaci {
  den: number
  navstevnost: number
  vstupne: number
  jidlo: number
  merch: number
}

export interface FinanceZaznam {
  den: number
  popis: string
  castka: number
}

export interface PosledniTrenink {
  den: number
  zamereni: TreninkTyp
  zlepseni: string[]
}

export interface GameState {
  seed: number
  sezona: number // 1, 2, 3…
  den: number // herní den od začátku sezóny, začíná 0
  faze: Faze
  mujKlubId: string
  tymy: Record<string, Tym>
  ligy: Liga[] // index = uroven
  zpravy: string[] // nejnovější první
  posledniZapas: PosledniZapas | null // poslední zápas mého klubu (pro obrazovku Zápas)
  trener: Trener
  cilSezony: CilSezony
  naladaFanousku: number
  historie: ZaznamSezony[]
  vyhlaseni: VyhlaseniSezony | null
  rekordy: Rekordy
  nabidky: string[] | null
  konecKariery: boolean
  cekajiciZapas: CekajiciZapas | null
  sponzor: Sponzor
  sponzorNabidka: boolean
  treninkZamereni: TreninkZamereni
  treninkovyTyden: Record<number, TreninkDen[]>
  treninkovyTydenOd: number
  nabidkyProdeje: NabidkaProdeje[]
  prichoziNabidka: PrichoziNabidka | null
  prichoziNabidky: PrichoziNabidka[]
  otazkaMedii: OtazkaMedii | null
  kabinovaUdalost: KabinovaUdalost | null
  posledniKabinovaDen: number
  oblibenyHracId: string | null
  marketing: MarketingSmlouva[]
  reklama: AktivniReklama[]
  navrhSestavy: string | null
  posledniOslovSponzory: number
  posledniUzaverka: number
  stadion: StadionNastaveni
  posledniDomaci: PosledniDomaci | null
  financeHistorie: FinanceZaznam[]
  posledniTrenink: PosledniTrenink | null
  nastaveni: NastaveniHry
}
