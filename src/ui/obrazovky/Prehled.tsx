import { advanceDay, dalsiMujZapas, mojeLiga, zahajNovouSezonu } from '../../core/sezona'
import { spocitejTabulku } from '../../core/tabulka'
import type { GameState } from '../../core/types'
import type { Obrazovka } from '../App'
import { ulozHru } from '../store'

export function Prehled({
  hra,
  setHra,
  setObrazovka,
}: {
  hra: GameState
  setHra: (s: GameState) => void
  setObrazovka: (o: Obrazovka) => void
}) {
  const liga = mojeLiga(hra)
  const tabulka = spocitejTabulku(liga.tymy, liga.zapasy)
  const dalsi = dalsiMujZapas(hra)

  // posouvá dny, dokud nenarazí na můj zápas nebo změnu fáze (max 10 dní na klik)
  function pokracuj() {
    let s = hra
    let pojistka = 0
    do {
      s = advanceDay(s)
    } while (pojistka++ < 10 && s.faze === hra.faze && s.posledniZapas?.den !== s.den)
    setHra(s)
    void ulozHru(0, s)
    if (s.posledniZapas?.den === s.den) setObrazovka('zapas')
  }

  function novaSezona() {
    const s = zahajNovouSezonu(hra)
    setHra(s)
    void ulozHru(0, s)
  }

  return (
    <>
      <h2>
        {hra.tymy[hra.mujKlubId].nazev} — sezóna {hra.sezona}, den {hra.den}
      </h2>
      <div className="mrizka">
        <div className="karta">
          <h3>Další zápas</h3>
          {dalsi ? (
            <p>
              Den {dalsi.den}: {hra.tymy[dalsi.domaci].nazev} – {hra.tymy[dalsi.hoste].nazev}
            </p>
          ) : hra.faze === 'konecSezony' ? (
            <p>Sezóna skončila.</p>
          ) : (
            <p>Nečeká vás zápas — sezóna běží dál.</p>
          )}
          {hra.faze === 'konecSezony' ? (
            <button className="tlacitko" onClick={novaSezona}>
              Zahájit novou sezónu
            </button>
          ) : (
            <button className="tlacitko" onClick={pokracuj}>
              Pokračovat ▶
            </button>
          )}
        </div>
        <div className="karta">
          <h3>{liga.nazev}</h3>
          <table>
            <tbody>
              {tabulka.map((r, i) => (
                <tr key={r.tymId} className={r.tymId === hra.mujKlubId ? 'muj' : ''}>
                  <td>{i + 1}.</td>
                  <td>{hra.tymy[r.tymId].nazev}</td>
                  <td>{r.body} b.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="karta">
        <h3>Zprávy</h3>
        {hra.zpravy.slice(0, 10).map((z, i) => (
          <div key={i} className="zprava">
            {z}
          </div>
        ))}
      </div>
    </>
  )
}
