export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, max). */
  nextInt(max: number): number;
  /** Internal state. `createRng(state())` resumes the same sequence. */
  state(): number;
}

/** Seeded PRNG (mulberry32). The same seed always produces the same sequence. */
export function createRng(seed: number): Rng {
  let current = seed >>> 0;

  const next = (): number => {
    current = (current + 0x6d2b79f5) >>> 0;
    let t = current;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt: (max) => Math.floor(next() * max),
    state: () => current,
  };
}
