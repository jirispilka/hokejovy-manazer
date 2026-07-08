import { useState } from 'react'
import {
  aktivniReklama,
  bonusNavstevnostiZReklamy,
  cenaReklamy,
  cenaVylepseniStadionu,
  faktorCenyVstupneho,
  kupReklamu,
  mesicniCashflow,
  nabidkySponzora,
  oslovSponzory,
  POPISY_VYLEPSENI,
  prodejTvPrav,
  REKLAMA_KANALY,
  vypocetDomacichTrzeb,
  vychoziStadion,
  vylepsiStadion,
  zmenStadion,
  zvolSponzora,
} from '../../core/finance'
import type { StadionVylepseniTyp } from '../../core/types'
import { kc } from '../../core/hodnoty'
import { dopadPlatuHrace, mesicniPlatyTymu, ocekavanyPlat, rocniPlatyTymu, zmenPlat, zmenPlatyVsech, type ZmenaPlatuTymu } from '../../core/platy'
import type { GameState } from '../../core/types'
import { overall } from '../../core/sestava'
import { ulozHru } from '../store'

type Zalozka = 'prehled' | 'platy' | 'stadion' | 'marketing' | 'denik'

export function Finance({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const [zalozka, setZalozka] = useState<Zalozka>('prehled')
  const [upravPlat, setUpravPlat] = useState<Record<string, number>>({})
  const [hlaska, setHlaska] = useState('')
  const muj = hra.tymy[hra.mujKlubId]
  const cashflow = mesicniCashflow(hra)
  const odhadDomaci = vypocetDomacichTrzeb(hra, false)
  const navstevnost = odhadDomaci.navstevnost
  const faktorCeny = faktorCenyVstupneho(hra)
  const navstevnostPriZakladu = Math.round(navstevnost / faktorCeny)
  const nabidky = nabidkySponzora(hra)
  const liga = hra.ligy.find((l) => l.tymy.includes(hra.mujKlubId))!.uroven
  const zakladListku = vychoziStadion(liga).cenaListku
  const muzeOslovit = hra.den - hra.posledniOslovSponzory >= 30
  const maTv = hra.marketing.some((m) => m.typ === 'tvp' && m.doSezony === hra.sezona)
  const celkemPlaty = mesicniPlatyTymu(muj.hraci)
  const celkemNavrh = muj.hraci.reduce((sum, h) => sum + (upravPlat[h.id] ?? h.plat), 0)
  const maZmenyPlatu = celkemNavrh !== celkemPlaty

  function uloz(s: GameState, zprava?: string) {
    setHra(s)
    void ulozHru(0, s)
    if (zprava) setHlaska(zprava)
  }

  function zvol(typ: 'jistota' | 'bonus') {
    uloz(zvolSponzora(hra, typ))
  }

  function ulozPlat(hracId: string) {
    const novy = upravPlat[hracId]
    if (novy === undefined) return
    try {
      uloz(zmenPlat(hra, hracId, novy))
      setUpravPlat((prev) => {
        const next = { ...prev }
        delete next[hracId]
        return next
      })
    } catch (e) {
      setHlaska(`❌ ${(e as Error).message}`)
    }
  }

  function ulozPlatyVsech(zmena: ZmenaPlatuTymu) {
    try {
      uloz(zmenPlatyVsech(hra, zmena))
      setUpravPlat({})
    } catch (e) {
      setHlaska(`❌ ${(e as Error).message}`)
    }
  }

  function vylepsi(typ: StadionVylepseniTyp) {
    try {
      uloz(vylepsiStadion(hra, typ))
    } catch (e) {
      setHlaska(`❌ ${(e as Error).message}`)
    }
  }

  const vylepseni = hra.stadion.vylepseni ?? { tribuny: 0, obcerstveni: 0, obchod: 0 }
  const stadionPolozky: { typ: StadionVylepseniTyp; popis: string }[] = [
    { typ: 'tribuny', popis: 'Více míst pro diváky' },
    { typ: 'obcerstveni', popis: 'Víc prodaného jídla a pití' },
    { typ: 'obchod', popis: 'Víc prodaného merche' },
  ]
  const maxJidlo = 200 + vylepseni.obcerstveni * 30
  const maxPiti = 120 + vylepseni.obcerstveni * 20
  const maxMerch = 600 + vylepseni.obchod * 70

  const Zalozky = (
    <div className="sub-zalozky">
      {(['prehled', 'platy', 'stadion', 'marketing', 'denik'] as const).map((z) => (
        <button key={z} className={`sub-zalozka ${zalozka === z ? 'aktivni' : ''}`} onClick={() => setZalozka(z)}>
          {z === 'prehled' ? 'Přehled' : z === 'platy' ? 'Platy' : z === 'stadion' ? 'Stadion' : z === 'marketing' ? 'Marketing' : 'Účetní deník'}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <h2>Finance</h2>
      {hlaska && <p className="hlaska">{hlaska}</p>}
      {Zalozky}

      {zalozka === 'prehled' && (
        <div className="mrizka-3">
          <div className="karta" style={{ textAlign: 'center' }}>
            <h3>Zůstatek</h3>
            <div className={muj.rozpocet >= 0 ? 'skore vyhra' : 'skore prohra'} style={{ fontSize: 30 }}>{kc(muj.rozpocet)}</div>
          </div>
          <div className="karta">
            <h3>Měsíční cashflow</h3>
            <div className="zprava">
              Sponzor{hra.sponzorNabidka ? ' (čeká na smlouvu)' : ' (efektivní)'}:{' '}
              {hra.sponzorNabidka ? '—' : `+${kc(cashflow.sponzor)}`}
            </div>
            <div className="zprava">Stadion (~{Math.round(cashflow.stadion / Math.max(1, odhadDomaci.celkem))} domácí): +{kc(cashflow.stadion)}</div>
            <div className="zprava">Marketing: +{kc(cashflow.marketing)}</div>
            <div className="zprava">Platy: −{kc(cashflow.platy)}</div>
            <div className={cashflow.bilance >= 0 ? 'vyhra' : 'prohra'} style={{ paddingTop: 6, fontWeight: 700 }}>
              Bilance: {cashflow.bilance >= 0 ? '+' : ''}{kc(cashflow.bilance)}
            </div>
            <p style={{ fontSize: 12, color: 'var(--tlumeny)', marginBottom: 0 }}>Uzávěrka za {cashflow.dnuDoUzaverky} dní</p>
          </div>
          <div className="karta">
            <h3>Sponzorská smlouva</h3>
            {hra.sponzorNabidka ? (
              <>
                <p style={{ color: 'var(--zlata)' }}>Vyber smlouvu — teprve po podpisu se započte do cashflow:</p>
                <button className="tlacitko sekundarni" onClick={() => zvol('jistota')}>Jistota {kc(nabidky.jistota.mesicne)}/měs</button>{' '}
                <button className="tlacitko sekundarni" onClick={() => zvol('bonus')}>Bonus {kc(nabidky.bonus.mesicne)} + výhry</button>
              </>
            ) : (
              <p>
                {hra.sponzor.typ === 'jistota' ? 'Jistota' : 'Bonusová'}: {kc(hra.sponzor.mesicne)}/měs
                {hra.sponzor.zaVyhru > 0 && ` + ${kc(hra.sponzor.zaVyhru)}/výhra`}
                <span style={{ color: 'var(--tlumeny)', fontSize: 13 }}> · efektivně +{kc(cashflow.sponzor)}/měs (dle důvěry)</span>
              </p>
            )}
          </div>
        </div>
      )}

      {zalozka === 'platy' && (
        <>
          <div className="karta platy-souhrn">
            <div className="platy-souhrn-radek">
              <span>Celkové náklady na platy</span>
              <b className="prohra">{kc(celkemPlaty)}/měs</b>
            </div>
            <div className="platy-souhrn-radek">
              <span>Ročně (12×)</span>
              <b>{kc(rocniPlatyTymu(muj.hraci))}</b>
            </div>
            <div className="platy-souhrn-radek">
              <span>Podíl na měsíčních příjmech</span>
              <b>{cashflow.prijmy > 0 ? `${Math.round((celkemPlaty / cashflow.prijmy) * 100)} %` : '—'}</b>
            </div>
            {maZmenyPlatu && (
              <p className="platy-souhrn-navrh">
                Po neuložených úpravách: <b className="prohra">{kc(celkemNavrh)}/měs</b>
                {' '}({celkemNavrh >= celkemPlaty ? '+' : ''}{kc(celkemNavrh - celkemPlaty)})
              </p>
            )}
            <p style={{ fontSize: 12, color: 'var(--tlumeny)', margin: '8px 0 0' }}>
              {muj.hraci.length} hráčů · uzávěrka za {cashflow.dnuDoUzaverky} dní strhne −{kc(celkemPlaty)}
            </p>
            <div className="platy-hromadne">
              <span className="platy-hromadne-popis">Upravit všechny platy najednou:</span>
              <div className="platy-hromadne-tlacitka">
                <button type="button" className="tlacitko-mini sekundarni" onClick={() => ulozPlatyVsech({ typ: 'procenta', hodnota: -10 })}>−10 %</button>
                <button type="button" className="tlacitko-mini sekundarni" onClick={() => ulozPlatyVsech({ typ: 'procenta', hodnota: -5 })}>−5 %</button>
                <button type="button" className="tlacitko-mini sekundarni" onClick={() => ulozPlatyVsech({ typ: 'delta', castka: -50_000 })}>−50 tis.</button>
                <button type="button" className="tlacitko-mini sekundarni" onClick={() => ulozPlatyVsech({ typ: 'delta', castka: -10_000 })}>−10 tis.</button>
                <button type="button" className="tlacitko-mini sekundarni" onClick={() => ulozPlatyVsech({ typ: 'delta', castka: 10_000 })}>+10 tis.</button>
                <button type="button" className="tlacitko-mini sekundarni" onClick={() => ulozPlatyVsech({ typ: 'delta', castka: 50_000 })}>+50 tis.</button>
                <button type="button" className="tlacitko-mini sekundarni" onClick={() => ulozPlatyVsech({ typ: 'procenta', hodnota: 5 })}>+5 %</button>
                <button type="button" className="tlacitko-mini sekundarni" onClick={() => ulozPlatyVsech({ typ: 'procenta', hodnota: 10 })}>+10 %</button>
              </div>
            </div>
          </div>
          <div className="karta tabulka-scroll">
          <table>
            <thead>
              <tr><th>Hráč</th><th>OVR</th><th>Plat/měs</th><th>Očekávaný</th><th>Náhled</th><th></th></tr>
            </thead>
            <tbody>
              {[...muj.hraci].sort((a, b) => b.plat - a.plat).map((h) => {
                const navrh = upravPlat[h.id] ?? h.plat
                const dopad = dopadPlatuHrace(h, navrh)
                const novaForma = Math.min(70, Math.max(30, h.forma + dopad.forma))
                const novaMoralka = Math.min(70, Math.max(30, muj.moralka + dopad.moralka))
                const podil = celkemPlaty > 0 ? Math.round((h.plat / celkemPlaty) * 100) : 0
                return (
                  <tr key={h.id}>
                    <td>{h.jmeno} {h.prijmeni}</td>
                    <td>{overall(h)}</td>
                    <td>
                      <input type="number" step={10000} value={navrh}
                        onChange={(e) => setUpravPlat({ ...upravPlat, [h.id]: Number(e.target.value) })} style={{ width: 110 }} />
                      <span className="plat-podil" title="Podíl na celkových nákladech">{podil} %</span>
                    </td>
                    <td>{kc(ocekavanyPlat(h))}</td>
                    <td className="plat-nahled">
                      Forma {h.forma}→{novaForma} · Morálka {muj.moralka}→{novaMoralka}
                    </td>
                    <td>
                      <button className="tlacitko-mini sekundarni" disabled={navrh === h.plat} onClick={() => ulozPlat(h.id)}>Uložit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="platy-celkem">
                <td colSpan={2}><b>Celkem</b> ({muj.hraci.length} hráčů)</td>
                <td><b className="prohra">{kc(maZmenyPlatu ? celkemNavrh : celkemPlaty)}/měs</b></td>
                <td colSpan={3} style={{ color: 'var(--tlumeny)', fontSize: 13 }}>
                  Ročně {kc((maZmenyPlatu ? celkemNavrh : celkemPlaty) * 12)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}

      {zalozka === 'stadion' && (
        <div className="mrizka">
          <div className="karta">
            <h3>Vylepšení stadionu</h3>
            <p className="prestupy-napoveda">Jednorázová investice — vyšší úroveň = víc diváků nebo víc prodaného zboží.</p>
            <div className="stadion-vylepseni">
              {stadionPolozky.map(({ typ, popis }) => {
                const lvl = vylepseni[typ]
                const cena = cenaVylepseniStadionu(hra, typ)
                const max = lvl >= 3
                return (
                  <div key={typ} className="stadion-vylepseni-karta">
                    <div className="stadion-vylepseni-hlavicka">
                      <b>{typ === 'tribuny' ? 'Tribuny' : typ === 'obcerstveni' ? 'Občerstvení' : 'Fan shop'}</b>
                      <span className="pill">{lvl}/3</span>
                    </div>
                    <p className="stadion-vylepseni-uroven">{POPISY_VYLEPSENI[typ][lvl]}</p>
                    <p style={{ fontSize: 12, color: 'var(--tlumeny)', margin: '4px 0 8px' }}>{popis}</p>
                    {max ? (
                      <span className="pill pill-ok">Maximální úroveň</span>
                    ) : (
                      <button
                        type="button"
                        className="tlacitko sekundarni tlacitko-mini"
                        disabled={muj.rozpocet < (cena ?? 0)}
                        onClick={() => vylepsi(typ)}
                      >
                        Vylepšit na „{POPISY_VYLEPSENI[typ][lvl + 1]}" (−{kc(cena ?? 0)})
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="karta">
            <h3>Ceny na stadionu</h3>
            <label>Vstupné ({zakladListku} Kč základ)</label>
            <input type="range" min={Math.round(zakladListku * 0.6)} max={Math.round(zakladListku * 1.4)} value={hra.stadion.cenaListku}
              onChange={(e) => uloz(zmenStadion(hra, { cenaListku: Number(e.target.value) }))} />
            <p>{hra.stadion.cenaListku} Kč / lístek</p>
            <label>Jídlo (max {maxJidlo} Kč)</label>
            <input type="range" min={40} max={maxJidlo} value={hra.stadion.cenaJidla}
              onChange={(e) => uloz(zmenStadion(hra, { cenaJidla: Number(e.target.value) }))} />
            <p>{hra.stadion.cenaJidla} Kč</p>
            <label>Pití (max {maxPiti} Kč)</label>
            <input type="range" min={30} max={maxPiti} value={hra.stadion.cenaPiti ?? 50}
              onChange={(e) => uloz(zmenStadion(hra, { cenaPiti: Number(e.target.value) }))} />
            <p>{hra.stadion.cenaPiti ?? 50} Kč</p>
            <label>Merch (max {maxMerch} Kč)</label>
            <input type="range" min={100} max={maxMerch} value={hra.stadion.cenaMerch}
              onChange={(e) => uloz(zmenStadion(hra, { cenaMerch: Number(e.target.value) }))} />
            <p>{hra.stadion.cenaMerch} Kč</p>
            <h4>Odhad příštího domácího</h4>
            <p>
              ~{navstevnost.toLocaleString('cs-CZ')} diváků
              {Math.abs(faktorCeny - 1) > 0.02 && (
                <span style={{ color: faktorCeny >= 1 ? 'var(--vyhra)' : 'var(--prohra)', fontSize: 13 }}>
                  {' '}({faktorCeny >= 1 ? '+' : ''}{Math.round((faktorCeny - 1) * 100)} % oproti základní ceně)
                </span>
              )}
              {' '}→ tržby <b>{kc(odhadDomaci.celkem)}</b>
            </p>
            <p style={{ fontSize: 13, color: 'var(--tlumeny)', marginTop: 4 }}>
              Vstupné {kc(odhadDomaci.vstupne)} · jídlo {kc(odhadDomaci.jidlo)} · pití {kc(odhadDomaci.piti)} · merch {kc(odhadDomaci.merch)}
              <br />
              Při základní ceně ({zakladListku} Kč) by přišlo ~{navstevnostPriZakladu.toLocaleString('cs-CZ')} diváků.
            </p>
          </div>
          <div className="karta">
            <h3>Poslední domácí zápas</h3>
            {!hra.posledniDomaci ? (
              <p style={{ color: 'var(--tlumeny)' }}>Zatím žádný domácí zápas v této sezóně.</p>
            ) : (
              <>
                <p>Den {hra.posledniDomaci.den}</p>
                <div className="zprava">Diváci: {hra.posledniDomaci.navstevnost.toLocaleString('cs-CZ')}</div>
                <div className="zprava">Vstupné: +{kc(hra.posledniDomaci.vstupne)}</div>
                <div className="zprava">Jídlo: +{kc(hra.posledniDomaci.jidlo)}</div>
                <div className="zprava">Pití: +{kc(hra.posledniDomaci.piti ?? 0)}</div>
                <div className="zprava">Merch: +{kc(hra.posledniDomaci.merch)}</div>
                <b>Celkem: +{kc(hra.posledniDomaci.vstupne + hra.posledniDomaci.jidlo + (hra.posledniDomaci.piti ?? 0) + hra.posledniDomaci.merch)}</b>
              </>
            )}
          </div>
        </div>
      )}

      {zalozka === 'marketing' && (
        <div className="mrizka">
          <div className="karta">
            <h3>Koupit reklamu</h3>
            <p className="prestupy-napoveda">
              Zaplať kampaň — okamžitě zvedne náladu fanoušků a na pár týdnů přiláká víc diváků na stadion.
            </p>
            {bonusNavstevnostiZReklamy(hra) > 0 && (
              <p className="vyhra" style={{ fontSize: 13 }}>
                Aktivní reklama: +{Math.round(bonusNavstevnostiZReklamy(hra) * 100)} % návštěvnost
              </p>
            )}
            <div className="reklama-kanaly">
              {REKLAMA_KANALY.map((kanal) => {
                const aktivni = aktivniReklama(hra, kanal.typ)
                const cena = cenaReklamy(hra, kanal.typ)
                const ikona = kanal.typ === 'tv' ? '📺' : kanal.typ === 'radio' ? '📻' : '📰'
                return (
                  <div key={kanal.typ} className={`reklama-karta ${aktivni ? 'aktivni' : ''}`}>
                    <div className="reklama-karta-hlavicka">
                      <span>{ikona} <b>{kanal.nazev}</b></span>
                      <span className="prohra">{kc(cena)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--tlumeny)', margin: '6px 0' }}>{kanal.popis}</p>
                    <p style={{ fontSize: 12, margin: '0 0 8px' }}>
                      {kanal.dnu} dní · +{kanal.naladaOkamzite} nálada · +{Math.round(kanal.bonusNavstevnost * 100)} % diváci
                    </p>
                    {aktivni ? (
                      <span className="pill pill-ok">Běží do dne {aktivni.doDne}</span>
                    ) : (
                      <button
                        className="tlacitko sekundarni tlacitko-mini"
                        disabled={muj.rozpocet < cena}
                        onClick={() => {
                          try {
                            uloz(kupReklamu(hra, kanal.typ), `📣 Reklama v ${kanal.nazev.toLowerCase()} spuštěna!`)
                          } catch (e) {
                            setHlaska(`❌ ${(e as Error).message}`)
                          }
                        }}
                      >
                        Koupit reklamu
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="karta">
            <h3>Sponzoři — příjmy</h3>
            {hra.marketing.length === 0 ? (
              <p style={{ color: 'var(--tlumeny)' }}>Zatím žádné smlouvy. Oslov sponzory podle výsledků v tabulce.</p>
            ) : (
              <table>
                <thead><tr><th>Smlouva</th><th>Typ</th><th>Měsíčně</th><th>Do sezóny</th></tr></thead>
                <tbody>
                  {hra.marketing.map((m, i) => (
                    <tr key={i}>
                      <td>{m.nazev}</td>
                      <td>{m.typ === 'dres' ? 'Dres' : m.typ === 'led' ? 'LED' : 'TV práva'}</td>
                      <td className="vyhra">+{kc(m.mesicne)}</td>
                      <td>{m.doSezony}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ marginTop: 12 }}>
              Celkem měsíčně: <b className="vyhra">+{kc(cashflow.marketing)}</b>
            </p>
          </div>
          <div className="karta">
            <h3>Nové příležitosti</h3>
            <button
              className="tlacitko sekundarni"
              disabled={!muzeOslovit}
              onClick={() => {
                try { uloz(oslovSponzory(hra), '🤝 Noví sponzoři osloveni!') }
                catch (e) { setHlaska(`❌ ${(e as Error).message}`) }
              }}
            >
              Oslovit sponzory
            </button>
            {!muzeOslovit && <p style={{ fontSize: 13, color: 'var(--tlumeny)' }}>Lze znovu za {30 - (hra.den - hra.posledniOslovSponzory)} dní</p>}
            <button
              className="tlacitko sekundarni"
              style={{ marginTop: 8 }}
              disabled={maTv}
              onClick={() => {
                try { uloz(prodejTvPrav(hra), '📺 TV práva prodána!') }
                catch (e) { setHlaska(`❌ ${(e as Error).message}`) }
              }}
            >
              Prodat TV práva
            </button>
            {maTv && <p style={{ fontSize: 13, color: 'var(--tlumeny)' }}>TV práva už máš tuto sezónu</p>}
            <p style={{ fontSize: 13, color: 'var(--tlumeny)', marginTop: 12 }}>
              Nabídky závisí na pozici v tabulce a náladě fanoušků.
            </p>
          </div>
        </div>
      )}

      {zalozka === 'denik' && (
        <div className="karta">
          <h3>Účetní deník</h3>
          {hra.financeHistorie.length === 0 ? (
            <p style={{ color: 'var(--tlumeny)' }}>Zatím žádné záznamy.</p>
          ) : (
            <table>
              <thead><tr><th>Den</th><th>Popis</th><th>Částka</th></tr></thead>
              <tbody>
                {hra.financeHistorie.slice(0, 30).map((z, i) => (
                  <tr key={i}>
                    <td>{z.den}</td>
                    <td>{z.popis}</td>
                    <td className={z.castka >= 0 ? 'vyhra' : 'prohra'}>{z.castka >= 0 ? '+' : ''}{kc(z.castka)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  )
}
