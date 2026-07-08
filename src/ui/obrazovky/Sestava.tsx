import { useMemo, useState } from 'react'
import {
  analyzaRozestaveni,
  celkovaChemie,
  jeZdravy,
  jeHracMimoPozici,
  navrhUmisteni,
  overall,
  ovrLajny,
  popisChemie,
  presunHraceVSestave,
  souhrnSestavy,
  zmenSestavuKlubu,
} from '../../core/sestava'
import { spojeneLajny } from '../../core/lajny'
import type { GameState, Pozice, Taktika } from '../../core/types'
import { zmenVytizeniTymu } from '../../core/zapas'
import { BadgePozice, MiniBar, PanelTaktiky, Ukazatel, barvaHodnoty } from '../komponenty'
import { PanelVytizeniUtoku } from '../PanelVytizeni'
import { SpojenaLajna } from '../SpojenaLajna'
import { ulozHru } from '../store'

export function SestavaObrazovka({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const [vybrany, setVybrany] = useState<string | null>(null)
  const [filtr, setFiltr] = useState<'vse' | Pozice>('vse')
  const [chyba, setChyba] = useState<string | null>(null)
  const tym = hra.tymy[hra.mujKlubId]
  const podleId = useMemo(() => new Map(tym.hraci.map((h) => [h.id, h])), [tym.hraci])
  const vSestave = useMemo(
    () => new Set([...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat(), tym.sestava.brankar]),
    [tym.sestava],
  )
  const lajny = useMemo(() => spojeneLajny(tym.sestava), [tym.sestava])
  const navrh = vybrany ? navrhUmisteni(tym, vybrany) : null

  function ulozTym(novyTym: typeof tym) {
    const s = { ...hra, tymy: { ...hra.tymy, [hra.mujKlubId]: novyTym } }
    setHra(s)
    void ulozHru(0, s)
  }

  function nastavTaktiku(id: Taktika) {
    ulozTym({ ...tym, taktika: id })
  }

  function presun(id: string) {
    const hrac = podleId.get(id)!
    if (!jeZdravy(hrac) && !vSestave.has(id)) return
    if (!vybrany) {
      setChyba(null)
      return setVybrany(id)
    }
    if (vybrany === id) {
      setChyba(null)
      return setVybrany(null)
    }
    const a = podleId.get(vybrany)!
    const b = podleId.get(id)!
    if (!jeZdravy(b) && !vSestave.has(id)) return
    if (!jeZdravy(a) && !vSestave.has(vybrany)) return
    if (a.pozice === 'G' || b.pozice === 'G') {
      if (a.pozice !== b.pozice) {
        setChyba('Brankáře vyměň jen za jiného brankáře.')
        return setVybrany(id)
      }
    }
    try {
      const novaSestava = presunHraceVSestave(tym.sestava, vybrany, { hracId: id })
      const tymPo = zmenSestavuKlubu(tym, novaSestava)
      ulozTym(tymPo)
      setVybrany(null)
      const mimo = [vybrany, id].filter((hid) => jeHracMimoPozici(tymPo, hid))
      if (mimo.length > 0) {
        const jmena = mimo.map((hid) => podleId.get(hid)!.prijmeni).join(', ')
        setChyba(`${jmena} ${mimo.length === 1 ? 'hraje' : 'hrají'} mimo pozici — nižší OVR a chemie.`)
      } else {
        setChyba(null)
      }
    } catch (e) {
      setChyba(e instanceof Error ? e.message : 'Nepodařilo se přesunout hráče.')
    }
  }

  function dosad(typ: 'utok' | 'obrana', lajna: number) {
    if (!vybrany) return
    const hrac = podleId.get(vybrany)!
    if (hrac.pozice === 'G') {
      setChyba('Brankáře do pole nedosadíš.')
      return
    }
    if (!jeZdravy(hrac) && !vSestave.has(vybrany)) {
      setChyba('Zraněného hráče nejde dosadit.')
      return
    }
    try {
      const novaSestava = presunHraceVSestave(tym.sestava, vybrany, { typ, lajna })
      const tymPo = zmenSestavuKlubu(tym, novaSestava)
      ulozTym(tymPo)
      setVybrany(null)
      if (jeHracMimoPozici(tymPo, vybrany)) {
        setChyba(`${hrac.prijmeni} hraje mimo pozici — nižší OVR a chemie.`)
      } else {
        setChyba(null)
      }
    } catch (e) {
      setChyba(e instanceof Error ? e.message : 'Nepodařilo se dosadit hráče.')
    }
  }

  const nahradnici = tym.hraci.filter((h) => !vSestave.has(h.id) && (filtr === 'vse' || h.pozice === filtr))
  const chemie = celkovaChemie(tym)
  const popis = popisChemie(chemie)
  const souhrn = souhrnSestavy(tym)
  const ovr = ovrLajny(tym)
  const tipy = analyzaRozestaveni(tym)

  const RadekNahradnik = ({ id }: { id: string }) => {
    const h = podleId.get(id)!
    const zraneny = !jeZdravy(h)
    const jeVybrany = vybrany === id
    const jeDoporuceny = navrh?.doporucenyId === id
    return (
      <button
        className={`radek-hrace radek-lajny klik ${jeVybrany ? 'vybrany' : ''} ${jeDoporuceny ? 'doporuceny-cil' : ''} ${zraneny ? 'zraneny' : ''}`}
        disabled={zraneny}
        onClick={() => presun(id)}
        title={jeDoporuceny ? 'Doporučená výměna' : undefined}
      >
        <span className="radek-pozice-badges"><BadgePozice pozice={h.pozice} /></span>
        <span className="radek-jmeno">
          {h.jmeno} {h.prijmeni}
          {h.id === tym.kapitanId && ' Ⓒ'}
          {zraneny && ` 🚑${h.zranenZapasu}`}
          {jeDoporuceny && ' 💡'}
        </span>
        <span className="radek-vek">{h.vek}</span>
        <b>{overall(h)}</b>
        <span className="radek-role">—</span>
        <MiniBar hodnota={h.forma} popisek="F" />
        <MiniBar hodnota={h.unava} popisek="Ú" barva="var(--prohra)" />
      </button>
    )
  }

  const RadekBrankar = ({ id }: { id: string }) => {
    const h = podleId.get(id)!
    const zraneny = !jeZdravy(h)
    const jeVybrany = vybrany === id
    return (
      <button
        className={`radek-hrace radek-lajny klik ${jeVybrany ? 'vybrany' : ''} ${zraneny ? 'zraneny' : ''}`}
        disabled={zraneny}
        onClick={() => presun(id)}
      >
        <span className="radek-pozice-badges"><BadgePozice pozice="G" /></span>
        <span className="radek-jmeno">
          {h.jmeno} {h.prijmeni}
          {h.id === tym.kapitanId && ' Ⓒ'}
          {zraneny && ` 🚑${h.zranenZapasu}`}
        </span>
        <span className="radek-vek">{h.vek}</span>
        <b>{overall(h)}</b>
        <span className="radek-role">—</span>
        <MiniBar hodnota={h.forma} popisek="F" />
        <MiniBar hodnota={h.unava} popisek="Ú" barva="var(--prohra)" />
      </button>
    )
  }

  return (
    <>
      <h2>Sestava</h2>
      <div className="karta">
        <PanelTaktiky taktika={tym.taktika} onZmena={nastavTaktiku} nadpis="Výchozí taktika" />
      </div>
      <div className="karta">
        <PanelVytizeniUtoku
          vytizeni={tym.vytizeniUtoku ?? [1, 1, 1, 1]}
          onZmena={(index, delta) => ulozTym(zmenVytizeniTymu(tym, index, delta))}
        />
      </div>
      <div className="karta chemie-pruvodce">
        <div className="sestava-souhrn">
          <Ukazatel hodnota={souhrn.prumerOvr} barva={barvaHodnoty(souhrn.prumerOvr)} popisek="Průměr OVR" />
          <Ukazatel hodnota={souhrn.prumerEfektivni} barva={barvaHodnoty(souhrn.prumerEfektivni)} popisek="Efektivní OVR" />
          <Ukazatel hodnota={chemie} barva={barvaHodnoty(chemie)} popisek="Chemie" />
          <div className="sestava-sila">
            <b>{souhrn.silaCelkem}</b>
            <span>Síla týmu</span>
            <small>útok {souhrn.silaUtok} · obrana {souhrn.silaObrana} · G {souhrn.silaBrankar}</small>
          </div>
        </div>
        <p><b>{popis.text}</b> — bonus k síle: {popis.bonus}</p>
        {tipy.length > 0 && (
          <ul className="sestava-tipy">
            {tipy.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        )}
        {navrh && (
          <p className={`napoveda-sestava napoveda-${navrh.typ}`}>
            <b>{navrh.hlavni}</b>
            {navrh.typ === 'doporuceno' && navrh.doporucenyId && (
              <span> Klikni na zvýrazněného hráče 💡.</span>
            )}
          </p>
        )}
        {chyba && <p className="napoveda-sestava napoveda-chyba_pozice">{chyba}</p>}
        <ol className="chemie-kroky">
          <li><b>Pyramida síly:</b> 1. lajna = hvězdy, 2.–3. rozlož sílu, 4. útok = udržba (méně ice time)</li>
          <li>Můžeš dosadit kohokoli kam chceš — mimo pozici klesne OVR i chemie pětky</li>
          <li>Pětka pohromadě roste chemie — výměna ji jen částečně sníží</li>
          <li>Hraj zápasy — pětky na ledě získávají +6 (max 100)</li>
        </ol>
        <p style={{ color: 'var(--tlumeny)', marginBottom: 0 }}>
          {vybrany
            ? 'Klikni na hráče k výměně, nebo na prázdné místo (+) pro dosazení.'
            : 'Klikni na hráče — ukážeme ti nejlepší místo.'}
        </p>
      </div>

      {lajny.map((l) => (
        <SpojenaLajna
          key={l.index}
          lajna={l}
          podleId={podleId}
          rezim="editace"
          tym={tym}
          chemie={tym.chemie.petky[l.index]}
          ovrUtok={ovr.utoky[l.index]}
          ovrObrana={ovr.obrany[Math.min(l.index, 2)]}
          vybrany={vybrany}
          doporucenyId={navrh?.doporucenyId ?? null}
          kapitanId={tym.kapitanId}
          vSestave={vSestave}
          onKlikHrace={presun}
          onDosad={dosad}
        />
      ))}

      <div className="karta">
        <b>Brankář</b>
        <RadekBrankar id={tym.sestava.brankar} />
      </div>

      <div className="karta">
        <div className="radek-hlavicka">
          <b>Náhradníci</b>
          <span className="filtr-pozice">
            {(['vse', 'U', 'D', 'G'] as const).map((p) => (
              <button key={p} className={`tlacitko-mini sekundarni ${filtr === p ? 'vybrany' : ''}`} onClick={() => setFiltr(p)}>
                {p === 'vse' ? 'Všichni' : p}
              </button>
            ))}
          </span>
        </div>
        {nahradnici.map((h) => <RadekNahradnik key={h.id} id={h.id} />)}
      </div>

      <div className="karta">
        <b>Kapitán Ⓒ:</b>{' '}
        <select
          value={tym.kapitanId ?? ''}
          onChange={(e) => ulozTym({ ...tym, kapitanId: e.target.value })}
        >
          {tym.hraci.map((h) => (
            <option key={h.id} value={h.id}>{h.jmeno} {h.prijmeni}</option>
          ))}
        </select>
      </div>
    </>
  )
}
