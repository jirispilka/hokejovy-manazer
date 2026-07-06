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
    expect(() => deserializuj(json.replace('"verze":1', '"verze":99'))).toThrow()
  })
})
