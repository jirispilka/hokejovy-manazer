import { useRef, useState } from 'react'
import { mesicniCashflow } from '../../core/finance'
import { formaTymu, kc } from '../../core/hodnoty'
import { predzapasovyBriefing, vyresKabinovku } from '../../core/kabinovka'
import { jeDerby, odmitniNabidky, prijmiNabidku, prumernyOverall } from '../../core/kariera'
import { odpovezNaOtazku } from '../../core/media'
import { prestupovyDeadlineBlizko } from '../../core/prestupy'
import { createRng, hashSeed } from '../../core/rng'
import { advanceDay, dalsiMujZapas, mojeLiga, zahajNovouSezonu } from '../../core/sezona'
import { dalsiDen, doplnSeanciProTym, IKONY_TRENINKU, NAZEV_TRENINKU, potrebujeVolbuDne, potvrdDen, prehledKondice } from '../../core/trenink'
import { spocitejTabulku } from '../../core/tabulka'
import type { GameState, TreninkDen } from '../../core/types'
import type { Obrazovka } from '../App'
import { EditorDne } from '../EditorDne'
import { barvaHodnoty, FormaTecky, OdznakKlubu, Ukazatel } from '../komponenty'
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
  if (hra.konecKariery) return <KonecKariery hra={hra} />
  if (hra.nabidky) return <Nabidky hra={hra} setHra={setHra} />
  return <PrehledObsah hra={hra} setHra={setHra} setObrazovka={setObrazovka} />
}

function PrehledObsah({
  hra,
  setHra,
  setObrazovka,
}: {
  hra: GameState
  setHra: (s: GameState) => void
  setObrazovka: (o: Obrazovka) => void
}) {
  const dalsiDenInfo = dalsiDen(hra)
  const [seanceDne, setSeanceDne] = useState<TreninkDen[]>(() => hra.treninkovyTyden?.[dalsiDenInfo.den] ?? [])
  const editorRef = useRef<HTMLDivElement>(null)

  const liga = mojeLiga(hra)
  const tabulka = spocitejTabulku(liga.tymy, liga.zapasy)
  const mojePozice = tabulka.findIndex((r) => r.tymId === hra.mujKlubId) + 1
  const dalsi = dalsiMujZapas(hra)
  const derbyPristi = dalsi ? jeDerby(dalsi.domaci, dalsi.hoste) : false
  const cashflow = mesicniCashflow(hra)
  const briefing = predzapasovyBriefing(hra)
  const deadline = prestupovyDeadlineBlizko(hra)
  const kondice = prehledKondice(hra)
  const volbaDne = potrebujeVolbuDne(hra)

  function uloz(s: GameState) {
    setHra(s)
    void ulozHru(0, s)
  }

  function pokracuj() {
    if (volbaDne) {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const s = advanceDay(hra)
    uloz(s)
    if (s.cekajiciZapas) setObrazovka('zapas')
  }

  function jitNaZapas() {
    const s = advanceDay(hra)
    uloz(s)
    setObrazovka('zapas')
  }

  function potvrdDenAPokracuj() {
    let s = potvrdDen(hra, dalsiDenInfo.den, doplnSeanciProTym(hra, seanceDne))
    s = advanceDay(s)
    uloz(s)
    if (s.cekajiciZapas) setObrazovka('zapas')
    else {
      const next = dalsiDen(s)
      setSeanceDne(s.treninkovyTyden?.[next.den] ?? [])
    }
  }

  function novaSezona() {
    uloz(zahajNovouSezonu(hra))
  }

  const typDneLabel =
    dalsiDenInfo.typ === 'zapas' ? 'zápas' : dalsiDenInfo.typ === 'po_zapase' ? 'den po zápase' : 'volný den'

  return (
    <>
      <h2>Přehled</h2>

      {deadline && (
        <div className="karta prestupy-banner">
          <b>🔥 Přestupový deadline za pár dní!</b> Trh je živější — sleduj nabídky v Přestupech.
        </div>
      )}

      {hra.kabinovaUdalost && (
        <div className="karta" style={{ borderColor: 'var(--zlata)' }}>
          <h3>📋 V kabině se něco děje</h3>
          <p>{hra.kabinovaUdalost.text}</p>
          {hra.kabinovaUdalost.moznosti.map((m, i) => (
            <button
              key={i}
              className="tlacitko sekundarni"
              style={{ marginRight: 8, marginBottom: 8 }}
              onClick={() => uloz(vyresKabinovku(hra, i))}
            >
              {m.text}
            </button>
          ))}
        </div>
      )}

      {hra.navrhSestavy && (
        <div className="karta" style={{ borderColor: 'var(--akcent)' }}>
          <h3>💡 Tip po zápase</h3>
          <p>{hra.navrhSestavy}</p>
          <button className="tlacitko sekundarni tlacitko-mini" onClick={() => setObrazovka('sestava')}>
            Upravit sestavu
          </button>
        </div>
      )}

      {hra.otazkaMedii && (
        <div className="karta" style={{ borderColor: 'var(--zlata)' }}>
          <h3>🎤 {hra.otazkaMedii.text}</h3>
          {hra.otazkaMedii.moznosti.map((m, i) => (
            <button
              key={i}
              className={`tlacitko ${m.riskantni ? 'nebezpecne' : 'sekundarni'}`}
              style={{ marginRight: 8, marginBottom: 8 }}
              onClick={() => uloz(odpovezNaOtazku(hra, i, createRng(hashSeed(hra.seed, hra.sezona, hra.den, 444))))}
            >
              {m.text}
              {m.riskantni && ' ⚡'}
            </button>
          ))}
        </div>
      )}

      <div className="karta karta-dalsi-den" id="dalsi-den" ref={editorRef}>
        <h3>
          Další den — den {dalsiDenInfo.den}{' '}
          <span className="pill">{typDneLabel}</span>
        </h3>
        {dalsiDenInfo.typ === 'zapas' ? (
          <>
            <p>{dalsiDenInfo.popis}</p>
            <p style={{ fontSize: 13, color: 'var(--tlumeny)' }}>Zápasový den — trénink se neplánuje.</p>
            {!hra.cekajiciZapas && (
              <button type="button" className="tlacitko puls" onClick={jitNaZapas}>
                Jít na zápas 🏒
              </button>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--tlumeny)', marginBottom: 12 }}>
              Rozhodni, co celý tým dnes dělá. Stačí vybrat aktivitu — hráče doplní hra. Podrobný plán (lajny, jednotliví hráči) upravíš v záložce Trénink.
            </p>
            <EditorDne hra={hra} den={dalsiDenInfo.den} seance={seanceDne} onChange={setSeanceDne} kompaktni />
            <button type="button" className="tlacitko puls" style={{ marginTop: 12 }} onClick={potvrdDenAPokracuj}>
              Potvrdit den a pokračovat ▶
            </button>
          </>
        )}
      </div>

      <div className="mrizka-3">
        <div className="karta">
          <h3>
            Další zápas{' '}
            {derbyPristi && <span className="pill pill-derby">DERBY</span>}
          </h3>
          {briefing ? (
            <>
              <p>
                <b>{briefing.souper}</b> ({briefing.pozice}. v tabulce)
                {briefing.derby && <span className="pill pill-derby"> DERBY</span>}
              </p>
              <p style={{ fontSize: 13, color: 'var(--tlumeny)' }}>
                Forma soupeře: {briefing.forma} · Nebezpečný střelec: {briefing.strelec}
              </p>
              <p style={{ fontSize: 13, fontStyle: 'italic' }}>Tip trenéra: „{briefing.tip}"</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="tlacitko sekundarni tlacitko-mini" onClick={() => setObrazovka('sestava')}>
                  Upravit taktiku
                </button>
                <button className="tlacitko puls" onClick={() => setObrazovka('zapas')}>
                  Jít na zápas 🏒
                </button>
              </div>
            </>
          ) : dalsi ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <OdznakKlubu klubId={dalsi.domaci} />
                <OdznakKlubu klubId={dalsi.hoste} />
                <div>
                  {hra.tymy[dalsi.domaci].nazev} – {hra.tymy[dalsi.hoste].nazev}
                  <div style={{ color: 'var(--tlumeny)', fontSize: 13 }}>den {dalsi.den}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: 'var(--tlumeny)' }}>forma:</span>
                <FormaTecky znaky={formaTymu(liga, dalsi.domaci)} />
                <span style={{ color: 'var(--tlumeny)' }}>vs</span>
                <FormaTecky znaky={formaTymu(liga, dalsi.hoste)} />
              </div>
              {hra.faze === 'konecSezony' ? (
                <>
                  {hra.vyhlaseni && (
                    <button className="tlacitko sekundarni" style={{ marginRight: 8 }} onClick={() => setObrazovka('vyhlaseni')}>
                      🏆 Vyhlášení sezóny
                    </button>
                  )}
                  <button className="tlacitko" onClick={novaSezona}>
                    Zahájit novou sezónu
                  </button>
                </>
              ) : hra.cekajiciZapas ? (
                <button className="tlacitko puls" onClick={() => setObrazovka('zapas')}>
                  Na zápas! 🏒
                </button>
              ) : (
                <button className="tlacitko" onClick={pokracuj}>
                  Pokračovat ▶
                </button>
              )}
            </>
          ) : (
            <p>{hra.faze === 'konecSezony' ? 'Sezóna skončila.' : 'Sezóna běží dál.'}</p>
          )}
        </div>

        <div className="karta">
          <h3>Finance</h3>
          <p style={{ marginBottom: 4 }}>
            Zůstatek:{' '}
            <b className={hra.tymy[hra.mujKlubId].rozpocet >= 0 ? 'vyhra' : 'prohra'}>
              {kc(hra.tymy[hra.mujKlubId].rozpocet)}
            </b>
          </p>
          <div className="zprava" style={{ fontSize: 13 }}>
            Měsíční cashflow (odhad):{' '}
            <span className={cashflow.bilance >= 0 ? 'vyhra' : 'prohra'}>
              {cashflow.bilance >= 0 ? '+' : ''}
              {kc(cashflow.bilance)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--tlumeny)' }}>
            {hra.sponzorNabidka ? 'sponzor čeká na smlouvu' : `+${kc(cashflow.sponzor)} sponzor`} · +{kc(cashflow.stadion)} stadion · +{kc(cashflow.marketing)} marketing · −
            {kc(cashflow.platy)} platy
          </div>
          <p style={{ fontSize: 12, color: 'var(--tlumeny)', marginBottom: 0 }}>
            Uzávěrka za {cashflow.dnuDoUzaverky} dní
          </p>
        </div>

        <div className="karta">
          <h3>Příběh týdne</h3>
          {hra.kabinovaUdalost && <p style={{ fontSize: 13 }}>📋 Kabina čeká na rozhodnutí</p>}
          {derbyPristi && <p style={{ fontSize: 13 }}>⚔ Tento týden derby!</p>}
          {!hra.kabinovaUdalost && !derbyPristi && (
            <p style={{ color: 'var(--tlumeny)', fontSize: 13 }}>Klidný týden — plánuj trénink a přestupy.</p>
          )}
          <Ukazatel hodnota={hra.trener.duvera} barva={barvaHodnoty(hra.trener.duvera)} popisek="Důvěra vedení" />
          <p style={{ color: 'var(--tlumeny)', fontSize: 13, marginBottom: 4 }}>{hra.cilSezony.popis}</p>
          <Ukazatel hodnota={hra.naladaFanousku} barva={barvaHodnoty(hra.naladaFanousku)} popisek="Nálada fanoušků" />
          <p style={{ marginBottom: 0, fontSize: 13 }}>
            {mojePozice}. místo · {liga.nazev}
          </p>
        </div>
      </div>

      <div className="karta prehled-kondice">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Kondice a trénink</h3>
          <button type="button" className="tlacitko sekundarni tlacitko-mini" onClick={() => setObrazovka('trenink')}>
            Upravit plán dopředu →
          </button>
        </div>

        <div className="prehled-kondice-statistiky">
          <div>
            <Ukazatel
              hodnota={kondice.unava}
              barva={kondice.unava >= 70 ? 'var(--prohra)' : kondice.unava >= 45 ? 'var(--zlata)' : 'var(--vyhra)'}
              popisek="Průměrná únava"
            />
            {kondice.dny.some((d) => d.den > hra.den && d.treninkPopis && d.typ !== 'zapas') && (
              <p style={{ fontSize: 12, color: 'var(--tlumeny)', marginTop: 4 }}>
                Po plánu: <b>{kondice.unavaPoPlanu} %</b>
                {kondice.unavaPoPlanu > kondice.unava ? ' ↑' : kondice.unavaPoPlanu < kondice.unava ? ' ↓' : ''}
              </p>
            )}
          </div>
          <div>
            <Ukazatel hodnota={kondice.forma} barva={barvaHodnoty(kondice.forma)} popisek="Průměrná forma" />
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'var(--tlumeny)', marginBottom: 4 }}>Náročnost týdne</p>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              {kondice.narocnost}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--tlumeny)' }}> / 100</span>
            </p>
          </div>
        </div>

        {kondice.nejviceUnaveni.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--tlumeny)', marginBottom: 12 }}>
            Nejvíc unavení:{' '}
            {kondice.nejviceUnaveni.map((h) => `${h.jmeno} (${h.unava} %)`).join(' · ')}
          </p>
        )}

        <div className="kalendar-prouzek prehled-kalendar">
          {kondice.dny.map((d) => {
            const seance = hra.treninkovyTyden?.[d.den] ?? []
            const jeDnes = d.den === hra.den
            const jeZapas = d.typ === 'zapas'
            return (
              <div
                key={d.den}
                className={`kalendar-den kalendar-${jeZapas ? 'zapas' : 'trenink'} ${jeDnes ? 'dnes' : ''}`}
                title={d.treninkPopis ?? d.popisZapasu ?? ''}
              >
                <div className="kalendar-den-cislo">
                  den {d.den}
                  {jeDnes && ' · dnes'}
                </div>
                <div className="kalendar-den-popis">
                  {jeZapas ? '⚔' : seance.length > 0 ? seance.map((td) => IKONY_TRENINKU[td.typ] ?? '•').join('') : '—'}
                </div>
                <div className="kalendar-den-text">
                  {jeZapas ? d.popisZapasu : d.treninkPopis ?? 'volno'}
                </div>
                {d.efektUnavy && (
                  <div className="kalendar-den-efekt">{d.efektUnavy}</div>
                )}
              </div>
            )
          })}
        </div>

        {kondice.odpocinek && (
          <div className="prehled-odpocinek">
            {kondice.odpocinek.vPlanu ? (
              <>
                😴 <b>Den {kondice.odpocinek.den}</b> — odpočinek v plánu: únava z {kondice.unava} % na{' '}
                <b>~{kondice.odpocinek.unavaPoOdpoinku} %</b> (+ forma)
              </>
            ) : (
              <>
                <b>Den {kondice.odpocinek.den}</b> je volný — únava sama klesne z {kondice.unava} % na{' '}
                <b>~{kondice.odpocinek.unavaPoVolny} %</b>.
                {kondice.odpocinek.unavaPoOdpoinku < kondice.odpocinek.unavaPoVolny && (
                  <>
                    {' '}
                    Odpočinek v plánu dá víc: ~{kondice.odpocinek.unavaPoOdpoinku} % (+ forma).
                  </>
                )}
              </>
            )}
          </div>
        )}

        {kondice.rust.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--tlumeny)', marginBottom: 6 }}>Očekávané zlepšení z plánu:</p>
            <ul className="prehled-rust">
              {kondice.rust.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {kondice.varovani.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {kondice.varovani.map((v, i) => (
              <p key={i} className={v.typ === 'varovani' ? 'prehled-varovani' : 'prehled-info'} style={{ fontSize: 13, margin: '4px 0' }}>
                {v.typ === 'varovani' ? '⚠️' : 'ℹ️'} {v.text}
              </p>
            ))}
          </div>
        )}

        {kondice.posledniTrenink && kondice.posledniTrenink.den >= hra.den - 3 && (
          <p style={{ fontSize: 13, color: 'var(--tlumeny)', marginTop: 12, marginBottom: 0 }}>
            Poslední trénink (den {kondice.posledniTrenink.den}):{' '}
            {NAZEV_TRENINKU(kondice.posledniTrenink.zamereni)}
            {kondice.posledniTrenink.zlepseni.length > 0 && ` — ${kondice.posledniTrenink.zlepseni.join(', ')}`}
          </p>
        )}
      </div>

      <div className="mrizka">
        <div className="karta">
          <h3>{liga.nazev}</h3>
          <table>
            <tbody>
              {tabulka.map((r, i) => (
                <tr key={r.tymId} className={r.tymId === hra.mujKlubId ? 'muj' : ''}>
                  <td>{i + 1}.</td>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <OdznakKlubu klubId={r.tymId} velikost={22} />
                    {hra.tymy[r.tymId].nazev}
                  </td>
                  <td>
                    <b>{r.body} b.</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="karta">
          <h3>Zprávy</h3>
          {hra.zpravy.slice(0, 12).map((z, i) => (
            <div key={i} className="zprava">
              {z}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function Nabidky({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  return (
    <>
      <h2>📰 Odvolán!</h2>
      <p>Vedení s tebou ztratilo trpělivost. Zájem o tebe ale mají jinde:</p>
      <div className="mrizka-3">
        {hra.nabidky!.map((id) => (
          <div key={id} className="karta" style={{ textAlign: 'center' }}>
            <OdznakKlubu klubId={id} velikost={48} />
            <h3>{hra.tymy[id].nazev}</h3>
            <p style={{ color: 'var(--tlumeny)' }}>
              {hra.ligy.find((l) => l.tymy.includes(id))!.nazev} · síla {Math.round(prumernyOverall(hra, id))}
            </p>
            <button
              className="tlacitko"
              onClick={() => {
                const s = prijmiNabidku(hra, id)
                setHra(s)
                void ulozHru(0, s)
              }}
            >
              Převzít klub
            </button>
          </div>
        ))}
      </div>
      <button
        className="tlacitko nebezpecne"
        onClick={() => {
          const s = odmitniNabidky(hra)
          setHra(s)
          void ulozHru(0, s)
        }}
      >
        Odmítnout vše a ukončit kariéru
      </button>
    </>
  )
}

function KonecKariery({ hra }: { hra: GameState }) {
  const k = hra.trener.kariera
  return (
    <>
      <h2>Konec kariéry</h2>
      <div className="karta">
        <p>
          Zápasů: <b>{k.zapasy}</b> · Výher: <b>{k.vyhry}</b> · Sezón: <b>{k.sezony}</b> · Vyhazovů:{' '}
          <b>{k.vyhazovy}</b>
        </p>
        <p>Trofeje: {k.trofeje.length > 0 ? k.trofeje.join(' · ') : 'žádné'}</p>
        <button className="tlacitko" onClick={() => location.reload()}>
          Nová hra
        </button>
      </div>
    </>
  )
}
