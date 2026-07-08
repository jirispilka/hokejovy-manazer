import type { GameState } from '../../core/types'
import { OdznakKlubu } from '../komponenty'

export function Klub({ hra }: { hra: GameState }) {
  const k = hra.trener.kariera
  const uspesnost = k.zapasy > 0 ? Math.round((k.vyhry / k.zapasy) * 100) : 0
  return (
    <>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <OdznakKlubu klubId={hra.mujKlubId} velikost={36} /> {hra.tymy[hra.mujKlubId].nazev}
      </h2>
      <div className="mrizka">
        <div className="karta">
          <h3>🏆 Síň trofejí</h3>
          {k.trofeje.length > 0 ? (
            k.trofeje.map((t, i) => (
              <div key={i} className="zprava" style={{ color: 'var(--zlata)', fontWeight: 700 }}>
                🏆 {t}
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--tlumeny)' }}>Zatím žádná trofej. Tak co s tím uděláš?</p>
          )}
        </div>
        <div className="karta">
          <h3>Rekordy</h3>
          <div className="zprava">
            Nejvyšší výhra: {hra.rekordy.nejvyssiVyhra ? hra.rekordy.nejvyssiVyhra.text : '—'}
          </div>
          <div className="zprava">
            Nejlepší střelec sezóny:{' '}
            {hra.rekordy.nejlepsiStrelec
              ? `${hra.rekordy.nejlepsiStrelec.jmeno} (${hra.rekordy.nejlepsiStrelec.goly} gólů)`
              : '—'}
          </div>
        </div>
      </div>
      <div className="karta">
        <h3>Historie sezón</h3>
        {hra.historie.length === 0 ? (
          <p style={{ color: 'var(--tlumeny)' }}>První sezóna teprve běží.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sezóna</th>
                <th>Klub</th>
                <th>Soutěž</th>
                <th>Umístění</th>
                <th>Cíl</th>
                <th>Trofej</th>
              </tr>
            </thead>
            <tbody>
              {hra.historie.map((z) => (
                <tr key={z.sezona}>
                  <td>{z.sezona}</td>
                  <td>{hra.tymy[z.klubId].nazev}</td>
                  <td>{z.nazevLigy}</td>
                  <td>{z.umisteni}.</td>
                  <td className={z.splnen ? 'vyhra' : 'prohra'}>{z.splnen ? '✅ splněn' : '❌ nesplněn'}</td>
                  <td>{z.trofej ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="karta">
        <h3>Profil trenéra</h3>
        <p>
          Zápasů: <b>{k.zapasy}</b> · Výher: <b>{k.vyhry}</b> ({uspesnost} %) · Sezón: <b>{k.sezony}</b> ·
          Vyhazovů: <b>{k.vyhazovy}</b> · Trofejí: <b>{k.trofeje.length}</b>
        </p>
      </div>
    </>
  )
}
