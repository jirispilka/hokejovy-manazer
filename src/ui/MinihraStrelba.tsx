import { useEffect, useRef, useState } from 'react'

/** Timing minihra — hráč zastaví ukazatel ve zelené zóně (kvalita 0–1). */
export function MinihraStrelba({ onHotovo }: { onHotovo: (kvalita: number) => void }) {
  const [pos, setPos] = useState(0)
  const smerRef = useRef(1)
  const hotovoRef = useRef(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setPos((p) => {
        let np = p + smerRef.current * 0.018
        if (np >= 1) {
          np = 1
          smerRef.current = -1
        }
        if (np <= 0) {
          np = 0
          smerRef.current = 1
        }
        return np
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  function zastav() {
    if (hotovoRef.current) return
    hotovoRef.current = true
    onHotovo(pos)
  }

  return (
    <div className="minihra-strelba">
      <p style={{ marginBottom: 8 }}>⏱ Zastav pásku ve zelené zóně — klikni nebo stiskni mezerník</p>
      <div
        className="minihra-track"
        role="button"
        tabIndex={0}
        onClick={zastav}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            zastav()
          }
        }}
      >
        <div className="minihra-zona" />
        <div className="minihra-ukazatel" style={{ left: `${pos * 100}%` }} />
      </div>
    </div>
  )
}
