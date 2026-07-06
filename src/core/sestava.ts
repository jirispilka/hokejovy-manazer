import type { Hrac, Sestava, Tym } from './types'

export function overall(h: Hrac): number {
  const a = h.atributy
  const vazeny =
    h.pozice === 'G'
      ? a.chytani * 0.7 + a.brusleni * 0.15 + a.fyzicka * 0.15
      : h.pozice === 'D'
        ? a.obrana * 0.35 + a.brusleni * 0.2 + a.fyzicka * 0.2 + a.prihravky * 0.15 + a.strelba * 0.1
        : a.strelba * 0.3 + a.prihravky * 0.25 + a.brusleni * 0.25 + a.fyzicka * 0.1 + a.obrana * 0.1
  return Math.round(vazeny)
}

export function vychoziSestava(hraci: Hrac[]): Sestava {
  const podleOverall = (poz: string) =>
    hraci.filter((h) => h.pozice === poz).sort((x, y) => overall(y) - overall(x))
  const utocnici = podleOverall('U')
  const obranci = podleOverall('D')
  const brankari = podleOverall('G')
  return {
    utoky: [0, 1, 2, 3].map((i) => utocnici.slice(i * 3, i * 3 + 3).map((h) => h.id)),
    obrany: [0, 1, 2].map((i) => obranci.slice(i * 2, i * 2 + 2).map((h) => h.id)),
    brankar: brankari[0].id,
  }
}

// efektivní síla hráče: overall upravený formou (±20 %) a únavou (až −30 %)
function efektivni(h: Hrac): number {
  return overall(h) * (1 + (h.forma - 50) / 100) * (1 - (h.unava / 100) * 0.3)
}

export function silaTymu(t: Tym): { utok: number; obrana: number; brankar: number } {
  const podleId = new Map(t.hraci.map((h) => [h.id, h]))
  const prumerLajny = (l: string[]) =>
    l.reduce((s, id) => s + efektivni(podleId.get(id)!), 0) / l.length
  // první lajny hrají víc → vyšší váha
  const vahyUtoku = [0.35, 0.28, 0.22, 0.15]
  const vahyObran = [0.4, 0.35, 0.25]
  const utok = t.sestava.utoky.reduce((s, l, i) => s + prumerLajny(l) * vahyUtoku[i], 0)
  const obrana = t.sestava.obrany.reduce((s, l, i) => s + prumerLajny(l) * vahyObran[i], 0)
  const brankar = efektivni(podleId.get(t.sestava.brankar)!)
  return { utok, obrana, brankar }
}

export function vymenVSestave(s: Sestava, idA: string, idB: string): Sestava {
  const nahrad = (id: string) => (id === idA ? idB : id === idB ? idA : id)
  return {
    utoky: s.utoky.map((l) => l.map(nahrad)),
    obrany: s.obrany.map((l) => l.map(nahrad)),
    brankar: nahrad(s.brankar),
  }
}
