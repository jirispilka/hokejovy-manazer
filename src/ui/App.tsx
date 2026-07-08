import { useState } from 'react'
import type { GameState } from '../core/types'
import { OdznakKlubu } from './komponenty'
import { Finance } from './obrazovky/Finance'
import { Klub } from './obrazovky/Klub'
import { LigaObrazovka } from './obrazovky/Liga'
import { NovaHra } from './obrazovky/NovaHra'
import { Prehled } from './obrazovky/Prehled'
import { Prestupy } from './obrazovky/Prestupy'
import { SestavaObrazovka } from './obrazovky/Sestava'
import { Soupiska } from './obrazovky/Soupiska'
import { Trenink } from './obrazovky/Trenink'
import { Ulozeni } from './obrazovky/Ulozeni'
import { Vyhlaseni } from './obrazovky/Vyhlaseni'
import { Zapas } from './obrazovky/Zapas'
import { ZivyZapas } from './obrazovky/ZivyZapas'

export type Obrazovka =
  | 'prehled'
  | 'soupiska'
  | 'sestava'
  | 'zapas'
  | 'liga'
  | 'klub'
  | 'ulozeni'
  | 'vyhlaseni'
  | 'prestupy'
  | 'finance'
  | 'trenink'

const ZALOZKY: [Obrazovka, string][] = [
  ['prehled', 'Přehled'],
  ['soupiska', 'Soupiska'],
  ['sestava', 'Sestava'],
  ['zapas', 'Poslední zápas'],
  ['liga', 'Soutěže'],
  ['prestupy', 'Přestupy'],
  ['finance', 'Finance'],
  ['trenink', 'Trénink'],
  ['klub', 'Klub'],
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
    soupiska: <Soupiska hra={hra} setHra={setHra} />,
    sestava: <SestavaObrazovka hra={hra} setHra={setHra} />,
    zapas: hra.cekajiciZapas ? (
      <ZivyZapas
        hra={hra}
        setHra={setHra}
        poZapase={(po) => setObrazovka(po.faze === 'konecSezony' ? 'vyhlaseni' : 'prehled')}
      />
    ) : (
      <Zapas hra={hra} />
    ),
    liga: <LigaObrazovka hra={hra} />,
    prestupy: <Prestupy hra={hra} setHra={setHra} />,
    finance: <Finance hra={hra} setHra={setHra} />,
    trenink: <Trenink hra={hra} setHra={setHra} />,
    klub: <Klub hra={hra} />,
    ulozeni: <Ulozeni hra={hra} setHra={setHra} />,
    vyhlaseni: <Vyhlaseni hra={hra} setHra={setHra} setObrazovka={setObrazovka} />,
  }[obrazovka]

  return (
    <>
      <nav>
        <div className="klub-hlavicka">
          <OdznakKlubu klubId={hra.mujKlubId} velikost={40} />
          <div>
            <div>{hra.tymy[hra.mujKlubId].nazev}</div>
            <div style={{ fontSize: 12, color: 'var(--tlumeny)', fontWeight: 400 }}>
              Sezóna {hra.sezona} · den {hra.den}
            </div>
          </div>
        </div>
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
