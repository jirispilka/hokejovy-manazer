import { normalizujVytizeniUtoku, vahyUtokuZVytizeni, VYCHOZI_VYTIZENI } from '../core/zapasPetky'

export function PanelVytizeniUtoku({
  vytizeni,
  onZmena,
}: {
  vytizeni: [number, number, number, number]
  onZmena: (index: number, delta: number) => void
}) {
  const v = normalizujVytizeniUtoku(vytizeni ?? VYCHOZI_VYTIZENI)
  const podily = vahyUtokuZVytizeni(v)
  return (
    <div className="panel-vytizeni">
      <h4>Vytížení útokových lajn</h4>
      <p style={{ fontSize: 13, color: 'var(--tlumeny)', marginBottom: 10 }}>
        Vyšší vytížení = víc minut na ledě a větší vliv lajny na útok. ×0 = lajna nehraje.
      </p>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="radek-vytizeni">
          <span>{i + 1}. útok</span>
          <span className="vytizeni-hodnota">×{v[i].toFixed(1)}</span>
          <span style={{ fontSize: 12, color: 'var(--tlumeny)' }}>~{Math.round(podily[i] * 60)}′</span>
          <button type="button" className="tlacitko-mini sekundarni" disabled={v[i] <= 0} onClick={() => onZmena(i, -0.5)}>
            −
          </button>
          <button type="button" className="tlacitko-mini sekundarni" disabled={v[i] >= 2} onClick={() => onZmena(i, 0.5)}>
            +
          </button>
        </div>
      ))}
    </div>
  )
}
