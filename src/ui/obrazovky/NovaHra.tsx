import { useEffect, useState } from 'react'
import kluby from '../../core/data/kluby.json'
import { newGame } from '../../core/sezona'
import type { GameState, Klub } from '../../core/types'
import { nactiHru, seznamSlotu, type InfoSlotu } from '../store'

export function NovaHra({ onStart }: { onStart: (s: GameState) => void }) {
  const [sloty, setSloty] = useState<InfoSlotu[]>([])
  useEffect(() => {
    void seznamSlotu().then(setSloty)
  }, [])
  const druhaLiga = (kluby as Klub[]).filter((k) => k.liga === 2)
  return (
    <main>
      <h2>🏒 Hokejový manažer — nová hra</h2>
      <p>Vyber klub 2. ligy, který povedeš do extraligy:</p>
      <div className="mrizka">
        {druhaLiga.map((k) => (
          <button key={k.id} className="karta klik" onClick={() => onStart(newGame(Date.now() % 2 ** 31, k.id))}>
            {k.nazev}
          </button>
        ))}
      </div>
      {sloty.length > 0 && (
        <>
          <h2>Pokračovat v rozehrané hře</h2>
          {sloty.map((s) => (
            <button
              key={s.slot}
              className="karta klik"
              onClick={async () => {
                const hra = await nactiHru(s.slot)
                if (hra) onStart(hra)
              }}
            >
              {s.slot === 0 ? 'Autosave' : `Slot ${s.slot}`}: {s.klub}, sezóna {s.sezona}, den {s.den}
            </button>
          ))}
        </>
      )}
    </main>
  )
}
