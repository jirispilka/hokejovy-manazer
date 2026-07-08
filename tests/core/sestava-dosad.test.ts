import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import {
  dosadDoLajny,
  presunHraceVSestave,
  volneMistaUtoku,
  vychoziSestava,
} from '../../src/core/sestava'
import type { Klub, Sestava } from '../../src/core/types'
import { dosadHraceVZapase, zacniZapas } from '../../src/core/zapas'

const tym = () => {
  resetIdCitac(1)
  return generujTym(createRng(1), { id: 'x', nazev: 'x', liga: 1 } as Klub)
}

describe('dosazení do lajny', () => {
  it('po prodeji může lajna mít volné místo', () => {
    const t = tym()
    const ut = t.hraci.filter((h) => h.pozice === 'U')
    const neuplna: Sestava = {
      utoky: [[ut[0].id, ut[1].id], [ut[2].id, ut[3].id, ut[4].id], [ut[5].id, ut[6].id, ut[7].id], [ut[8].id]],
      obrany: vychoziSestava(t.hraci).obrany,
      brankar: vychoziSestava(t.hraci).brankar,
    }
    expect(volneMistaUtoku(neuplna.utoky[0])).toBe(1)
    expect(volneMistaUtoku(neuplna.utoky[3])).toBe(2)
  })

  it('dosadDoLajny přidá hráče bez výměny', () => {
    const t = tym()
    const ut = t.hraci.filter((h) => h.pozice === 'U')
    const s: Sestava = {
      utoky: [[ut[0].id, ut[1].id], ...vychoziSestava(t.hraci).utoky.slice(1)],
      obrany: vychoziSestava(t.hraci).obrany,
      brankar: vychoziSestava(t.hraci).brankar,
    }
    const nahradnik = ut[11]
    const po = dosadDoLajny(s, nahradnik.id, 'utok', 0)
    expect(po.utoky[0]).toHaveLength(3)
    expect(po.utoky[0]).toContain(nahradnik.id)
  })

  it('presunHraceVSestave dosadí z lavičky', () => {
    const t = tym()
    const ut = t.hraci.filter((h) => h.pozice === 'U')
    const s: Sestava = {
      utoky: [[ut[0].id], ...vychoziSestava(t.hraci).utoky.slice(1)],
      obrany: vychoziSestava(t.hraci).obrany,
      brankar: vychoziSestava(t.hraci).brankar,
    }
    const po = presunHraceVSestave(s, ut[10].id, { typ: 'utok', lajna: 0 })
    expect(po.utoky[0]).toContain(ut[10].id)
  })

  it('dosadHraceVZapase funguje během zápasu', () => {
    const domaci = tym()
    resetIdCitac(1000)
    const hoste = generujTym(createRng(2), { id: 'y', nazev: 'y', liga: 1 } as Klub)
    let stav = zacniZapas(domaci, hoste)
    const s = stav.domaci.sestava
    const odstraneny = s.utoky[3][2]
    stav.domaci.sestava = {
      utoky: [s.utoky[0].slice(0, 2), s.utoky[1], s.utoky[2], s.utoky[3].filter((id) => id !== odstraneny)],
      obrany: s.obrany,
      brankar: s.brankar,
    }
    stav.minuta = 10
    const po = dosadHraceVZapase(stav, 'domaci', domaci, odstraneny, 'utok', 0)
    expect(po.domaci.sestava.utoky[0]).toHaveLength(3)
    expect(po.domaci.sestava.utoky[0]).toContain(odstraneny)
  })
})
