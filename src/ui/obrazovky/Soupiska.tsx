import { overall } from '../../core/sestava'
import type { GameState } from '../../core/types'

const POZICE = { G: 'Brankář', D: 'Obránce', U: 'Útočník' } as const

export function Soupiska({ hra }: { hra: GameState }) {
  const hraci = [...hra.tymy[hra.mujKlubId].hraci].sort((a, b) => overall(b) - overall(a))
  return (
    <>
      <h2>Soupiska</h2>
      <table>
        <thead>
          <tr>
            <th>Hráč</th><th>Pozice</th><th>Věk</th><th>Celkem</th><th>Stř</th><th>Při</th>
            <th>Bru</th><th>Obr</th><th>Fyz</th><th>Chy</th><th>Forma</th><th>Únava</th><th>G</th><th>A</th>
          </tr>
        </thead>
        <tbody>
          {hraci.map((h) => (
            <tr key={h.id}>
              <td>{h.jmeno} {h.prijmeni}</td>
              <td>{POZICE[h.pozice]}</td>
              <td>{h.vek}</td>
              <td><b>{overall(h)}</b></td>
              <td>{h.atributy.strelba}</td>
              <td>{h.atributy.prihravky}</td>
              <td>{h.atributy.brusleni}</td>
              <td>{h.atributy.obrana}</td>
              <td>{h.atributy.fyzicka}</td>
              <td>{h.atributy.chytani}</td>
              <td>{h.forma}</td>
              <td>{h.unava}</td>
              <td>{h.goly}</td>
              <td>{h.asistence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
