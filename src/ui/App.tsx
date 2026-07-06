import { useState } from 'react'
import type { GameState } from '../core/types'
import { LigaObrazovka } from './obrazovky/Liga'
import { NovaHra } from './obrazovky/NovaHra'
import { Prehled } from './obrazovky/Prehled'
import { SestavaObrazovka } from './obrazovky/Sestava'
import { Soupiska } from './obrazovky/Soupiska'
import { Ulozeni } from './obrazovky/Ulozeni'
import { Zapas } from './obrazovky/Zapas'

export type Obrazovka = 'prehled' | 'soupiska' | 'sestava' | 'zapas' | 'liga' | 'ulozeni'

const ZALOZKY: [Obrazovka, string][] = [
  ['prehled', 'Přehled'],
  ['soupiska', 'Soupiska'],
  ['sestava', 'Sestava'],
  ['zapas', 'Poslední zápas'],
  ['liga', 'Soutěže'],
  ['ulozeni', 'Uložení'],
]

export default function App() {
  const [hra, setHra] = useState<GameState | null>(null)
  const [obrazovka, setObrazovka] = useState<Obrazovka>('prehled')

  if (!hra) {
    return (
      <NovaHra
        onStart={(s) => {
          setHra(s)
          setObrazovka('prehled')
        }}
      />
    )
  }

  const obsah = {
    prehled: <Prehled hra={hra} setHra={setHra} setObrazovka={setObrazovka} />,
    soupiska: <Soupiska hra={hra} />,
    sestava: <SestavaObrazovka hra={hra} setHra={setHra} />,
    zapas: <Zapas hra={hra} />,
    liga: <LigaObrazovka hra={hra} />,
    ulozeni: <Ulozeni hra={hra} setHra={setHra} />,
  }[obrazovka]

  return (
    <>
      <nav>
        <h1>🏒 Hokejový manažer</h1>
        {ZALOZKY.map(([id, popisek]) => (
          <button key={id} className={obrazovka === id ? 'aktivni' : ''} onClick={() => setObrazovka(id)}>
            {popisek}
          </button>
        ))}
      </nav>
      <main>{obsah}</main>
    </>
  )
}
