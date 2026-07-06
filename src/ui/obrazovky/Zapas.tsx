import type { GameState } from '../../core/types'

export function Zapas({ hra }: { hra: GameState }) {
  const z = hra.posledniZapas
  if (!z) {
    return (
      <>
        <h2>Poslední zápas</h2>
        <p>Zatím jste neodehráli žádný zápas.</p>
      </>
    )
  }
  const v = z.vysledek
  const dodatek = v.najezdy ? ' po nájezdech' : v.prodlouzeni ? ' po prodloužení' : ''
  return (
    <>
      <h2>
        {hra.tymy[z.domaci].nazev} {v.golyDomaci} : {v.golyHoste} {hra.tymy[z.hoste].nazev}
        {dodatek}
      </h2>
      <p>
        Střely na branku: {v.strelyDomaci} : {v.strelyHoste} · hráno den {z.den}
      </p>
      <div className="karta">
        {v.udalosti.map((u, i) => (
          <div key={i} className={u.typ === 'gol' ? 'udalost-gol zprava' : 'zprava'}>
            {u.text}
          </div>
        ))}
      </div>
    </>
  )
}
