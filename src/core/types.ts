export type Pozice = 'G' | 'D' | 'U'

export interface Atributy {
  strelba: number
  prihravky: number
  brusleni: number
  obrana: number
  fyzicka: number
  chytani: number // relevantní jen pro brankáře, ostatní mají nízké
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
}

export interface Klub {
  id: string
  nazev: string
  liga: number // 0 = Extraliga, 1 = Chance liga, 2 = 2. liga
}

export interface Sestava {
  utoky: string[][] // 4 lajny × 3 id hráčů
  obrany: string[][] // 3 dvojice × 2 id hráčů
  brankar: string // id brankáře
}

export interface Tym {
  klubId: string
  nazev: string
  hraci: Hrac[]
  sestava: Sestava
  moralka: number // 30–70, výchozí 50
}

export interface Udalost {
  minuta: number
  typ: 'gol' | 'strela' | 'zakrok' | 'vylouceni' | 'info'
  tymId: string
  text: string
  hracId?: string // střelec / vyloučený
  asistentId?: string
}

export interface Vysledek {
  golyDomaci: number
  golyHoste: number
  strelyDomaci: number
  strelyHoste: number
  prodlouzeni: boolean
  najezdy: boolean
  udalosti: Udalost[]
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
}
