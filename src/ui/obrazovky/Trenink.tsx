import { useState } from 'react'
import {
  dnyKalendare,
  doporucenyPlan,
  IKONY_TRENINKU,
  NAZEV_TRENINKU,
  normalizujTreninkovyPlan,
  potvrdTreninkovyPlan,
  previewTydne,
} from '../../core/trenink'
import type { GameState, TreninkDen } from '../../core/types'
import { EditorDne } from '../EditorDne'
import { ulozHru } from '../store'

export function Trenink({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const [plan, setPlan] = useState<Record<number, TreninkDen[]>>(() => normalizujTreninkovyPlan(hra.treninkovyTyden))
  const [vybranyDen, setVybranyDen] = useState<number | null>(null)
  const kalend = dnyKalendare(hra, 7)
  const preview = previewTydne(hra, plan)

  function uloz(s: GameState) {
    setHra(s)
    void ulozHru(0, s)
  }

  function seanceDne(den: number): TreninkDen[] {
    return plan[den] ?? []
  }

  function nastavSeanceDne(den: number, seance: TreninkDen[]) {
    const novy = { ...plan }
    if (seance.length === 0) delete novy[den]
    else novy[den] = seance
    setPlan(novy)
  }

  function potvrd() {
    uloz(potvrdTreninkovyPlan(hra, plan))
  }

  function doporuc() {
    setPlan(doporucenyPlan(hra))
  }

  return (
    <>
      <h2>Trénink — plán týdne</h2>
      <p style={{ color: 'var(--tlumeny)' }}>
        Naplánuj příštích 7 dní dopředu. Každý volný den pak potvrdíš na Přehledu — plán se předvyplní, ale můžeš ho změnit.
      </p>

      <div className="karta">
        <h3>Příštích 7 dní</h3>
        <div className="kalendar-prouzek trenink-plan">
          {kalend.map((d) => {
            const seance = seanceDne(d.den)
            const jeZapas = d.typ === 'zapas'
            return (
              <button
                key={d.den}
                type="button"
                className={`kalendar-den kalendar-${jeZapas ? 'zapas' : 'trenink'} ${vybranyDen === d.den ? 'vybrany' : ''}`}
                disabled={jeZapas}
                onClick={() => setVybranyDen(d.den)}
                title={jeZapas ? d.popis : seance.map((td) => NAZEV_TRENINKU(td.typ, td.intenzita)).join(', ') || 'Vyber den'}
              >
                <div className="kalendar-den-cislo">den {d.den}</div>
                <div className="kalendar-den-popis">
                  {jeZapas ? '⚔' : seance.length > 0 ? seance.map((td) => IKONY_TRENINKU[td.typ]).join('') : '—'}
                </div>
                <div className="kalendar-den-text">
                  {jeZapas
                    ? d.popis
                    : seance.length === 0
                      ? 'volno'
                      : seance.length === 1 && seance[0].typ === 'odpocinek'
                        ? 'odpočinek'
                        : `${seance.length}× aktivita`}
                </div>
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="button" className="tlacitko sekundarni" onClick={doporuc}>Doporučený plán</button>{' '}
          <button type="button" className="tlacitko" onClick={potvrd}>Potvrdit plán na příštích 7 dní</button>
        </div>
      </div>

      {vybranyDen !== null && (
        <div className="karta">
          <h3>Den {vybranyDen}</h3>
          <EditorDne
            hra={hra}
            den={vybranyDen}
            seance={seanceDne(vybranyDen)}
            onChange={(seance) => nastavSeanceDne(vybranyDen, seance)}
          />
        </div>
      )}

      <div className="karta">
        <h3>Preview celého plánu</h3>
        <p>
          Únava týmu: {preview.unavaPred} → <b>{preview.unavaPo}</b>
          {' · '}
          Náročnost: <b>{preview.narocnost}</b> / 8
        </p>
        {preview.rustPoDnech.length > 0 ? (
          <ul className="preview-tydne">
            {preview.rustPoDnech.map(({ den, polozky }) => (
              <li key={den} className={vybranyDen === den ? 'vybrany-den' : ''}>
                <b>Den {den}</b>
                <ul>
                  {polozky.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--tlumeny)', fontSize: 13 }}>Zatím nic naplánováno.</p>
        )}
        {preview.varovani.map((v, i) => (
          <p key={i} className={v.typ === 'varovani' ? 'prohra' : ''} style={{ fontSize: 13 }}>
            {v.text}
          </p>
        ))}
      </div>

      <div className="karta">
        <h3>Poslední trénink</h3>
        {!hra.posledniTrenink ? (
          <p style={{ color: 'var(--tlumeny)' }}>Zatím žádný.</p>
        ) : (
          <>
            <p>
              Den {hra.posledniTrenink.den} · <b>{NAZEV_TRENINKU(hra.posledniTrenink.zamereni)}</b>
            </p>
            {hra.posledniTrenink.zlepseni.length > 0 && (
              <ul>
                {hra.posledniTrenink.zlepseni.map((z, i) => (
                  <li key={i}>{z}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  )
}
