import type { CatalogEntry, Exercise } from '../types';

/** Lower case, å/ä -> a, ö -> o, strip spaces, hyphens and punctuation. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/[\s\-_'’.,()/]/g, '');
}

/** Allowed typos for a query of this (normalised) length. */
export function typoBudget(len: number): number {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  return 2;
}

/** Damerau-Levenshtein (optimal string alignment) distance, bounded: returns max+1 early when exceeded. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  let cur: number[] = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, (prev2[j - 2] ?? 0) + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2.length = 0;
    prev2.push(...prev);
    [prev, cur] = [cur, prev];
  }
  return prev[b.length] ?? max + 1;
}

export type MatchKind = 'prefix' | 'substring' | 'fuzzy';

/** How well `query` matches one normalised name; undefined when it does not. */
export function matchName(query: string, name: string): MatchKind | undefined {
  if (query.length === 0) return undefined;
  if (name.startsWith(query)) return 'prefix';
  if (name.includes(query)) return 'substring';
  const budget = typoBudget(query.length);
  if (budget === 0) return undefined;
  // Compare against the prefix of the same length (so "bempres" matches "benpressimaskin") and the whole name.
  if (editDistance(query, name.slice(0, query.length), budget) <= budget) return 'fuzzy';
  if (editDistance(query, name, budget) <= budget) return 'fuzzy';
  return undefined;
}

const KIND_RANK: Record<MatchKind, number> = { prefix: 0, substring: 1, fuzzy: 2 };

export interface SearchableEntry {
  id: string;
  names: string[]; // normalised
  common: number;
  inLibrary: boolean;
}

export interface SearchHit<T> {
  item: T;
  kind: MatchKind;
}

export function searchItems<T>(
  query: string,
  items: T[],
  toSearchable: (item: T) => SearchableEntry,
  limit = 30,
): SearchHit<T>[] {
  const q = normalise(query);
  if (q.length === 0) return [];
  const hits: { item: T; kind: MatchKind; s: SearchableEntry }[] = [];
  for (const item of items) {
    const s = toSearchable(item);
    let best: MatchKind | undefined;
    for (const n of s.names) {
      const k = matchName(q, n);
      if (k && (best === undefined || KIND_RANK[k] < KIND_RANK[best])) best = k;
      if (best === 'prefix') break;
    }
    if (best) hits.push({ item, kind: best, s });
  }
  hits.sort((a, b) => {
    if (a.s.inLibrary !== b.s.inLibrary) return a.s.inLibrary ? -1 : 1;
    if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (a.s.common !== b.s.common) return a.s.common - b.s.common;
    return (a.s.names[0] ?? '').localeCompare(b.s.names[0] ?? '');
  });
  return hits.slice(0, limit).map(({ item, kind }) => ({ item, kind }));
}

export function catalogSearchable(entry: CatalogEntry, inLibrary: boolean): SearchableEntry {
  return {
    id: entry.id,
    names: [normalise(entry.name), normalise(entry.nameEn), ...entry.aliases.map(normalise)],
    common: entry.common,
    inLibrary,
  };
}

export function exerciseSearchable(ex: Exercise): SearchableEntry {
  return {
    id: ex.id,
    names: [normalise(ex.name), ...(ex.nameEn ? [normalise(ex.nameEn)] : [])],
    common: 0,
    inLibrary: true,
  };
}

export function youtubeUrl(ex: Pick<Exercise, 'name' | 'nameEn'>): string {
  const q = `${ex.nameEn ?? ex.name} exercise`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}
