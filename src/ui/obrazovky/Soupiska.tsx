import { useMemo, useState } from 'react'
import { mesicniPlatyTymu } from '../../core/platy'
import { overall } from '../../core/sestava'
import type { GameState, Hrac } from '../../core/types'
import { kc, roleHrace } from '../../core/hodnoty'
import { BadgePozice, MiniBar } from '../komponenty'
import { ulozHru } from '../store'

type Zalozka = 'soupiska' | 'statistiky' | 'historie'
type Razeni = 'ovr' | 'unava' | 'forma' | 'vek'

export function Soupiska({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const [zalozka, setZalozka] = useState<Zalozka>('soupiska')
  const [hlaska, setHlaska] = useState('')
  const [vybrany, setVybrany] = useState<string | null>(null)
  const [hledani, setHledani] = useState('')
  const [razeni, setRazeni] = useState<Razeni>('ovr')
  const muj = hra.tymy[hra.mujKlubId]

  const hraci = useMemo(() => {
    const q = hledani.trim().toLowerCase()
    let list = [...muj.hraci]
    if (q) list = list.filter((h) => `${h.jmeno} ${h.prijmeni}`.toLowerCase().includes(q))
    list.sort((a, b) => {
      switch (razeni) {
        case 'unava': return b.unava - a.unava
        case 'forma': return b.forma - a.forma
        case 'vek': return a.vek - b.vek
        default: return overall(b) - overall(a)
      }
    })
    return list
  }, [muj.hraci, hledani, razeni])

  function aplikuj(s: GameState, zprava: string) {
    setHra(s)
    void ulozHru(0, s)
    setHlaska(zprava)
  }

  function prepniOblibeneho(hracId: string) {
    const ns = structuredClone(hra)
    ns.oblibenyHracId = hra.oblibenyHracId === hracId ? null : hracId
    aplikuj(ns, ns.oblibenyHracId ? '⭐ Oblíbený hráč označen.' : 'Oblíbený hráč zrušen.')
  }

  const Zalozky = (
    <div className="sub-zalozky">
      {(['soupiska', 'statistiky', 'historie'] as const).map((z) => (
        <button key={z} className={`sub-zalozka ${zalozka === z ? 'aktivni' : ''}`} onClick={() => setZalozka(z)}>
          {z === 'soupiska' ? 'Soupiska' : z === 'statistiky' ? 'Statistiky' : 'Historie'}
        </button>
      ))}
    </div>
  )

  const RadekSoupisky = ({ h }: { h: Hrac }) => (
    <tr className={vybrany === h.id ? 'vybrany-radek' : ''} onClick={() => setVybrany(h.id === vybrany ? null : h.id)}>
      <td>
        <button
          className="tlacitko-mini sekundarni"
          style={{ marginRight: 4, padding: '2px 6px' }}
          title="Oblíbený hráč"
          onClick={(e) => { e.stopPropagation(); prepniOblibeneho(h.id) }}
        >
          {h.id === hra.oblibenyHracId ? '⭐' : '☆'}
        </button>
        {h.jmeno} {h.prijmeni}
        {h.id === muj.kapitanId && ' Ⓒ'}
      </td>
      <td><BadgePozice pozice={h.pozice} /></td>
      <td>{h.vek}</td>
      <td><b>{overall(h)}</b></td>
      <td>{roleHrace(h) ?? '—'}</td>
      <td><MiniBar hodnota={h.forma} popisek="F" /></td>
      <td><MiniBar hodnota={h.unava} popisek="Ú" barva="var(--prohra)" /></td>
      <td>{h.zranenZapasu > 0 ? `🚑${h.zranenZapasu}` : '✓'}</td>
      <td>{kc(h.plat)}</td>
    </tr>
  )

  return (
    <>
      <h2>Soupiska</h2>
      {hlaska && <p className="hlaska">{hlaska}</p>}
      {Zalozky}

      {zalozka === 'soupiska' && (
        <>
          <div className="filtry-radek" style={{ marginBottom: 8 }}>
            <input placeholder="Hledat jméno…" value={hledani} onChange={(e) => setHledani(e.target.value)} />
            <select value={razeni} onChange={(e) => setRazeni(e.target.value as Razeni)}>
              <option value="ovr">OVR</option>
              <option value="unava">Únava</option>
              <option value="forma">Forma</option>
              <option value="vek">Věk</option>
            </select>
          </div>
          <div className="karta tabulka-scroll">
            <table>
              <thead>
                <tr>
                  <th>Hráč</th><th>Poz.</th><th>Věk</th><th>OVR</th><th>Role</th><th>Forma</th><th>Únava</th>
                  <th>Zdraví</th><th>Plat</th>
                </tr>
              </thead>
              <tbody>{hraci.map((h) => <RadekSoupisky key={h.id} h={h} />)}</tbody>
              <tfoot>
                <tr className="platy-celkem">
                  <td colSpan={8}><b>Celkové náklady na platy</b></td>
                  <td><b className="prohra">{kc(mesicniPlatyTymu(muj.hraci))}/měs</b></td>
                </tr>
              </tfoot>
            </table>
            <p style={{ fontSize: 13, color: 'var(--tlumeny)', marginTop: 8 }}>
              Prodej hráčů je v záložce Přestupy → Můj tým.
            </p>
          </div>
        </>
      )}

      {zalozka === 'statistiky' && (
        <div className="karta tabulka-scroll">
          <table>
            <thead>
              <tr>
                <th>Hráč</th><th>Zápasy</th><th>G</th><th>A</th><th>B</th><th>Potenciál</th>
                <th>Stř</th><th>Při</th><th>Obr</th><th>Fyz</th><th>Chy</th>
              </tr>
            </thead>
            <tbody>
              {hraci.map((h) => (
                <tr key={h.id}>
                  <td>{h.jmeno} {h.prijmeni}</td>
                  <td>{h.odehranoSezona}</td>
                  <td>{h.goly}</td>
                  <td>{h.asistence}</td>
                  <td><b>{h.goly + h.asistence}</b></td>
                  <td>{h.potencial}</td>
                  <td>{h.atributy.strelba}</td>
                  <td>{h.atributy.prihravky}</td>
                  <td>{h.atributy.obrana}</td>
                  <td>{h.atributy.fyzicka}</td>
                  <td>{h.atributy.chytani}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {zalozka === 'historie' && (
        <div className="karta">
          {hraci.map((h) => {
            const herni = h.herniHistorie ?? []
            return (
              <div key={h.id} className="historie-blok">
                <h3>
                  {h.jmeno} {h.prijmeni}
                  {h.id === hra.oblibenyHracId && ' ⭐'}
                </h3>
                {herni.length > 0 ? (
                  <table className="historie-tabulka">
                    <thead>
                      <tr><th>Sezona</th><th>Klub</th><th>Z</th><th>G</th><th>A</th><th>B</th></tr>
                    </thead>
                    <tbody>
                      {herni.map((s) => (
                        <tr key={s.sezona}>
                          <td>{s.sezona}</td><td>{s.klub}</td><td>{s.zapasy}</td>
                          <td>{s.goly}</td><td>{s.asistence}</td><td><b>{s.goly + s.asistence}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: 'var(--tlumeny)', fontSize: 13 }}>Zatím žádná herní historie — odehraj sezónu.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
