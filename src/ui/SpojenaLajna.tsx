import { roleHrace } from '../core/hodnoty'
import {
  detailPoziceHrace,
  popisDetailPozice,
  seradObrance,
  seradUtocniky,
  type SpojenaLajna as SpojenaLajnaData,
} from '../core/lajny'
import {
  jeHracMimoPozici,
  jeZdravy,
  overallProRoli,
  volneMistaObrany,
  volneMistaUtoku,
} from '../core/sestava'
import type { Hrac, Tym } from '../core/types'
import { BadgePozice, MiniBar, barvaHodnoty } from './komponenty'

export type RezimLajny = 'prehled' | 'editace' | 'zapas'

export interface SpojenaLajnaProps {
  lajna: SpojenaLajnaData
  podleId: Map<string, Hrac>
  rezim: RezimLajny
  tym?: Tym
  chemieUtok?: number
  chemieObrana?: number
  ovrUtok?: number
  ovrObrana?: number
  energie?: Record<string, number>
  vybrany?: string | null
  doporucenyId?: string | null
  kapitanId?: string | null
  vSestave?: Set<string>
  onKlikHrace?: (id: string) => void
  onDosad?: (typ: 'utok' | 'obrana', lajna: number) => void
}

function BadgeDetailPozice({ hrac }: { hrac: Hrac }) {
  const dp = detailPoziceHrace(hrac)
  if (!dp) return null
  return <span className="badge badge-detail-pozice">{popisDetailPozice(dp)}</span>
}

function RadekHrace({
  id,
  role,
  hrac,
  rezim,
  tym,
  energie,
  vybrany,
  doporucenyId,
  kapitanId,
  vSestave,
  onKlikHrace,
}: {
  id: string
  role: 'utok' | 'obrana'
  hrac: Hrac
  rezim: RezimLajny
  tym?: Tym
  energie?: Record<string, number>
  vybrany?: string | null
  doporucenyId?: string | null
  kapitanId?: string | null
  vSestave?: Set<string>
  onKlikHrace?: (id: string) => void
}) {
  const zraneny = !jeZdravy(hrac)
  const jeVybrany = vybrany === id
  const jeDoporuceny = doporucenyId === id
  const mimoPozici = tym ? jeHracMimoPozici(tym, id) : false
  const ovr = overallProRoli(hrac, role)
  const en = energie?.[id]
  const unaveny = rezim === 'zapas' && en !== undefined && en < 55

  const obsah = (
    <>
      <span className="radek-pozice-badges">
        <BadgePozice pozice={hrac.pozice} />
        <BadgeDetailPozice hrac={hrac} />
      </span>
      <span className="radek-jmeno">
        {hrac.jmeno} {hrac.prijmeni}
        {id === kapitanId && ' Ⓒ'}
        {zraneny && ` 🚑${hrac.zranenZapasu}`}
        {jeDoporuceny && ' 💡'}
      </span>
      <span className="radek-vek">{hrac.vek}</span>
      <b>{ovr}</b>
      <span className="radek-role">{roleHrace(hrac) ?? '—'}</span>
      <MiniBar hodnota={hrac.forma} popisek="F" />
      {rezim === 'zapas' && en !== undefined ? (
        <MiniBar hodnota={en} popisek="E" barva={barvaHodnoty(en)} />
      ) : (
        <MiniBar hodnota={hrac.unava} popisek="Ú" barva="var(--prohra)" />
      )}
    </>
  )

  if (rezim === 'prehled' || !onKlikHrace) {
    return (
      <div
        className={`radek-hrace radek-lajny ${mimoPozici ? 'mimo-pozici' : ''} ${zraneny ? 'zraneny' : ''} ${unaveny ? 'unaveny' : ''}`}
      >
        {obsah}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`radek-hrace radek-lajny klik ${jeVybrany ? 'vybrany' : ''} ${jeDoporuceny ? 'doporuceny-cil' : ''} ${zraneny ? 'zraneny' : ''} ${mimoPozici ? 'mimo-pozici' : ''} ${unaveny ? 'unaveny' : ''}`}
      disabled={zraneny && rezim === 'editace' && !vSestave?.has(id)}
      onClick={() => onKlikHrace(id)}
    >
      {obsah}
    </button>
  )
}

export function SpojenaLajna({
  lajna,
  podleId,
  rezim,
  tym,
  chemieUtok,
  chemieObrana,
  ovrUtok,
  ovrObrana,
  energie,
  vybrany,
  doporucenyId,
  kapitanId,
  vSestave,
  onKlikHrace,
  onDosad,
}: SpojenaLajnaProps) {
  const utocnici = seradUtocniky(lajna.utok, podleId)
  const obranci = seradObrance(lajna.obrana, podleId)
  const volneU = rezim === 'editace' ? volneMistaUtoku(lajna.utok) : 0
  const volneD = rezim === 'editace' ? volneMistaObrany(lajna.obrana) : 0

  return (
    <div className="karta spojena-lajna">
      <div className="radek-hlavicka">
        <div>
          <b>{lajna.popis}</b>
          {(ovrUtok !== undefined || ovrObrana !== undefined) && (
            <span className="lajna-role">
              Útok OVR {ovrUtok ?? '—'} · Obrana OVR {ovrObrana ?? '—'}
            </span>
          )}
        </div>
        <div className="lajna-chemie-bary">
          {chemieUtok !== undefined && (
            <MiniBar hodnota={chemieUtok} popisek="Ú chemie" barva={barvaHodnoty(chemieUtok)} />
          )}
          {chemieObrana !== undefined && (
            <MiniBar hodnota={chemieObrana} popisek="O chemie" barva={barvaHodnoty(chemieObrana)} />
          )}
        </div>
      </div>

      <div className="lajna-sekce">
        <div className="lajna-sekce-nadpis">Útok</div>
        {utocnici.map((id) => (
          <RadekHrace
            key={id}
            id={id}
            role="utok"
            hrac={podleId.get(id)!}
            rezim={rezim}
            tym={tym}
            energie={energie}
            vybrany={vybrany}
            doporucenyId={doporucenyId}
            kapitanId={kapitanId}
            vSestave={vSestave}
            onKlikHrace={onKlikHrace}
          />
        ))}
        {rezim === 'editace' &&
          Array.from({ length: volneU }).map((_, slot) => (
            <button
              key={`prazdny-u-${lajna.index}-${slot}`}
              type="button"
              className={`radek-hrace radek-prazdny radek-lajny klik ${vybrany ? 'vybrany-cil' : ''}`}
              onClick={() => onDosad?.('utok', lajna.index)}
            >
              + Volné místo — dosadit útočníka
            </button>
          ))}
      </div>

      <div className="lajna-sekce lajna-obrana">
        <div className="lajna-sekce-nadpis">Obrana</div>
        {obranci.map((id) => (
          <RadekHrace
            key={id}
            id={id}
            role="obrana"
            hrac={podleId.get(id)!}
            rezim={rezim}
            tym={tym}
            energie={energie}
            vybrany={vybrany}
            doporucenyId={doporucenyId}
            kapitanId={kapitanId}
            vSestave={vSestave}
            onKlikHrace={onKlikHrace}
          />
        ))}
        {rezim === 'editace' &&
          Array.from({ length: volneD }).map((_, slot) => (
            <button
              key={`prazdny-d-${lajna.index}-${slot}`}
              type="button"
              className={`radek-hrace radek-prazdny radek-lajny klik ${vybrany ? 'vybrany-cil' : ''}`}
              onClick={() => onDosad?.('obrana', Math.min(lajna.index, 2))}
            >
              + Volné místo — dosadit obránce
            </button>
          ))}
      </div>
    </div>
  )
}
