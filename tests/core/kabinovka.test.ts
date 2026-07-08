import { describe, expect, it } from 'vitest'
import { vyresKabinovku } from '../../src/core/kabinovka'
import { newGame } from '../../src/core/sezona'
import type { KabinovaUdalost } from '../../src/core/types'

describe('kabinovka', () => {
  it('vyřešení události změní morálku a zruší čekající událost', () => {
    const s = newGame(1, 'tabor')
    const udalost: KabinovaUdalost = {
      id: 'stiznost',
      text: 'Test',
      moznosti: [{ text: 'Uklidnit', efektMoralka: 3 }],
    }
    s.kabinovaUdalost = udalost
    const moralkaPred = s.tymy[s.mujKlubId].moralka
    const po = vyresKabinovku(s, 0)
    expect(po.kabinovaUdalost).toBeNull()
    expect(po.tymy[s.mujKlubId].moralka).toBeGreaterThan(moralkaPred)
    expect(po.zpravy[0]).toContain('Kabina')
  })
})
