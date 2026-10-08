/** Deterministic 32-bit hash of a string mixed with a seed (FNV-1a variant). */
export function hashString(seed: number, s: string): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // final avalanche
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

export function newSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
