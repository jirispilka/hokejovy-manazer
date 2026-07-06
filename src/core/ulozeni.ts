import type { GameState } from './types'

const VERZE = 1

interface UlozenaHra {
  verze: number
  ulozeno: string
  stav: GameState
}

export function serializuj(stav: GameState, ulozeno: string): string {
  const data: UlozenaHra = { verze: VERZE, ulozeno, stav }
  return JSON.stringify(data)
}

function parsuj(json: string): UlozenaHra {
  const data = JSON.parse(json) as UlozenaHra
  if (data.verze !== VERZE || !data.stav?.tymy || !data.stav?.ligy) {
    throw new Error('Nepodporovaný nebo poškozený soubor uložení.')
  }
  return data
}

export function deserializuj(json: string): GameState {
  return parsuj(json).stav
}

export function popisUlozeni(json: string): { ulozeno: string; sezona: number; den: number; klub: string } {
  const { ulozeno, stav } = parsuj(json)
  return { ulozeno, sezona: stav.sezona, den: stav.den, klub: stav.tymy[stav.mujKlubId].nazev }
}
