/**
 * Doplní soupisky.json o historii (aktuální sezóna + profil hokej.cz) a věk z profilu.
 * Spuštění: node scripts/obohat-historie.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const VYSTUP = path.join(ROOT, 'src/core/data/soupisky.json')
const KLUBY = path.join(ROOT, 'src/core/data/kluby.json')
const HOKEJ_ORIGIN = 'https://www.hokej.cz'

const NAZVY_LIG = ['Tipsport extraliga', 'Chance liga', '2. liga']
const SEZONA = '2025/26'

const ZDROJE = [
  'https://www.hokej.cz/tipsport-extraliga/stats-center?season=2025&competition=7537&stranger=0&stats-all=1&t=8',
  'https://www.hokej.cz/tipsport-extraliga/stats-center?season=2025&competition=7537&stranger=0&stats-section=goalkeeper&stats-all=1&t=8',
  'https://www.hokej.cz/maxa-liga/stats-center?season=2025&competition=7538&stranger=0&stats-all=1&t=66',
  'https://www.hokej.cz/maxa-liga/stats-center?season=2025&competition=7538&stranger=0&stats-section=goalkeeper&stats-all=1&t=66',
  'https://www.hokej.cz/druha-liga/player-stats/detailni?stats-filter-season=2025&stats-filter-competition=7539&stats-all=1&t=66',
  'https://www.hokej.cz/druha-liga/player-stats/detailni?t=66&stats-filter-season=2025&stats-filter-competition=7539&stats-menu-section=goalkeeper&stats-all=1',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function strip(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function normalizuj(text) {
  return decodeHtml(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
}

function klicJmena(jmeno, prijmeni) {
  return normalizuj(`${jmeno} ${prijmeni}`)
}

async function stahni(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'hokej-manazer/1.0 (+local data import)', accept: 'text/html' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

function mapaProfilu(html) {
  const mapa = new Map()
  for (const m of html.matchAll(/<a\b[^>]*href="(\/hrac\/[^"]+)"[^>]*>([^<]+)<\/a>/gi)) {
    const url = new URL(decodeHtml(m[1]), HOKEJ_ORIGIN).toString()
    const jmeno = strip(m[2])
    const casti = jmeno.split(/\s+/).filter(Boolean)
    if (casti.length < 2) continue
    mapa.set(klicJmena(casti.slice(0, -1).join(' '), casti.at(-1)), url)
  }
  return mapa
}

function parsujVekProfilu(html) {
  const narozen = html.match(/person-info-title[^>]*>narozen<\/h2>\s*<span>(\d{1,2})\.(\d{1,2})\.(\d{4})<\/span>/i)
  if (narozen) return 2026 - Number(narozen[3])
  const vek = html.match(/person-info-title[^>]*>v[eě]k<\/h2>\s*<span>(\d+)\s*let<\/span>/i)
  if (vek) return Number(vek[1])
  return null
}

function parsujHistoriiProfilu(html) {
  const historie = []
  for (const tabulka of [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[1])) {
    const hlavicka = strip(tabulka.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? '')
    if (!/(sez|season|sout[eě]ž|liga)/i.test(hlavicka)) continue
    if (!/(z|gp|g|a|b)/i.test(hlavicka)) continue
    for (const radek of [...tabulka.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1])) {
      const bunky = [...radek.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => strip(m[1]))
      if (bunky.length < 5) continue
      const sezona = bunky.find((b) => /\d{4}/.test(b))
      if (!sezona) continue
      const cisla = bunky.map((b) => Number(b.replace(/[^\d]/g, '')) || 0)
      const zapasy = cisla.find((n, i) => i > 0 && n > 0 && n < 90) ?? 0
      const goly = cisla.find((n, i) => i > 1 && n <= 80) ?? 0
      const asistence = cisla.find((n, i) => i > 2 && n <= 80) ?? 0
      historie.push({
        sezona,
        soutez: bunky.find((b) => /liga|elh|extraliga|chance|maxa/i.test(b)) ?? '',
        tym: bunky.find((b, i) => i > 0 && /[A-Za-zÁ-ž]/.test(b) && !/\d{4}/.test(b)) ?? '',
        zapasy,
        goly,
        asistence,
        body: goly + asistence,
      })
    }
  }
  return historie.slice(0, 12)
}

function historieAktualni(hrac, soutez, tym) {
  return {
    sezona: SEZONA,
    soutez,
    tym,
    zapasy: hrac.zapasy,
    goly: hrac.goly,
    asistence: hrac.asistence,
    body: hrac.goly + hrac.asistence,
  }
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

async function main() {
  const kluby = JSON.parse(await readFile(KLUBY, 'utf8'))
  const data = JSON.parse(await readFile(VYSTUP, 'utf8'))
  const nazvy = Object.fromEntries(kluby.map((k) => [k.id, k.nazev]))
  const ligy = Object.fromEntries(kluby.map((k) => [k.id, k.liga]))

  const profily = new Map()
  for (const url of ZDROJE) {
    const html = await stahni(url)
    for (const [k, v] of mapaProfilu(html)) profily.set(k, v)
    await sleep(400)
  }
  console.log(`Nalezeno ${profily.size} profilovych odkazu`)

  let sHistorii = 0
  let sVekem = 0
  for (const [klubId, hraci] of Object.entries(data)) {
    const soutez = NAZVY_LIG[ligy[klubId] ?? 2]
    const tym = nazvy[klubId] ?? klubId
    for (const h of hraci) {
      const klic = klicJmena(h.jmeno, h.prijmeni)
      const profilUrl = profily.get(klic)
      const zaklad = [historieAktualni(h, soutez, tym)]
      if (profilUrl && ligy[klubId] <= 1) {
        try {
          const html = await stahni(profilUrl)
          const vek = parsujVekProfilu(html)
          if (vek && vek >= 16 && vek <= 45) {
            h.vek = vek
            sVekem++
          }
          const zProfilu = parsujHistoriiProfilu(html)
          if (zProfilu.length) {
            h.historieStatistik = [...zProfilu, ...zaklad.filter((z) => !zProfilu.some((p) => p.sezona === z.sezona))]
          } else {
            h.historieStatistik = zaklad
          }
          await sleep(350)
        } catch (e) {
          console.warn(`Profil ${h.jmeno} ${h.prijmeni}: ${e.message}`)
          h.historieStatistik = zaklad
        }
      } else {
        h.historieStatistik = zaklad
      }
      if (h.historieStatistik?.length) sHistorii++
      h.trzniCena = odhadniTrzniCenu(h, ligy[klubId] ?? 2)
    }
  }

  await writeFile(VYSTUP, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`Ulozeno. Historie: ${sHistorii}, vek z profilu: ${sVekem}`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
