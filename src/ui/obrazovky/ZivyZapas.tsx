import { useEffect, useRef, useState } from 'react'
import { formaTymu } from '../../core/hodnoty'
import { prumernyOverall } from '../../core/kariera'
import { createRng, hashSeed, type Rng } from '../../core/rng'
import { spojeneLajny } from '../../core/lajny'
import { celkovaChemie, jeZdravy, overall, ovrLajny, souhrnSestavy } from '../../core/sestava'
import { atmosferaZapasu, dokonciZapas, mojeLiga } from '../../core/sezona'
import type { GameState, Taktika, Tym } from '../../core/types'
import {
  aplikujProslov,
  autoNahrada,
  energiePetky,
  energieUtokLajny,
  nahradZraneneho,
  odvolejBrankare,
  pokracujPoPauze,
  popisPetky,
  potvrdKlicovyMoment,
  potvrdPresilovku,
  pouzijTimeout,
  pouzijZetonTrenera,
  predikceUtoku,
  bonusMinihryZKvality,
  segmentyKostky,
  silaStran,
  simulujDoKonce,
  simulujMinutu,
  vsechnyPetky,
  zacniZapas,
  zmenTaktiku,
  zmenVytizeniUtoku,
  hraciPetky,
  jePetkaKompletni,
  pocetZdravychVPetce,
  type Petka,
  type StavZapasu,
  type VolbaKlicovehoMomentu,
} from '../../core/zapas'
import { FormaTecky, MiniBar, MomentumGraf, OdznakKlubu, PanelTaktiky } from '../komponenty'
import { MinihraStrelba } from '../MinihraStrelba'
import { PanelVytizeniUtoku } from '../PanelVytizeni'
import { SpojenaLajna } from '../SpojenaLajna'
import { ulozHru } from '../store'

const HLASKY_SOUPERE = [
  'Dnes si odvezete debakl!',
  'Na váš led se nebojíme.',
  'Body zůstanou u nás, uvidíte.',
  'Vaše obrana je děravá jak cedník.',
  'Přijeli jsme si pro tři body.',
]

const vyhralJsem = (stav: StavZapasu, moje: 'domaci' | 'hoste') =>
  moje === 'domaci' ? stav.domaci.goly > stav.hoste.goly : stav.hoste.goly > stav.domaci.goly

export function ZivyZapas({
  hra,
  setHra,
  poZapase,
}: {
  hra: GameState
  setHra: (s: GameState) => void
  poZapase: (po: GameState) => void
}) {
  const cz = hra.cekajiciZapas!
  const domaci = hra.tymy[cz.domaci]
  const hoste = hra.tymy[cz.hoste]
  const mujDomaci = cz.domaci === hra.mujKlubId
  const mojeStrana: 'domaci' | 'hoste' = mujDomaci ? 'domaci' : 'hoste'
  const mujTym = mujDomaci ? domaci : hoste

  const rngRef = useRef<Rng | null>(null)
  const [stav, setStav] = useState<StavZapasu | null>(null)
  const [rychlost, setRychlost] = useState(1) // 0 | 1 | 4
  const [proslovVyuzit, setProslovVyuzit] = useState(false)
  const [minihraKvalita, setMinihraKvalita] = useState<number | null>(null)

  const rng = () => rngRef.current!
  const novyRng = () => createRng(hashSeed(hra.seed, hra.sezona, hra.den, 777))
  const moznosti = { derby: cz.derby, atmosfera: mujDomaci ? atmosferaZapasu(hra) : 0 }

  useEffect(() => {
    if (!stav?.cekaNaKlicovyMoment) setMinihraKvalita(null)
  }, [stav?.cekaNaKlicovyMoment?.strelecId, stav?.cekaNaKlicovyMoment?.pGol])

  // tikání minut + automatická náhrada zraněného soupeře (i v pauze — jinak by pauza uvízla)
  useEffect(() => {
    if (!stav) return
    if (stav.cekaNaPresilovku || stav.cekaNaKlicovyMoment) {
      setRychlost(0)
      return
    }
    if (stav.cekaNaNahradu) {
      if (stav.cekaNaNahradu.strana !== mojeStrana) {
        setStav(autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? domaci : hoste))
      }
      return // moje zranění čeká na modal
    }
    if (stav.faze !== 'hraje' || rychlost === 0) return
    const id = setTimeout(
      () => setStav(simulujMinutu(stav, domaci, hoste, rng(), { hracuvKlubId: hra.mujKlubId })),
      1300 / rychlost,
    )
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stav, rychlost])

  // auto-pauza — default po 10 s
  useEffect(() => {
    if (!stav?.cekaNaPresilovku && !stav?.cekaNaKlicovyMoment) return
    const id = setTimeout(() => {
      setStav((s) => {
        if (!s) return s
        if (s.cekaNaPresilovku) {
          const info = s.cekaNaPresilovku
          return potvrdPresilovku(
            s,
            info.typ === 'pp'
              ? { petka: { index: 0 } }
              : { petka: { index: 3 }, pkAgresivni: false },
          )
        }
        if (s.cekaNaKlicovyMoment) return potvrdKlicovyMoment(s, 'nechat', domaci, hoste, rng())
        return s
      })
      setRychlost(1)
    }, 10_000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stav?.cekaNaPresilovku, stav?.cekaNaKlicovyMoment])

  // nová pauza → proslov je zase k dispozici
  useEffect(() => {
    if (stav?.faze === 'pauza1' || stav?.faze === 'pauza2') setProslovVyuzit(false)
  }, [stav?.faze])

  function zacni() {
    rngRef.current = novyRng()
    setStav(zacniZapas(domaci, hoste, moznosti))
    setRychlost(1)
  }

  function odsimulujCely() {
    const r = novyRng()
    const konec = simulujDoKonce(zacniZapas(domaci, hoste, moznosti), domaci, hoste, r)
    const po = dokonciZapas(hra, konec)
    setHra(po)
    void ulozHru(0, po)
    poZapase(po)
  }

  function prehrajTretinu() {
    if (!stav) return
    let s = stav
    while (s.faze === 'hraje') {
      if (s.cekaNaNahradu) {
        if (s.cekaNaNahradu.strana === mojeStrana) break
        s = autoNahrada(s, s.cekaNaNahradu.strana === 'domaci' ? domaci : hoste)
      } else {
        s = simulujMinutu(s, domaci, hoste, rng(), { hracuvKlubId: hra.mujKlubId })
      }
    }
    setStav(s)
  }

  function dokonci() {
    if (!stav) return
    const po = dokonciZapas(hra, stav)
    setHra(po)
    void ulozHru(0, po)
    poZapase(po)
  }

  function nastavTaktiku(id: Taktika) {
    if (stav && (stav.faze === 'hraje' || stav.faze === 'pauza1' || stav.faze === 'pauza2')) {
      setStav(zmenTaktiku(stav, mojeStrana, id))
    }
    setHra({
      ...hra,
      tymy: { ...hra.tymy, [hra.mujKlubId]: { ...hra.tymy[hra.mujKlubId], taktika: id } },
    })
  }

  // ---------- před zápasem (nav zůstává — jde upravit sestavu) ----------
  if (!stav) {
    const souper = mujDomaci ? hoste : domaci
    const hlaska = HLASKY_SOUPERE[hashSeed(hra.seed, hra.den) % HLASKY_SOUPERE.length]
    const liga = mojeLiga(hra)
    const mojeForma = formaTymu(liga, hra.mujKlubId)
    const jehoForma = formaTymu(liga, souper.klubId)
    const mujSouhrn = souhrnSestavy(mujTym)
    const souperSouhrn = souhrnSestavy(souper)
    const mujPrumerSoupisky = Math.round(prumernyOverall(hra, hra.mujKlubId))
    const souperPrumerSoupisky = Math.round(prumernyOverall(hra, souper.klubId))
    return (
      <>
        <h2>
          {cz.derby && (
            <span className="pill pill-derby" style={{ marginRight: 8 }}>
              DERBY
            </span>
          )}
          Před zápasem
        </h2>
        <div className="karta" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <OdznakKlubu klubId={cz.domaci} velikost={56} />
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {domaci.nazev} — {hoste.nazev}
          </div>
          <OdznakKlubu klubId={cz.hoste} velikost={56} />
        </div>
        <div className="mrizka">
          <div className="karta">
            <h3>Srovnání</h3>
            <table>
              <tbody>
                <tr>
                  <td>{mujTym.nazev}</td>
                  <td></td>
                  <td>{souper.nazev}</td>
                </tr>
                <tr>
                  <td>
                    <b>{mujSouhrn.silaCelkem}</b>
                  </td>
                  <td style={{ color: 'var(--tlumeny)' }}>síla sestavy</td>
                  <td>
                    <b>{souperSouhrn.silaCelkem}</b>
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>{mujSouhrn.prumerOvr}</b>
                  </td>
                  <td style={{ color: 'var(--tlumeny)' }}>průměr OVR (sestava)</td>
                  <td>
                    <b>{souperSouhrn.prumerOvr}</b>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style={{ color: 'var(--tlumeny)', fontSize: 12 }}>{mujPrumerSoupisky} celá soupiska</span>
                  </td>
                  <td style={{ color: 'var(--tlumeny)', fontSize: 12 }}>průměr OVR</td>
                  <td>
                    <span style={{ color: 'var(--tlumeny)', fontSize: 12 }}>{souperPrumerSoupisky} celá soupiska</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <FormaTecky znaky={mojeForma} />
                  </td>
                  <td style={{ color: 'var(--tlumeny)' }}>forma</td>
                  <td>
                    <FormaTecky znaky={jehoForma} />
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>{celkovaChemie(mujTym)}</b>
                  </td>
                  <td style={{ color: 'var(--tlumeny)' }}>chemie</td>
                  <td>
                    <b>{celkovaChemie(souper)}</b>
                  </td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: 12, color: 'var(--tlumeny)', marginBottom: 8 }}>
              Síla sestavy ({mujSouhrn.silaCelkem}) = součet útoku, obrany a brankáře z tvé sestavy včetně formy, únavy a chemie.
              OVR jednoho hráče je vždy 1–99 — na Soupisce u každého jména.
            </p>
            <p style={{ marginBottom: 0 }}>
              „{hlaska}" <span style={{ color: 'var(--tlumeny)' }}>— trenér {souper.nazev}</span>
            </p>
          </div>
          <div className="karta">
            <PanelTaktiky taktika={mujTym.taktika} onZmena={nastavTaktiku} nadpis="Tvoje taktika" />
            <p style={{ color: 'var(--tlumeny)', marginTop: 10, marginBottom: 0 }}>
              Sestavu uprav na záložce Sestava a vrať se sem. Během zápasu můžeš taktiku kdykoliv přepnout.
            </p>
          </div>
        </div>
        <button className="tlacitko" onClick={zacni}>
          Začít zápas 🏒
        </button>{' '}
        <button className="tlacitko sekundarni" onClick={odsimulujCely}>
          Odsimulovat celý zápas
        </button>
      </>
    )
  }

  // ---------- živý zápas ----------
  const tretina = stav.minuta <= 20 ? 1 : stav.minuta <= 40 ? 2 : 3
  const posledniUdalosti = [...stav.udalosti].slice(-12).reverse()
  const cekaNaMne = stav.cekaNaNahradu?.strana === mojeStrana
  const cekaPresilovka = stav.cekaNaPresilovku?.strana === mojeStrana ? stav.cekaNaPresilovku : null
  const km = stav.cekaNaKlicovyMoment
  const cekaKlicovy =
    km &&
    (km.utocnik === mojeStrana || km.obrance === mojeStrana)
      ? km
      : null
  const sila = silaStran(stav, domaci, hoste)
  const mojeSila = sila[mojeStrana]
  const souperSila = sila[mojeStrana === 'domaci' ? 'hoste' : 'domaci']
  const jaVedu = vyhralJsem(stav, mojeStrana)
  const zetony = stav[mojeStrana].zbyvajiciZetony
  const cekaZeton = stav[mojeStrana].bonusDalsiSance > 0
  const bonusCekajici = stav[mojeStrana].bonusDalsiSance

  const predikce = predikceUtoku(mojeSila.utok, souperSila.utok, souperSila.obrana, souperSila.brankar, 75, stav.momentum)

  function potvrdKm(volba: VolbaKlicovehoMomentu) {
    if (!stav?.cekaNaKlicovyMoment) return
    const bonus = minihraKvalita !== null ? bonusMinihryZKvality(minihraKvalita) : 0
    setStav(potvrdKlicovyMoment(stav, volba, domaci, hoste, rng(), bonus))
    setMinihraKvalita(null)
    setRychlost(1)
  }

  return (
    <div className="zapas-overlay">
      <div className="karta" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
          <OdznakKlubu klubId={cz.domaci} velikost={52} />
          <div>
            <div className="skore">
              {stav.domaci.goly} : {stav.hoste.goly}
            </div>
            <div style={{ color: 'var(--tlumeny)' }}>
              {stav.faze === 'konec'
                ? 'Konec zápasu'
                : stav.minuta > 60
                  ? `Prodloužení · ${stav.minuta}. min`
                  : `${tretina}. třetina · ${stav.minuta}. min`}
              {cz.derby && (
                <>
                  {' '}
                  · <span className="pill pill-derby">DERBY</span>
                </>
              )}
            </div>
            <div style={{ color: 'var(--tlumeny)', fontSize: 13 }}>
              Střely {stav.domaci.strely} : {stav.hoste.strely}
            </div>
          </div>
          <OdznakKlubu klubId={cz.hoste} velikost={52} />
        </div>
        <MomentumGraf momentum={stav.momentum} domaci={domaci.nazev} hoste={hoste.nazev} />
        <div className="zapas-sila-panel">
          <span>Útok <b>{Math.round(mojeSila.utok)}</b> vs {Math.round(souperSila.utok)}</span>
          <span>Obrana <b>{Math.round(mojeSila.obrana)}</b> vs {Math.round(souperSila.obrana)}</span>
          <span>Chemie <b>{celkovaChemie(mujTym)}</b></span>
          <span style={{ fontSize: 13, color: 'var(--akcent)' }}>
            Při našem útoku: ~{Math.round(predikce.pUtok * 100)} % šance na akci, ~{Math.round(predikce.pNebezpeci * 100)} % nebezpečná, ~{Math.round(predikce.pGolPrumer * 100)} % gól ze střely
          </span>
          <span>Žetony trenéra: {'●'.repeat(zetony)}{'○'.repeat(Math.max(0, 3 - zetony))}{cekaZeton ? ' · 🔥 čeká bonus' : ''}</span>
        </div>
      </div>

      {cekaPresilovka && (
        <ModalPresilovky
          stav={stav}
          setStav={setStav}
          setRychlost={setRychlost}
          typ={cekaPresilovka.typ}
          mojeStrana={mojeStrana}
          mujTym={mujTym}
          souperStrana={mojeStrana === 'domaci' ? 'hoste' : 'domaci'}
        />
      )}

      {cekaKlicovy && (() => {
        const utociJa = cekaKlicovy.utocnik === mojeStrana
        const sanceZaklad = cekaKlicovy.pGol
        const minihraBonus = minihraKvalita !== null ? bonusMinihryZKvality(minihraKvalita) : 0
        const sanceEfekt =
          utociJa && bonusCekajici > 0
            ? Math.min(75, Math.round((sanceZaklad + bonusCekajici + minihraBonus) * 100))
            : Math.round((sanceZaklad + minihraBonus) * 100)
        const kostkaBonus = utociJa && (bonusCekajici > 0 || zetony > 0)
        const cekaMinihru = utociJa && hra.nastaveni.minihryZapnuto && minihraKvalita === null
        return (
        <div className="modal-trener karta modal-klicovy">
          <h3>
            {utociJa
              ? `🔥 Klíčový moment — ${sanceEfekt} % gól${bonusCekajici > 0 ? ' (vč. žetonu)' : ''}${minihraBonus ? ` (minihra ${minihraBonus > 0 ? '+' : ''}${Math.round(minihraBonus * 100)} %)` : ''}`
              : `⚠️ Soupeř útočí — ${Math.round(sanceZaklad * 100)} % gól`}
          </h3>
          {cekaMinihru ? (
            <MinihraStrelba onHotovo={(k) => setMinihraKvalita(k)} />
          ) : (
            <>
          <p>
            🎲 Kostka: {segmentyKostky(sanceZaklad + (utociJa ? bonusCekajici : 0), kostkaBonus && zetony > 0)}/6 dobrých výsledků
            {utociJa && zetony > 0 && ' · Zapálit přidá +1 segment a +15 %'}
            {utociJa && bonusCekajici > 0 && ' · Čeká bonus z žetonu'}
          </p>
          <div className="modal-tlacitka">
            {utociJa ? (
              <>
                <button className="tlacitko" disabled={zetony <= 0} onClick={() => potvrdKm('zapalit')}>
                  🔥 Zapálit ({zetony} žeton{zetony === 1 ? '' : 'y'})
                </button>
                <button className="tlacitko sekundarni" onClick={() => potvrdKm('bezpecne')}>
                  Hrát bezpečně
                </button>
                <button className="tlacitko sekundarni" onClick={() => potvrdKm('nechat')}>
                  ▶ Nechat běžet
                </button>
              </>
            ) : (
              <>
                <button className="tlacitko" disabled={zetony <= 0} onClick={() => potvrdKm('timeout')}>
                  ⏱ Time-out ({zetony} žeton{zetony === 1 ? '' : 'y'})
                </button>
                <button className="tlacitko sekundarni" onClick={() => potvrdKm('beton')}>
                  Beton
                </button>
                <button className="tlacitko sekundarni" onClick={() => potvrdKm('nechat')}>
                  ▶ Nechat běžet
                </button>
              </>
            )}
          </div>
            </>
          )}
        </div>
        )
      })()}

      {(stav.faze === 'hraje' || stav.faze === 'pauza1' || stav.faze === 'pauza2') && !cekaNaMne && !cekaPresilovka && !cekaKlicovy && (
        <div className="karta">
          <PanelTaktiky
            taktika={stav[mojeStrana].taktika}
            onZmena={nastavTaktiku}
            nadpis={stav.faze === 'hraje' ? `Taktika · ${tretina}. třetina` : 'Taktika na další třetinu'}
            vPrubehu={stav.faze === 'hraje'}
          />
        </div>
      )}

      {stav.faze === 'hraje' && !cekaNaMne && !cekaPresilovka && !cekaKlicovy && (
        <div className="karta" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`tlacitko ${rychlost === 0 ? '' : 'sekundarni'}`} onClick={() => setRychlost(0)}>
            ⏸
          </button>
          <button className={`tlacitko ${rychlost === 1 ? '' : 'sekundarni'}`} onClick={() => setRychlost(1)}>
            ▶ 1×
          </button>
          <button className={`tlacitko ${rychlost === 4 ? '' : 'sekundarni'}`} onClick={() => setRychlost(4)}>
            ⏩ 4×
          </button>
          <button className="tlacitko sekundarni" onClick={prehrajTretinu}>
            Přeskočit třetinu
          </button>
          <button className="tlacitko sekundarni" onClick={() => setStav(simulujDoKonce(stav, domaci, hoste, rng()))}>
            Odsimulovat zbytek
          </button>
          <span style={{ flex: 1 }} />
          <button
            className="tlacitko sekundarni"
            disabled={zetony <= 0 || cekaZeton}
            title="Spálí 1 žeton — příští střelecká šance +15 %"
            onClick={() => {
              try {
                setStav(pouzijZetonTrenera(stav, mojeStrana))
              } catch (e) {
                console.error(e)
              }
            }}
          >
            🔥 Žeton (+15 %)
          </button>
          <button
            className="tlacitko sekundarni"
            disabled={stav[mojeStrana].timeoutPouzit}
            title="1× za zápas zdarma — neplést se žetony v klíčovém momentu"
            onClick={() => setStav(pouzijTimeout(stav, mojeStrana))}
          >
            ⏱ Time-out (1× za zápas)
          </button>
          <button
            className={`tlacitko ${stav[mojeStrana].odvolanyBrankar ? 'nebezpecne' : 'sekundarni'}`}
            onClick={() => setStav(odvolejBrankare(stav, mojeStrana, !stav[mojeStrana].odvolanyBrankar))}
          >
            {stav[mojeStrana].odvolanyBrankar ? '🥅 Vrátit brankáře' : '⚠️ Odvolat brankáře'}
          </button>
        </div>
      )}

      {(stav.faze === 'pauza1' || stav.faze === 'pauza2') && (
        <div className="karta">
          <h3>Přestávka — kabina čeká na trenéra</h3>
          <PanelVytizeniUtoku
            vytizeni={stav[mojeStrana].vytizeniUtoku}
            onZmena={(index, delta) => {
              const novy = zmenVytizeniUtoku(stav, mojeStrana, index, delta)
              setStav(novy)
              setHra({
                ...hra,
                tymy: {
                  ...hra.tymy,
                  [hra.mujKlubId]: {
                    ...hra.tymy[hra.mujKlubId],
                    vytizeniUtoku: [...novy[mojeStrana].vytizeniUtoku] as [number, number, number, number],
                  },
                },
              })
            }}
          />
          <h4 style={{ marginTop: 16 }}>Tvoje lajny</h4>
          <div className="soupiska-lajny-grid">
            {spojeneLajny(stav[mojeStrana].sestava).map((l) => {
              const obrIdx = Math.min(l.index, 2)
              const ovr = ovrLajny({
                ...mujTym,
                sestava: stav[mojeStrana].sestava,
                chemie: stav[mojeStrana].chemie,
              })
              return (
                <SpojenaLajna
                  key={l.index}
                  lajna={l}
                  podleId={new Map(mujTym.hraci.map((h) => [h.id, h]))}
                  rezim="zapas"
                  chemie={stav[mojeStrana].chemie.petky[l.index]}
                  ovrUtok={ovr.utoky[l.index]}
                  ovrObrana={ovr.obrany[obrIdx]}
                  energie={stav[mojeStrana].energie}
                  kapitanId={mujTym.kapitanId}
                />
              )
            })}
          </div>
          <div className="mrizka">
            <div>
              <h4>Proslov v kabině (1× za přestávku)</h4>
              {(
                [
                  ['povzbudit', '💪 Povzbudit'],
                  ['zdrbat', '🔥 Zdrbat'],
                  ['klid', '😌 Nechat být'],
                ] as const
              ).map(([volba, popisek]) => (
                <button
                  key={volba}
                  className="tlacitko sekundarni"
                  style={{ marginRight: 8 }}
                  disabled={proslovVyuzit}
                  onClick={() => {
                    setStav(aplikujProslov(stav, mojeStrana, volba, rng()))
                    setProslovVyuzit(true)
                  }}
                >
                  {popisek}
                </button>
              ))}
            </div>
          </div>
          <button
            className="tlacitko"
            disabled={!!stav.cekaNaNahradu}
            onClick={() => {
              setStav(pokracujPoPauze(stav))
              setRychlost(1)
            }}
          >
            Pokračovat ve hře ▶
          </button>
        </div>
      )}

      {cekaNaMne && stav.faze !== 'konec' && <VyberNahradnika stav={stav} setStav={setStav} tym={mujTym} />}

      {stav.faze === 'konec' && (
        <div className={`karta ${jaVedu ? '' : ''}`} style={{ textAlign: 'center' }}>
          <h3 className={jaVedu ? 'vyhra' : 'prohra'}>
            {jaVedu ? '🎉 VÝHRA!' : '😞 Prohra…'}
            {stav.najezdy ? ' (po nájezdech)' : stav.prodlouzeni ? ' (po prodloužení)' : ''}
          </h3>
          <HvezdaZapasu stav={stav} domaci={domaci} hoste={hoste} />
          <button className="tlacitko" onClick={dokonci}>
            Pokračovat
          </button>
        </div>
      )}

      <div className="karta">
        {posledniUdalosti.map((u) => (
          <div
            key={`${u.minuta}-${u.typ}-${u.hracId ?? ''}-${u.text}`}
            className={`zprava ${u.typ === 'gol' ? 'udalost-gol' : u.typ === 'zraneni' ? 'udalost-zraneni' : ''}`}
          >
            {u.text}
            {u.sance !== undefined && u.typ !== 'gol' ? ` (šance ${u.sance} %)` : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function ModalPresilovky({
  stav,
  setStav,
  setRychlost,
  typ,
  mojeStrana,
  mujTym,
  souperStrana,
}: {
  stav: StavZapasu
  setStav: (s: StavZapasu) => void
  setRychlost: (n: number) => void
  typ: 'pp' | 'pk'
  mojeStrana: 'domaci' | 'hoste'
  mujTym: Tym
  souperStrana: 'domaci' | 'hoste'
}) {
  const strana = stav[mojeStrana]
  const souperStav = stav[souperStrana]
  const podleId = new Map(mujTym.hraci.map((h) => [h.id, h]))
  const souperUtoky = [0, 1, 2, 3].map((i) => energieUtokLajny(souperStav, i))

  function jmenaPetky(petka: Petka): string {
    return hraciPetky(strana, petka)
      .map((id) => {
        const z = strana.zraneni.includes(id) ? '🚑' : ''
        return `${podleId.get(id)!.prijmeni}${z}`
      })
      .join(', ')
  }

  function vyber(petka: Petka, pkAgresivni = false) {
    setStav(potvrdPresilovku(stav, typ === 'pp' ? { petka } : { petka, pkAgresivni }))
    setRychlost(1)
  }

  return (
    <div className="modal-trener karta">
      <h3>{typ === 'pp' ? '⚡ Přesilovka — vyber pětku!' : '🛡️ Oslabení — vyber pětku!'}</h3>
      <p>
        {typ === 'pp'
          ? 'Vyber celou lajnu (3+2). Chybí hráč? Dosad ho níže — klikni zraněného a pak náhradníka ze střídačky.'
          : 'Kdo bude bránit? Soupeř má tyto útoky:'}{' '}
        {typ === 'pk' && (
          <span className="petka-souper-unava">
            {souperUtoky.map((e, i) => (
              <span key={i} className={e < 50 ? 'unavena' : ''}>
                {i + 1}. útok {e}%
              </span>
            ))}
          </span>
        )}
      </p>
      <div className="petka-mrizka">
        {vsechnyPetky().map((petka) => {
          const energie = energiePetky(strana, petka)
          const kompletni = jePetkaKompletni(strana, petka)
          const unavena = energie < 55
          return (
            <button
              key={petka.index}
              className={`petka-karta tlacitko sekundarni ${unavena ? 'unavena' : ''} ${!kompletni ? 'nekompletni' : ''}`}
              disabled={!kompletni}
              title={!kompletni ? 'Nejdřív dosad chybějícího hráče' : undefined}
              onClick={() => vyber(petka)}
            >
              <strong>{popisPetky(petka)}</strong>
              {!kompletni && <span className="petka-chybi">Chybí hráč ({pocetZdravychVPetce(strana, petka)}/5)</span>}
              <span className="petka-energie">E {kompletni ? `${energie}%` : '—'}</span>
              <span className="petka-jmena">{jmenaPetky(petka)}</span>
            </button>
          )
        })}
      </div>
      {typ === 'pk' && (
        <div className="modal-tlacitka" style={{ marginTop: 10 }}>
          <button className="tlacitko nebezpecne" onClick={() => vyber({ index: 3 }, true)}>
            Risk blok (4. útok · sdílí 3. obranu)
          </button>
        </div>
      )}
    </div>
  )
}


function VyberNahradnika({
  stav,
  setStav,
  tym,
}: {
  stav: StavZapasu
  setStav: (s: StavZapasu) => void
  tym: Tym
}) {
  const info = stav.cekaNaNahradu!
  const strana = stav[info.strana]
  const zraneny = tym.hraci.find((h) => h.id === info.hracId)!
  const vSestave = new Set([
    ...strana.sestava.utoky.flat(),
    ...strana.sestava.obrany.flat(),
    strana.sestava.brankar,
  ])
  const kandidati = tym.hraci.filter(
    (h) => h.pozice === zraneny.pozice && !vSestave.has(h.id) && jeZdravy(h) && !strana.zraneni.includes(h.id),
  )
  return (
    <div className="karta" style={{ borderColor: 'var(--prohra)' }}>
      <h3 className="udalost-zraneni">
        🚑 {zraneny.jmeno} {zraneny.prijmeni} nemůže pokračovat! Kdo ho nahradí?
      </h3>
      {kandidati.length === 0 ? (
        <button className="tlacitko" onClick={() => setStav(autoNahrada(stav, tym))}>
          Nikdo není k dispozici — hrát v oslabení
        </button>
      ) : (
        kandidati.map((h) => (
          <button
            key={h.id}
            className="tlacitko sekundarni"
            style={{ marginRight: 8, marginBottom: 8 }}
            onClick={() => setStav(nahradZraneneho(stav, tym, h.id))}
          >
            {h.jmeno} {h.prijmeni} ({overall(h)})
          </button>
        ))
      )}
    </div>
  )
}


function HvezdaZapasu({ stav, domaci, hoste }: { stav: StavZapasu; domaci: Tym; hoste: Tym }) {
  const vsichni = [...domaci.hraci, ...hoste.hraci]
  let nejlepsi: { jmeno: string; hodnoceni: number } | null = null
  for (const h of vsichni) {
    const hod = stav.domaci.hodnoceni[h.id] ?? stav.hoste.hodnoceni[h.id]
    if (hod !== undefined && (!nejlepsi || hod > nejlepsi.hodnoceni)) {
      nejlepsi = { jmeno: `${h.jmeno} ${h.prijmeni}`, hodnoceni: hod }
    }
  }
  if (!nejlepsi) return null
  return (
    <p>
      ⭐ Hvězda zápasu: <b>{nejlepsi.jmeno}</b> ({nejlepsi.hodnoceni.toFixed(1)})
    </p>
  )
}
