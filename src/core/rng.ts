export type Rng = () => number

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pick<T>(rng: Rng, pole: T[]): T {
  return pole[Math.floor(rng() * pole.length)]
}

export function hashSeed(...casti: number[]): number {
  let h = 2166136261 >>> 0
  for (const c of casti) {
    h ^= c >>> 0
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
