// Validates catalog/source.json. Exits non-zero on any error so the build fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const FINE_TAGS = [
  'calves', 'quads', 'hamstrings', 'adductors', 'glutes', 'lower_back', 'lats', 'upper_back', 'traps',
  'front_delts', 'side_delts', 'rear_delts', 'chest', 'biceps', 'triceps', 'forearms', 'abs', 'obliques',
];

export function normalise(s) {
  return s
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/[\s\-_'’.,()]/g, '');
}

export function loadSource() {
  return JSON.parse(readFileSync(join(root, 'catalog', 'source.json'), 'utf8'));
}

export function loadMapping() {
  return JSON.parse(readFileSync(join(root, 'catalog', 'mapping.json'), 'utf8'));
}

/** Returns a list of error strings; empty when valid. */
export function validate(entries, mapping) {
  const errors = [];
  const mappedTags = new Set(Object.values(mapping).flat());
  for (const t of mappedTags) if (!FINE_TAGS.includes(t)) errors.push(`mapping uses unknown tag: ${t}`);
  for (const t of FINE_TAGS) if (!mappedTags.has(t)) errors.push(`mapping does not cover tag: ${t}`);

  const ids = new Map();
  const names = new Map();
  const aliasOwner = new Map(); // normalised alias/name -> id

  const claim = (key, id, what) => {
    const prev = aliasOwner.get(key);
    if (prev !== undefined && prev !== id) errors.push(`${what} "${key}" of ${id} collides with ${prev}`);
    else aliasOwner.set(key, id);
  };

  entries.forEach((e, i) => {
    const where = `#${i} (${e.id ?? '?'})`;
    if (typeof e.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) errors.push(`${where}: bad id`);
    if (ids.has(e.id)) errors.push(`${where}: duplicate id (also #${ids.get(e.id)})`);
    ids.set(e.id, i);
    for (const k of ['name_sv', 'name_en', 'description_sv', 'equipment']) {
      if (typeof e[k] !== 'string' || e[k].trim() === '') errors.push(`${where}: missing ${k}`);
    }
    if (!['styrka', 'kardio'].includes(e.type)) errors.push(`${where}: bad type ${e.type}`);
    if (![1, 2, 3].includes(e.common)) errors.push(`${where}: bad common ${e.common}`);
    if (!Array.isArray(e.primary) || !Array.isArray(e.secondary) || !Array.isArray(e.aliases)) {
      errors.push(`${where}: primary/secondary/aliases must be arrays`);
      return;
    }
    for (const t of [...e.primary, ...e.secondary]) if (!FINE_TAGS.includes(t)) errors.push(`${where}: unknown tag ${t}`);
    if (e.type === 'styrka' && e.primary.length === 0) errors.push(`${where}: strength entry without primary`);
    if (e.type === 'kardio' && (e.primary.length > 0 || e.secondary.length > 0)) errors.push(`${where}: cardio entry with muscles`);
    if (e.primary.length > 3) errors.push(`${where}: more than three primaries`);
    for (const t of e.secondary) if (e.primary.includes(t)) errors.push(`${where}: ${t} is both primary and secondary`);
    if (new Set(e.primary).size !== e.primary.length) errors.push(`${where}: duplicate primary tags`);

    const nameKey = normalise(e.name_sv ?? '');
    if (names.has(nameKey)) errors.push(`${where}: duplicate Swedish name "${e.name_sv}" (also ${names.get(nameKey)})`);
    names.set(nameKey, e.id);
    claim(nameKey, e.id, 'name');
    for (const a of e.aliases) {
      if (typeof a !== 'string' || a.trim() === '') errors.push(`${where}: empty alias`);
      else claim(normalise(a), e.id, 'alias');
    }
  });
  return errors;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const errors = validate(loadSource(), loadMapping());
  if (errors.length > 0) {
    console.error(`Catalog validation failed with ${errors.length} error(s):`);
    for (const e of errors) console.error(' - ' + e);
    process.exit(1);
  }
  console.log('Catalog valid.');
}
