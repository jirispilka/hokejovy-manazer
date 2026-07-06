import { useState } from 'react'
import { spocitejTabulku } from '../../core/tabulka'
import type { GameState } from '../../core/types'

const NAZVY_KOL = ['Čtvrtfinále', 'Semifinále', 'Finále']

export function LigaObrazovka({ hra }: { hra: GameState }) {
  const [uroven, setUroven] = useState(hra.ligy.findIndex((l) => l.tymy.includes(hra.mujKlubId)))
  const liga = hra.ligy[uroven]
  const tabulka = spocitejTabulku(liga.tymy, liga.zapasy)
  return (
    <>
      <h2>Soutěže</h2>
      <p>
        {hra.ligy.map((l) => (
          <button
            key={l.uroven}
            className={`tlacitko ${l.uroven === uroven ? '' : 'sekundarni'}`}
            style={{ marginRight: 8 }}
            onClick={() => setUroven(l.uroven)}
          >
            {l.nazev}
          </button>
        ))}
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Tým</th><th>Z</th><th>V</th><th>VP</th><th>PP</th><th>P</th><th>Skóre</th><th>B</th>
          </tr>
        </thead>
        <tbody>
          {tabulka.map((r, i) => (
            <tr key={r.tymId} className={r.tymId === hra.mujKlubId ? 'muj' : ''}>
              <td>{i + 1}.</td>
              <td>{hra.tymy[r.tymId].nazev}</td>
              <td>{r.zapasy}</td>
              <td>{r.vyhry}</td>
              <td>{r.vyhryP}</td>
              <td>{r.prohryP}</td>
              <td>{r.prohry}</td>
              <td>{r.vstrelene}:{r.obdrzene}</td>
              <td><b>{r.body}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      {liga.playoff && (
        <div className="karta">
          <h3>Playoff{liga.playoff.vitez ? ` — vítěz: ${hra.tymy[liga.playoff.vitez].nazev} 🏆` : ''}</h3>
          {liga.playoff.kola.map((kolo, i) => (
            <div key={i}>
              <b>{NAZVY_KOL[i]}</b>
              {kolo.map((serie, j) => (
                <div key={j} className="zprava">
                  {hra.tymy[serie.domaci].nazev} {serie.vyhryDomaci} : {serie.vyhryHoste}{' '}
                  {hra.tymy[serie.hoste].nazev}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
