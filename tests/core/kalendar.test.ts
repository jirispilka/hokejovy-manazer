import { describe, expect, it } from 'vitest'
import { dalsiTreninkovyDen, dalsiUdalosti, jeTreninkovyDen } from '../../src/core/kalendar'
import { newGame } from '../../src/core/sezona'

describe('kalendar', () => {
  it('trénink je každý 7. den', () => {
    expect(jeTreninkovyDen(7)).toBe(true)
    expect(jeTreninkovyDen(14)).toBe(true)
    expect(jeTreninkovyDen(5)).toBe(false)
  })
  it('dalsiTreninkovyDen počítá správně', () => {
    expect(dalsiTreninkovyDen(0)).toBe(7)
    expect(dalsiTreninkovyDen(5)).toBe(7)
    expect(dalsiTreninkovyDen(7)).toBe(7)
    expect(dalsiTreninkovyDen(8)).toBe(14)
  })
  it('dalsiUdalosti obsahuje zápasy a naplánovaný trénink', () => {
    const s = newGame(1, 'tabor')
    const u = dalsiUdalosti(s, 14)
    expect(u.some((x) => x.typ === 'zapas')).toBe(true)
    expect(u.some((x) => x.typ === 'trenink')).toBe(true)
    expect(u.filter((x) => x.typ === 'trenink').every((x) => x.popis.includes('Trénink:'))).toBe(true)
  })
})
