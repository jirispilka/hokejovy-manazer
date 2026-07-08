import type { Hrac, Pozice, Sestava, Tym } from './types'

const VAHY_UTOKU = [0.35, 0.28, 0.22, 0.15]
const VAHY_OBRAN = [0.4, 0.35, 0.25]
const chemieFaktor = (chemie: number) => 0.95 + chemie / 1000
/** OVR na ledě mimo přirozenou pozici (obránce v útoku atd.). */
const SPATNA_POZICE_FAKTOR = 0.72

export type RoleNaLede = 'utok' | 'obrana' | 'G'

export function overall(h: Hrac): number {
  return overallProRoli(h, h.pozice === 'G' ? 'G' : h.pozice === 'D' ? 'obrana' : 'utok')
}

export function overallProRoli(h: Hrac, role: RoleNaLede): number {
  const a = h.atributy
  const vazeny =
    role === 'G'
      ? a.chytani * 0.7 + a.brusleni * 0.15 + a.fyzicka * 0.15
      : role === 'obrana'
        ? a.obrana * 0.35 + a.brusleni * 0.2 + a.fyzicka * 0.2 + a.prihravky * 0.15 + a.strelba * 0.1
        : a.strelba * 0.3 + a.prihravky * 0.25 + a.brusleni * 0.25 + a.fyzicka * 0.1 + a.obrana * 0.1
  let ovr = Math.round(vazeny)
  if (role === 'utok' && h.pozice !== 'U') ovr = Math.round(ovr * SPATNA_POZICE_FAKTOR)
  if (role === 'obrana' && h.pozice !== 'D') ovr = Math.round(ovr * SPATNA_POZICE_FAKTOR)
  if (role === 'G' && h.pozice !== 'G') ovr = Math.round(ovr * 0.35)
  return ovr
}

export function jeNaSpravnePozici(h: Hrac, role: RoleNaLede): boolean {
  if (role === 'G') return h.pozice === 'G'
  if (role === 'utok') return h.pozice === 'U'
  return h.pozice === 'D'
}

export const jeZdravy = (h: Hrac): boolean => h.zranenZapasu === 0

export function otiskLajn(s: Sestava): { utoky: string[]; obrany: string[] } {
  const otisk = (l: string[]) => [...l].sort().join('+')
  return { utoky: s.utoky.map(otisk), obrany: s.obrany.map(otisk) }
}

export function vychoziSestava(hraci: Hrac[]): Sestava {
  const podleOverall = (poz: Pozice) => {
    const vsichni = hraci.filter((h) => h.pozice === poz).sort((x, y) => overall(y) - overall(x))
    // zdraví mají přednost; zranění doplní konec fronty, aby sestava byla vždy plná
    return [...vsichni.filter(jeZdravy), ...vsichni.filter((h) => !jeZdravy(h))]
  }
  const utocnici = podleOverall('U')
  const obranci = podleOverall('D')
  const brankari = podleOverall('G')
  return {
    utoky: [0, 1, 2, 3].map((i) => utocnici.slice(i * 3, i * 3 + 3).map((h) => h.id)),
    obrany: [0, 1, 2].map((i) => obranci.slice(i * 2, i * 2 + 2).map((h) => h.id)),
    brankar: brankari[0].id,
  }
}

// efektivní síla hráče: OVR pro roli na ledě, forma (±20 %) a únava (až −30 %)
function efektivniProRoli(h: Hrac, role: RoleNaLede): number {
  return overallProRoli(h, role) * (1 + (h.forma - 50) / 100) * (1 - (h.unava / 100) * 0.3)
}

function efektivni(h: Hrac): number {
  return efektivniProRoli(h, h.pozice === 'G' ? 'G' : h.pozice === 'D' ? 'obrana' : 'utok')
}

export function silaTymu(
  t: Tym,
  vahyUtoku: readonly number[] = VAHY_UTOKU,
  vahyObran: readonly number[] = VAHY_OBRAN,
): { utok: number; obrana: number; brankar: number } {
  const podleId = new Map(t.hraci.map((h) => [h.id, h]))
  const prumerLajny = (l: string[], role: 'utok' | 'obrana') => {
    if (l.length === 0) return 0
    return l.reduce((s, id) => s + efektivniProRoli(podleId.get(id)!, role), 0) / l.length
  }
  const utok = t.sestava.utoky.reduce(
    (s, l, i) => s + prumerLajny(l, 'utok') * (vahyUtoku[i] ?? 0) * chemieFaktor(t.chemie.utoky[i]),
    0,
  )
  const obrana = t.sestava.obrany.reduce(
    (s, l, i) => s + prumerLajny(l, 'obrana') * (vahyObran[i] ?? 0) * chemieFaktor(t.chemie.obrany[i]),
    0,
  )
  const brankar = efektivniProRoli(podleId.get(t.sestava.brankar)!, 'G')
  return { utok, obrana, brankar }
}

/** Celková síla sestavy (váhy lajn + chemie + forma/únava). */
export function silaCelkem(tym: Tym): number {
  const s = silaTymu(tym)
  return s.utok + s.obrana + s.brankar
}

export interface SouhrnSestavy {
  prumerOvr: number
  prumerEfektivni: number
  silaUtok: number
  silaObrana: number
  silaBrankar: number
  silaCelkem: number
}

export function souhrnSestavy(tym: Tym): SouhrnSestavy {
  const ids = [...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat(), tym.sestava.brankar]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const ovrNaLede = (id: string) => {
    const lajna = lajnaHrace(tym.sestava, id)
    if (!lajna) return overall(podleId.get(id)!)
    return overallProRoli(podleId.get(id)!, lajna.typ)
  }
  const prumerOvr = Math.round(ids.reduce((s, id) => s + ovrNaLede(id), 0) / ids.length)
  const prumerEfektivni = Math.round(ids.reduce((s, id) => {
    const lajna = lajnaHrace(tym.sestava, id)
    const role: RoleNaLede = lajna?.typ ?? (podleId.get(id)!.pozice === 'G' ? 'G' : podleId.get(id)!.pozice === 'D' ? 'obrana' : 'utok')
    return s + efektivniProRoli(podleId.get(id)!, role)
  }, 0) / ids.length)
  const sila = silaTymu(tym)
  return {
    prumerOvr,
    prumerEfektivni,
    silaUtok: Math.round(sila.utok * 10) / 10,
    silaObrana: Math.round(sila.obrana * 10) / 10,
    silaBrankar: Math.round(sila.brankar * 10) / 10,
    silaCelkem: Math.round(silaCelkem(tym) * 10) / 10,
  }
}

export function vymenVSestave(s: Sestava, idA: string, idB: string): Sestava {
  const nahrad = (id: string) => (id === idA ? idB : id === idB ? idA : id)
  return {
    utoky: s.utoky.map((l) => l.map(nahrad)),
    obrany: s.obrany.map((l) => l.map(nahrad)),
    brankar: nahrad(s.brankar),
  }
}

export function jeVSestave(s: Sestava, id: string): boolean {
  return [...s.utoky.flat(), ...s.obrany.flat(), s.brankar].includes(id)
}

export function odeberZeSestavy(s: Sestava, id: string): Sestava {
  return {
    utoky: s.utoky.map((l) => l.filter((x) => x !== id)),
    obrany: s.obrany.map((l) => l.filter((x) => x !== id)),
    brankar: s.brankar,
  }
}

/** Dosadí hráče z lavičky do lajny s volným místem (po prodeji / zranění). */
export function dosadDoLajny(
  s: Sestava,
  hracId: string,
  typ: 'utok' | 'obrana',
  lajna: number,
): Sestava {
  const max = typ === 'utok' ? 3 : 2
  const radky = typ === 'utok' ? s.utoky : s.obrany
  if (lajna < 0 || lajna >= radky.length) throw new Error('Neplatná lajna.')
  if (radky[lajna].length >= max) throw new Error('Lajna je plná — vyber hráče k výměně.')
  if (radky[lajna].includes(hracId)) throw new Error('Hráč už je v této lajně.')
  const bez = odeberZeSestavy(s, hracId)
  const utoky = bez.utoky.map((l) => [...l])
  const obrany = bez.obrany.map((l) => [...l])
  if (typ === 'utok') utoky[lajna].push(hracId)
  else obrany[lajna].push(hracId)
  return { ...bez, utoky, obrany }
}

/** Výměna dvou hráčů nebo dosazení z lavičky do volného slotu. */
export function presunHraceVSestave(
  s: Sestava,
  hracId: string,
  cil: { hracId: string } | { typ: 'utok' | 'obrana'; lajna: number },
): Sestava {
  if ('hracId' in cil) {
    if (cil.hracId === hracId) return s
    return vymenVSestave(s, hracId, cil.hracId)
  }
  return dosadDoLajny(s, hracId, cil.typ, cil.lajna)
}

export function volneMistaUtoku(lajna: string[]): number {
  return Math.max(0, 3 - lajna.length)
}

export function volneMistaObrany(dvojice: string[]): number {
  return Math.max(0, 2 - dvojice.length)
}

export function chemiePoZmeneLajny(staraLajna: string[], novaLajna: string[], staraChemie: number): number {
  if (staraLajna.length === 0) return 30
  const vel = staraLajna.length
  const set = new Set(staraLajna)
  const zachovano = novaLajna.filter((id) => set.has(id)).length / vel
  return Math.round(staraChemie * zachovano + 30 * (1 - zachovano))
}

function novaChemieLajny(staraLajna: string[], novaLajna: string[], staraChemie: number): number {
  return chemiePoZmeneLajny(staraLajna, novaLajna, staraChemie)
}

export function chemieZaPoziceNaLede(
  lajna: string[],
  hraci: Map<string, Hrac>,
  role: 'utok' | 'obrana',
  chemie: number,
): number {
  const spatne = lajna.filter((id) => !jeNaSpravnePozici(hraci.get(id)!, role)).length
  if (spatne === 0) return chemie
  return Math.max(15, chemie - spatne * 18)
}

/** Po zápase: lajny s dostatečným ice time (nízká energie) získají +6 chemie. */
export function aplikujSehravaniChemie(tym: Tym, energie: Record<string, number>): void {
  const utokHral = (l: string[]) => l.filter((id) => (energie[id] ?? 100) < 90).length >= 2
  const obranaHrala = (l: string[]) => l.filter((id) => (energie[id] ?? 100) < 90).length >= 1
  tym.chemie.utoky = tym.chemie.utoky.map((c, i) =>
    utokHral(tym.sestava.utoky[i]) ? Math.min(100, c + 6) : c,
  )
  tym.chemie.obrany = tym.chemie.obrany.map((c, i) =>
    obranaHrala(tym.sestava.obrany[i]) ? Math.min(100, c + 6) : c,
  )
}

export function zmenSestavuKlubu(tym: Tym, novaSestava: Sestava): Tym {
  const novy = structuredClone(tym)
  const novyOtisk = otiskLajn(novaSestava)
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  novy.sestava = structuredClone(novaSestava)
  novy.chemie = {
    utoky: novyOtisk.utoky.map((o, i) => {
      const c =
        o === tym.slozeni.utoky[i]
          ? tym.chemie.utoky[i]
          : novaChemieLajny(tym.sestava.utoky[i], novaSestava.utoky[i], tym.chemie.utoky[i])
      return chemieZaPoziceNaLede(novaSestava.utoky[i], podleId, 'utok', c)
    }),
    obrany: novyOtisk.obrany.map((o, i) => {
      const c =
        o === tym.slozeni.obrany[i]
          ? tym.chemie.obrany[i]
          : novaChemieLajny(tym.sestava.obrany[i], novaSestava.obrany[i], tym.chemie.obrany[i])
      return chemieZaPoziceNaLede(novaSestava.obrany[i], podleId, 'obrana', c)
    }),
  }
  novy.slozeni = novyOtisk
  return novy
}

export function predikceChemie(tym: Tym, novaSestava: Sestava): { utoky: number[]; obrany: number[] } {
  const novy = zmenSestavuKlubu(tym, novaSestava)
  return novy.chemie
}

export function navrhPoZapase(tym: Tym, hodnoceni: Record<string, number>): string | null {
  let bestId = ''
  let best = 0
  for (const [id, h] of Object.entries(hodnoceni)) {
    if (h > best && tym.hraci.some((x) => x.id === id)) {
      best = h
      bestId = id
    }
  }
  if (!bestId || best < 7) return null
  const h = tym.hraci.find((x) => x.id === bestId)!
  for (let i = 0; i < tym.sestava.utoky.length; i++) {
    if (tym.sestava.utoky[i].includes(bestId)) {
      const partner = tym.sestava.utoky[i].find((id) => id !== bestId)!
      const p = tym.hraci.find((x) => x.id === partner)!
      return `${h.prijmeni} a ${p.prijmeni} hráli skvěle na ${i + 1}. útoku — nech je spolu.`
    }
  }
  return `${h.prijmeni} měl skvělý zápas (${best.toFixed(1)}) — zvaž víc ice time.`
}

export function popisChemie(chemie: number): { text: string; bonus: string } {
  const bonus = `${((0.95 + chemie / 1000) * 100 - 100).toFixed(1)} %`
  if (chemie < 40) return { text: 'Nová lajna — sehrávej zápasy', bonus }
  if (chemie < 70) return { text: 'Sehrává se — pokračuj', bonus }
  return { text: 'Výborná souhra', bonus }
}

export function celkovaChemie(t: Tym): number {
  const u = t.chemie.utoky.reduce((s, c, i) => s + c * VAHY_UTOKU[i], 0)
  const o = t.chemie.obrany.reduce((s, c, i) => s + c * VAHY_OBRAN[i], 0)
  return Math.round(u * 0.6 + o * 0.4)
}

/** Efektivní síla hráče pro sestavení (forma, únava). */
export function efektivniHrace(h: Hrac): number {
  return efektivni(h)
}

export interface MoznyCilVymeny {
  hracId: string
  popisMista: string
  skore: number
  chemiePred: number
  chemiePo: number
  text: string
}

export interface NavrhUmisteni {
  hlavni: string
  typ: 'doporuceno' | 'neni_lepsi' | 'uz_optimalni' | 'chyba_pozice'
  doporucenyId: string | null
  cile: MoznyCilVymeny[]
}

function idsVSestave(s: Sestava): Set<string> {
  return new Set([...s.utoky.flat(), ...s.obrany.flat(), s.brankar])
}

export function popisMistaVSestave(tym: Tym, hracId: string): string {
  const { sestava } = tym
  for (let i = 0; i < sestava.utoky.length; i++) {
    if (sestava.utoky[i].includes(hracId)) return `${i + 1}. útok`
  }
  for (let i = 0; i < sestava.obrany.length; i++) {
    if (sestava.obrany[i].includes(hracId)) return `${i + 1}. obrana`
  }
  if (sestava.brankar === hracId) return 'brankář'
  return 'střídačka'
}

/** Pořadí hráče mezi zdravými na stejné pozici (0 = nejlepší). */
export function rankNaPozici(tym: Tym, hracId: string): number {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const hrac = podleId.get(hracId)
  if (!hrac) return 99
  const vsichni = tym.hraci
    .filter((h) => h.pozice === hrac.pozice && jeZdravy(h))
    .sort((a, b) => efektivniHrace(b) - efektivniHrace(a))
  const rank = vsichni.findIndex((h) => h.id === hracId)
  return rank >= 0 ? rank : vsichni.length
}

/** Ideální index lajny podle síly v soupisce (0 = 1. lajna). */
export function idealniLajna(tym: Tym, hracId: string): number {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const hrac = podleId.get(hracId)
  if (!hrac) return 0
  const rank = rankNaPozici(tym, hracId)
  if (hrac.pozice === 'U') return Math.min(3, Math.floor(rank / 3))
  if (hrac.pozice === 'D') return Math.min(2, Math.floor(rank / 2))
  return 0
}

export function popisRoleLajny(pozice: 'U' | 'D', index: number): string {
  if (pozice === 'U') {
    if (index === 0) return 'Hvězdná lajna'
    if (index === 3) return 'Udržba · méně ice time'
    return 'Rozložená síla'
  }
  if (index === 0) return '1. dvojice'
  if (index === 2) return 'Udržba obrany'
  return '2. dvojice'
}

export function ovrLajny(tym: Tym): { utoky: number[]; obrany: number[] } {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const prumer = (ids: string[], role: 'utok' | 'obrana') =>
    Math.round(ids.reduce((s, id) => s + overallProRoli(podleId.get(id)!, role), 0) / ids.length)
  return {
    utoky: tym.sestava.utoky.map((l) => prumer(l, 'utok')),
    obrany: tym.sestava.obrany.map((l) => prumer(l, 'obrana')),
  }
}

export function analyzaRozestaveni(tym: Tym): string[] {
  const tips: string[] = []
  const ovr = ovrLajny(tym)
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  for (let i = 0; i < 3; i++) {
    if (ovr.utoky[i] < ovr.utoky[i + 1]) {
      tips.push(`${i + 1}. útok (OVR ${ovr.utoky[i]}) je slabší než ${i + 2}. (${ovr.utoky[i + 1]}) — posuň hvězdy nahoru.`)
    }
  }
  for (let i = 0; i < 2; i++) {
    if (ovr.obrany[i] < ovr.obrany[i + 1]) {
      tips.push(`${i + 1}. obrana je slabší než ${i + 2}. — seřaď dvojice podle síly.`)
    }
  }
  for (const id of tym.sestava.utoky.flat()) {
    const h = podleId.get(id)!
    if (!jeNaSpravnePozici(h, 'utok')) {
      tips.push(`${h.prijmeni} hraje v útoku mimo pozici — OVR ${overallProRoli(h, 'utok')} místo ${overall(h)}.`)
    }
    const lajna = lajnaHrace(tym.sestava, id)
    if (!lajna || lajna.typ !== 'utok') continue
    const ideal = idealniLajna(tym, id)
    if (lajna.index > ideal + 1) {
      tips.push(`${h.prijmeni} (${overall(h)} OVR) patří spíš na ${ideal + 1}. útok, ne na ${lajna.index + 1}.`)
    }
  }
  for (const id of tym.sestava.obrany.flat()) {
    const h = podleId.get(id)!
    if (!jeNaSpravnePozici(h, 'obrana')) {
      tips.push(`${h.prijmeni} hraje v obraně mimo pozici — OVR ${overallProRoli(h, 'obrana')} místo ${overall(h)}.`)
    }
  }
  if (tips.length === 0) {
    tips.push('Rozestavení sedí — 1. lajna nejsilnější, 4. útok na udržbu.')
  }
  return tips.slice(0, 3)
}

function lajnaHrace(sestava: Sestava, hracId: string): { typ: 'utok' | 'obrana'; index: number } | null {
  for (let i = 0; i < sestava.utoky.length; i++) {
    if (sestava.utoky[i].includes(hracId)) return { typ: 'utok', index: i }
  }
  for (let i = 0; i < sestava.obrany.length; i++) {
    if (sestava.obrany[i].includes(hracId)) return { typ: 'obrana', index: i }
  }
  return null
}

export function jeHracMimoPozici(tym: Tym, hracId: string): boolean {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const lajna = lajnaHrace(tym.sestava, hracId)
  if (!lajna) return false
  return !jeNaSpravnePozici(podleId.get(hracId)!, lajna.typ)
}

function chemieLajnySHracem(tym: Tym, hracId: string): { typ: 'utok' | 'obrana'; index: number } | null {
  return lajnaHrace(tym.sestava, hracId)
}

function chemieHodnotaLajny(tym: Tym, lajna: { typ: 'utok' | 'obrana'; index: number }): number {
  return lajna.typ === 'utok' ? tym.chemie.utoky[lajna.index] : tym.chemie.obrany[lajna.index]
}

function bonusUmisteniNaLajnu(tym: Tym, hracId: string, novaSestava: Sestava): number {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const hrac = podleId.get(hracId)!
  const ideal = idealniLajna(tym, hracId)
  const tymPo = { ...tym, sestava: novaSestava }
  const lajna = chemieLajnySHracem(tymPo, hracId)
  if (!lajna) return 0
  const actual = lajna.index
  const diff = actual - ideal // kladné = moc nízko (hvězda na 4. lajně)
  if (diff <= 0) return -diff * 1.5 // bonus za posun nahoru
  return -diff * 4 * (efektivniHrace(hrac) / 60) // pokuta za hvězdu dole
}

function hodnotVymeny(tym: Tym, idA: string, idB: string): MoznyCilVymeny {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const a = podleId.get(idA)!
  const novaSestava = vymenVSestave(tym.sestava, idA, idB)
  const po = zmenSestavuKlubu(tym, novaSestava)
  const silaPred = silaCelkem(tym)
  const silaPo = silaCelkem(po)
  const silaDelta = Math.round((silaPo - silaPred) * 10) / 10
  const umisteni = bonusUmisteniNaLajnu(tym, idA, novaSestava)
  const skore = Math.round((silaDelta + umisteni) * 10) / 10
  const lajnaB = chemieLajnySHracem(tym, idB)
  const chemiePred = lajnaB ? chemieHodnotaLajny(tym, lajnaB) : 0
  const chemiePo = lajnaB ? chemieHodnotaLajny(po, lajnaB) : 0
  const chemieDelta = chemiePo - chemiePred
  const misto = popisMistaVSestave(tym, idB)
  const idxPo = lajnaB?.index ?? 0
  const ideal = idealniLajna(tym, idA)
  let text = `${overall(a)} OVR → ${misto}`
  if (idxPo !== ideal) text += ` (ideálně ${ideal + 1}. lajna)`
  if (chemieDelta !== 0) text += `, chemie ${chemieDelta >= 0 ? '+' : ''}${chemieDelta}`
  return {
    hracId: idB,
    popisMista: misto,
    skore,
    chemiePred,
    chemiePo,
    text,
  }
}

export function mozneCileVymeny(tym: Tym, hracId: string): MoznyCilVymeny[] {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const hrac = podleId.get(hracId)
  if (!hrac || !jeZdravy(hrac)) return []
  const vSestave = idsVSestave(tym.sestava)
  const cile = tym.hraci
    .filter((h) => h.id !== hracId && h.pozice === hrac.pozice && jeZdravy(h))
    .map((h) => h.id)
  return cile
    .map((cilId) => hodnotVymeny(tym, hracId, cilId))
    .sort((x, y) => y.skore - x.skore)
}

export function navrhUmisteni(tym: Tym, hracId: string): NavrhUmisteni {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const hrac = podleId.get(hracId)
  if (!hrac) return { hlavni: 'Hráč nenalezen.', typ: 'neni_lepsi', doporucenyId: null, cile: [] }
  if (!jeZdravy(hrac)) {
    return { hlavni: `${hrac.prijmeni} je zraněný — do sestavy ho teď nedáš.`, typ: 'neni_lepsi', doporucenyId: null, cile: [] }
  }
  const cile = mozneCileVymeny(tym, hracId)
  const vSestave = idsVSestave(tym.sestava)
  const naBench = !vSestave.has(hracId)
  const best = cile[0]

  if (!best) {
    const poz = hrac.pozice === 'G' ? 'brankáře' : hrac.pozice === 'D' ? 'obránce' : 'útočníka'
    return {
      hlavni: `Pro ${poz} ${hrac.prijmeni} nemáš v sestavě žádné místo k výměně.`,
      typ: 'neni_lepsi',
      doporucenyId: null,
      cile: [],
    }
  }

  if (best.skore <= 0) {
    const kde = popisMistaVSestave(tym, hracId)
    const ideal = idealniLajna(tym, hracId)
    const lajna = chemieLajnySHracem(tym, hracId)
    const spatne = lajna && lajna.index > ideal
    return {
      hlavni: naBench
        ? `${hrac.prijmeni} patří spíš na ${ideal + 1}. lajnu — na střídačce je OK jen jako ${ideal >= 2 ? '4.' : '2.'} volba.`
        : spatne
          ? `${hrac.prijmeni} je na ${kde}, ale podle síly patří na ${ideal + 1}. lajnu — zkus vyměnit s někým výš.`
          : `${hrac.prijmeni} už hraje na správném místě (${kde}).`,
      typ: naBench ? 'neni_lepsi' : spatne ? 'neni_lepsi' : 'uz_optimalni',
      doporucenyId: null,
      cile,
    }
  }

  const cil = podleId.get(best.hracId)!
  const ideal = idealniLajna(tym, hracId)
  return {
    hlavni: `💡 Dej ${hrac.prijmeni} na ${best.popisMista} místo ${cil.prijmeni} (cíl: ${ideal + 1}. lajna) — síla +${best.skore.toFixed(1)} (${best.text}).`,
    typ: 'doporuceno',
    doporucenyId: best.hracId,
    cile,
  }
}

export function zpravaSpatnePozice(a: Hrac, b: Hrac): string {
  if (a.pozice === 'G' || b.pozice === 'G') return 'Brankáře vyměň jen za jiného brankáře.'
  const nazev = (p: Pozice) => (p === 'D' ? 'obránce' : 'útočníka')
  return `${b.prijmeni} je ${nazev(b.pozice)} — můžeš ho dosadit kam chceš, ale klesne mu OVR i chemie lajny.`
}
