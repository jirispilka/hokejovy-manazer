import { useEffect, useState } from 'react'
import kluby from '../../core/data/kluby.json'
import { newGame } from '../../core/sezona'
import type { GameState, Klub } from '../../core/types'
import { OdznakKlubu } from '../komponenty'
import { nactiHru, seznamSlotu, type InfoSlotu } from '../store'

const LIGY = [
  { uroven: 0, nazev: 'Extraliga', popis: 'boj o titul a nejvyšší tlak fanoušků' },
  { uroven: 1, nazev: 'Chance liga', popis: 'postupová mise do extraligy' },
  { uroven: 2, nazev: '2. liga', popis: 'dlouhá cesta z nižší soutěže nahoru' },
] as const

export function NovaHra({ onStart }: { onStart: (s: GameState) => void }) {
  const [sloty, setSloty] = useState<InfoSlotu[]>([])
  const [liga, setLiga] = useState(0)
  useEffect(() => {
    void seznamSlotu().then(setSloty)
  }, [])
  const klubyVLize = (kluby as Klub[]).filter((k) => k.liga === liga)
  const vybranaLiga = LIGY.find((l) => l.uroven === liga)!
  return (
    <main>
      <h2>🏒 Hokejový manažer — nová hra</h2>
      <p>Vyber klub, který chceš koučovat. Můžeš začít rovnou v extralize, nebo si vybrat postupovou výzvu níž.</p>
      <div className="karta" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {LIGY.map((l) => (
          <button
            key={l.uroven}
            className={`tlacitko ${liga === l.uroven ? '' : 'sekundarni'}`}
            onClick={() => setLiga(l.uroven)}
          >
            {l.nazev}
          </button>
        ))}
        <span style={{ color: 'var(--tlumeny)' }}>{vybranaLiga.popis}</span>
      </div>
      <div className="mrizka">
        {klubyVLize.map((k) => (
          <button
            key={k.id}
            className="karta klik"
            style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
            onClick={() => onStart(newGame(Date.now() % 2 ** 31, k.id))}
          >
            <OdznakKlubu klubId={k.id} velikost={36} />
            <span>
              <b>{k.nazev}</b>
              <br />
              <span style={{ color: 'var(--tlumeny)', fontSize: 13 }}>{vybranaLiga.nazev}</span>
            </span>
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
