import { describe, expect, it } from 'vitest'
import { TAKTIKY, nazevTaktiky, normalizujTaktiku, taktikaFaktory } from '../../src/core/taktika'

describe('taktika', () => {
  it('má 5 úrovní od betonu po pressing', () => {
    expect(TAKTIKY).toHaveLength(5)
    expect(TAKTIKY.map((t) => t.id)).toEqual([
      'velmi_utocna',
      'utocna',
      'vyvazena',
      'obranna',
      'velmi_obranna',
    ])
  })

  it('útočnější taktika zvyšuje útok a snižuje obranu', () => {
    const press = taktikaFaktory('velmi_utocna')
    const beton = taktikaFaktory('velmi_obranna')
    expect(press.utok).toBeGreaterThan(taktikaFaktory('vyvazena').utok)
    expect(press.obrana).toBeLessThan(taktikaFaktory('vyvazena').obrana)
    expect(beton.utok).toBeLessThan(taktikaFaktory('vyvazena').utok)
    expect(beton.obrana).toBeGreaterThan(taktikaFaktory('vyvazena').obrana)
  })

  it('normalizuje neznámou hodnotu na vyváženou', () => {
    expect(normalizujTaktiku('cokoliv')).toBe('vyvazena')
    expect(normalizujTaktiku('utocna')).toBe('utocna')
  })

  it('vrací český název', () => {
    expect(nazevTaktiky('velmi_obranna')).toBe('Beton')
  })
})
