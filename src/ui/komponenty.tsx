import kluby from '../core/data/kluby.json'
import { TAKTIKY, taktikaFaktory } from '../core/taktika'
import type { VysledekZnak } from '../core/hodnoty'
import type { Klub, Pozice, Taktika } from '../core/types'

const KLUBY = new Map((kluby as Klub[]).map((k) => [k.id, k]))

// reálná loga klubů (best effort z Wikipedie) — chybí zejména u týmů 2. ligy
const LOGA = import.meta.glob<string>('./loga/*.png', { eager: true, import: 'default' })

export function OdznakKlubu({ klubId, velikost = 36 }: { klubId: string; velikost?: number }) {
  const klub = KLUBY.get(klubId)
  if (!klub) return null
  const logo = LOGA[`./loga/${klubId}.png`]
  if (logo) {
    return (
      <span className="odznak odznak-logo" title={klub.nazev} style={{ width: velikost, height: velikost }}>
        <img src={logo} alt={klub.nazev} />
      </span>
    )
  }
  const zbytek = klub.nazev.replace(/^(HC|BK|SK|SC|AZ|IHC|LHK|VHK|SHC|SKLH|Mountfield|Bílí)\s+/i, '')
  const slova = zbytek.split(' ')
  // jednoslovný zbytek (např. „HK" z Mountfield HK) → první dvě písmena
  const inicialy = (
    slova.length >= 2 ? slova.map((slovo) => slovo[0]).slice(0, 2).join('') : zbytek.slice(0, 2)
  ).toUpperCase()
  const [a, b] = klub.barvy
  return (
    <span
      className="odznak"
      title={klub.nazev}
      style={{
        width: velikost,
        height: velikost,
        background: `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)`,
        fontSize: velikost * 0.36,
      }}
    >
      {inicialy}
    </span>
  )
}

export function Ukazatel({
  hodnota,
  barva = 'var(--akcent)',
  popisek,
}: {
  hodnota: number
  barva?: string
  popisek?: string
}) {
  const w = Math.max(0, Math.min(100, hodnota))
  return (
    <div>
      {popisek && (
        <div className="ukazatel-popisek">
          <span>{popisek}</span>
          <b>{Math.round(hodnota)}</b>
        </div>
      )}
      <div className="ukazatel">
        <span style={{ width: `${w}%`, background: barva }} />
      </div>
    </div>
  )
}

// barva ukazatele podle hodnoty (důvěra, nálada): červená → zlatá → zelená
export const barvaHodnoty = (hodnota: number): string =>
  hodnota <= 25 ? 'var(--prohra)' : hodnota <= 55 ? 'var(--zlata)' : 'var(--vyhra)'

const POZICE_BARVY: Record<Pozice, string> = { G: '#f0b429', D: '#3d9bff', U: '#2fbf71' }
const POZICE_TEXT: Record<Pozice, string> = { G: 'B', D: 'O', U: 'Ú' }

export function BadgePozice({ pozice }: { pozice: Pozice }) {
  return (
    <span className="badge" style={{ background: POZICE_BARVY[pozice] }}>
      {POZICE_TEXT[pozice]}
    </span>
  )
}

export function MomentumGraf({ momentum, domaci, hoste }: { momentum: number; domaci: string; hoste: string }) {
  const pozice = 50 - momentum / 2 // kladné momentum (domácí) táhne ukazatel doleva k domácím
  return (
    <div className="momentum">
      <div className="momentum-tymy">
        <span>{domaci}</span>
        <span>momentum</span>
        <span>{hoste}</span>
      </div>
      <div className="momentum-draha">
        <span className="momentum-stred" />
        <span className="momentum-ukazatel" style={{ left: `calc(${pozice}% - 9px)` }} />
      </div>
    </div>
  )
}

export function MiniBar({
  hodnota,
  popisek,
  barva = 'var(--akcent)',
}: {
  hodnota: number
  popisek?: string
  barva?: string
}) {
  const w = Math.max(0, Math.min(100, hodnota))
  return (
    <span className="minibar" title={`${popisek ? popisek + ': ' : ''}${Math.round(hodnota)}`}>
      {popisek && <span className="minibar-popisek">{popisek}</span>}
      <span className="minibar-draha">
        <span style={{ width: `${w}%`, background: barva }} />
      </span>
    </span>
  )
}

const BARVY_FORMY: Record<VysledekZnak, string> = {
  V: 'var(--vyhra)',
  VP: '#7fd6a4',
  PP: '#f0a35e',
  P: 'var(--prohra)',
}

export function FormaTecky({ znaky }: { znaky: VysledekZnak[] }) {
  if (znaky.length === 0) return <span style={{ color: 'var(--tlumeny)' }}>—</span>
  return (
    <span className="forma-tecky" title={znaky.join(' ')}>
      {znaky.map((z, i) => (
        <span key={i} className="tecka" style={{ background: BARVY_FORMY[z] }} />
      ))}
    </span>
  )
}

function formatModTaktiky(f: number) {
  if (f === 1) return '±0 %'
  const pct = Math.round((f - 1) * 100)
  return pct > 0 ? `+${pct} %` : `${pct} %`
}

export function PanelTaktiky({
  taktika,
  onZmena,
  nadpis,
  vPrubehu,
}: {
  taktika: Taktika
  onZmena: (t: Taktika) => void
  nadpis?: string
  vPrubehu?: boolean
}) {
  const f = taktikaFaktory(taktika)
  const aktivni = TAKTIKY.find((t) => t.id === taktika)
  return (
    <div className={`panel-taktiky ${vPrubehu ? 'panel-taktiky-aktivni' : ''}`}>
      {nadpis && <h3>{nadpis}</h3>}
      {vPrubehu && (
        <p className="taktika-napoveda">Změna platí okamžitě — můžeš přepínat i uprostřed třetiny.</p>
      )}
      <div className="taktika-spectrum" role="group" aria-label="Taktika">
        {TAKTIKY.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`taktika-prepinac ${taktika === t.id ? 'aktivni' : ''}`}
            onClick={() => onZmena(t.id)}
            title={t.popis}
          >
            {t.nazev}
          </button>
        ))}
      </div>
      <p className="taktika-efekt">
        <b>{aktivni?.nazev}</b> — {aktivni?.popis}
        <span className="taktika-modifikatory">
          Útok {formatModTaktiky(f.utok)} · Obrana {formatModTaktiky(f.obrana)}
        </span>
      </p>
    </div>
  )
}
