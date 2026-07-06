import { useState } from 'react'
import { overall, vymenVSestave } from '../../core/sestava'
import type { GameState } from '../../core/types'

export function SestavaObrazovka({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const [vybrany, setVybrany] = useState<string | null>(null)
  const tym = hra.tymy[hra.mujKlubId]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))

  function klik(id: string) {
    if (!vybrany) return setVybrany(id)
    if (vybrany === id) return setVybrany(null)
    if (podleId.get(vybrany)!.pozice !== podleId.get(id)!.pozice) return setVybrany(id) // jen stejná pozice
    const novaSestava = vymenVSestave(tym.sestava, vybrany, id)
    setHra({ ...hra, tymy: { ...hra.tymy, [hra.mujKlubId]: { ...tym, sestava: novaSestava } } })
    setVybrany(null)
  }

  const Karta = ({ id }: { id: string }) => {
    const h = podleId.get(id)!
    return (
      <button className={`tlacitko sekundarni klik ${vybrany === id ? 'vybrany' : ''}`} onClick={() => klik(id)}>
        {h.jmeno} {h.prijmeni} ({overall(h)})
      </button>
    )
  }

  const vSestave = new Set([...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat(), tym.sestava.brankar])
  const nahradnici = tym.hraci.filter((h) => !vSestave.has(h.id))

  return (
    <>
      <h2>Sestava</h2>
      <p>Klikni na dva hráče stejné pozice a prohodí se (i s náhradníkem).</p>
      {tym.sestava.utoky.map((lajna, i) => (
        <div key={i} className="karta">
          <b>{i + 1}. útok:</b> {lajna.map((id) => <Karta key={id} id={id} />)}
        </div>
      ))}
      {tym.sestava.obrany.map((dvojice, i) => (
        <div key={i} className="karta">
          <b>{i + 1}. obrana:</b> {dvojice.map((id) => <Karta key={id} id={id} />)}
        </div>
      ))}
      <div className="karta">
        <b>Brankář:</b> <Karta id={tym.sestava.brankar} />
      </div>
      <div className="karta">
        <b>Náhradníci:</b> {nahradnici.map((h) => <Karta key={h.id} id={h.id} />)}
      </div>
    </>
  )
}
