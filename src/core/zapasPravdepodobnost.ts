/** Pravděpodobnostní model zápasu — čisté funkce pro testování. */

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Podíl náhody v emergentním výsledku (kalibrační konstanta). */
export const PODIL_NAHODY = 0.22

/** Koeficient šance gólu ze střely (kalibrováno Monte Carlo). */
export const ALFA_GOL = 0.19

export const PGOL_MIN = 0.03
export const PGOL_MAX = 0.75

export const PRAG_KLICOVA_SANCE = 0.35

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/** Šance že v minutě vůbec proběhne útok (domácí vs hosté síla). */
export function pUtokVMinute(utokUtocnika: number, utokObrance: number, obranaObrance: number): number {
  const pUtocnik = utokUtocnika / (utokUtocnika + obranaObrance)
  return clamp(0.55 + 0.35 * pUtocnik, 0.35, 0.9)
}

/** Nebezpečná šance po vytvoření útoku. */
export function pNebezpecnaSance(
  utok: number,
  obrana: number,
  momentumBonus = 0,
  modifikator = 1,
): number {
  const rozdil = utok - obrana
  return clamp(sigmoid(0.065 * rozdil + momentumBonus) * modifikator, 0.2, 0.88)
}

/** Šance gólu ze střely. */
export function pGolZeStrelby(
  strelba: number,
  brankarSila: number,
  chemieFaktor = 1,
  energieFaktor = 1,
  bonus = 0,
): number {
  const zaklad = ALFA_GOL * (strelba / Math.max(brankarSila, 1)) * chemieFaktor * energieFaktor
  return clamp(zaklad + bonus, PGOL_MIN, PGOL_MAX)
}

export function jeKlicovyMoment(pGol: number, limit = PRAG_KLICOVA_SANCE): boolean {
  return pGol >= limit
}

/** Počet „dobrých“ segmentů kostky (0–6) pro UI. */
export function segmentyKostky(pGol: number, bonusZeton = false): number {
  const zaklad = Math.round(clamp(pGol * 6, 1, 5))
  return clamp(zaklad + (bonusZeton ? 1 : 0), 1, 6)
}

export function tretinaZMinuty(minuta: number): 1 | 2 | 3 {
  if (minuta <= 20) return 1
  if (minuta <= 40) return 2
  return 3
}

/** Bonus k pGol z minihry (kvalita 0–1, ideál = 0.5). */
export function bonusMinihryZKvality(kvalita: number): number {
  const dist = Math.abs(clamp(kvalita, 0, 1) - 0.5) * 2
  if (dist <= 0.2) return 0.08
  if (dist <= 0.5) return 0.04
  if (dist <= 0.75) return -0.04
  return -0.08
}

export function aplikujBonusMinihry(pGol: number, bonus: number): number {
  return clamp(pGol + bonus, PGOL_MIN, PGOL_MAX)
}

export interface PredikceUtoku {
  pUtok: number
  pNebezpeci: number
  pGolPrumer: number
}

/** Predikce šancí pro panel síly (typický útočník vs brankář). */
export function predikceUtoku(
  utokUtocnika: number,
  utokObrance: number,
  obranaObrance: number,
  brankarObrance: number,
  prumerStrelba: number,
  momentum = 0,
  presila = 1,
): PredikceUtoku {
  const momentumBonus = (momentum / 100) * 2
  const pUtok = clamp(pUtokVMinute(utokUtocnika, utokObrance, obranaObrance) * presila * (1 + momentumBonus * 0.12), 0.35, 0.95)
  const pNebezpeci = pNebezpecnaSance(utokUtocnika, obranaObrance, momentumBonus)
  const pGolPrumer = pGolZeStrelby(prumerStrelba, brankarObrance)
  return { pUtok, pNebezpeci, pGolPrumer }
}

/** Makro šance výhry ze sigmoidu (referenční křivka pro kalibraci). */
export function pWinZeSigmoidu(deltaOvr: number, k = 0.11): number {
  return sigmoid(k * deltaOvr)
}
