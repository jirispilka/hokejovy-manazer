/**
 * Doplní detailPozice do soupisky.json z reálných gólů/asistencí (rychlé, offline).
 * Pro EP data spusť: node scripts/dopln-z-eliteprospects.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VYSTUP = path.join(__dirname, '../src/core/data/soupisky.json')

function hash(klic) {
  let h = 0
  for (const z of klic) h = (h * 31 + z.charCodeAt(0)) >>> 0
  return h
}

function odvodDetailPozice(h) {
  if (h.pozice === 'G') return undefined
  const klic = `${h.jmeno}-${h.prijmeni}`
  const golPodil = (h.goly - h.asistence) / Math.max(1, h.goly + h.asistence)
  if (h.pozice === 'D') {
    if (golPodil > 0.15) return 'LD'
    if (golPodil < -0.15) return 'RD'
    return hash(klic) % 2 === 0 ? 'LD' : 'RD'
  }
  if (golPodil > 0.12) return hash(klic) % 2 === 0 ? 'LW' : 'RW'
  if (golPodil < -0.12) return 'C'
  return hash(klic) % 2 === 0 ? 'LW' : 'RW'
}

async function main() {
  const data = JSON.parse(await readFile(VYSTUP, 'utf8'))
  let doplneno = 0
  for (const hraci of Object.values(data)) {
    for (const h of hraci) {
      if (h.detailPozice) continue
      const dp = odvodDetailPozice(h)
      if (dp) {
        h.detailPozice = dp
        doplneno++
      }
    }
  }
  await writeFile(VYSTUP, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`detailPozice doplněno: ${doplneno} hráčů`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
