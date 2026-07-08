import { zahajNovouSezonu } from '../../core/sezona'
import type { GameState } from '../../core/types'
import type { Obrazovka } from '../App'
import { OdznakKlubu } from '../komponenty'
import { ulozHru } from '../store'

export function Vyhlaseni({
  hra,
  setHra,
  setObrazovka,
}: {
  hra: GameState
  setHra: (s: GameState) => void
  setObrazovka: (o: Obrazovka) => void
}) {
  const v = hra.vyhlaseni
  if (!v) {
    return (
      <>
        <h2>Vyhlášení sezóny</h2>
        <p>Sezóna ještě běží.</p>
      </>
    )
  }
  const posledniZaznam = hra.historie[hra.historie.length - 1]
  return (
    <>
      <h2>🏆 Vyhlášení sezóny {v.sezona}</h2>
      <div className="mrizka-3">
        {v.mistri.map((m) => (
          <div key={m.nazevLigy} className="karta" style={{ textAlign: 'center' }}>
            <OdznakKlubu klubId={m.klubId} velikost={48} />
            <h3>{hra.tymy[m.klubId].nazev}</h3>
            <p style={{ color: 'var(--zlata)' }}>vítěz — {m.nazevLigy}</p>
          </div>
        ))}
      </div>
      <div className="mrizka">
        <div className="karta">
          <h3>Králové střelců</h3>
          {v.kraloveStrelcu.map((k) => (
            <div key={k.nazevLigy} className="zprava">
              {k.nazevLigy}: <b>{k.jmeno}</b> ({hra.tymy[k.klubId].nazev}) — {k.goly} gólů
            </div>
          ))}
        </div>
        <div className="karta">
          <h3>Hvězda tvého týmu</h3>
          {v.hvezdaTymu ? (
            <p>
              ⭐ <b>{v.hvezdaTymu.jmeno}</b> — {v.hvezdaTymu.goly} gólů, {v.hvezdaTymu.asistence} asistencí
            </p>
          ) : (
            <p>—</p>
          )}
          {posledniZaznam && (
            <p className={posledniZaznam.splnen ? 'vyhra' : 'prohra'}>
              {posledniZaznam.splnen ? '✅ Cíl sezóny splněn!' : '❌ Cíl sezóny nesplněn.'}
              {posledniZaznam.trofej && ` 🏆 ${posledniZaznam.trofej}`}
            </p>
          )}
        </div>
      </div>
      {hra.nabidky ? (
        // vyhazov na konci sezóny: zahajNovouSezonu by hodila chybu — nejdřív nabídky
        <button className="tlacitko nebezpecne" onClick={() => setObrazovka('prehled')}>
          Nejdřív vyřeš nabídky klubů ▶
        </button>
      ) : (
        <button
          className="tlacitko"
          onClick={() => {
            const s = zahajNovouSezonu(hra)
            setHra(s)
            void ulozHru(0, s)
            setObrazovka('prehled')
          }}
        >
          Zahájit novou sezónu ▶
        </button>
      )}
    </>
  )
}
