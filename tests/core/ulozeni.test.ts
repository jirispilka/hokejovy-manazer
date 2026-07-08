import { describe, expect, it } from 'vitest'
import { newGame } from '../../src/core/sezona'
import { deserializuj, popisUlozeni, serializuj } from '../../src/core/ulozeni'

describe('serializace', () => {
  const stav = newGame(1, 'tabor')
  const json = serializuj(stav, '2026-07-05T10:00:00.000Z')
  it('round-trip zachová stav', () => {
    expect(deserializuj(json)).toEqual(stav)
  })
  it('popis slotu obsahuje metadata', () => {
    expect(popisUlozeni(json)).toEqual({
      ulozeno: '2026-07-05T10:00:00.000Z',
      sezona: 1,
      den: 0,
      klub: 'HC Tábor',
    })
  })
  it('odmítne cizí/poškozený obsah', () => {
    expect(() => deserializuj('{"foo":1}')).toThrow()
    expect(() => deserializuj(json.replace('"verze":8', '"verze":99'))).toThrow()
  })
  it('migruje verzi 4 na 8', () => {
    const stara = json.replace('"verze":8', '"verze":4')
    const s = deserializuj(stara)
    expect(s.stadion).toBeDefined()
    expect(s.financeHistorie).toEqual([])
    expect(s.treninkovyTyden).toBeDefined()
    expect(s.reklama).toEqual([])
    expect(s.nastaveni.minihryZapnuto).toBe(true)
  })
  it('migruje verzi 6 na 8 — legacy typy tréninku', () => {
    const v6json = json
      .replace('"verze":8', '"verze":6')
      .replace('"strelba"', '"led"')
      .replace('"kondice"', '"posilovna"')
    const s = deserializuj(v6json)
    const seance = Object.values(s.treninkovyTyden).flat()
    for (const td of seance) {
      expect(td.typ).not.toBe('led')
      expect(td.typ).not.toBe('posilovna')
    }
  })

  it('migruje verzi 5 na 8', () => {
    const v5 = json.replace('"verze":8', '"verze":5')
    const bezV6 = v5
      .replace('"treninkovyTyden":', '"treninkovyTydenX":')
      .replace(/"treninkovyTydenOd":\d+,/, '')
    const patched = bezV6.replace('"treninkovyTydenX":', '"treninkovyTyden":')
    const s = deserializuj(patched)
    expect(s.prichoziNabidky).toEqual([])
    expect(s.kabinovaUdalost).toBeNull()
  })
})
