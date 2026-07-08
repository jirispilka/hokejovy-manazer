import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const VYSTUP = path.join(ROOT, 'src/core/data/soupisky.json')
const KLUBY = path.join(ROOT, 'src/core/data/kluby.json')
const HOKEJ_ORIGIN = 'https://www.hokej.cz'

const ZDROJE = [
  {
    nazev: 'Tipsport ELH - hraci',
    url: 'https://www.hokej.cz/tipsport-extraliga/stats-center?season=2025&competition=7537&stranger=0&stats-all=1&t=8',
    typ: 'elhHraci',
  },
  {
    nazev: 'Tipsport ELH - brankari',
    url: 'https://www.hokej.cz/tipsport-extraliga/stats-center?season=2025&competition=7537&stranger=0&stats-section=goalkeeper&stats-all=1&t=8',
    typ: 'elhBrankari',
  },
  {
    nazev: 'Maxa liga - hraci',
    url: 'https://www.hokej.cz/maxa-liga/stats-center?season=2025&competition=7538&stranger=0&stats-all=1&t=66',
    typ: 'maxaHraci',
  },
  {
    nazev: 'Maxa liga - brankari',
    url: 'https://www.hokej.cz/maxa-liga/stats-center?season=2025&competition=7538&stranger=0&stats-section=goalkeeper&stats-all=1&t=66',
    typ: 'maxaBrankari',
  },
  {
    nazev: '2. liga - hraci',
    url: 'https://www.hokej.cz/druha-liga/player-stats/detailni?stats-filter-season=2025&stats-filter-competition=7539&stats-all=1&t=66',
    typ: 'druhaHraci',
  },
  {
    nazev: '2. liga - brankari',
    url: 'https://www.hokej.cz/druha-liga/player-stats/detailni?t=66&stats-filter-season=2025&stats-filter-competition=7539&stats-menu-section=goalkeeper&stats-all=1',
    typ: 'druhaBrankari',
  },
]

const ALIASY_TYMU = new Map(
  Object.entries({
    'banes motor c budejovice': 'budejovice',
    'banes motor ceske budejovice': 'budejovice',
    'bk mlada boleslav': 'boleslav',
    'bili tygri liberec': 'liberec',
    'hc dynamo pardubice': 'pardubice',
    'hc energie karlovy vary': 'vary',
    'hc kometa brno': 'kometa',
    'hc ocelaři třinec': 'trinec',
    'hc ocelari trinec': 'trinec',
    'hc olomouc': 'olomouc',
    'hc skoda plzen': 'plzen',
    'hc sparta praha': 'sparta',
    'hc verva litvinov': 'litvinov',
    'hc vitkovice ridera': 'vitkovice',
    'mountfield hk': 'hradec',
    'rytiri kladno': 'kladno',

    'az havirov': 'havirov',
    'hc banik sokolov': 'sokolov',
    'hc dukla jihlava': 'jihlava',
    'hc frydek-mistek': 'frydek',
    'hc frydek mistek': 'frydek',
    'hc rt torax poruba': 'poruba',
    'hc slavia praha': 'slavia',
    'hc stadion litomerice': 'litomerice',
    'hc tabor': 'tabor',
    'hc zubr prerov': 'prerov',
    'lhk jestrabi prostejov': 'prostejov',
    'pirati chomutov': 'chomutov',
    'ri okna berani zlin': 'zlin',
    'sc kolin': 'kolin',
    'sc retia kolin': 'kolin',
    'sk horacka slavia trebic': 'trebic',
    'vhk robe vsetin': 'vsetin',

    'hc decin': 'decin',
    'hc kobra praha': 'kobra',
    'hc leram orli znojmo': 'znojmo',
    'hc most': 'most',
    'hc novy jicin': 'jicin',
    'hk novy jicin': 'jicin',
    'hc pribram': 'pribram',
    'hc slezan opava': 'opava',
    'hc stadion vrchlabi': 'vrchlabi',
    'hc wikov hronov': 'hronov',
    'ihc pisek': 'pisek',
    'orli znojmo': 'znojmo',
    'shc klatovy': 'klatovy',
    'sklh zdar nad sazavou': 'zdar',
  }),
)

const strip = (html) =>
  decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function normalizuj(text) {
  return decodeHtml(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/č/g, 'c')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function bunkyRadku(radek) {
  return [...radek.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => strip(m[1]))
}

function odkazHrace(radek) {
  const bunky = [...radek.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
  const html = bunky[1]?.[1] ?? ''
  const href = html.match(/<a\b[^>]*href="([^"]+)"/i)?.[1]
  if (!href) return undefined
  return new URL(decodeHtml(href), HOKEJ_ORIGIN).toString()
}

function prvniTabulkaStatistik(html) {
  const match = html.match(/<table\b[^>]*class="[^"]*table-stats[^"]*"[^>]*>([\s\S]*?)<\/table>/i)
  return match?.[1] ?? ''
}

function radkyTabulky(html) {
  return [...prvniTabulkaStatistik(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1])
}

function pozice(raw) {
  const p = normalizuj(raw)
  if (p === 'o' || p === 'd') return 'D'
  if (p === 'b' || p === 'g' || p.includes('brankar')) return 'G'
  return 'U'
}

function cislo(raw) {
  const n = Number(String(raw).replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function rozdelJmeno(cela) {
  const casti = cela.split(/\s+/).filter(Boolean)
  return {
    jmeno: casti.slice(0, -1).join(' ') || cela,
    prijmeni: casti.at(-1) || cela,
  }
}

function vekZKlice(klic) {
  let hash = 0
  for (const znak of klic) hash = (hash * 31 + znak.charCodeAt(0)) >>> 0
  return 20 + (hash % 17)
}

function idTymu(nazev) {
  return ALIASY_TYMU.get(normalizuj(nazev))
}

function hrac(cela, tym, poz, zapasy, goly, asistence, profilUrl) {
  const jmeno = rozdelJmeno(cela)
  return {
    ...jmeno,
    pozice: poz,
    vek: vekZKlice(`${cela}-${tym}`),
    zapasy: cislo(zapasy),
    goly: cislo(goly),
    asistence: cislo(asistence),
    profilUrl,
  }
}

function parsujHraci(html, typ) {
  const druhaLiga = typ === 'druhaHraci'
  const vysledek = []
  for (const radek of radkyTabulky(html)) {
    const b = bunkyRadku(radek)
    if (b.length < 8 || !/^\d+$/.test(b[0])) continue
    const tymId = idTymu(b[2])
    if (!tymId) continue
    const zaznam = druhaLiga
      ? hrac(b[1], b[2], pozice(b[3]), b[4], b[5], b[6], odkazHrace(radek))
      : hrac(b[1], b[2], pozice(b[3]), b[4], b[6], b[7], odkazHrace(radek))
    vysledek.push([tymId, zaznam])
  }
  return vysledek
}

function parsujBrankari(html) {
  const vysledek = []
  for (const radek of radkyTabulky(html)) {
    const b = bunkyRadku(radek)
    if (b.length < 4 || !/^\d+$/.test(b[0])) continue
    const tymId = idTymu(b[2])
    if (!tymId) continue
    vysledek.push([tymId, hrac(b[1], b[2], 'G', b[3], 0, b[12] ?? 0, odkazHrace(radek))])
  }
  return vysledek
}

async function stahni(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'hokej-manazer/1.0 (+local data import)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`)
  return response.text()
}

function pridej(cil, tymId, zaznam) {
  const klic = `${zaznam.jmeno} ${zaznam.prijmeni} ${zaznam.pozice}`
  cil[tymId] ??= []
  if (!cil[tymId].some((h) => `${h.jmeno} ${h.prijmeni} ${h.pozice}` === klic)) cil[tymId].push(zaznam)
}

function serad(hraci) {
  const rank = { U: 0, D: 1, G: 2 }
  return [...hraci].sort((a, b) => rank[a.pozice] - rank[b.pozice] || b.goly + b.asistence - (a.goly + a.asistence) || b.zapasy - a.zapasy)
}

function omezSoupisku(hraci) {
  const serazeni = serad(hraci)
  const vyber = [
    ...serazeni.filter((h) => h.pozice === 'U').slice(0, 14),
    ...serazeni.filter((h) => h.pozice === 'D').slice(0, 7),
    ...serazeni.filter((h) => h.pozice === 'G').slice(0, 2),
  ]
  return serad(vyber)
}

function parsujHistorii(html) {
  const tabulky = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[1])
  const historie = []
  for (const tabulka of tabulky) {
    const hlavicka = strip(tabulka.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? tabulka)
    if (!/(sez(o|ó)na|season)/i.test(hlavicka) || !/(z|gp|utk|g|a|b|pts)/i.test(hlavicka)) continue
    for (const radek of [...tabulka.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1])) {
      const b = bunkyRadku(radek)
      if (b.length < 6 || !/\d{4}/.test(b[0])) continue
      const nums = b.map(cislo)
      const zapasy = nums.find((n, i) => i > 0 && n > 0 && n < 100) ?? 0
      const goly = nums.find((_, i) => i > 1) ?? 0
      const asistence = nums.find((_, i) => i > 2) ?? 0
      historie.push({
        sezona: b[0],
        soutez: b.find((x) => /liga|elh|extraliga|chance|maxa|junior|dorost/i.test(x)) ?? '',
        tym: b.find((x, i) => i > 0 && /[A-Za-zÁ-ž]/.test(x) && !/liga|season|sezona/i.test(x)) ?? '',
        zapasy,
        goly,
        asistence,
        body: goly + asistence,
      })
    }
  }
  return historie.slice(0, 12)
}

function odhadniTrzniCenu(hrac, liga) {
  const uroven = liga === 0 ? 1 : liga === 1 ? 0.42 : 0.16
  const bodyNaZapas = (hrac.goly + hrac.asistence) / Math.max(1, hrac.zapasy)
  const historickyVykon = (hrac.historieStatistik ?? []).reduce((sum, s) => sum + s.body / Math.max(1, s.zapasy), 0)
  const historieBonus = Math.min(0.6, historickyVykon / 20)
  const vekBonus = hrac.vek <= 22 ? 1.45 : hrac.vek <= 26 ? 1.25 : hrac.vek <= 30 ? 1 : hrac.vek <= 34 ? 0.7 : 0.45
  const poziceBonus = hrac.pozice === 'G' ? 1.1 : hrac.pozice === 'D' ? 0.92 : 1
  const zaklad = 1_200_000 + 18_000_000 * uroven * Math.min(1.4, bodyNaZapas + historieBonus)
  return Math.round((zaklad * vekBonus * poziceBonus) / 10_000) * 10_000
}

async function obohatHistorii(data, kluby) {
  const ligaKlubu = new Map(kluby.map((k) => [k.id, k.liga]))
  let pocetHistorii = 0
  for (const [klubId, hraci] of Object.entries(data)) {
    for (const h of hraci) {
      if (h.profilUrl) {
        try {
          h.historieStatistik = parsujHistorii(await stahni(h.profilUrl))
        } catch (error) {
          console.warn(`Historie se nepodarila: ${h.jmeno} ${h.prijmeni}: ${error.message}`)
        }
      }
      if (h.historieStatistik?.length) pocetHistorii++
      else delete h.historieStatistik
      h.trzniCena = odhadniTrzniCenu(h, ligaKlubu.get(klubId) ?? 2)
      delete h.profilUrl
    }
  }
  return pocetHistorii
}

async function main() {
  const kluby = JSON.parse(await readFile(KLUBY, 'utf8'))
  const puvodni = JSON.parse(await readFile(VYSTUP, 'utf8'))
  const data = Object.fromEntries(kluby.map((k) => [k.id, []]))
  const statistika = []

  for (const zdroj of ZDROJE) {
    const html = await stahni(zdroj.url)
    const radky = zdroj.typ.endsWith('Brankari') ? parsujBrankari(html) : parsujHraci(html, zdroj.typ)
    for (const [tymId, zaznam] of radky) pridej(data, tymId, zaznam)
    statistika.push(`${zdroj.nazev}: ${radky.length}`)
  }

  const fallbacky = []
  for (const klub of kluby) {
    data[klub.id] = serad(data[klub.id])
    if (data[klub.id].length < 10) {
      const existujici = puvodni[klub.id] ?? []
      for (const zaznam of existujici) pridej(data, klub.id, zaznam)
      data[klub.id] = serad(data[klub.id])
      fallbacky.push(`${klub.id} (${data[klub.id].length})`)
    }
    data[klub.id] = omezSoupisku(data[klub.id])
  }

  const pocetProfilovychHistorii = await obohatHistorii(data, kluby)

  await writeFile(VYSTUP, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`Ulozeno: ${path.relative(ROOT, VYSTUP)}`)
  console.log(statistika.join('\n'))
  console.log(`Profilove historie z hokej.cz: ${pocetProfilovychHistorii}`)
  if (fallbacky.length) console.log(`Fallback z dosavadnich dat kvuli chybejicimu pokryti hokej.cz: ${fallbacky.join(', ')}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
