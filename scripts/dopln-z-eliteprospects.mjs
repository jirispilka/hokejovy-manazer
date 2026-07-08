/**
 * Záložní doplnění historie z Elite Prospects (best-effort).
 * Hokej.cz má prioritu — EP doplňuje jen hráče bez historieStatistik.
 * Spuštění: node scripts/dopln-z-eliteprospects.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const VYSTUP = path.join(ROOT, 'src/core/data/soupisky.json')
const KLUBY = path.join(ROOT, 'src/core/data/kluby.json')
const GQL = 'https://gql.eliteprospects.com/'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function normalizuj(text) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
}

async function gql(query, variables = {}) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'HokejManazer/1.0' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`GQL HTTP ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data
}

async function najdiHrace(jmeno, prijmeni) {
  const data = await gql(
    `query($name: String!) {
      search(name: $name, type: PLAYER, limit: 8) {
        edges { node { ... on Player { id name yearOfBirth position } } }
      }
    }`,
    { name: `${jmeno} ${prijmeni}` },
  )
  const edges = data?.search?.edges ?? []
  const cil = normalizuj(`${prijmeni}`)
  const shoda = edges.find((e) => normalizuj(e.node.name).includes(cil))
  return shoda?.node ?? null
}

async function statistikyHrace(id) {
  const data = await gql(
    `query($id: ID!) {
      player(id: $id) {
        stats { edges { season { slug } team { name } league { name } stats {
          regularStats { GP G A PTS }
        } } } }
      }
    }`,
    { id: String(id) },
  )
  const edges = data?.player?.stats?.edges ?? []
  return edges
    .map((e) => {
      const rs = e.stats?.regularStats
      if (!rs?.GP) return null
      const sezona = e.season?.slug?.replace('-', '/') ?? ''
      return {
        sezona: sezona.replace(/(\d{4})-(\d{4})/, '$1/$2'),
        soutez: e.league?.name ?? '',
        tym: e.team?.name ?? '',
        zapasy: rs.GP ?? 0,
        goly: rs.G ?? 0,
        asistence: rs.A ?? 0,
        body: rs.PTS ?? (rs.G ?? 0) + (rs.A ?? 0),
      }
    })
    .filter(Boolean)
    .slice(0, 12)
}

function mapujDetailPozici(raw) {
  if (!raw) return undefined
  const p = String(raw).trim().toUpperCase()
  if (p === 'C' || p === 'CENTER') return 'C'
  if (p === 'LW' || p === 'L' || p === 'LEFT WING') return 'LW'
  if (p === 'RW' || p === 'R' || p === 'RIGHT WING') return 'RW'
  if (p === 'LD' || p === 'LEFT DEFENSE' || p === 'LEFT DEFENCE') return 'LD'
  if (p === 'RD' || p === 'D' || p === 'RIGHT DEFENSE' || p === 'RIGHT DEFENCE') return 'RD'
  return undefined
}

async function main() {
  const kluby = JSON.parse(await readFile(KLUBY, 'utf8'))
  const data = JSON.parse(await readFile(VYSTUP, 'utf8'))
  let doplneno = 0
  let pozice = 0
  let chyby = 0

  for (const klub of kluby) {
    const hraci = data[klub.id] ?? []
    for (const h of hraci) {
      const potrebaHistorie = !(h.historieStatistik?.length > 1)
      const potrebaPozice = !h.detailPozice
      if (!potrebaHistorie && !potrebaPozice) continue
      try {
        const ep = await najdiHrace(h.jmeno, h.prijmeni)
        if (!ep) continue
        if (potrebaPozice) {
          const dp = mapujDetailPozici(ep.position)
          if (dp) {
            h.detailPozice = dp
            pozice++
          }
        }
        if (potrebaHistorie) {
          const stats = await statistikyHrace(ep.id)
          if (stats.length) {
            const existujici = h.historieStatistik ?? []
            const nove = stats.filter((s) => !existujici.some((e) => e.sezona === s.sezona))
            h.historieStatistik = [...nove, ...existujici]
          }
        }
        if (ep.yearOfBirth) {
          const vek = 2026 - ep.yearOfBirth
          if (vek >= 16 && vek <= 45) h.vek = vek
        }
        doplneno++
        await sleep(1100)
      } catch (e) {
        chyby++
        if (chyby <= 5) console.warn(`EP ${h.jmeno} ${h.prijmeni}: ${e.message}`)
      }
    }
  }

  await writeFile(VYSTUP, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`EP doplnění: ${doplneno} hráčů (${pozice} pozic), ${chyby} chyb`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
