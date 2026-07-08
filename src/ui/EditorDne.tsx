import { useState } from 'react'
import {
  BEZ_INTENZITY,
  doplnHraciDoSeanci,
  doplnSeanciProTym,
  IKONY_TRENINKU,
  jeKondiceTyp,
  jeLedovyTyp,
  NAZEV_TRENINKU,
  NAZVY_UI_TRENINKU,
  potrebujeHrace,
  previewDne,
  TYPY_AKTIVIT,
} from '../core/trenink'
import { overall } from '../core/sestava'
import { POPISY_LAJEN } from '../core/lajny'
import { kc } from '../core/hodnoty'
import type { GameState, TreninkDen, TreninkIntenzita, TreninkTyp } from '../core/types'

export function EditorDne({
  hra,
  den,
  seance: seanceProp,
  onChange,
  kompaktni = false,
}: {
  hra: GameState
  den: number
  seance: TreninkDen[]
  onChange: (seance: TreninkDen[]) => void
  kompaktni?: boolean
}) {
  const muj = hra.tymy[hra.mujKlubId]
  const [novyTyp, setNovyTyp] = useState<TreninkTyp>('strelba')
  const [novyIntenzita, setNovyIntenzita] = useState<TreninkIntenzita>('tezka')
  const [novyLajna, setNovyLajna] = useState(0)
  const [vyberHraci, setVyberHraci] = useState<string[]>([])

  const seanceZobrazeni = kompaktni ? doplnSeanciProTym(hra, seanceProp) : seanceProp
  const preview = previewDne(hra, den, seanceZobrazeni)
  const podleId = new Map(muj.hraci.map((h) => [h.id, h]))
  const hraciVolba = muj.hraci
    .filter((h) => h.pozice !== 'G')
    .sort((a, b) => {
      const aMuze = overall(a) < a.potencial ? 0 : 1
      const bMuze = overall(b) < b.potencial ? 0 : 1
      if (aMuze !== bMuze) return aMuze - bMuze
      return b.potencial - overall(b) - (a.potencial - overall(a))
    })

  function popisSeance(td: TreninkDen): string {
    const zaklad = NAZEV_TRENINKU(td.typ, td.intenzita)
    if (kompaktni) return zaklad
    if (jeKondiceTyp(td.typ) && td.hraci?.[0]) {
      return `${zaklad} — ${podleId.get(td.hraci[0])?.prijmeni ?? '?'}`
    }
    if (jeLedovyTyp(td.typ) && td.hraci?.length) {
      const jmena = td.hraci.map((id) => podleId.get(id)?.prijmeni ?? '?').join(', ')
      return `${zaklad} — ${jmena}${td.hraci.length < 2 ? ' (chybí hráč)' : ''}`
    }
    if ((td.typ === 'taktika' || td.typ === 'parta') && td.lajna !== undefined) {
      return `${zaklad} — ${POPISY_LAJEN[td.lajna] ?? `${td.lajna + 1}. lajna`}`
    }
    return zaklad
  }

  function pridejSeanci() {
    const td: TreninkDen = { typ: novyTyp }
    if (!BEZ_INTENZITY.includes(novyTyp)) td.intenzita = novyIntenzita
    if (!kompaktni) {
      if (jeLedovyTyp(novyTyp) && vyberHraci.length >= 2) td.hraci = vyberHraci.slice(0, 2)
      if (jeKondiceTyp(novyTyp) && vyberHraci.length >= 1) td.hraci = [vyberHraci[0]]
      if (novyTyp === 'taktika' || novyTyp === 'parta') td.lajna = novyLajna
    }
    let novy = [...seanceProp, td]
    if (kompaktni) {
      novy = doplnSeanciProTym(hra, novy)
    } else if ((jeLedovyTyp(novyTyp) || jeKondiceTyp(novyTyp)) && vyberHraci.length > 0) {
      novy = doplnHraciDoSeanci({ [den]: novy }, den, vyberHraci)[den] ?? novy
    }
    onChange(novy)
  }

  function odeberSeanci(index: number) {
    const novy = [...seanceProp]
    novy.splice(index, 1)
    onChange(novy)
  }

  const potreba = potrebujeHrace(novyTyp)
  const bezIntenzity = BEZ_INTENZITY.includes(novyTyp)

  return (
    <div className={`editor-dne ${kompaktni ? 'editor-dne-kompaktni' : ''}`}>
      {seanceProp.length === 0 ? (
        <p style={{ color: 'var(--tlumeny)', fontSize: 13 }}>Zatím nic naplánováno — přidej aktivitu níže.</p>
      ) : (
        <ul className="seznam-seanci">
          {seanceProp.map((td, i) => (
            <li key={i}>
              {IKONY_TRENINKU[td.typ]} {popisSeance(td)}
              <button type="button" className="tlacitko-mini sekundarni" style={{ marginLeft: 8 }} onClick={() => odeberSeanci(i)}>
                Odebrat
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="filtry-radek" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
        <select value={novyTyp} onChange={(e) => setNovyTyp(e.target.value as TreninkTyp)}>
          {TYPY_AKTIVIT.map((t) => (
            <option key={t} value={t}>
              {IKONY_TRENINKU[t]} {NAZVY_UI_TRENINKU[t]}
            </option>
          ))}
        </select>
        {!bezIntenzity && (
          <select value={novyIntenzita} onChange={(e) => setNovyIntenzita(e.target.value as TreninkIntenzita)}>
            <option value="lehka">Lehký</option>
            <option value="tezka">Těžký</option>
          </select>
        )}
        {potreba === 'lajna' && !kompaktni && (
          <select value={novyLajna} onChange={(e) => setNovyLajna(Number(e.target.value))}>
            {POPISY_LAJEN.map((popis, i) => (
              <option key={i} value={i}>{popis}</option>
            ))}
          </select>
        )}
        <button type="button" className="tlacitko sekundarni" onClick={pridejSeanci}>
          + Přidat
        </button>
      </div>

      {kompaktni && (potreba === 'dva' || potreba === 'jeden' || potreba === 'lajna') && (
        <p style={{ fontSize: 12, color: 'var(--tlumeny)', marginTop: 8, marginBottom: 0 }}>
          Hráče a lajny doplní hra automaticky — stačí vybrat typ aktivity.
        </p>
      )}

      {!kompaktni && (potreba === 'dva' || potreba === 'jeden') && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--tlumeny)', marginBottom: 6 }}>
            {potreba === 'dva' ? 'Vyber 2 hráče na led' : 'Vyber 1 hráče do kondice'}
          </p>
          <div className="vyber-hracu-trenink">
            {hraciVolba.map((h) => {
              const muzeRust = overall(h) < h.potencial
              return (
                <button
                  key={h.id}
                  type="button"
                  className={`tlacitko-mini sekundarni ${vyberHraci.includes(h.id) ? 'vybrany' : ''} ${!muzeRust ? 'trenink-strop' : ''}`}
                  onClick={() => {
                    const next = vyberHraci.includes(h.id)
                      ? vyberHraci.filter((x) => x !== h.id)
                      : [...vyberHraci, h.id]
                    setVyberHraci(next)
                    onChange(doplnHraciDoSeanci({ [den]: seanceProp }, den, next)[den] ?? seanceProp)
                  }}
                >
                  {h.prijmeni} ({overall(h)})
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="preview-dne karta-vnorena">
        <h4 style={{ marginTop: 0 }}>Náhled dne {den}</h4>
        <div className="preview-dne-metriky">
          <span>Únava: {preview.unavaPred} → <b>{preview.unavaPo}</b></span>
          <span>Forma: {preview.formaPred} → <b>{preview.formaPo}</b></span>
          <span>Morálka: {preview.moralkaPred} → <b>{preview.moralkaPo}</b></span>
          {preview.rozpoctPo !== preview.rozpoctPred && (
            <span>Rozpočet: +{kc(preview.rozpoctPo - preview.rozpoctPred)}</span>
          )}
          {preview.naladaPo !== preview.naladaPred && (
            <span>Nálada: {preview.naladaPred} → <b>{preview.naladaPo}</b></span>
          )}
          <span>Náročnost: <b>{preview.narocnost}</b>/8</span>
        </div>
        {preview.rust.length > 0 && (
          <ul className="preview-tydne" style={{ fontSize: 13 }}>
            {preview.rust.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
        {preview.varovani.map((v, i) => (
          <p key={i} className={v.typ === 'varovani' ? 'prohra' : ''} style={{ fontSize: 13, margin: '4px 0' }}>
            {v.text}
          </p>
        ))}
      </div>
    </div>
  )
}
