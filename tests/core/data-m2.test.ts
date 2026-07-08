import { describe, expect, it } from 'vitest'
import kluby from '../../src/core/data/kluby.json'
import rivalove from '../../src/core/data/rivalove.json'
import { generujSvet, generujTym } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { newGame } from '../../src/core/sezona'
import type { Klub } from '../../src/core/types'

describe('kluby.json barvy', () => {
  it('každý klub má dvě hex barvy', () => {
    for (const k of kluby as (Klub & { barvy: string[] })[]) {
      expect(k.barvy).toHaveLength(2)
      for (const b of k.barvy) expect(b).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('rivalove.json', () => {
  const dvojice = rivalove as [string, string][]
  it('pokrývá všech 42 klubů právě jednou', () => {
    const vsichni = dvojice.flat()
    expect(vsichni).toHaveLength(42)
    expect(new Set(vsichni).size).toBe(42)
    const idKlubu = new Set((kluby as Klub[]).map((k) => k.id))
    for (const id of vsichni) expect(idKlubu.has(id)).toBe(true)
  })
})

describe('nová pole hráče a týmu', () => {
  const tym = generujTym(createRng(1), { id: 'tabor', nazev: 'HC Tábor', liga: 2 } as Klub)
  it('hráči startují zdraví', () => {
    for (const h of tym.hraci) expect(h.zranenZapasu).toBe(0)
  })
  it('tým má výchozí taktiku a kapitána (nejlepší overall)', () => {
    expect(tym.taktika).toBe('vyvazena')
    expect(tym.kapitanId).toBeTruthy()
    expect(tym.hraci.some((h) => h.id === tym.kapitanId)).toBe(true)
  })
})

describe('newGame má kariérní stav', () => {
  const s = newGame(7, 'tabor')
  it('inicializuje trenéra, cíl, náladu, historii', () => {
    expect(s.trener.duvera).toBe(50)
    expect(s.trener.kariera.zapasy).toBe(0)
    expect(['titul', 'postup', 'playoff', 'stred', 'zachrana']).toContain(s.cilSezony.typ)
    expect(s.naladaFanousku).toBe(50)
    expect(s.historie).toEqual([])
    expect(s.vyhlaseni).toBeNull()
    expect(s.rekordy).toEqual({ nejvyssiVyhra: null, nejlepsiStrelec: null })
    expect(s.nabidky).toBeNull()
    expect(s.konecKariery).toBe(false)
    expect(s.cekajiciZapas).toBeNull()
  })
})
