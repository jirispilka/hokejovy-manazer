import { useEffect, useState } from 'react'
import type { GameState } from '../../core/types'
import { nactiHru, seznamSlotu, ulozHru, type InfoSlotu } from '../store'

export function Ulozeni({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const [sloty, setSloty] = useState<InfoSlotu[]>([])
  const [zprava, setZprava] = useState('')
  const obnov = () => void seznamSlotu().then(setSloty)
  useEffect(obnov, [])
  const info = (n: number) => sloty.find((s) => s.slot === n)
  const popis = (s: InfoSlotu) =>
    `${s.klub}, sezóna ${s.sezona}, den ${s.den} (${new Date(s.ulozeno).toLocaleString('cs')})`
  return (
    <>
      <h2>Uložení hry</h2>
      {[1, 2, 3].map((n) => (
        <div key={n} className="karta">
          <p>
            <b>Slot {n}:</b> {info(n) ? popis(info(n)!) : 'prázdný'}
          </p>
          <button
            className="tlacitko"
            onClick={async () => {
              await ulozHru(n, hra)
              obnov()
              setZprava(`Uloženo do slotu ${n}.`)
            }}
          >
            Uložit
          </button>{' '}
          {info(n) && (
            <button
              className="tlacitko sekundarni"
              onClick={async () => {
                const s = await nactiHru(n)
                if (s) {
                  setHra(s)
                  setZprava(`Načteno ze slotu ${n}.`)
                }
              }}
            >
              Načíst
            </button>
          )}
        </div>
      ))}
      <div className="karta">
        <b>Autosave:</b> {info(0) ? popis(info(0)!) : 'zatím nic'} — ukládá se automaticky po každém tahu.
      </div>
      {zprava && <p>{zprava}</p>}
    </>
  )
}
