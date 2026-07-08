import { useMemo, useState } from 'react'
import { kc, roleHrace } from '../../core/hodnoty'
import {
  cenaProdeje,
  hodnotaHrace,
  kupHrace,
  MINIMA,
  pocetNaPozici,
  pozadovanaCena,
  prestupoveOknoOtevrene,
  prodajHrace,
  rngProdeje,
} from '../../core/prestupy'
import { filtrujHrace, SABLONY_FILTRU, seradTrh, skautReport, type FiltrHracu, type RazeniTrhu } from '../../core/skaut'
import { overall } from '../../core/sestava'
import type { GameState, Hrac, Pozice } from '../../core/types'
import { BadgePozice, MiniBar, OdznakKlubu } from '../komponenty'
import { ulozHru } from '../store'

interface RadekTrhu {
  hrac: Hrac
  klubId: string
}

const STRANKA = 20
const VYCHOZI_FILTR: FiltrHracu = { liga: -1, pozice: 'vse' }

type Zalozka = 'trh' | 'muj'

const SABLONY: { klic: keyof typeof SABLONY_FILTRU; label: string }[] = [
  { klic: 'mlady', label: '🌟 Mladý talent' },
  { klic: 'posila', label: '⚡ Okamžitá posila' },
  { klic: 'loterie', label: '🎲 Levná loterie' },
  { klic: 'brankar', label: '🥅 Brankář' },
]

function nejslabsiNaPozici(hraci: Hrac[], pozice: Pozice): Hrac | null {
  const naPozici = hraci.filter((h) => h.pozice === pozice)
  if (naPozici.length === 0) return null
  return naPozici.reduce((a, b) => (overall(a) <= overall(b) ? a : b))
}

function vsechnyRadky(hra: GameState): RadekTrhu[] {
  const radky: RadekTrhu[] = []
  for (const liga of hra.ligy) {
    for (const klubId of liga.tymy) {
      if (klubId === hra.mujKlubId) continue
      for (const hrac of hra.tymy[klubId].hraci) {
        radky.push({ hrac, klubId })
      }
    }
  }
  return radky
}

function popisFiltru(filtr: FiltrHracu, ligy: GameState['ligy']): string[] {
  const chips: string[] = []
  if (filtr.jmeno?.trim()) chips.push(`„${filtr.jmeno.trim()}"`)
  if (filtr.liga !== undefined && filtr.liga >= 0) chips.push(ligy.find((l) => l.uroven === filtr.liga)!.nazev)
  if (filtr.pozice && filtr.pozice !== 'vse') chips.push(filtr.pozice === 'U' ? 'Útočníci' : filtr.pozice === 'D' ? 'Obránci' : 'Brankáři')
  if (filtr.ovrMin !== undefined && filtr.ovrMin > 40) chips.push(`OVR ≥ ${filtr.ovrMin}`)
  if (filtr.ovrMax !== undefined && filtr.ovrMax < 99) chips.push(`OVR ≤ ${filtr.ovrMax}`)
  if (filtr.vekMin !== undefined && filtr.vekMin > 16) chips.push(`věk ≥ ${filtr.vekMin}`)
  if (filtr.vekMax !== undefined && filtr.vekMax < 40) chips.push(`věk ≤ ${filtr.vekMax}`)
  if (filtr.potencialMin !== undefined) chips.push(`pot. ≥ ${filtr.potencialMin}`)
  if (filtr.maxCena !== undefined) chips.push(`max ${kc(filtr.maxCena)}`)
  if (filtr.maxPlat !== undefined) chips.push(`plat ≤ ${kc(filtr.maxPlat)}`)
  if (filtr.lepsiNezSlaby) chips.push('lepší než můj slabý')
  if (filtr.jenZdravi) chips.push('jen zdraví')
  return chips
}

export function Prestupy({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const [zalozka, setZalozka] = useState<Zalozka>('trh')
  const [filtr, setFiltr] = useState<FiltrHracu>(VYCHOZI_FILTR)
  const [razeni, setRazeni] = useState<RazeniTrhu>('ovr')
  const [stranka, setStranka] = useState(0)
  const [vybrany, setVybrany] = useState<RadekTrhu | null>(null)
  const [hlaska, setHlaska] = useState<{ typ: 'info' | 'uspech' | 'chyba'; text: string } | null>(null)
  const [filtryOtevrene, setFiltryOtevrene] = useState(false)

  const okno = prestupoveOknoOtevrene(hra)
  const muj = hra.tymy[hra.mujKlubId]
  const aktivniFiltry = popisFiltru(filtr, hra.ligy)

  const trh = useMemo(() => {
    const radky = filtrujHrace(hra, vsechnyRadky(hra), filtr, hra.mujKlubId)
    return seradTrh(radky, razeni, hra.seed)
  }, [hra, filtr, razeni])

  const stranek = Math.max(1, Math.ceil(trh.length / STRANKA))
  const strankaTrh = trh.slice(stranka * STRANKA, (stranka + 1) * STRANKA)

  function nastavFiltr(uprava: Partial<FiltrHracu>) {
    setFiltr({ ...filtr, ...uprava })
    setStranka(0)
  }

  function zobrazHlasku(typ: 'info' | 'uspech' | 'chyba', text: string) {
    setHlaska({ typ, text })
  }

  function aplikuj(s: GameState, typ: 'info' | 'uspech' | 'chyba', zprava: string) {
    setHra(s)
    void ulozHru(0, s)
    zobrazHlasku(typ, zprava)
  }

  function koupit() {
    if (!vybrany) return
    const jmeno = `${vybrany.hrac.jmeno} ${vybrany.hrac.prijmeni}`
    const klub = hra.tymy[vybrany.klubId].nazev
    const cena = pozadovanaCena(hra, vybrany.klubId, vybrany.hrac.id)
    try {
      aplikuj(
        kupHrace(hra, vybrany.klubId, vybrany.hrac.id),
        'uspech',
        `✅ Koupil jsi hráče! ${jmeno} je ve tvém týmu (z ${klub}) za ${kc(cena)}.`,
      )
      setVybrany(null)
    } catch (e) {
      zobrazHlasku('chyba', `❌ ${(e as Error).message}`)
    }
  }

  function prodat(hracId: string) {
    const hrac = muj.hraci.find((h) => h.id === hracId)!
    if (hra.oblibenyHracId === hracId) {
      if (!window.confirm('Opravdu prodáš oblíbeného hráče? Fanoušci budou zklamaní.')) return
    }
    const podMinimum = pocetNaPozici(muj, hrac.pozice) - 1 < MINIMA[hrac.pozice]
    if (podMinimum) {
      const nazev = hrac.pozice === 'G' ? 'brankářů' : hrac.pozice === 'D' ? 'obránců' : 'útočníků'
      if (
        !window.confirm(
          `Po prodeji budeš mít méně než ${MINIMA[hrac.pozice]} ${nazev} (minimum ligy). Sestavu si musíš doplnit sám. Prodat stejně?`,
        )
      )
        return
    }
    const cena = cenaProdeje(hrac)
    try {
      const po = prodajHrace(hra, hracId, rngProdeje(hra, hracId))
      const zprava = po.zpravy[0] ?? `✅ Prodáno! ${hrac.jmeno} ${hrac.prijmeni} za ${kc(cena)}.`
      aplikuj(po, 'uspech', zprava.startsWith('💰') ? `✅ ${zprava.slice(2)}` : zprava)
    } catch (e) {
      zobrazHlasku('chyba', `❌ ${(e as Error).message}`)
    }
  }

  function aplikujSablonu(klic: keyof typeof SABLONY_FILTRU) {
    setFiltr({ ...VYCHOZI_FILTR, ...SABLONY_FILTRU[klic] })
    setStranka(0)
    setFiltryOtevrene(true)
  }

  function vymazFiltry() {
    setFiltr(VYCHOZI_FILTR)
    setStranka(0)
  }

  function vyber(r: RadekTrhu) {
    setVybrany(r)
    setHlaska(null)
  }

  const detail = vybrany?.hrac
  const porovnani = detail ? nejslabsiNaPozici(muj.hraci, detail.pozice) : null
  const hodnota = detail ? hodnotaHrace(detail) : 0
  const cenaKoupe = detail && vybrany ? pozadovanaCena(hra, vybrany.klubId, detail.id) : 0
  const rozpocetOk = muj.rozpocet >= cenaKoupe
  const report = detail && vybrany ? skautReport(hra, detail, vybrany.klubId) : null

  return (
    <>
      <div className="prestupy-hlavicka">
        <h2>Přestupy</h2>
        <span className={`pill ${okno ? 'pill-ok' : 'pill-derby'}`}>{okno ? 'Trh otevřen' : 'Playoff — trh zavřen'}</span>
        <span className="prestupy-rozpocet" style={{ color: muj.rozpocet >= 0 ? 'var(--vyhra)' : 'var(--prohra)' }}>
          Rozpočet: <b>{kc(muj.rozpocet)}</b>
        </span>
      </div>

      {hlaska && (
        <p className={`hlaska hlaska-${hlaska.typ}`} role="status">
          {hlaska.text}
        </p>
      )}

      <div className="sub-zalozky">
        <button className={`sub-zalozka ${zalozka === 'trh' ? 'aktivni' : ''}`} onClick={() => setZalozka('trh')}>
          🔍 Hledat posilu
        </button>
        <button className={`sub-zalozka ${zalozka === 'muj' ? 'aktivni' : ''}`} onClick={() => setZalozka('muj')}>
          📤 Můj tým
        </button>
      </div>

      {zalozka === 'muj' ? (
        <div className="karta tabulka-scroll">
          <p className="prestupy-napoveda">
            Klikni <b>Prodat</b> — hráč okamžitě odejde do jiného klubu a peníze přibydou na rozpočet (90 % tržní hodnoty).
          </p>
          <table>
            <thead>
              <tr>
                <th>Hráč</th><th>OVR</th><th>Hodnota</th><th>Prodej za</th><th>Plat</th><th></th>
              </tr>
            </thead>
            <tbody>
              {[...muj.hraci].sort((a, b) => overall(b) - overall(a)).map((h) => (
                <tr key={h.id}>
                  <td>
                    {h.jmeno} {h.prijmeni}
                    {h.id === hra.oblibenyHracId && ' ⭐'}
                  </td>
                  <td><b>{overall(h)}</b></td>
                  <td>{kc(hodnotaHrace(h))}</td>
                  <td><b>{kc(cenaProdeje(h))}</b></td>
                  <td>{kc(h.plat)}</td>
                  <td>
                    <button className="tlacitko sekundarni tlacitko-mini" disabled={!okno} onClick={() => prodat(h.id)}>
                      Prodat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="karta prestupy-filtry">
            <div className="prestupy-sablony">
              {SABLONY.map((s) => (
                <button key={s.klic} type="button" className="tlacitko-mini sekundarni" onClick={() => aplikujSablonu(s.klic)}>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="prestupy-filtry-zaklad">
              <input
                className="prestupy-hledat"
                placeholder="🔍 Hledat jméno…"
                value={filtr.jmeno ?? ''}
                onChange={(e) => nastavFiltr({ jmeno: e.target.value })}
              />
              <select value={filtr.liga ?? -1} onChange={(e) => nastavFiltr({ liga: Number(e.target.value) })}>
                <option value={-1}>Všechny ligy</option>
                {hra.ligy.map((l) => <option key={l.uroven} value={l.uroven}>{l.nazev}</option>)}
              </select>
              <select value={filtr.pozice ?? 'vse'} onChange={(e) => nastavFiltr({ pozice: e.target.value as 'vse' | Pozice })}>
                <option value="vse">Všechny pozice</option>
                <option value="U">Útočníci</option>
                <option value="D">Obránci</option>
                <option value="G">Brankáři</option>
              </select>
              <select value={razeni} onChange={(e) => setRazeni(e.target.value as RazeniTrhu)} title="Řazení">
                <option value="ovr">Řadit: OVR ↓</option>
                <option value="potencial">Řadit: Potenciál ↓</option>
                <option value="cena">Řadit: Cena ↑</option>
                <option value="vek">Řadit: Věk ↑</option>
                <option value="forma">Řadit: Forma ↓</option>
                <option value="pomer">Řadit: Cena/výkon ↓</option>
              </select>
            </div>

            <button
              type="button"
              className="prestupy-filtry-toggle"
              onClick={() => setFiltryOtevrene((o) => !o)}
            >
              {filtryOtevrene ? '▲ Skrýt pokročilé filtry' : '▼ Pokročilé filtry'}
              {aktivniFiltry.length > 0 && !filtryOtevrene && ` (${aktivniFiltry.length} aktivní)`}
            </button>

            {filtryOtevrene && (
              <div className="prestupy-filtry-pokrocile">
                <div className="prestupy-filtr-skupina">
                  <label>OVR od</label>
                  <input type="number" min={40} max={99} placeholder="40" value={filtr.ovrMin ?? ''} onChange={(e) => nastavFiltr({ ovrMin: e.target.value ? Number(e.target.value) : undefined })} />
                  <label>do</label>
                  <input type="number" min={40} max={99} placeholder="99" value={filtr.ovrMax ?? ''} onChange={(e) => nastavFiltr({ ovrMax: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="prestupy-filtr-skupina">
                  <label>Věk od</label>
                  <input type="number" min={16} max={40} placeholder="16" value={filtr.vekMin ?? ''} onChange={(e) => nastavFiltr({ vekMin: e.target.value ? Number(e.target.value) : undefined })} />
                  <label>do</label>
                  <input type="number" min={16} max={40} placeholder="40" value={filtr.vekMax ?? ''} onChange={(e) => nastavFiltr({ vekMax: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="prestupy-filtr-skupina">
                  <label>Max. cena</label>
                  <input type="number" step={100000} placeholder="bez limitu" value={filtr.maxCena ?? ''} onChange={(e) => nastavFiltr({ maxCena: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="prestupy-filtr-skupina">
                  <label>Max. plat</label>
                  <input type="number" step={10000} placeholder="bez limitu" value={filtr.maxPlat ?? ''} onChange={(e) => nastavFiltr({ maxPlat: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="prestupy-filtr-skupina prestupy-filtr-checkboxy">
                  <label><input type="checkbox" checked={!!filtr.lepsiNezSlaby} onChange={(e) => nastavFiltr({ lepsiNezSlaby: e.target.checked || undefined })} /> Lepší než můj nejslabší na pozici</label>
                  <label><input type="checkbox" checked={!!filtr.jenZdravi} onChange={(e) => nastavFiltr({ jenZdravi: e.target.checked || undefined })} /> Jen zdraví hráči</label>
                </div>
              </div>
            )}

            {aktivniFiltry.length > 0 && (
              <div className="prestupy-filtry-aktivni">
                {aktivniFiltry.map((c) => (
                  <span key={c} className="filtr-chip">{c}</span>
                ))}
                <button type="button" className="tlacitko-mini sekundarni" onClick={vymazFiltry}>Vymazat vše</button>
              </div>
            )}
          </div>

          <div className="prestupy-layout">
            <div className="karta prestupy-seznam">
              <div className="prestupy-seznam-hlavicka">
                <b>{trh.length} hráčů</b>
                <span className="prestupy-strankovani-text">{stranka + 1} / {stranek}</span>
              </div>
              <div className="tabulka-scroll">
                <table className="trh-tabulka">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Hráč</th>
                      <th>Klub</th>
                      <th>OVR</th>
                      <th>Věk</th>
                      <th>Forma</th>
                      <th>Cena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strankaTrh.length === 0 ? (
                      <tr><td colSpan={7} className="prestupy-prazdny">Žádný hráč nevyhovuje filtrům — zkus uvolnit kritéria.</td></tr>
                    ) : strankaTrh.map((r) => (
                      <tr
                        key={r.hrac.id}
                        className={`klik ${vybrany?.hrac.id === r.hrac.id ? 'vybrany-radek' : ''}`}
                        onClick={() => vyber(r)}
                      >
                        <td><BadgePozice pozice={r.hrac.pozice} /></td>
                        <td><b>{r.hrac.prijmeni}</b> <span className="prestupy-jmeno-male">{r.hrac.jmeno}</span></td>
                        <td className="prestupy-klub-bunka">
                          <OdznakKlubu klubId={r.klubId} velikost={20} />
                          <span>{hra.tymy[r.klubId].nazev.replace(/^HC\s+/, '')}</span>
                        </td>
                        <td><b>{overall(r.hrac)}</b></td>
                        <td>{r.hrac.vek}</td>
                        <td><MiniBar hodnota={r.hrac.forma} popisek="F" /></td>
                        <td>{kc(hodnotaHrace(r.hrac))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="strankovani">
                <button className="tlacitko-mini sekundarni" disabled={stranka === 0} onClick={() => setStranka((s) => s - 1)}>← Předchozí</button>
                <button className="tlacitko-mini sekundarni" disabled={stranka >= stranek - 1} onClick={() => setStranka((s) => s + 1)}>Další →</button>
              </div>
            </div>

            <div className="prestupy-detail">
              {!detail ? (
                <div className="karta prestupy-prazdny-detail">
                  <p>← Vyber hráče z tabulky vlevo</p>
                  <p className="prestupy-napoveda">Tip: zkus šablonu „Mladý talent" nebo „Okamžitá posila" nahoře.</p>
                </div>
              ) : (
                <>
                  <div className="karta">
                    <div className="prestupy-detail-hlavicka">
                      <div>
                        <h3 style={{ margin: 0 }}>{detail.jmeno} {detail.prijmeni}</h3>
                        <p style={{ margin: '4px 0', color: 'var(--tlumeny)', fontSize: 13 }}>
                          {detail.vek} let · {roleHrace(detail) ?? 'Brankář'} · OVR <b>{overall(detail)}</b>
                        </p>
                      </div>
                      <OdznakKlubu klubId={vybrany!.klubId} velikost={36} />
                    </div>
                    <p style={{ fontSize: 13 }}>{hra.tymy[vybrany!.klubId].nazev}</p>
                    <div className="atributy-mrizka">
                      <div>Střelba <MiniBar hodnota={detail.atributy.strelba} /></div>
                      <div>Obrana <MiniBar hodnota={detail.atributy.obrana} /></div>
                      <div>Fyzička <MiniBar hodnota={detail.atributy.fyzicka} /></div>
                      <div>Chytání <MiniBar hodnota={detail.atributy.chytani} /></div>
                    </div>
                    <p>Hodnota: <b>{kc(hodnota)}</b>{detail.trzniCena ? <span style={{ color: 'var(--tlumeny)' }}> · trh {kc(detail.trzniCena)}</span> : null}</p>
                    {porovnani && (
                      <p className={overall(detail) > overall(porovnani) ? 'vyhra' : 'prohra'} style={{ fontSize: 13 }}>
                        vs. tvůj {porovnani.prijmeni} ({overall(porovnani)}): {overall(detail) > overall(porovnani) ? '▲ posílí tým' : '▼ slabší'}
                      </p>
                    )}
                    {report && (
                      <div className="skaut-report">
                        <h4>Skaut říká</h4>
                        <p>Potenciál: <b>{report.potencialOd}–{report.potencialDo}</b></p>
                        <p style={{ fontSize: 13, color: 'var(--tlumeny)' }}>{report.komentar}</p>
                        <p>{report.doporuceni}</p>
                      </div>
                    )}
                  </div>

                  <div className="karta prestupy-vyjednavani">
                    <h3>Koupě hráče</h3>
                    <p className="prestupy-napoveda">
                      Jedno tlačítko — hráč okamžitě přejde do tvého týmu. Cena závisí na jeho hodnotě a postavení v klubu.
                    </p>
                    <p>Cena: <b>{kc(cenaKoupe)}</b> <span style={{ color: 'var(--tlumeny)', fontSize: 13 }}>(tržní hodnota {kc(hodnota)})</span></p>
                    <div className={`rozpocet-varovani ${!rozpocetOk ? 'prohra' : 'vyhra'}`}>
                      Zůstatek po koupi: {kc(muj.rozpocet - cenaKoupe)}
                    </div>
                    <button className="tlacitko" disabled={!okno || !rozpocetOk} onClick={koupit}>
                      Koupit za {kc(cenaKoupe)}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

