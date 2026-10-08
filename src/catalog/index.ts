import type { CatalogEntry, Exercise } from '../types';

let cache: Promise<CatalogEntry[]> | undefined;

/** Loads the built catalog (a separate precached chunk). */
export function loadCatalog(): Promise<CatalogEntry[]> {
  if (!cache) {
    cache = import('./catalog.generated.json').then((m) => (m.default as CatalogEntry[]));
  }
  return cache;
}

/** Copies a catalog entry into a library exercise. Later catalog changes never affect the copy. */
export function exerciseFromCatalog(entry: CatalogEntry): Omit<Exercise, 'id' | 'archived'> {
  return {
    name: entry.name,
    nameEn: entry.nameEn,
    type: entry.type,
    primary: [...entry.primary],
    secondary: [...entry.secondary],
    description: entry.description,
    catalogId: entry.id,
  };
}
