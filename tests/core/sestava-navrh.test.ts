import { describe, expect, it } from 'vitest'
import { newGame } from '../../src/core/sezona'
import {
  analyzaRozestaveni,
  efektivniHrace,
  idealniLajna,
  mozneCileVymeny,
  navrhUmisteni,
  overall,
  ovrLajny,
  silaCelkem,
  souhrnSestavy,
  vymenVSestave,
  vychoziSestava,
  zmenSestavuKlubu,
  zpravaSpatnePozice,
} from '../../src/core/sestava'

describe('návrhy umístění', () => {
  it('doporučí výměnu která zvýší sílu týmu', () => {
    const s = newGame(1, 'tabor')
    let tym = s.tymy.tabor
    const utocnici = [...tym.hraci.filter((h) => h.pozice === 'U')].sort((a, b) => overall(b) - overall(a))
    const silny = utocnici[0]
    const slaby = utocnici[utocnici.length - 1]
    // slabý v 1. útoku, silný vyměníme ven na střídačku
    const nova = structuredClone(tym.sestava)
    const idx = nova.utoky[0].indexOf(silny.id)
    if (idx >= 0) {
      nova.utoky[0][idx] = slaby.id
    } else {
      nova.utoky[0][0] = slaby.id
    }
    tym = zmenSestavuKlubu(tym, nova)
    const navrh = navrhUmisteni(tym, silny.id)
    expect(navrh.typ).toBe('doporuceno')
    expect(navrh.cile[0].skore).toBeGreaterThan(0)
  })

  it('nedoporučí výměnu která sníží sílu týmu', () => {
    const s = newGame(99, 'tabor')
    const tym = s.tymy.tabor
    const vSestave = [...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat(), tym.sestava.brankar]
    const nejsilnejsi = tym.hraci
      .filter((h) => vSestave.includes(h.id))
      .sort((a, b) => efektivniHrace(b) - efektivniHrace(a))[0]
    const navrh = navrhUmisteni(tym, nejsilnejsi.id)
    if (navrh.typ === 'doporuceno') {
      expect(navrh.cile[0].skore).toBeGreaterThan(0)
    } else {
      expect(['uz_optimalni', 'neni_lepsi']).toContain(navrh.typ)
    }
  })

  it('skóre výměny zohledňuje sílu týmu a umístění na lajnu', () => {
    const s = newGame(5, 'tabor')
    const tym = s.tymy.tabor
    const bench = tym.hraci.find((h) => h.pozice === 'U' && !tym.sestava.utoky.flat().includes(h.id))!
    const cile = mozneCileVymeny(tym, bench.id)
    expect(cile.length).toBeGreaterThan(0)
    const naPrvni = cile.find((c) => c.popisMista === '1. útok')
    const naCtvrty = cile.find((c) => c.popisMista === '4. útok')
    if (naPrvni && naCtvrty && idealniLajna(tym, bench.id) < 2) {
      expect(naPrvni.skore).toBeGreaterThan(naCtvrty.skore)
    }
  })

  it('doporučí posunout hvězdu z 4. lajny nahoru', () => {
    const s = newGame(3, 'tabor')
    let tym = s.tymy.tabor
    const ut = [...tym.hraci.filter((h) => h.pozice === 'U')].sort((a, b) => overall(b) - overall(a))
    const nova = vychoziSestava(tym.hraci)
    // nejlepšího dej na 4. útok
    nova.utoky[3] = [ut[0].id, ut[9].id, ut[10].id]
    nova.utoky[0] = nova.utoky[0].filter((id) => id !== ut[0].id)
    if (nova.utoky[0].length < 3) nova.utoky[0].push(ut[11].id)
    tym = zmenSestavuKlubu(tym, nova)
    const navrh = navrhUmisteni(tym, ut[0].id)
    expect(navrh.typ).toBe('doporuceno')
    expect(navrh.cile[0].popisMista).not.toBe('4. útok')
  })

  it('analyzaRozestaveni odhalí obrácenou pyramidu', () => {
    const s = newGame(3, 'tabor')
    let tym = s.tymy.tabor
    const ut = [...tym.hraci.filter((h) => h.pozice === 'U')].sort((a, b) => overall(b) - overall(a))
    const nova = vychoziSestava(tym.hraci)
    nova.utoky[0] = [ut[9].id, ut[10].id, ut[11].id]
    nova.utoky[3] = [ut[0].id, ut[1].id, ut[2].id]
    tym = zmenSestavuKlubu(tym, nova)
    const ovr = ovrLajny(tym)
    expect(ovr.utoky[0]).toBeLessThan(ovr.utoky[3])
    const tips = analyzaRozestaveni(tym)
    expect(tips.some((t) => t.includes('1. útok') || t.includes('nahoru'))).toBe(true)
  })

  it('souhrnSestavy vrací průměr OVR hráčů na ledě', () => {
    const s = newGame(1, 'tabor')
    const tym = s.tymy.tabor
    const souhrn = souhrnSestavy(tym)
    expect(souhrn.prumerOvr).toBeGreaterThan(40)
    expect(souhrn.prumerOvr).toBeLessThan(90)
    expect(souhrn.silaCelkem).toBeGreaterThan(0)
  })

  it('zpravaSpatnePozice vysvětlí výměnu brankáře', () => {
    const s = newGame(1, 'tabor')
    const ut = s.tymy.tabor.hraci.find((h) => h.pozice === 'U')!
    const g = s.tymy.tabor.hraci.find((h) => h.pozice === 'G')!
    expect(zpravaSpatnePozice(ut, g)).toContain('Brankáře')
  })

  it('obránce v útoku sníží sílu a chemie', () => {
    const s = newGame(1, 'tabor')
    const tym = s.tymy.tabor
    const obr = tym.hraci.find((h) => h.pozice === 'D' && !tym.sestava.utoky.flat().includes(h.id))!
    const obet = tym.sestava.utoky[3][0]
    const silaPred = silaCelkem(tym)
    const chemiePred = tym.chemie.petky[3]
    const nova = vymenVSestave(tym.sestava, obet, obr.id)
    const po = zmenSestavuKlubu(tym, nova)
    expect(silaCelkem(po)).toBeLessThan(silaPred)
    expect(po.chemie.petky[3]).toBeLessThan(chemiePred)
  })

  it('mozneCileVymeny nabízí jen stejnou pozici', () => {
    const s = newGame(1, 'tabor')
    const tym = s.tymy.tabor
    const ut = tym.hraci.find((h) => h.pozice === 'U' && !tym.sestava.utoky.flat().includes(h.id))!
    const cile = mozneCileVymeny(tym, ut.id)
    expect(cile.length).toBeGreaterThan(0)
    for (const c of cile) {
      expect(tym.hraci.find((h) => h.id === c.hracId)!.pozice).toBe('U')
    }
  })
})
