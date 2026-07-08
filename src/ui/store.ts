import type { GameState } from '../core/types'
import { deserializuj, popisUlozeni, serializuj } from '../core/ulozeni'

export interface InfoSlotu {
  slot: number
  ulozeno: string
  sezona: number
  den: number
  klub: string
}

const SLOTY = [0, 1, 2, 3] // 0 = autosave
const jeTauri = '__TAURI_INTERNALS__' in window
const cesta = (slot: number) => `sloty/slot-${slot}.json`

async function zapis(slot: number, obsah: string): Promise<void> {
  if (jeTauri) {
    const { BaseDirectory, exists, mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs')
    if (!(await exists('sloty', { baseDir: BaseDirectory.AppData }))) {
      await mkdir('sloty', { baseDir: BaseDirectory.AppData, recursive: true })
    }
    await writeTextFile(cesta(slot), obsah, { baseDir: BaseDirectory.AppData })
  } else {
    localStorage.setItem(`hokej-slot-${slot}`, obsah)
  }
}

async function precti(slot: number): Promise<string | null> {
  if (jeTauri) {
    const { BaseDirectory, exists, readTextFile } = await import('@tauri-apps/plugin-fs')
    if (!(await exists(cesta(slot), { baseDir: BaseDirectory.AppData }))) return null
    return readTextFile(cesta(slot), { baseDir: BaseDirectory.AppData })
  }
  return localStorage.getItem(`hokej-slot-${slot}`)
}

export async function ulozHru(slot: number, stav: GameState): Promise<boolean> {
  try {
    await zapis(slot, serializuj(stav, new Date().toISOString()))
    return true
  } catch (e) {
    console.error('Uložení selhalo:', e)
    return false
  }
}

export async function nactiHru(slot: number): Promise<GameState | null> {
  const json = await precti(slot)
  return json ? deserializuj(json) : null
}

export async function seznamSlotu(): Promise<InfoSlotu[]> {
  const vysledek: InfoSlotu[] = []
  for (const slot of SLOTY) {
    try {
      const json = await precti(slot)
      if (json) vysledek.push({ slot, ...popisUlozeni(json) })
    } catch {
      // poškozený/nekompatibilní slot nesmí schovat ty zdravé
      console.warn(`Slot ${slot}: poškozené nebo nekompatibilní uložení — přeskočeno.`)
    }
  }
  return vysledek
}
