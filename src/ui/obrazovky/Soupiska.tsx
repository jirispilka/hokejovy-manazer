import { useMemo, useState } from 'react'
import {
  detailPoziceHrace,
  popisDetailPozice,
  popisZarazeni,
  spojeneLajny,
} from '../../core/lajny'
import { mesicniPlatyTymu } from '../../core/platy'
import { overall, ovrLajny } from '../../core/sestava'
import type { GameState, Hrac } from '../../core/types'
import { kc, roleHrace } from '../../core/hodnoty'
import { BadgePozice, MiniBar } from '../komponenty'
import { SpojenaLajna } from '../SpojenaLajna'
import { ulozHru } from '../store'

type Zalozka = 'soupiska' | 'statistiky' | 'historie'
type Razeni = 'ovr' | 'unava' | 'forma' | 'vek'
type PohledSoupisky = 'lajny' | 'tabulka'

export function Soupiska({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const [zalozka, setZalozka] = useState<Zalozka>('soupiska')
  const [pohled, setPohled] = useState<PohledSoupisky>('lajny')
  const [hlaska, setHlaska] = useState('')
  const [vybrany, setVybrany] = useState<string | null>(null)
  const [hledani, setHledani] = useState('')
  const [razeni, setRazeni] = useState<Razeni>('ovr')
  const muj = hra.tymy[hra.mujKlubId]
  const podleId = useMemo(() => new Map(muj.hraci.map((h) => [h.id, h])), [muj.hraci])
  const vSestave = useMemo(
    () => new Set([...muj.sestava.utoky.flat(), ...muj.sestava.obrany.flat(), muj.sestava.brankar]),
    [muj.sestava],
  )
  const lajny = useMemo(() => spojeneLajny(muj.sestava), [muj.sestava])
  const ovr = useMemo(() => ovrLajny(muj), [muj])

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

  const stridacka = useMemo(() => muj.hraci.filter((h) => !vSestave.has(h.id)), [muj.hraci, vSestave])
  const brankar = podleId.get(muj.sestava.brankar)

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

  const RadekSoupisky = ({ h }: { h: Hrac }) => {
    const dp = detailPoziceHrace(h)
    return (
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
        <td>{dp ? popisDetailPozice(dp) : '—'}</td>
        <td>{popisZarazeni(muj.sestava, h.id)}</td>
        <td>{h.vek}</td>
        <td><b>{overall(h)}</b></td>
        <td>{roleHrace(h) ?? '—'}</td>
        <td><MiniBar hodnota={h.forma} popisek="F" /></td>
        <td><MiniBar hodnota={h.unava} popisek="Ú" barva="var(--prohra)" /></td>
        <td>{h.zranenZapasu > 0 ? `🚑${h.zranenZapasu}` : '✓'}</td>
        <td>{kc(h.plat)}</td>
      </tr>
    )
  }

  const RadekStridacky = ({ h }: { h: Hrac }) => {
    const dp = detailPoziceHrace(h)
    return (
      <div className="radek-hrace radek-lajny">
        <span className="radek-pozice-badges">
          <BadgePozice pozice={h.pozice} />
          {dp && <span className="badge badge-detail-pozice">{popisDetailPozice(dp)}</span>}
        </span>
        <span className="radek-jmeno">
          {h.jmeno} {h.prijmeni}
          {h.id === hra.oblibenyHracId && ' ⭐'}
          {h.zranenZapasu > 0 && ` 🚑${h.zranenZapasu}`}
        </span>
        <span className="radek-vek">{h.vek}</span>
        <b>{overall(h)}</b>
        <span className="radek-role">{roleHrace(h) ?? '—'}</span>
        <MiniBar hodnota={h.forma} popisek="F" />
        <MiniBar hodnota={h.unava} popisek="Ú" barva="var(--prohra)" />
      </div>
    )
  }

  return (
    <>
      <h2>Soupiska</h2>
      {hlaska && <p className="hlaska">{hlaska}</p>}
      {Zalozky}

      {zalozka === 'soupiska' && (
        <>
          <div className="filtry-radek soupiska-prepinac">
            <div className="filtr-pozice">
              <button
                type="button"
                className={`tlacitko-mini sekundarni ${pohled === 'lajny' ? 'vybrany' : ''}`}
                onClick={() => setPohled('lajny')}
              >
                Po lajnách
              </button>
              <button
                type="button"
                className={`tlacitko-mini sekundarni ${pohled === 'tabulka' ? 'vybrany' : ''}`}
                onClick={() => setPohled('tabulka')}
              >
                Celá tabulka
              </button>
            </div>
            {pohled === 'tabulka' && (
              <>
                <input placeholder="Hledat jméno…" value={hledani} onChange={(e) => setHledani(e.target.value)} />
                <select value={razeni} onChange={(e) => setRazeni(e.target.value as Razeni)}>
                  <option value="ovr">OVR</option>
                  <option value="unava">Únava</option>
                  <option value="forma">Forma</option>
                  <option value="vek">Věk</option>
                </select>
              </>
            )}
          </div>

          {pohled === 'lajny' ? (
            <div className="soupiska-lajny-grid">
              {lajny.map((l) => (
                <SpojenaLajna
                  key={l.index}
                  lajna={l}
                  podleId={podleId}
                  rezim="prehled"
                  tym={muj}
                  chemieUtok={muj.chemie.utoky[l.index]}
                  chemieObrana={muj.chemie.obrany[Math.min(l.index, 2)]}
                  ovrUtok={ovr.utoky[l.index]}
                  ovrObrana={ovr.obrany[Math.min(l.index, 2)]}
                  kapitanId={muj.kapitanId}
                />
              ))}
              {brankar && (
                <div className="karta">
                  <b>Brankář</b>
                  <div className="radek-hrace radek-lajny">
                    <span className="radek-pozice-badges"><BadgePozice pozice="G" /></span>
                    <span className="radek-jmeno">
                      {brankar.jmeno} {brankar.prijmeni}
                      {brankar.id === muj.kapitanId && ' Ⓒ'}
                    </span>
                    <span className="radek-vek">{brankar.vek}</span>
                    <b>{overall(brankar)}</b>
                    <span className="radek-role">—</span>
                    <MiniBar hodnota={brankar.forma} popisek="F" />
                    <MiniBar hodnota={brankar.unava} popisek="Ú" barva="var(--prohra)" />
                  </div>
                </div>
              )}
              {stridacka.length > 0 && (
                <div className="karta">
                  <b>Střídačka ({stridacka.length})</b>
                  {stridacka
                    .sort((a, b) => overall(b) - overall(a))
                    .map((h) => <RadekStridacky key={h.id} h={h} />)}
                </div>
              )}
              <p style={{ fontSize: 13, color: 'var(--tlumeny)' }}>
                Sestavu upravíš v záložce Sestava. Prodej hráčů je v Přestupy → Můj tým.
              </p>
            </div>
          ) : (
            <div className="karta tabulka-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Hráč</th><th>Poz.</th><th>Led.</th><th>Lajna</th><th>Věk</th><th>OVR</th>
                    <th>Role</th><th>Forma</th><th>Únava</th><th>Zdraví</th><th>Plat</th>
                  </tr>
                </thead>
                <tbody>{hraci.map((h) => <RadekSoupisky key={h.id} h={h} />)}</tbody>
                <tfoot>
                  <tr className="platy-celkem">
                    <td colSpan={10}><b>Celkové náklady na platy</b></td>
                    <td><b className="prohra">{kc(mesicniPlatyTymu(muj.hraci))}/měs</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
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
