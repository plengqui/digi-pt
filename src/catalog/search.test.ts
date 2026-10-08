import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../types';
import { catalogSearchable, editDistance, matchName, normalise, searchItems, youtubeUrl } from './search';
import catalogJson from './catalog.generated.json';

const catalog = catalogJson as CatalogEntry[];

describe('normalise', () => {
  it('folds Swedish letters and strips separators', () => {
    expect(normalise('Höftlyft med skiv-stång')).toBe('hoftlyftmedskivstang');
    expect(normalise('Bänkpress')).toBe('bankpress');
  });
});

describe('editDistance', () => {
  it('counts substitutions, insertions and transpositions', () => {
    expect(editDistance('abc', 'abc', 2)).toBe(0);
    expect(editDistance('abc', 'abd', 2)).toBe(1);
    expect(editDistance('abc', 'acb', 2)).toBe(1);
    expect(editDistance('abc', 'abcd', 2)).toBe(1);
    expect(editDistance('abc', 'xyz', 2)).toBeGreaterThan(2);
  });
});

describe('matchName', () => {
  it('ranks prefix, substring and fuzzy', () => {
    expect(matchName('bank', 'bankpress')).toBe('prefix');
    expect(matchName('press', 'bankpress')).toBe('substring');
    expect(matchName('benkpress', 'bankpress')).toBe('fuzzy');
    expect(matchName('bempres', 'benpressimaskin')).toBe('fuzzy');
    expect(matchName('xyz', 'bankpress')).toBeUndefined();
    expect(matchName('bnk', 'bankpress')).toBeUndefined(); // too short for typos
  });
});

describe('catalog search', () => {
  const inLib = new Set(['hip-thrust-barbell']);
  const search = (q: string) => searchItems(q, catalog, (e) => catalogSearchable(e, inLib.has(e.id)));

  it('finds entries by Swedish name, English name and alias, tolerating typos', () => {
    expect(search('hip thrust').some((h) => h.item.id === 'hip-thrust-barbell')).toBe(true);
    expect(search('marklyft').length).toBeGreaterThan(0);
    expect(search('deadlift').length).toBeGreaterThan(0);
    expect(search('latsdrag').length).toBeGreaterThan(0);
    expect(search('bänkpres').length).toBeGreaterThan(0);
  });

  it('ranks library hits first, then prefix matches, then common', () => {
    const hits = search('hip thrust');
    expect(hits[0]?.item.id).toBe('hip-thrust-barbell');
    const rest = hits.slice(1);
    const kinds = rest.map((h) => h.kind);
    const firstNonPrefix = kinds.findIndex((k) => k !== 'prefix');
    if (firstNonPrefix >= 0) expect(kinds.slice(firstNonPrefix).every((k) => k !== 'prefix')).toBe(true);
  });

  it('returns nothing for an empty query', () => {
    expect(search('')).toEqual([]);
    expect(search('   ')).toEqual([]);
  });
});

describe('catalog content', () => {
  it('has between 500 and 900 entries with valid groups', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(500);
    expect(catalog.length).toBeLessThanOrEqual(900);
    for (const e of catalog) {
      expect(e.primary.length).toBeGreaterThanOrEqual(1);
      expect(e.primary.length).toBeLessThanOrEqual(3);
      if (e.type === 'kardio') expect(e.primary).toEqual(['kardio']);
      else expect(e.primary).not.toContain('kardio');
    }
  });
});

describe('youtubeUrl', () => {
  it('uses the English name when present', () => {
    expect(youtubeUrl({ name: 'Höftlyft', nameEn: 'Barbell hip thrust' })).toBe(
      'https://www.youtube.com/results?search_query=Barbell%20hip%20thrust%20exercise',
    );
    expect(youtubeUrl({ name: 'Min övning' })).toContain('Min%20%C3%B6vning%20exercise');
  });
});
