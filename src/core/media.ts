import { formaTymu } from './hodnoty'
import type { Rng } from './rng'
import type { CekajiciZapas, GameState, OtazkaMedii, Vysledek } from './types'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

const DERBY_VYHRA = (souper: string): OtazkaMedii => ({
  text: `Novináři: „Vyhráli jste derby s ${souper}! Co vzkážete jejich fanouškům?"`,
  moznosti: [
    { text: 'Byl to férový boj, klobouk dolů.', efektMoralka: 2, efektNalada: 2, riskantni: false },
    { text: 'Ať si zvykají — tohle město je naše!', efektMoralka: 3, efektNalada: 6, riskantni: true },
  ],
})

const DERBY_PROHRA = (souper: string): OtazkaMedii => ({
  text: `Novináři: „Prohrané derby s ${souper}. Jak to vysvětlíte fanouškům?"`,
  moznosti: [
    { text: 'Omlouváme se, příště to vrátíme.', efektMoralka: 1, efektNalada: 2, riskantni: false },
    { text: 'Rozhodčí nám to dnes nedovolili vyhrát.', efektMoralka: 3, efektNalada: 3, riskantni: true },
  ],
})

const DEMOLICE = (souper: string): OtazkaMedii => ({
  text: `Novináři: „Rozstříleli jste ${souper}. Je tým zralý na vyšší cíle?"`,
  moznosti: [
    { text: 'Jdeme zápas od zápasu.', efektMoralka: 2, efektNalada: 1, riskantni: false },
    { text: 'Ano — a klidně to napište tučně!', efektMoralka: 4, efektNalada: 5, riskantni: true },
  ],
})

const DEBAKL = (souper: string): OtazkaMedii => ({
  text: `Novináři: „Debakl od ${souper}. Kdo za to může?"`,
  moznosti: [
    { text: 'Odpovědnost beru na sebe.', efektMoralka: 3, efektNalada: 1, riskantni: false },
    { text: 'Hráči dnes nechali dres v kabině.', efektMoralka: -2, efektNalada: 3, riskantni: true },
    { text: 'Bez komentáře.', efektMoralka: 0, efektNalada: -2, riskantni: false },
  ],
})

const SERIE = (): OtazkaMedii => ({
  text: 'Novináři: „Pět výher v řadě! Kde to zastavíte?"',
  moznosti: [
    { text: 'Nohama na zemi, pracujeme dál.', efektMoralka: 2, efektNalada: 2, riskantni: false },
    { text: 'Nezastavíme. Jedeme si pro pohár!', efektMoralka: 4, efektNalada: 6, riskantni: true },
  ],
})

// mutuje klon — volá dokonciZapas po mém zápase
export function zkontrolujOtazku(s: GameState, v: Vysledek, cz: CekajiciZapas): void {
  const mujDomaci = cz.domaci === s.mujKlubId
  const rozdil = mujDomaci ? v.golyDomaci - v.golyHoste : v.golyHoste - v.golyDomaci
  const souper = s.tymy[mujDomaci ? cz.hoste : cz.domaci].nazev
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  const forma = formaTymu(liga, s.mujKlubId)
  const serieVyher = forma.length === 5 && forma.every((z) => z === 'V' || z === 'VP')

  let otazka: OtazkaMedii | null = null
  if (cz.derby) otazka = rozdil > 0 ? DERBY_VYHRA(souper) : DERBY_PROHRA(souper)
  else if (rozdil >= 4) otazka = DEMOLICE(souper)
  else if (rozdil <= -4) otazka = DEBAKL(souper)
  else if (serieVyher && rozdil > 0) otazka = SERIE()
  s.otazkaMedii = otazka // null = stará nezodpovězená otázka zaniká
}

export function odpovezNaOtazku(state: GameState, index: number, rng: Rng): GameState {
  if (!state.otazkaMedii) throw new Error('Žádná otázka novinářů nečeká.')
  const volba = state.otazkaMedii.moznosti[index]
  if (!volba) throw new Error('Neplatná odpověď.')
  const s = structuredClone(state)
  let { efektMoralka, efektNalada } = volba
  let text = '🗞️ Odpověď v médiích zarezonovala.'
  if (volba.riskantni && rng() < 0.4) {
    efektMoralka = -Math.abs(efektMoralka)
    efektNalada = -Math.abs(efektNalada)
    text = '🗞️ Novináři odpověď otočili proti tobě!'
  }
  const muj = s.tymy[s.mujKlubId]
  muj.moralka = clamp(muj.moralka + efektMoralka, 30, 70)
  s.naladaFanousku = clamp(s.naladaFanousku + efektNalada, 0, 100)
  s.zpravy.unshift(text)
  s.zpravy = s.zpravy.slice(0, 50)
  s.otazkaMedii = null
  return s
}
