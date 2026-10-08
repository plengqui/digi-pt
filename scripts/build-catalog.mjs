// Validates catalog/source.json, applies catalog/mapping.json and writes src/catalog/catalog.generated.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadMapping, loadSource, validate } from './validate-catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GROUP_ORDER = ['vader', 'lar', 'rumpa', 'rygg', 'mage', 'skuldror', 'axlar', 'biceps', 'triceps', 'brost', 'kardio'];

const source = loadSource();
const mapping = loadMapping();
const errors = validate(source, mapping);
if (errors.length > 0) {
  console.error(`Catalog validation failed with ${errors.length} error(s):`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}

const tagToGroup = new Map();
for (const [group, tags] of Object.entries(mapping)) for (const t of tags) tagToGroup.set(t, group);

const sortGroups = (gs) => [...new Set(gs)].sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));

const out = source.map((e) => {
  const primary = e.type === 'kardio' ? ['kardio'] : sortGroups(e.primary.map((t) => tagToGroup.get(t)));
  const secondary = sortGroups(e.secondary.map((t) => tagToGroup.get(t))).filter((g) => !primary.includes(g));
  return {
    id: e.id,
    name: e.name_sv,
    nameEn: e.name_en,
    aliases: e.aliases,
    type: e.type,
    primary,
    secondary,
    equipment: e.equipment,
    common: e.common,
    description: e.description_sv,
  };
});

out.sort((a, b) => a.common - b.common || a.name.localeCompare(b.name, 'sv'));

const warnings = out.filter((e) => e.primary.length > 2);
for (const w of warnings) console.warn(`warning: ${w.id} maps to ${w.primary.length} groups (${w.primary.join(', ')})`);

const dir = join(root, 'src', 'catalog');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'catalog.generated.json'), JSON.stringify(out));
console.log(`Catalog built: ${out.length} entries (${out.filter((e) => e.type === 'kardio').length} kardio).`);
